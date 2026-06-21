// ============================================================================
// rendering.js - Node and Connector Rendering
// ============================================================================
// Handles all DOM rendering of nodes and visual elements.

import { state } from './state.js';
import { getDomElements } from './dom.js';
import { getAbsoluteCoords, getContrastingTextColor, getEdgePoint, getNodeDepth } from './utils.js';
import { finishEditingNode, selectNode, startEditingNode, getChildren, isNodeHiddenByCollapsedAncestor, toggleNodeCollapsed } from './nodes.js';
import { selectRelationship, deleteRelationship, startLinkingMode, createRelationship, cancelLinkingMode } from './relationships.js';

/**
 * Main render function - updates all DOM nodes
 */
export function render() {
    const { nodesContainer, svgOverlay } = getDomElements();
    if (!nodesContainer) return;

    if (state.selectedNodeId && isNodeHiddenByCollapsedAncestor(state.selectedNodeId)) {
        let fallbackId = state.selectedNodeId;
        while (fallbackId && isNodeHiddenByCollapsedAncestor(fallbackId)) {
            fallbackId = state.nodes[fallbackId]?.parent || null;
        }
        state.selectedNodeId = fallbackId || "root";
        state.selectedRelationshipId = null;
    }

    nodesContainer.innerHTML = "";

    Object.keys(state.nodes).forEach(nodeId => {
        if (isNodeHiddenByCollapsedAncestor(nodeId)) return;
        renderNode(nodeId);
    });

    // Update sidebar controls for selected node
    updateNodeStyleControls();

    // Re-render connectors
    renderConnectors();
}

/**
 * Render a single node
 */
function renderNode(nodeId) {
    const { nodesContainer } = getDomElements();
    const node = state.nodes[nodeId];

    const coords = getAbsoluteCoords(nodeId);
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "node";
    nodeDiv.id = `node-${nodeId}`;

    // Apply selected state
    if (state.selectedNodeId === nodeId) {
        nodeDiv.classList.add("selected");
    }

    // Apply editing state
    if (state.editingNodeId === nodeId) {
        nodeDiv.classList.add("editing");
    }

    // Position
    nodeDiv.style.left = coords.x + "px";
    nodeDiv.style.top = coords.y + "px";

    // Apply custom background color if set
    if (node.color && node.color.bg) {
        nodeDiv.style.backgroundColor = node.color.bg;
        nodeDiv.style.color = getContrastingTextColor(node.color.bg);
    }

    // Create text content
    const isEditing = state.editingNodeId === nodeId;
    const displayText = isEditing && typeof state.editingBuffer === "string"
        ? state.editingBuffer
        : node.text;
    let content = isEditing
        ? `<span class="node-text editing-text node-text-edit" contenteditable="true" spellcheck="false" role="textbox" aria-label="Edit node text">${escapeHtml(displayText || " ")}</span>`
        : `<span class="node-text">${escapeHtml(displayText || " ")}</span>`;

    // Add comment indicator if present
    if (node.comment) {
        content += `<span class="node-comment-indicator" title="${escapeHtml(node.comment)}">💬</span>`;
    }

    const childCount = getChildren(nodeId).length;
    if (childCount > 0) {
        const isCollapsed = !!node.collapsed;
        const toggleLabel = isCollapsed ? "+" : "-";
        const toggleTitle = isCollapsed ? "Show children" : "Hide children";
        content += `<button class="node-collapse-toggle" type="button" aria-label="${toggleTitle}" title="${toggleTitle}">${toggleLabel}</button>`;
    }

    nodeDiv.innerHTML = content;

    // Attach event listeners
    nodeDiv.addEventListener("pointerdown", (e) => handleNodePointerDown(e, nodeId));
    nodeDiv.addEventListener("dblclick", () => {
        startEditingNode(nodeId);
        render();
    });

    if (isEditing) {
        setTimeout(() => {
            const editor = nodeDiv.querySelector(".node-text-edit");
            if (!editor) return;

            editor.focus();
            const selection = window.getSelection();
            if (selection) {
                const range = document.createRange();
                range.selectNodeContents(editor);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            editor.addEventListener("input", () => {
                state.editingBuffer = editor.textContent || "";
            });

            editor.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    finishEditingNode(nodeId, editor.textContent || "");
                    render();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    state.editingNodeId = null;
                    state.editingBuffer = null;
                    state.editingReplaceOnType = false;
                    render();
                }
            });
        }, 0);
    }

    const collapseToggle = nodeDiv.querySelector(".node-collapse-toggle");
    if (collapseToggle) {
        collapseToggle.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
        });
        collapseToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleNodeCollapsed(nodeId);
            render();
        });
    }

    nodesContainer.appendChild(nodeDiv);
}

