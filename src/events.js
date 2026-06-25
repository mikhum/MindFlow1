// ============================================================================
// events.js - Event Listeners & Handlers
// ============================================================================
// Centralized event handling for keyboard, mouse, and UI interactions.

import { state } from './state.js';
import { getDomElements } from './dom.js';
import { getAbsoluteCoords, isDescendantOf } from './utils.js';
import { render, renderConnectors, updateNodeStyleControls, showHelp, handleNodePointerDown } from './rendering.js';
import { selectNode, addChildNode, addSiblingNode, deleteNode, finishEditingNode, startEditingNode, setNodeColor, clearNodeColor, setNodeComment, setNodeTextAlign, reparentNode, mirrorSubtreeHorizontally } from './nodes.js';
import {
    handleSaveMap,
    handleSaveAsMap,
    handleSaveToGoogleDrive,
    handleGoogleDriveSignIn,
    handleGoogleDriveSignOut,
    showGoogleClientIdEditor,
    handleGoogleClientIdSave,
    refreshGoogleMapList,
    handleOpenGoogleMap,
    handleDeleteGoogleMap,
    handleNewMap,
    handleOpenMindflow,
    handleImportFile,
    handleImportMindMeisterFile,
    loadMapList,
    saveAutosave
} from './fileIO.js';
import { handleExportDoc, handleExportPdf } from './fileIO.js';
import { zoom, resetViewport, handleWheel } from './viewport.js';
import { navigateGeometrically, centerOnNode, scrollToNode } from './navigation.js';
import { undo, redo, saveHistory } from './history.js';
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

