// ============================================================================
// events.js - Event Listeners & Handlers
// ============================================================================
// Centralized event handling for keyboard, mouse, and UI interactions.

import { state } from './state.js';
import { getDomElements } from './dom.js';
import { getAbsoluteCoords, isDescendantOf } from './utils.js';
import { render, renderConnectors, updateNodeStyleControls, showHelp, handleNodePointerDown } from './rendering.js';
import { selectNode, addChildNode, addSiblingNode, deleteNode, finishEditingNode, startEditingNode, setNodeColor, clearNodeColor, setNodeComment, reparentNode, mirrorSubtreeHorizontally } from './nodes.js';
import { handleSaveMap, handleNewMap, handleExportFile, handleImportFile, handleImportMindMeisterFile, loadMapList, saveAutosave } from './fileIO.js';
import { handleExportDoc } from './fileIO.js';
import { zoom, resetViewport, handleWheel } from './viewport.js';
import { navigateGeometrically, centerOnNode, scrollToNode } from './navigation.js';
import { undo, redo } from './history.js';
import { layoutImportedMap } from './layout.js';
import {
    selectRelationship,
    deleteRelationship,
    startLinkingMode,
    cancelLinkingMode,
    createRelationship,
    setRelationshipColor,
    clearRelationshipColor,
    setRelationshipComment
} from './relationships.js';
import { updateCanvasTransform } from './viewport.js';

/**
 * Setup all event listeners
 */
export function setupEventListeners() {
    const {
        workspace,
        canvas,
        btnHideSidebar,
        btnShowSidebar,
        ctrlZoomIn,
        ctrlZoomOut,
        ctrlResetView,
        ctrlAddChild,
        ctrlAddRelationship,
        ctrlDeleteNode,
        ctrlHelp,
        btnNewMap,
        btnSaveMap,
        btnArrangeMap,
        btnExportFile,
        btnExportDoc,
        btnOpenMindmap,
        btnImportFile,
        btnImportMindMeister,
        fileImportInput,
        fileImportMindMeisterInput,
        nodeColorPicker,
        nodeColorClearBtn,
        nodeColorPalette,
        nodeCommentTextarea,
        helpModal,
        btnCloseHelpModal,
        btnCloseHelp,
        sidebar
    } = getDomElements();

    // Canvas zooming (Wheel)
    workspace.addEventListener("wheel", handleWheel, { passive: false });

    // Canvas panning (Pointer)
    workspace.addEventListener("pointerdown", handleWorkspacePointerDown);
    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);

    // Global Key Events
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handleGlobalPointerDown, true);

    // Sidebar Toggling
    btnHideSidebar.addEventListener("click", () => {
        sidebar.classList.add("hidden");
        btnShowSidebar.style.display = "flex";
    });
    btnShowSidebar.addEventListener("click", () => {
        sidebar.classList.remove("hidden");
        btnShowSidebar.style.display = "none";
    });

    // Floating Control Buttons
    ctrlZoomIn.addEventListener("click", () => zoom(1.1));
    ctrlZoomOut.addEventListener("click", () => zoom(0.9));
    ctrlResetView.addEventListener("click", resetViewport);
    ctrlAddChild.addEventListener("click", () => {
        addChildNode(state.selectedNodeId);
        render();
    });
    ctrlAddRelationship.addEventListener("click", () => {
        if (state.selectedNodeId) startLinkingMode(state.selectedNodeId);
    });
    ctrlDeleteNode.addEventListener("click", () => {
        if (state.selectedNodeId) {
            deleteNode(state.selectedNodeId);
            render();
        } else if (state.selectedRelationshipId) {
            deleteRelationship(state.selectedRelationshipId);
            render();
        }
    });
    ctrlHelp.addEventListener("click", () => showHelp(true));

    // Modals
    btnCloseHelpModal.addEventListener("click", () => showHelp(false));
    btnCloseHelp.addEventListener("click", () => showHelp(false));

    // Map Manager
    btnNewMap.addEventListener("click", () => {
        handleNewMap();
        render();
    });
    btnSaveMap.addEventListener("click", handleSaveMap);
    if (btnArrangeMap) {
        btnArrangeMap.addEventListener("click", () => {
            layoutImportedMap();
            render();
            centerOnNode("root");
        });
    }

    // File Import/Export
    btnExportFile.addEventListener("click", handleExportFile);
    if (btnExportDoc) {
        btnExportDoc.addEventListener("click", handleExportDoc);
    }
    if (btnOpenMindmap) {
        btnOpenMindmap.addEventListener("click", () => fileImportInput.click());
    }
    btnImportFile.addEventListener("click", () => fileImportInput.click());
    if (btnImportMindMeister) {
        btnImportMindMeister.addEventListener("click", () => fileImportMindMeisterInput.click());
    }
    fileImportInput.addEventListener("change", handleImportFile);
    fileImportMindMeisterInput.addEventListener("change", handleImportMindMeisterFile);

    // Node color controls
    if (nodeColorPicker) {
        nodeColorPicker.addEventListener("input", (e) => {
            if (state.selectedRelationshipId) {
                setRelationshipColor(state.selectedRelationshipId, e.target.value);
            } else {
                setNodeColor(state.selectedNodeId, e.target.value);
            }
            render();
        });
    }
    if (nodeColorClearBtn) {
        nodeColorClearBtn.addEventListener("click", () => {
            if (state.selectedRelationshipId) {
                clearRelationshipColor(state.selectedRelationshipId);
            } else {
                clearNodeColor(state.selectedNodeId);
            }
            render();
        });
    }
    if (nodeColorPalette) {
        nodeColorPalette.addEventListener("click", (e) => {
            if (e.target.classList.contains("color-swatch")) {
                const color = e.target.getAttribute("data-color");
                if (state.selectedRelationshipId) {
                    setRelationshipColor(state.selectedRelationshipId, color);
                } else {
                    setNodeColor(state.selectedNodeId, color);
                }
                render();
            }
        });
    }
    if (nodeCommentTextarea) {
        nodeCommentTextarea.addEventListener("input", (e) => {
            if (state.selectedRelationshipId) {
                setRelationshipComment(state.selectedRelationshipId, e.target.value);
            } else {
                setNodeComment(state.selectedNodeId, e.target.value);
            }
        });
    }

    // Resize viewport
    window.addEventListener("resize", renderConnectors);
}