/**
 * Update sidebar controls based on selected node/relationship
 */
export function updateNodeStyleControls() {
    const { nodeColorPicker, nodeColorClearBtn, nodeColorPalette, nodeCommentTextarea } = getDomElements();

    let selectedObject = null;
    let selectedColor = null;
    let selectedComment = "";

    if (state.selectedRelationshipId) {
        selectedObject = state.relationships.find(rel => rel.id === state.selectedRelationshipId) || null;
        selectedColor = selectedObject?.color || null;
        selectedComment = selectedObject?.comment || "";
    } else if (state.selectedNodeId && state.nodes[state.selectedNodeId]) {
        selectedObject = state.nodes[state.selectedNodeId];
        selectedColor = selectedObject.color?.bg || null;
        selectedComment = selectedObject.comment || "";
    }

    if (!selectedObject) {
        if (nodeColorPicker) {
            nodeColorPicker.disabled = true;
            nodeColorPicker.value = "#7c3aed";
        }
        if (nodeColorClearBtn) {
            nodeColorClearBtn.style.display = "none";
        }
        if (nodeCommentTextarea) {
            nodeCommentTextarea.disabled = true;
            nodeCommentTextarea.value = "";
        }
        if (nodeColorPalette) {
            nodeColorPalette.querySelectorAll(".color-swatch").forEach((swatch) => {
                swatch.classList.remove("active");
            });
        }
        return;
    }

    if (nodeColorPicker) {
        nodeColorPicker.disabled = false;
        nodeColorPicker.value = selectedColor || "#7c3aed";
    }

    if (nodeColorClearBtn) {
        nodeColorClearBtn.style.display = selectedColor ? "inline-block" : "none";
    }

    if (nodeCommentTextarea) {
        nodeCommentTextarea.disabled = false;
        nodeCommentTextarea.value = selectedComment;
    }

    if (nodeColorPalette) {
        nodeColorPalette.querySelectorAll(".color-swatch").forEach((swatch) => {
            swatch.classList.toggle("active", swatch.getAttribute("data-color") === selectedColor);
        });
    }
}

/**
 * Render connector lines between nodes and relationships
 */