function setupClassicMenuInteractions() {
    const menuBar = document.querySelector('.menu-bar');
    const menuItems = Array.from(document.querySelectorAll('.menu-item'));

    if (!menuBar || menuItems.length === 0) return;

    const closeAllMenus = () => {
        menuItems.forEach((item) => {
            item.classList.remove('open');
            const trigger = item.querySelector('.menu-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    };

    const openMenu = (itemToOpen) => {
        menuItems.forEach((item) => {
            const isOpen = item === itemToOpen;
            item.classList.toggle('open', isOpen);
            const trigger = item.querySelector('.menu-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    };

    menuItems.forEach((item) => {
        const trigger = item.querySelector('.menu-trigger');
        if (!trigger) return;

        trigger.setAttribute('aria-haspopup', 'true');
        trigger.setAttribute('aria-expanded', 'false');

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = item.classList.contains('open');
            if (isOpen) {
                closeAllMenus();
            } else {
                openMenu(item);
            }
        });

        item.addEventListener('mouseenter', () => {
            const hasOpenMenu = menuItems.some((entry) => entry.classList.contains('open'));
            if (hasOpenMenu) {
                openMenu(item);
            }
        });
    });

    document.addEventListener('pointerdown', (e) => {
        if (!menuBar.contains(e.target)) {
            closeAllMenus();
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllMenus();
        }
    });
}

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
        menuOpenHelp,
        btnNewMap,
        btnSaveMap,
        btnSaveAsMap,
        btnSaveGoogleMap,
        btnArrangeMap,
        btnExportDoc,
        btnExportPdf,
        btnOpenMindflow,
        btnImportMindMeister,
        btnGoogleSignin,
        btnGoogleSignout,
        btnGoogleRefresh,
        btnGoogleEditClientId,
        btnGoogleSaveClientId,
        googleClientIdInput,
        googleMapsList,
        topicSearchInput,
        topicSearchPrev,
        topicSearchNext,
        topicSearchStatus,
        fileImportInput,
        fileImportMindMeisterInput,
        nodeColorPicker,
        nodeColorClearBtn,
        nodeColorPalette,
        topicAlignCenter,
        topicAlignLeft,
        nodeCommentTextarea,
        helpModal,
        btnCloseHelpModal,
        btnCloseHelp,
        sidebar
    } = getDomElements();

    setupClassicMenuInteractions();

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
    if (btnHideSidebar && btnShowSidebar && sidebar) {
        btnHideSidebar.addEventListener("click", () => {
            sidebar.classList.add("hidden");
            btnShowSidebar.style.display = "flex";
        });
        btnShowSidebar.addEventListener("click", () => {
            sidebar.classList.remove("hidden");
            btnShowSidebar.style.display = "none";
        });
    }

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
    if (ctrlHelp) {
        ctrlHelp.addEventListener("click", () => showHelp(true));
    }
    if (menuOpenHelp) {
        menuOpenHelp.addEventListener("click", () => showHelp(true));
    }

    // Modals
    btnCloseHelpModal.addEventListener("click", () => showHelp(false));
    btnCloseHelp.addEventListener("click", () => showHelp(false));

    // Map Manager
    btnNewMap.addEventListener("click", () => {
        handleNewMap();
        render();
    });
    btnSaveMap.addEventListener("click", handleSaveMap);
    if (btnSaveAsMap) {
        btnSaveAsMap.addEventListener("click", handleSaveAsMap);
    }
    if (btnSaveGoogleMap) {
        btnSaveGoogleMap.addEventListener("click", () => {
            handleSaveToGoogleDrive();
        });
    }
    if (btnArrangeMap) {
        btnArrangeMap.addEventListener("click", () => {
            layoutImportedMap();
            saveHistory();
            saveAutosave();
            render();
            centerOnNode("root");
        });
    }

    // File Import/Export
    if (btnExportDoc) {
        btnExportDoc.addEventListener("click", handleExportDoc);
    }
    if (btnExportPdf) {
        btnExportPdf.addEventListener("click", handleExportPdf);
    }
    if (btnOpenMindflow) {
        btnOpenMindflow.addEventListener("click", () => {
            handleOpenMindflow();
        });
    }
    if (btnImportMindMeister) {
        btnImportMindMeister.addEventListener("click", () => fileImportMindMeisterInput.click());
    }
    if (btnGoogleSignin) {
        btnGoogleSignin.addEventListener("click", () => {
            handleGoogleDriveSignIn();
        });
    }
    if (btnGoogleSignout) {
        btnGoogleSignout.addEventListener("click", () => {
            handleGoogleDriveSignOut();
        });
    }
    if (btnGoogleRefresh) {
        btnGoogleRefresh.addEventListener("click", () => {
            refreshGoogleMapList(true);
        });
    }
    if (btnGoogleEditClientId) {
        btnGoogleEditClientId.addEventListener("click", () => {
            showGoogleClientIdEditor();
        });
    }
    if (btnGoogleSaveClientId) {
        btnGoogleSaveClientId.addEventListener("click", () => {
            const value = googleClientIdInput?.value || "";
            const saved = handleGoogleClientIdSave(value);
            if (saved) {
                refreshGoogleMapList();
            }
        });
    }
    if (googleClientIdInput) {
        googleClientIdInput.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const saved = handleGoogleClientIdSave(googleClientIdInput.value || "");
            if (saved) {
                refreshGoogleMapList();
            }
        });
    }
    if (googleMapsList) {
        googleMapsList.addEventListener("click", (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            const item = target.closest(".saved-map-item[data-google-file-id]");
            if (!item) return;

            const fileId = item.getAttribute("data-google-file-id");
            if (!fileId) return;

            const deleteBtn = target.closest(".map-action-btn.delete[data-google-file-id]");
            if (deleteBtn) {
                handleDeleteGoogleMap(fileId);
                return;
            }

            handleOpenGoogleMap(fileId);
        });
    }
    fileImportInput.addEventListener("change", handleImportFile);
    fileImportMindMeisterInput.addEventListener("change", handleImportMindMeisterFile);

    if (topicSearchInput) {
        topicSearchInput.addEventListener("input", () => {
            applyTopicSearch(topicSearchInput.value);
        });
        topicSearchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) {
                    goToSearchMatch(-1);
                } else {
                    goToSearchMatch(1);
                }
            }
        });
    }
    if (topicSearchPrev) {
        topicSearchPrev.addEventListener("click", () => goToSearchMatch(-1));
    }
    if (topicSearchNext) {
        topicSearchNext.addEventListener("click", () => goToSearchMatch(1));
    }
    updateSearchStatus(topicSearchStatus);

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

    if (topicAlignCenter) {
        topicAlignCenter.addEventListener("click", () => {
            if (!state.selectedNodeId || state.selectedRelationshipId) return;
            setNodeTextAlign(state.selectedNodeId, "center");
            render();
        });
    }

    if (topicAlignLeft) {
        topicAlignLeft.addEventListener("click", () => {
            if (!state.selectedNodeId || state.selectedRelationshipId) return;
            setNodeTextAlign(state.selectedNodeId, "left");
            render();
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
        (sidebar && sidebar.contains(e.target)) ||
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

    if (state.resizingNodeId) {
        const rect = workspace.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - state.viewportTransform.x) / state.viewportTransform.scale;
        const mouseY = (e.clientY - rect.top - state.viewportTransform.y) / state.viewportTransform.scale;
        const dx = mouseX - state.resizeStartMouse.x;
        const dy = mouseY - state.resizeStartMouse.y;

        const resizedNode = state.nodes[state.resizingNodeId];
        if (resizedNode) {
            const minWidth = 110;
            const minHeight = 36;
            const maxWidth = 900;
            const maxHeight = 520;
            resizedNode.width = Math.max(minWidth, Math.min(maxWidth, Math.round(state.resizeStartSize.width + dx * 2)));
            resizedNode.height = Math.max(minHeight, Math.min(maxHeight, Math.round(state.resizeStartSize.height + dy * 2)));
            render();
        }
        return;
    }

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

    if (state.resizingNodeId) {
        state.resizingNodeId = null;
        state.resizeStartMouse = { x: 0, y: 0 };
        state.resizeStartSize = { width: 0, height: 0 };
        saveHistory();
        render();
        return;
    }

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
    let bestCandidateId = null;
    let bestScore = Infinity;

    // Get the dragged node's current position (including dragDelta)
    const draggedCoords = getAbsoluteCoords(draggedId);
    const draggedDiv = document.getElementById(`node-${draggedId}`);
    if (!draggedDiv) return;
    const draggedWidth = draggedDiv.offsetWidth;
    const draggedHeight = draggedDiv.offsetHeight;

    Object.keys(state.nodes).forEach(nodeId => {
        // Skip the dragged node itself and its direct children (to avoid circular references)
        if (nodeId === draggedId || state.nodes[nodeId]?.parent === draggedId) return;

        const coords = getAbsoluteCoords(nodeId);
        const div = document.getElementById(`node-${nodeId}`);
        if (!div) return;

        const nodeWidth = div.offsetWidth;
        const nodeHeight = div.offsetHeight;

        const tolerance = 12;
        // Check if dragged node's bounds overlap with target node's bounds (with tolerance)
        if (
            draggedCoords.x + draggedWidth / 2 >= coords.x - nodeWidth / 2 - tolerance &&
            draggedCoords.x - draggedWidth / 2 <= coords.x + nodeWidth / 2 + tolerance &&
            draggedCoords.y + draggedHeight / 2 >= coords.y - nodeHeight / 2 - tolerance &&
            draggedCoords.y - draggedHeight / 2 <= coords.y + nodeHeight / 2 + tolerance
        ) {
            // Score based on distance between centers
            const score = Math.abs(draggedCoords.x - coords.x) + Math.abs(draggedCoords.y - coords.y);
            if (score < bestScore) {
                bestScore = score;
                bestCandidateId = nodeId;
            }
        }
    });

    // Remove potential-parent from all nodes first
    Object.keys(state.nodes).forEach(nodeId => {
        const div = document.getElementById(`node-${nodeId}`);
        if (div) div.classList.remove("potential-parent");
    });

    // Add potential-parent to the best candidate
    if (bestCandidateId) {
        const bestDiv = document.getElementById(`node-${bestCandidateId}`);
        if (bestDiv) bestDiv.classList.add("potential-parent");
    }

    state.hoveredParentId = bestCandidateId;
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

    // Only reparent if hoveredParentId was explicitly set by checkPotentialParent
    // (i.e. the dragged node's center was strictly within a target node's bounds).
    const dropParentId = state.hoveredParentId || null;

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
    const { topicSearchInput } = getDomElements();
    const activeElement = document.activeElement;
    const isInputFocused = !!activeElement && (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT" ||
        activeElement.isContentEditable
    );

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (topicSearchInput) {
            topicSearchInput.focus();
            topicSearchInput.select();
        }
        return;
    }

    if (isInputFocused && !state.editingNodeId) {
        return;
    }

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

function applyTopicSearch(rawQuery) {
    const query = String(rawQuery || "").trim().toLowerCase();
    state.topicSearchQuery = rawQuery || "";

    if (!query) {
        state.topicSearchMatches = [];
        state.topicSearchIndex = -1;
        render();
        updateSearchStatus();
        return;
    }

    state.topicSearchMatches = Object.keys(state.nodes).filter((nodeId) => {
        const nodeText = String(state.nodes[nodeId]?.text || "").toLowerCase();
        return nodeText.includes(query);
    });

    state.topicSearchIndex = state.topicSearchMatches.length > 0 ? 0 : -1;
    focusCurrentSearchMatch();
    updateSearchStatus();
}

function goToSearchMatch(direction) {
    const query = String(state.topicSearchQuery || "").trim().toLowerCase();
    if (!query) return;

    // Recompute against latest node texts in case map content changed after initial search.
    state.topicSearchMatches = Object.keys(state.nodes).filter((nodeId) => {
        const nodeText = String(state.nodes[nodeId]?.text || "").toLowerCase();
        return nodeText.includes(query);
    });

    if (state.topicSearchMatches.length === 0) {
        state.topicSearchIndex = -1;
        render();
        updateSearchStatus();
        return;
    }

    const currentIndex = state.topicSearchIndex >= 0 ? state.topicSearchIndex : 0;
    const count = state.topicSearchMatches.length;
    state.topicSearchIndex = (currentIndex + direction + count) % count;
    focusCurrentSearchMatch();
    updateSearchStatus();
}

function focusCurrentSearchMatch() {
    const nodeId = state.topicSearchMatches[state.topicSearchIndex];
    if (!nodeId || !state.nodes[nodeId]) {
        render();
        return;
    }

    revealNodeForSearch(nodeId);
    state.selectedNodeId = nodeId;
    state.selectedRelationshipId = null;
    render();
    scrollToNode(nodeId);
}

function revealNodeForSearch(nodeId) {
    let currentParentId = state.nodes[nodeId]?.parent;
    while (currentParentId && state.nodes[currentParentId]) {
        state.nodes[currentParentId].collapsed = false;
        currentParentId = state.nodes[currentParentId].parent;
    }
}

function updateSearchStatus(explicitStatusEl = null) {
    const { topicSearchStatus } = getDomElements();
    const statusEl = explicitStatusEl || topicSearchStatus;
    if (!statusEl) return;

    const query = String(state.topicSearchQuery || "").trim();
    if (!query) {
        statusEl.textContent = "No active search.";
        return;
    }

    if (state.topicSearchMatches.length === 0) {
        statusEl.textContent = "No matches found.";
        return;
    }

    statusEl.textContent = `${state.topicSearchIndex + 1} of ${state.topicSearchMatches.length} matches`;
}