function commitActiveEdit() {
    const editingNodeId = state.editingNodeId;
    if (!editingNodeId || !state.nodes[editingNodeId]) {
        state.editingNodeId = null;
        state.editingBuffer = null;
        state.editingReplaceOnType = false;
        return false;
    }

    const finalText = typeof state.editingBuffer === "string"
        ? state.editingBuffer
        : state.nodes[editingNodeId].text;
    finishEditingNode(editingNodeId, finalText);
    return true;
}

function handleGlobalPointerDown(e) {
    if (!state.editingNodeId) return;

    const target = e.target;
    if (target.closest(".node")) return;

    if (commitActiveEdit()) {
        render();
    }
}

/**
 * Handle workspace pointer down (panning)
 */
function handleWorkspacePointerDown(e) {
    if (state.editingNodeId) {
        if (commitActiveEdit()) {
            render();
        }
        return;
    }

    if (state.linkingSourceId) {
        cancelLinkingMode();
        return;
    }

    // Clear relationship selection on background click
    if (state.selectedRelationshipId) {
        state.selectedRelationshipId = null;
        render();
    }

    // Avoid panning if click is on a node, button, or relationship overlay
    const { sidebar } = getDomElements();
    if (
        e.target.closest(".node") ||
        e.target.closest(".floating-controls") ||
        sidebar.contains(e.target) ||
        e.target.closest(".relationship-delete-btn")
    ) {
        return;
    }

    state.isPanning = true;
    const { canvas } = getDomElements();
    canvas.classList.add("grabbing");
    state.panStart = { x: e.clientX, y: e.clientY };
    state.panOffset = { x: state.viewportTransform.x, y: state.viewportTransform.y };
    const { workspace } = getDomElements();
    workspace.setPointerCapture(e.pointerId);
}

/**
 * Handle global pointer move
 */