export function renderConnectors() {
    const { svgOverlay, nodesContainer } = getDomElements();
    if (!svgOverlay || !nodesContainer) return;

    const defs = svgOverlay.querySelector("defs");
    svgOverlay.innerHTML = "";
    if (defs) {
        svgOverlay.appendChild(defs);
    }

    nodesContainer.querySelectorAll(".relationship-delete-btn").forEach((button) => button.remove());

    Object.keys(state.nodes).forEach((nodeId) => {
        if (isNodeHiddenByCollapsedAncestor(nodeId)) return;

        const node = state.nodes[nodeId];
        if (!node.parent) return;
        if (isNodeHiddenByCollapsedAncestor(node.parent)) return;

        const childDiv = document.getElementById(`node-${nodeId}`);
        const parentDiv = document.getElementById(`node-${node.parent}`);
        if (!childDiv || !parentDiv) return;

        const childWidth = childDiv.offsetWidth;
        const parentWidth = parentDiv.offsetWidth;
        const childCoords = getAbsoluteCoords(nodeId);
        const parentCoords = getAbsoluteCoords(node.parent);

        let startX;
        let startY;
        let endX;
        let endY;

        if (childCoords.x > parentCoords.x) {
            startX = parentCoords.x + parentWidth / 2;
            startY = parentCoords.y;
            endX = childCoords.x - childWidth / 2;
            endY = childCoords.y;
        } else {
            startX = parentCoords.x - parentWidth / 2;
            startY = parentCoords.y;
            endX = childCoords.x + childWidth / 2;
            endY = childCoords.y;
        }

        const dx = endX - startX;
        const controlOffset = Math.sign(dx) * Math.min(100, Math.abs(dx) * 0.5);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute(
            "d",
            `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`
        );
        path.setAttribute("class", "connector-line");
        svgOverlay.appendChild(path);
    });

    state.relationships.forEach((rel) => {
        if (isNodeHiddenByCollapsedAncestor(rel.fromId) || isNodeHiddenByCollapsedAncestor(rel.toId)) return;

        const fromDiv = document.getElementById(`node-${rel.fromId}`);
        const toDiv = document.getElementById(`node-${rel.toId}`);
        if (!fromDiv || !toDiv) return;

        const fromWidth = fromDiv.offsetWidth;
        const fromHeight = fromDiv.offsetHeight;
        const toWidth = toDiv.offsetWidth;
        const toHeight = toDiv.offsetHeight;
        const fromCoords = getAbsoluteCoords(rel.fromId);
        const toCoords = getAbsoluteCoords(rel.toId);

        const startPort = getEdgePoint(fromCoords, toCoords, fromWidth, fromHeight);
        const endPort = getEdgePoint(toCoords, fromCoords, toWidth, toHeight);
        const dx = endPort.x - startPort.x;
        const dy = endPort.y - startPort.y;
        const length = Math.hypot(dx, dy);
        if (length < 10) return;

        const perpendicularX = -dy / length;
        const perpendicularY = dx / length;
        const offset = Math.min(80, length * 0.2);
        const controlX = (startPort.x + endPort.x) / 2 + perpendicularX * offset;
        const controlY = (startPort.y + endPort.y) / 2 + perpendicularY * offset;
        const pathData = `M ${startPort.x} ${startPort.y} Q ${controlX} ${controlY}, ${endPort.x} ${endPort.y}`;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("class", `relationship-line${rel.id === state.selectedRelationshipId ? " selected" : ""}`);
        path.setAttribute("marker-end", "url(#relationship-arrow)");
        path.setAttribute("stroke", rel.color || "#f43f5e");
        svgOverlay.appendChild(path);

        const overlayPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        overlayPath.setAttribute("d", pathData);
        overlayPath.setAttribute("class", "relationship-line-overlay");
        overlayPath.addEventListener("mouseenter", () => path.classList.add("hovered"));
        overlayPath.addEventListener("mouseleave", () => path.classList.remove("hovered"));
        overlayPath.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            selectRelationship(rel.id);
            render();
        });
        svgOverlay.appendChild(overlayPath);

        if (rel.id === state.selectedRelationshipId) {
            const midX = 0.25 * startPort.x + 0.5 * controlX + 0.25 * endPort.x;
            const midY = 0.25 * startPort.y + 0.5 * controlY + 0.25 * endPort.y;
            const deleteButton = document.createElement("button");
            deleteButton.className = "relationship-delete-btn";
            deleteButton.style.left = `${midX}px`;
            deleteButton.style.top = `${midY}px`;
            deleteButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            deleteButton.title = "Delete Relationship Link";
            deleteButton.addEventListener("pointerdown", (e) => e.stopPropagation());
            deleteButton.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteRelationship(rel.id);
                render();
            });
            nodesContainer.appendChild(deleteButton);
        }
    });

    if (state.draggingNodeId && state.hoveredParentId) {
        const childDiv = document.getElementById(`node-${state.draggingNodeId}`);
        const parentDiv = document.getElementById(`node-${state.hoveredParentId}`);
        if (childDiv && parentDiv) {
            const childWidth = childDiv.offsetWidth;
            const parentWidth = parentDiv.offsetWidth;
            const startCoords = getAbsoluteCoords(state.draggingNodeId, true);
            const childCoords = {
                x: startCoords.x + state.dragDelta.x,
                y: startCoords.y + state.dragDelta.y
            };
            const parentCoords = getAbsoluteCoords(state.hoveredParentId);

            let startX;
            let startY;
            let endX;
            let endY;

            if (childCoords.x > parentCoords.x) {
                startX = parentCoords.x + parentWidth / 2;
                startY = parentCoords.y;
                endX = childCoords.x - childWidth / 2;
                endY = childCoords.y;
            } else {
                startX = parentCoords.x - parentWidth / 2;
                startY = parentCoords.y;
                endX = childCoords.x + childWidth / 2;
                endY = childCoords.y;
            }

            const dx = endX - startX;
            const controlOffset = Math.sign(dx) * Math.min(100, Math.abs(dx) * 0.5);
            const previewPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            previewPath.setAttribute(
                "d",
                `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`
            );
            previewPath.setAttribute("class", "connector-line preview");
            svgOverlay.appendChild(previewPath);
        }
    }

    if (state.linkingSourceId && state.linkingMousePos) {
        const sourceDiv = document.getElementById(`node-${state.linkingSourceId}`);
        if (!sourceDiv) return;

        const sourceWidth = sourceDiv.offsetWidth;
        const sourceHeight = sourceDiv.offsetHeight;
        const sourceCoords = getAbsoluteCoords(state.linkingSourceId);
        const startPort = getEdgePoint(sourceCoords, state.linkingMousePos, sourceWidth, sourceHeight);
        const dx = state.linkingMousePos.x - startPort.x;
        const dy = state.linkingMousePos.y - startPort.y;
        const length = Math.hypot(dx, dy);
        if (length < 1) return;

        const perpendicularX = -dy / length;
        const perpendicularY = dx / length;
        const offset = Math.min(80, length * 0.2);
        const controlX = (startPort.x + state.linkingMousePos.x) / 2 + perpendicularX * offset;
        const controlY = (startPort.y + state.linkingMousePos.y) / 2 + perpendicularY * offset;
        const previewLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
        previewLine.setAttribute(
            "d",
            `M ${startPort.x} ${startPort.y} Q ${controlX} ${controlY}, ${state.linkingMousePos.x} ${state.linkingMousePos.y}`
        );
        previewLine.setAttribute("class", "relationship-line preview");
        previewLine.setAttribute("marker-end", "url(#relationship-arrow)");
        svgOverlay.appendChild(previewLine);
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Handle node pointer down (selection & dragging)
 */
export function handleNodePointerDown(e, nodeId) {
    if (e.button !== 0) return; // Only left-click

    if (e.detail === 2) {
        e.stopPropagation();
        startEditingNode(nodeId);
        render();
        return;
    }

    if (state.editingNodeId === nodeId) return;
    if (state.editingNodeId && state.editingNodeId !== nodeId) {
        const editedNodeId = state.editingNodeId;
        const editedText = typeof state.editingBuffer === "string"
            ? state.editingBuffer
            : state.nodes[editedNodeId]?.text || "";
        finishEditingNode(editedNodeId, editedText);
    }

    e.stopPropagation();

    if (state.linkingSourceId) {
        if (nodeId !== state.linkingSourceId) {
            createRelationship(state.linkingSourceId, nodeId);
        }

        cancelLinkingMode();
        render();
        return;
    }

    selectNode(nodeId);
    render();

    const { workspace } = getDomElements();
    const rect = workspace.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - state.viewportTransform.x) / state.viewportTransform.scale;
    const mouseY = (e.clientY - rect.top - state.viewportTransform.y) / state.viewportTransform.scale;

    state.draggingNodeId = nodeId;
    state.dragStartMouse = { x: mouseX, y: mouseY };
    state.dragStartNodePos = getAbsoluteCoords(nodeId, true);

    workspace.setPointerCapture(e.pointerId);
}

/**
 * Show help modal
 */
export function showHelp(show) {
    const { helpModal } = getDomElements();
    if (!helpModal) return;

    if (show) {
        helpModal.classList.add("active");
    } else {
        helpModal.classList.remove("active");
    }
}