function handleGlobalPointerMove(e) {
    const { workspace } = getDomElements();
    if (state.linkingSourceId) {
        const rect = workspace.getBoundingClientRect();
        state.linkingMousePos = {
            x: (e.clientX - rect.left - state.viewportTransform.x) / state.viewportTransform.scale,
            y: (e.clientY - rect.top - state.viewportTransform.y) / state.viewportTransform.scale
        };
        renderConnectors();
        return;
    }

    if (state.draggingNodeId) {
        const rect = workspace.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - state.viewportTransform.x) / state.viewportTransform.scale;
        const mouseY = (e.clientY - rect.top - state.viewportTransform.y) / state.viewportTransform.scale;

        state.dragDelta = {
            x: mouseX - state.dragStartMouse.x,
            y: mouseY - state.dragStartMouse.y
        };

        // Check for potential parent during drag
        checkPotentialParent(state.draggingNodeId, mouseX, mouseY);

        render();
        renderConnectors();
        return;
    }

    if (state.isPanning) {
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;

        state.viewportTransform.x = state.panOffset.x + dx;
        state.viewportTransform.y = state.panOffset.y + dy;

        updateCanvasTransform();
    }
}

/**
 * Handle global pointer up
 */
function handleGlobalPointerUp(e) {
    const { canvas } = getDomElements();
    if (state.isPanning) {
        state.isPanning = false;
        canvas.classList.remove("grabbing");
    }

    if (state.draggingNodeId) {
        finishDraggingNode(e);
    }
}

/**
 * Check for potential parent node during drag
 */
function checkPotentialParent(draggedId, absX, absY) {
    state.hoveredParentId = null;

    Object.keys(state.nodes).forEach(nodeId => {
        if (nodeId === draggedId || isDescendantOf(draggedId, nodeId)) return;

        const coords = getAbsoluteCoords(nodeId);
        const div = document.getElementById(`node-${nodeId}`);
        if (!div) return;

        const nodeWidth = div.offsetWidth;
        const nodeHeight = div.offsetHeight;
        const tolerance = 50;

        if (
            absX >= coords.x - nodeWidth / 2 - tolerance &&
            absX <= coords.x + nodeWidth / 2 + tolerance &&
            absY >= coords.y - nodeHeight / 2 - tolerance &&
            absY <= coords.y + nodeHeight / 2 + tolerance
        ) {
            state.hoveredParentId = nodeId;
            div.classList.add("potential-parent");
        } else {
            div.classList.remove("potential-parent");
        }
    });
}

/**
 * Finish dragging node
 */
function finishDraggingNode(e) {
    const draggedNodeId = state.draggingNodeId;
    const rootX = getAbsoluteCoords("root", true).x;
    const dragStartSide = Math.sign(state.dragStartNodePos.x - rootX);

    const { workspace } = getDomElements();
    const rect = workspace.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - state.viewportTransform.x) / state.viewportTransform.scale;
    const mouseY = (e.clientY - rect.top - state.viewportTransform.y) / state.viewportTransform.scale;

    Object.keys(state.nodes).forEach(nodeId => {
        const div = document.getElementById(`node-${nodeId}`);
        if (div) div.classList.remove("potential-parent");
    });

    const droppedAbsPos = {
        x: state.dragStartNodePos.x + state.dragDelta.x,
        y: state.dragStartNodePos.y + state.dragDelta.y
    };

    // Prefer explicit hover target, but fall back to the node under cursor at drop time.
    let dropParentId = state.hoveredParentId;
    if (!dropParentId) {
        const draggedDiv = document.getElementById(`node-${draggedNodeId}`);
        let previousPointerEvents = "";
        if (draggedDiv) {
            previousPointerEvents = draggedDiv.style.pointerEvents;
            draggedDiv.style.pointerEvents = "none";
        }

        const dropElement = document.elementFromPoint(e.clientX, e.clientY);
        const dropNode = dropElement?.closest?.(".node");
        if (dropNode && dropNode.id && dropNode.id.startsWith("node-")) {
            const candidateParentId = dropNode.id.slice(5);
            if (
                candidateParentId &&
                candidateParentId !== draggedNodeId &&
                !isDescendantOf(candidateParentId, draggedNodeId)
            ) {
                dropParentId = candidateParentId;
            }
        }

        if (draggedDiv) {
            draggedDiv.style.pointerEvents = previousPointerEvents;
        }
    }

    // If a valid parent target was found, reparent.
    if (dropParentId) {
        reparentNode(draggedNodeId, dropParentId, droppedAbsPos);
    } else {
        // Otherwise, update position
        const parentCoords = state.nodes[draggedNodeId].parent
            ? getAbsoluteCoords(state.nodes[draggedNodeId].parent, true)
            : { x: 0, y: 0 };

        state.nodes[draggedNodeId].x = state.dragStartNodePos.x + state.dragDelta.x - parentCoords.x;
        state.nodes[draggedNodeId].y = state.dragStartNodePos.y + state.dragDelta.y - parentCoords.y;
    }

    // If the moved topic crosses root's vertical axis, mirror its subtree.
    const dragEndSide = Math.sign(getAbsoluteCoords(draggedNodeId, true).x - rootX);
    if (dragStartSide !== 0 && dragEndSide !== 0 && dragStartSide !== dragEndSide) {
        mirrorSubtreeHorizontally(draggedNodeId);
    }

    state.draggingNodeId = null;
    state.dragDelta = { x: 0, y: 0 };
    state.hoveredParentId = null;

    render();
    renderConnectors();
}

/**
 * Handle keyboard input
 */
function handleKeyDown(e) {
    const isEditing = state.editingNodeId !== null;

    if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
            e.preventDefault();
            undo();
            render();
            renderConnectors();
        } else if (e.key === "y") {
            e.preventDefault();
            redo();
            render();
            renderConnectors();
        }
        return;
    }

    if (isEditing) {
        if (e.key === "Enter") {
            e.preventDefault();
            const editedNodeId = state.editingNodeId;
            if (commitActiveEdit() && editedNodeId) {
                addSiblingNode(editedNodeId);
                render();
            }
            return;
        }

        if (e.key === "Tab") {
            e.preventDefault();
            const editedNodeId = state.editingNodeId;
            if (commitActiveEdit() && editedNodeId) {
                addChildNode(editedNodeId);
                render();
            }
            return;
        }

        if (e.key === "Escape") {
            e.preventDefault();
            state.editingNodeId = null;
            state.editingBuffer = null;
            state.editingReplaceOnType = false;
            render();
            return;
        }

        return;
    }

    if (state.selectedNodeId && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        e.preventDefault();
        startEditingNode(state.selectedNodeId);
        state.editingBuffer = e.key;
        state.editingReplaceOnType = false;
        render();
        return;
    }

    switch (e.key) {
        case "Tab":
            e.preventDefault();
            const childId = addChildNode(state.selectedNodeId);
            render();
            break;

        case "Enter":
            e.preventDefault();
            if (state.selectedNodeId) {
                if (state.selectedNodeId === "root") {
                    addChildNode(state.selectedNodeId);
                    render();
                } else {
                    addSiblingNode(state.selectedNodeId);
                    render();
                }
            }
            break;

        case "F2":
            e.preventDefault();
            if (state.selectedNodeId) {
                startEditingNode(state.selectedNodeId);
                render();
            }
            break;

        case "ArrowUp":
            e.preventDefault();
            navigateGeometrically("up");
            render();
            break;

        case "ArrowDown":
            e.preventDefault();
            navigateGeometrically("down");
            render();
            break;

        case "ArrowLeft":
            e.preventDefault();
            navigateGeometrically("left");
            render();
            break;

        case "ArrowRight":
            e.preventDefault();
            navigateGeometrically("right");
            render();
            break;

        case "Delete":
        case "Backspace":
            e.preventDefault();
            if (state.selectedNodeId && state.selectedNodeId !== "root") {
                deleteNode(state.selectedNodeId);
                render();
            } else if (state.selectedRelationshipId) {
                deleteRelationship(state.selectedRelationshipId);
                render();
            }
            break;

        case "Escape":
            e.preventDefault();
            selectNode("root");
            render();
            break;

        case " ":
            e.preventDefault();
            centerOnNode(state.selectedNodeId);
            break;

        case "h":
        case "H":
            if (!e.ctrlKey && !e.metaKey) {
                showHelp(true);
            }
            break;

        case "l":
        case "L":
            e.preventDefault();
            if (state.selectedNodeId) {
                startLinkingMode(state.selectedNodeId);
                render();
                renderConnectors();
            }
            break;
    }
}
