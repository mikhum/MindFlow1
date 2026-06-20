// MindFlow - Core Mindmap Logic

// --- Application State ---
let nodes = {
    "root": { id: "root", text: "Central Topic", parent: null, x: 0, y: 0 }
};
let relationships = [];

let selectedNodeId = "root";
let editingNodeId = null;

// Viewport panning and zooming state
let viewportTransform = { x: 0, y: 0, scale: 1 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };

// Dragging node state
let draggingNodeId = null;
let dragStartMouse = { x: 0, y: 0 };
let dragStartNodePos = { x: 0, y: 0 };
let dragDelta = { x: 0, y: 0 };
let hoveredParentId = null;

// Relationship link states
let linkingSourceId = null;
let linkingMousePos = null;
let selectedRelationshipId = null;

// History for Undo/Redo
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

let currentMapName = "";
let saveFileHandle = null;

// --- DOM References ---
const workspace = document.getElementById("workspace");
const canvas = document.getElementById("canvas");
const nodesContainer = document.getElementById("nodes-container");
const svgOverlay = document.getElementById("svg-overlay");
const zoomIndicator = document.getElementById("zoom-indicator");

// Floating Controls
const ctrlZoomIn = document.getElementById("ctrl-zoom-in");
const ctrlZoomOut = document.getElementById("ctrl-zoom-out");
const ctrlResetView = document.getElementById("ctrl-reset-view");
const ctrlAddChild = document.getElementById("ctrl-add-child");
const ctrlAddRelationship = document.getElementById("ctrl-add-relationship");
const ctrlDeleteNode = document.getElementById("ctrl-delete-node");
const ctrlHelp = document.getElementById("ctrl-help");

// Sidebar Elements
const sidebar = document.getElementById("sidebar");
const btnHideSidebar = document.getElementById("hide-sidebar");
const btnShowSidebar = document.getElementById("show-sidebar");
const btnNewMap = document.getElementById("btn-new-map");
const btnSaveMap = document.getElementById("btn-save-map");
const btnArrangeMap = document.getElementById("btn-arrange-map");
const savedMapsList = document.getElementById("saved-maps-list");
const btnExportFile = document.getElementById("btn-export-file");
const btnExportDoc = document.getElementById("btn-export-doc");
const btnOpenMindflow = document.getElementById("btn-open-mindflow");
const btnImportFile = document.getElementById("btn-import-file");
const btnImportMindMeister = document.getElementById("btn-import-mindmeister");
const fileImportInput = document.getElementById("file-import-input");
const fileImportMindMeisterInput = document.getElementById("file-import-mindmeister-input");
const nodeColorPicker = document.getElementById("node-color-picker");
const nodeColorClearBtn = document.getElementById("node-color-clear");
const nodeColorPalette = document.getElementById("node-color-palette");
const nodeCommentTextarea = document.getElementById("node-comment");

// Modals
const helpModal = document.getElementById("help-modal");
const btnCloseHelpModal = document.getElementById("close-help-modal");
const btnCloseHelp = document.getElementById("btn-close-help");

// --- Initialization ---
function init() {
    setupEventListeners();
    loadMapList();
    
    // Check if there was a map saved as "autosave"
    const autosave = localStorage.getItem("mindflow_autosave");
    if (autosave) {
        try {
            const data = JSON.parse(autosave);
            if (data && data.nodes && data.nodes.root) {
                nodes = data.nodes;
                relationships = data.relationships || [];
                currentMapName = data.name || "";
            }
        } catch (e) {
            console.error("Failed to load autosave map:", e);
        }
    }

    // Ensure we have a valid root node
    if (!nodes || !nodes.root) {
        nodes = {
            "root": { id: "root", text: "Central Topic", parent: null, x: 0, y: 0 }
        };
        relationships = [];
    }
    
    saveHistory(); // Save initial state
    render();
    centerOnNode("root");

    // Delayed redraw to calculate accurate node sizes once browser layout completes
    setTimeout(() => {
        renderConnectors();
    }, 150);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Canvas Zooming (Wheel)
    workspace.addEventListener("wheel", handleWheel, { passive: false });

    // Canvas Panning (Pointer)
    workspace.addEventListener("pointerdown", handleWorkspacePointerDown);
    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);

    // Global Key Events
    window.addEventListener("keydown", handleKeyDown);

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
    ctrlResetView.addEventListener("click", () => {
        viewportTransform = { x: 0, y: 0, scale: 1 };
        updateCanvasTransform();
    });
    ctrlAddChild.addEventListener("click", () => addChildNode(selectedNodeId));
    ctrlAddRelationship.addEventListener("click", () => {
        if (selectedNodeId) startLinkingMode(selectedNodeId);
    });
    ctrlDeleteNode.addEventListener("click", () => {
        if (selectedNodeId) {
            deleteNode(selectedNodeId);
        } else if (selectedRelationshipId) {
            deleteRelationship(selectedRelationshipId);
        }
    });
    ctrlHelp.addEventListener("click", () => showHelp(true));

    // Modals
    btnCloseHelpModal.addEventListener("click", () => showHelp(false));
    btnCloseHelp.addEventListener("click", () => showHelp(false));

    // Map Manager
    btnNewMap.addEventListener("click", handleNewMap);
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
    if (btnOpenMindflow) {
        btnOpenMindflow.addEventListener("click", () => fileImportInput.click());
    }
    btnImportFile.addEventListener("click", () => fileImportInput.click());
    if (btnImportMindMeister) {
        btnImportMindMeister.addEventListener("click", () => fileImportMindMeisterInput.click());
    }
    fileImportInput.addEventListener("change", handleImportFile);
    fileImportMindMeisterInput.addEventListener("change", handleImportMindMeisterFile);

    // Node color controls
    if (nodeColorPicker) {
        nodeColorPicker.addEventListener("input", handleNodeColorChange);
    }
    if (nodeColorClearBtn) {
        nodeColorClearBtn.addEventListener("click", handleClearNodeColor);
    }
    if (nodeColorPalette) {
        nodeColorPalette.addEventListener("click", handleNodeColorPaletteClick);
    }
    if (nodeCommentTextarea) {
        nodeCommentTextarea.addEventListener("input", handleNodeCommentChange);
    }

    // Resize viewport
    window.addEventListener("resize", () => {
        renderConnectors();
    });
}

// --- Viewport Panning & Zooming ---
function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = 1.08;
    const direction = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    
    // Zoom to mouse cursor
    const rect = workspace.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse position to canvas coordinates before zoom
    const canvasMouseX = (mouseX - viewportTransform.x) / viewportTransform.scale;
    const canvasMouseY = (mouseY - viewportTransform.y) / viewportTransform.scale;

    // Calculate new zoom scale
    let newScale = viewportTransform.scale * direction;
    newScale = Math.max(0.15, Math.min(3.0, newScale)); // limit zoom

    // Calculate new offsets to keep mouse position anchored
    viewportTransform.scale = newScale;
    viewportTransform.x = mouseX - canvasMouseX * newScale;
    viewportTransform.y = mouseY - canvasMouseY * newScale;

    updateCanvasTransform();
}

function handleWorkspacePointerDown(e) {
    if (linkingSourceId) {
        cancelLinkingMode();
        return;
    }
    
    // Clear relationship selection on background click
    if (selectedRelationshipId) {
        selectedRelationshipId = null;
        render();
    }
    
    // Avoid panning if click is on a node, button, or relationship overlay
    if (e.target.closest(".node") || e.target.closest(".floating-controls") || e.target.closest(".sidebar") || e.target.closest(".relationship-delete-btn")) {
        return;
    }
    isPanning = true;
    canvas.classList.add("grabbing");
    panStart = { x: e.clientX, y: e.clientY };
    panOffset = { x: viewportTransform.x, y: viewportTransform.y };
    workspace.setPointerCapture(e.pointerId);
}

function handleGlobalPointerMove(e) {
    if (linkingSourceId) {
        const rect = workspace.getBoundingClientRect();
        linkingMousePos = {
            x: (e.clientX - rect.left - viewportTransform.x) / viewportTransform.scale,
            y: (e.clientY - rect.top - viewportTransform.y) / viewportTransform.scale
        };
        renderConnectors();
        return;
    }
    
    if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        viewportTransform.x = panOffset.x + dx;
        viewportTransform.y = panOffset.y + dy;
        updateCanvasTransform();
    } else if (draggingNodeId) {
        // Calculate dragging in canvas space (accounting for scale)
        const dx = (e.clientX - dragStartMouse.x) / viewportTransform.scale;
        const dy = (e.clientY - dragStartMouse.y) / viewportTransform.scale;
        
        dragDelta = { x: dx, y: dy };
        
        // Update visual position of dragged node and all its descendants
        Object.keys(nodes).forEach(id => {
            if (isDescendantOf(id, draggingNodeId)) {
                const el = document.getElementById("node-" + id);
                if (el) {
                    const abs = getAbsoluteCoords(id);
                    el.style.left = `${abs.x}px`;
                    el.style.top = `${abs.y}px`;
                }
            }
        });
        
        // Search for potential parent nodes using current absolute coordinates
        const dragNodeAbs = getAbsoluteCoords(draggingNodeId);
        checkPotentialParent(draggingNodeId, dragNodeAbs.x, dragNodeAbs.y);
        
        // Redraw connections dynamically during drag
        renderConnectors();
    }
}

function handleGlobalPointerUp(e) {
    if (isPanning) {
        isPanning = false;
        canvas.classList.remove("grabbing");
        try {
            workspace.releasePointerCapture(e.pointerId);
        } catch(err) {}
    } else if (draggingNodeId) {
        finishDraggingNode(e);
    }
}

function updateCanvasTransform() {
    canvas.style.transform = `translate(${viewportTransform.x}px, ${viewportTransform.y}px) scale(${viewportTransform.scale})`;
    zoomIndicator.textContent = `${Math.round(viewportTransform.scale * 100)}%`;
}

// --- Coordinates Helper ---
// Returns absolute coordinates relative to the canvas center (0,0)
function getAbsoluteCoords(nodeId, ignoreDragDelta = false) {
    const node = nodes[nodeId];
    if (!node) return { x: 0, y: 0 };
    
    let absX = node.x;
    let absY = node.y;
    
    // Walk up the parent tree
    let currentParentId = node.parent;
    while (currentParentId) {
        const parent = nodes[currentParentId];
        if (!parent) break;
        absX += parent.x;
        absY += parent.y;
        currentParentId = parent.parent;
    }
    
    // Add drag delta if requested and if this node (or one of its ancestors) is being dragged
    if (!ignoreDragDelta && draggingNodeId) {
        if (isDescendantOf(nodeId, draggingNodeId)) {
            absX += dragDelta.x;
            absY += dragDelta.y;
        }
    }
    
    return { x: absX, y: absY };
}

// Checks if a node is a descendant of another node (or the node itself)
function isDescendantOf(nodeId, potentialAncestorId) {
    if (nodeId === potentialAncestorId) return true;
    let currentId = nodes[nodeId]?.parent;
    while (currentId) {
        if (currentId === potentialAncestorId) return true;
        currentId = nodes[currentId]?.parent;
    }
    return false;
}

// --- Node Rendering and Updates ---
function render() {
    // Remove deleted nodes from DOM
    const existingNodeElements = nodesContainer.querySelectorAll(".node");
    const nodeIds = Object.keys(nodes);
    
    existingNodeElements.forEach(el => {
        const id = el.id.replace("node-", "");
        if (!nodes[id]) {
            el.remove();
        }
    });

    // Remove old relationship delete buttons
    const oldDeleteBtns = nodesContainer.querySelectorAll(".relationship-delete-btn");
    oldDeleteBtns.forEach(btn => btn.remove());

    // Render / Update existing nodes
    nodeIds.forEach(id => {
        let nodeEl = document.getElementById("node-" + id);
        const node = nodes[id];
        
        if (!nodeEl) {
            // Create new DOM element for node
            nodeEl = document.createElement("div");
            nodeEl.id = "node-" + id;
            nodeEl.className = "node";
            
            const textSpan = document.createElement("span");
            textSpan.className = "node-text";
            nodeEl.appendChild(textSpan);
            
            // Pointer Down for Selection & Dragging
            nodeEl.addEventListener("pointerdown", (e) => handleNodePointerDown(e, id));
            
            // Double Click for Text Editing
            nodeEl.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                startEditingNode(id);
            });
            
            nodesContainer.appendChild(nodeEl);
        }

        // Apply depth styling
        const depth = getNodeDepth(id);
        // Reset depth classes
        nodeEl.className = "node";
        nodeEl.classList.add(`node-depth-${Math.min(depth, 2)}`);
        
        if (id === selectedNodeId) {
            nodeEl.classList.add("selected");
        }
        
        if (id === hoveredParentId) {
            nodeEl.classList.add("potential-parent");
        }

        // Set Text (if not editing)
        if (editingNodeId !== id) {
            const textSpan = nodeEl.querySelector(".node-text");
            textSpan.textContent = node.text;
        }

        // Apply custom node color if present
        if (node.color) {
            nodeEl.style.backgroundColor = node.color;
            nodeEl.style.color = getContrastingTextColor(node.color);
        } else {
            nodeEl.style.backgroundColor = "";
            nodeEl.style.color = "";
        }

        // Position node (if not currently dragging)
        if (draggingNodeId !== id || dragDelta.x === 0) {
            const abs = getAbsoluteCoords(id);
            nodeEl.style.left = `${abs.x}px`;
            nodeEl.style.top = `${abs.y}px`;
        }
    });

    updateNodeStyleControls();
    renderConnectors();
    saveAutosave();
}

function getNodeDepth(nodeId) {
    let depth = 0;
    let parentId = nodes[nodeId]?.parent;
    while (parentId) {
        depth++;
        parentId = nodes[parentId]?.parent;
    }
    return depth;
}

function getContrastingTextColor(hexColor) {
    if (!hexColor || !hexColor.startsWith("#")) return "#0f172a";
    let hex = hexColor.slice(1);
    if (hex.length === 3) {
        hex = hex.split("").map(ch => ch + ch).join("");
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.65 ? "#0f172a" : "#ffffff";
}

function updateNodeStyleControls() {
    if (!nodeColorPicker || !nodeColorClearBtn) return;
    // Determine current selection (node or relationship)
    let selectionType = null;
    let obj = null;
    if (selectedRelationshipId) {
        selectionType = "relationship";
        obj = relationships.find(r => r.id === selectedRelationshipId) || null;
    } else if (selectedNodeId && nodes[selectedNodeId]) {
        selectionType = "node";
        obj = nodes[selectedNodeId];
    }

    if (!obj) {
        nodeColorPicker.disabled = true;
        nodeColorPicker.value = "#7c3aed";
        nodeColorClearBtn.style.display = "none";
        if (nodeColorPalette) {
            nodeColorPalette.querySelectorAll(".color-swatch").forEach(swatch => swatch.classList.remove("active"));
        }
        if (nodeCommentTextarea) {
            nodeCommentTextarea.disabled = true;
            nodeCommentTextarea.value = "";
        }
        return;
    }

    nodeColorPicker.disabled = false;
    nodeColorPicker.value = obj.color || "#7c3aed";
    nodeColorClearBtn.style.display = obj.color ? "inline-flex" : "none";

    if (nodeColorPalette) {
        nodeColorPalette.querySelectorAll(".color-swatch").forEach(swatch => {
            if (swatch.dataset.color === obj.color) {
                swatch.classList.add("active");
            } else {
                swatch.classList.remove("active");
            }
        });
    }

    if (nodeCommentTextarea) {
        nodeCommentTextarea.disabled = false;
        nodeCommentTextarea.value = obj.comment || "";
    }
}

function handleNodeColorChange(e) {
    const color = e.target.value;
    if (selectedRelationshipId) {
        const rel = relationships.find(r => r.id === selectedRelationshipId);
        if (!rel) return;
        rel.color = color;
        saveHistory();
        render();
        return;
    }
    if (!selectedNodeId || !nodes[selectedNodeId]) return;
    nodes[selectedNodeId].color = color;
    saveHistory();
    render();
}

function handleNodeColorPaletteClick(e) {
    const swatch = e.target.closest(".color-swatch");
    if (!swatch || !nodeColorPalette) return;

    const color = swatch.dataset.color;
    if (!color) return;

    if (selectedRelationshipId) {
        const rel = relationships.find(r => r.id === selectedRelationshipId);
        if (!rel) return;
        rel.color = color;
        nodeColorPicker.value = color;
        saveHistory();
        render();
        return;
    }

    if (!selectedNodeId || !nodes[selectedNodeId]) return;
    nodes[selectedNodeId].color = color;
    nodeColorPicker.value = color;
    saveHistory();
    render();
}

function handleNodeCommentChange(e) {
    const text = e.target.value.trim();
    if (selectedRelationshipId) {
        const rel = relationships.find(r => r.id === selectedRelationshipId);
        if (!rel) return;
        if (text) {
            rel.comment = text;
        } else {
            delete rel.comment;
        }
        saveHistory();
        return;
    }
    if (!selectedNodeId || !nodes[selectedNodeId]) return;
    if (text) {
        nodes[selectedNodeId].comment = text;
    } else {
        delete nodes[selectedNodeId].comment;
    }
    saveHistory();
}

function handleClearNodeColor() {
    if (selectedRelationshipId) {
        const rel = relationships.find(r => r.id === selectedRelationshipId);
        if (!rel) return;
        delete rel.color;
        saveHistory();
        render();
        return;
    }

    if (!selectedNodeId || !nodes[selectedNodeId]) return;
    delete nodes[selectedNodeId].color;
    saveHistory();
    render();
}

// --- Edge Intersection helper for Relationship Links ---
function getEdgePoint(fromCenter, toCenter, nodeW, nodeH) {
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const theta = Math.atan2(dy, dx);
    
    // Approximate border point by projecting onto the ellipse radius (with padding)
    const rx = nodeW / 2 + 2;
    const ry = nodeH / 2 + 2;
    
    return {
        x: fromCenter.x + Math.cos(theta) * rx,
        y: fromCenter.y + Math.sin(theta) * ry
    };
}

// --- Connector Renderer ---
function renderConnectors() {
    svgOverlay.innerHTML = "";
    
    // Clear old relationship delete buttons from HTML container before recreating
    const oldDeleteBtns = nodesContainer.querySelectorAll(".relationship-delete-btn");
    oldDeleteBtns.forEach(btn => btn.remove());

    // 1. Draw Hierarchical Tree Connectors (Parent-Child)
    Object.keys(nodes).forEach(id => {
        const node = nodes[id];
        if (!node.parent) return; // Root has no parent
        
        const childEl = document.getElementById("node-" + id);
        const parentEl = document.getElementById("node-" + node.parent);
        
        if (!childEl || !parentEl) return;
        
        const childW = childEl.offsetWidth;
        const childH = childEl.offsetHeight;
        const parentW = parentEl.offsetWidth;
        const parentH = parentEl.offsetHeight;
        
        const childAbs = getAbsoluteCoords(id);
        const parentAbs = getAbsoluteCoords(node.parent);
        
        let pStartX, pStartY, pEndX, pEndY;
        
        if (childAbs.x > parentAbs.x) {
            pStartX = parentAbs.x + parentW / 2;
            pStartY = parentAbs.y;
            pEndX = childAbs.x - childW / 2;
            pEndY = childAbs.y;
        } else {
            pStartX = parentAbs.x - parentW / 2;
            pStartY = parentAbs.y;
            pEndX = childAbs.x + childW / 2;
            pEndY = childAbs.y;
        }
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const dx = pEndX - pStartX;
        const controlOffset = Math.sign(dx) * Math.min(100, Math.abs(dx) * 0.5);
        
        const d = `M ${pStartX} ${pStartY} C ${pStartX + controlOffset} ${pStartY}, ${pEndX - controlOffset} ${pEndY}, ${pEndX} ${pEndY}`;
        path.setAttribute("d", d);
        path.setAttribute("class", "connector-line");
        svgOverlay.appendChild(path);
    });

    // 2. Draw Temporary Preview Parent Connection (If Dragging)
    if (draggingNodeId && hoveredParentId) {
        const childEl = document.getElementById("node-" + draggingNodeId);
        const parentEl = document.getElementById("node-" + hoveredParentId);
        
        if (childEl && parentEl) {
            const childW = childEl.offsetWidth;
            const childH = childEl.offsetHeight;
            const parentW = parentEl.offsetWidth;
            const parentH = parentEl.offsetHeight;
            
            const startAbs = getAbsoluteCoords(draggingNodeId, true);
            const childAbs = { x: startAbs.x + dragDelta.x, y: startAbs.y + dragDelta.y };
            const parentAbs = getAbsoluteCoords(hoveredParentId);
            
            let pStartX, pStartY, pEndX, pEndY;
            
            if (childAbs.x > parentAbs.x) {
                pStartX = parentAbs.x + parentW / 2;
                pStartY = parentAbs.y;
                pEndX = childAbs.x - childW / 2;
                pEndY = childAbs.y;
            } else {
                pStartX = parentAbs.x - parentW / 2;
                pStartY = parentAbs.y;
                pEndX = childAbs.x + childW / 2;
                pEndY = childAbs.y;
            }
            
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const dx = pEndX - pStartX;
            const controlOffset = Math.sign(dx) * Math.min(100, Math.abs(dx) * 0.5);
            const d = `M ${pStartX} ${pStartY} C ${pStartX + controlOffset} ${pStartY}, ${pEndX - controlOffset} ${pEndY}, ${pEndX} ${pEndY}`;
            path.setAttribute("d", d);
            path.setAttribute("class", "connector-line preview");
            svgOverlay.appendChild(path);
        }
    }

    // 3. Draw Relationship Links (Arced Bezier Curves between Arbitrary Nodes)
    relationships.forEach(rel => {
        const fromEl = document.getElementById("node-" + rel.from);
        const toEl = document.getElementById("node-" + rel.to);
        
        if (!fromEl || !toEl) return;
        
        const fromW = fromEl.offsetWidth;
        const fromH = fromEl.offsetHeight;
        const toW = toEl.offsetWidth;
        const toH = toEl.offsetHeight;
        
        const fromAbs = getAbsoluteCoords(rel.from);
        const toAbs = getAbsoluteCoords(rel.to);
        
        const startPort = getEdgePoint(fromAbs, toAbs, fromW, fromH);
        const endPort = getEdgePoint(toAbs, fromAbs, toW, toH);
        
        const dx = endPort.x - startPort.x;
        const dy = endPort.y - startPort.y;
        const len = Math.hypot(dx, dy);
        
        if (len < 10) return; // Ignore overlapping node connections
        
        // Perpendicular vector for arcing bend
        const px = -dy / len;
        const py = dx / len;
        const offset = Math.min(80, len * 0.2); // Bend curve proportionally up to 80px
        
        const cx = (startPort.x + endPort.x) / 2 + px * offset;
        const cy = (startPort.y + endPort.y) / 2 + py * offset;
        
        const d = `M ${startPort.x} ${startPort.y} Q ${cx} ${cy}, ${endPort.x} ${endPort.y}`;
        
        // Visually drawn relationship curve
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("class", "relationship-line" + (selectedRelationshipId === rel.id ? " selected" : ""));
        path.setAttribute("marker-end", "url(#relationship-arrow)");
        svgOverlay.appendChild(path);
        
        // Thick overlay path for touch/mouse click target expansion
        const overlayPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        overlayPath.setAttribute("d", d);
        overlayPath.setAttribute("class", "relationship-line-overlay");
        
        overlayPath.addEventListener("mouseenter", () => path.classList.add("hovered"));
        overlayPath.addEventListener("mouseleave", () => path.classList.remove("hovered"));
        overlayPath.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            selectRelationship(rel.id);
        });
        
        svgOverlay.appendChild(overlayPath);
        
        // Float a delete button at midpoint if selected
        if (selectedRelationshipId === rel.id) {
            // Midpoint of quadratic Bezier: B(0.5) = 0.25 * P0 + 0.5 * P1 + 0.25 * P2
            const midX = 0.25 * startPort.x + 0.5 * cx + 0.25 * endPort.x;
            const midY = 0.25 * startPort.y + 0.5 * cy + 0.25 * endPort.y;
            
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "relationship-delete-btn";
            deleteBtn.style.left = `${midX}px`;
            deleteBtn.style.top = `${midY}px`;
            deleteBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            deleteBtn.title = "Delete Relationship Link";
            deleteBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteRelationship(rel.id);
            });
            nodesContainer.appendChild(deleteBtn);
        }
    });

    // 4. Draw Temporary Preview Line in Linking Mode
    if (linkingSourceId && linkingMousePos) {
        const sourceEl = document.getElementById("node-" + linkingSourceId);
        if (sourceEl) {
            const sourceW = sourceEl.offsetWidth;
            const sourceH = sourceEl.offsetHeight;
            const sourceAbs = getAbsoluteCoords(linkingSourceId);
            
            const startPort = getEdgePoint(sourceAbs, linkingMousePos, sourceW, sourceH);
            
            const dx = linkingMousePos.x - startPort.x;
            const dy = linkingMousePos.y - startPort.y;
            const len = Math.hypot(dx, dy);
            
            const px = -dy / (len || 1);
            const py = dx / (len || 1);
            const offset = Math.min(60, len * 0.15);
            const cx = (startPort.x + linkingMousePos.x) / 2 + px * offset;
            const cy = (startPort.y + linkingMousePos.y) / 2 + py * offset;
            
            const d = `M ${startPort.x} ${startPort.y} Q ${cx} ${cy}, ${linkingMousePos.x} ${linkingMousePos.y}`;
            
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", d);
            path.setAttribute("class", "relationship-line preview");
            path.setAttribute("marker-end", "url(#relationship-arrow)");
            svgOverlay.appendChild(path);
        }
    }
}

// --- Node Selection & Dragging ---
function handleNodePointerDown(e, nodeId) {
    if (editingNodeId === nodeId) return; // Don't drag while editing
    e.stopPropagation();
    
    if (linkingSourceId) {
        // We are in linking mode! Clicked node is the target.
        if (nodeId !== linkingSourceId) {
            createRelationship(linkingSourceId, nodeId);
        }
        cancelLinkingMode();
        return;
    }
    
    selectNode(nodeId);
    selectedRelationshipId = null;
    
    // Start Dragging Node
    draggingNodeId = nodeId;
    dragStartMouse = { x: e.clientX, y: e.clientY };
    dragStartNodePos = { x: nodes[nodeId].x, y: nodes[nodeId].y };
    dragDelta = { x: 0, y: 0 };
    
    const nodeEl = document.getElementById("node-" + nodeId);
    nodeEl.classList.add("dragging");
    nodeEl.setPointerCapture(e.pointerId);
}

function checkPotentialParent(draggedId, absX, absY) {
    let bestCandidateId = null;
    let bestOverlapArea = 0;
    const draggedEl = document.getElementById("node-" + draggedId);
    if (!draggedEl) {
        hoveredParentId = null;
        return;
    }

    const dragWidth = draggedEl.offsetWidth;
    const dragHeight = draggedEl.offsetHeight;
    const dragRect = {
        left: absX - dragWidth / 2,
        right: absX + dragWidth / 2,
        top: absY - dragHeight / 2,
        bottom: absY + dragHeight / 2
    };

    Object.keys(nodes).forEach(id => {
        // Exclude the dragged node itself and all its descendants to avoid cycles
        if (isDescendantOf(id, draggedId)) return;
        
        const candidateEl = document.getElementById("node-" + id);
        if (!candidateEl) return;

        const candidateAbs = getAbsoluteCoords(id);
        const candidateWidth = candidateEl.offsetWidth;
        const candidateHeight = candidateEl.offsetHeight;
        const candidateRect = {
            left: candidateAbs.x - candidateWidth / 2,
            right: candidateAbs.x + candidateWidth / 2,
            top: candidateAbs.y - candidateHeight / 2,
            bottom: candidateAbs.y + candidateHeight / 2
        };

        const overlapX = Math.max(0, Math.min(dragRect.right, candidateRect.right) - Math.max(dragRect.left, candidateRect.left));
        const overlapY = Math.max(0, Math.min(dragRect.bottom, candidateRect.bottom) - Math.max(dragRect.top, candidateRect.top));
        const overlapArea = overlapX * overlapY;

        if (overlapArea > bestOverlapArea) {
            bestOverlapArea = overlapArea;
            bestCandidateId = id;
        }
    });

    if (hoveredParentId !== bestCandidateId) {
        if (hoveredParentId) {
            const prevParentEl = document.getElementById("node-" + hoveredParentId);
            if (prevParentEl) prevParentEl.classList.remove("potential-parent");
        }

        hoveredParentId = bestCandidateId;

        if (hoveredParentId) {
            const nextParentEl = document.getElementById("node-" + hoveredParentId);
            if (nextParentEl) nextParentEl.classList.add("potential-parent");
        }
    }
}

function finishDraggingNode(e) {
    if (!draggingNodeId) return;
    
    const nodeEl = document.getElementById("node-" + draggingNodeId);
    if (nodeEl) {
        nodeEl.classList.remove("dragging");
        if (e) {
            try {
                nodeEl.releasePointerCapture(e.pointerId);
            } catch(err) {}
        }
    }
    
    const wasReparented = hoveredParentId !== null;
    const finalAbs = getAbsoluteCoords(draggingNodeId);
    
    if (wasReparented) {
        // Re-parent node
        const newParentId = hoveredParentId;
        const parentAbs = getAbsoluteCoords(newParentId);
        
        // Calculate new local relative offsets to the new parent
        nodes[draggingNodeId].parent = newParentId;
        nodes[draggingNodeId].x = finalAbs.x - parentAbs.x;
        nodes[draggingNodeId].y = finalAbs.y - parentAbs.y;
    } else {
        // Simply update node offset in place relative to its current parent
        nodes[draggingNodeId].x += dragDelta.x;
        nodes[draggingNodeId].y += dragDelta.y;
    }
    
    // Clear highlights
    if (hoveredParentId) {
        const parentEl = document.getElementById("node-" + hoveredParentId);
        if (parentEl) parentEl.classList.remove("potential-parent");
    }
    
    const didMove = dragDelta.x !== 0 || dragDelta.y !== 0;
    
    draggingNodeId = null;
    hoveredParentId = null;
    dragDelta = { x: 0, y: 0 };
    
    if (didMove || wasReparented) {
        saveHistory();
    }
    
    render();
}

function selectNode(nodeId) {
    if (selectedNodeId === nodeId) return;
    
    if (selectedNodeId) {
        const prevSelectedEl = document.getElementById("node-" + selectedNodeId);
        if (prevSelectedEl) prevSelectedEl.classList.remove("selected");
    }
    
    selectedNodeId = nodeId;
    
    if (selectedNodeId) {
        const newSelectedEl = document.getElementById("node-" + selectedNodeId);
        if (newSelectedEl) newSelectedEl.classList.add("selected");
    }
}

// --- Text Editing Logic ---
function startEditingNode(nodeId) {
    if (editingNodeId) return; // Already editing a node
    
    editingNodeId = nodeId;
    const nodeEl = document.getElementById("node-" + nodeId);
    const textSpan = nodeEl.querySelector(".node-text");
    
    // Swap text span content with contenteditable span
    textSpan.contentEditable = "true";
    textSpan.classList.add("node-editor");
    
    textSpan.focus();
    // Select all text inside
    document.execCommand('selectAll', false, null);
    
    // Save current text in case of cancellation
    const originalText = nodes[nodeId].text;
    
    // Handle inline typing and resize connectors dynamically
    textSpan.addEventListener("input", () => {
        renderConnectors();
    });
    
    textSpan.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            textSpan.blur(); // Triggers save on blur
        }
        if (e.key === "Escape") {
            textSpan.textContent = originalText;
            editingNodeId = null;
            textSpan.blur();
            render();
        }
    });
    
    textSpan.addEventListener("blur", () => {
        const newText = textSpan.textContent.trim();
        textSpan.contentEditable = "false";
        textSpan.classList.remove("node-editor");
        
        if (newText && newText !== originalText) {
            nodes[nodeId].text = newText;
            saveHistory();
        } else {
            textSpan.textContent = originalText;
        }
        
        editingNodeId = null;
        render();
    }, { once: true });
}

// --- Mindmap Operations (Add, Delete) ---
function addChildNode(parentId) {
    if (!parentId || !nodes[parentId]) return;
    
    const childId = "node_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    
    // Decide default horizontal direction (outward growth)
    let childX = 200;
    let childY = 0;
    
    const parentAbs = getAbsoluteCoords(parentId);
    
    if (parentId === "root") {
        // Count existing children on left/right to alternate side
        const rightChildren = Object.values(nodes).filter(n => n.parent === "root" && n.x > 0);
        const leftChildren = Object.values(nodes).filter(n => n.parent === "root" && n.x < 0);
        
        if (rightChildren.length <= leftChildren.length) {
            childX = 220;
            // Place it below the last right-side child if exists
            if (rightChildren.length > 0) {
                const maxY = Math.max(...rightChildren.map(c => c.y));
                childY = maxY + 60;
            }
        } else {
            childX = -220;
            if (leftChildren.length > 0) {
                const maxY = Math.max(...leftChildren.map(c => c.y));
                childY = maxY + 60;
            }
        }
    } else {
        // If parent is on left, children grow left. If parent is on right, children grow right.
        childX = parentAbs.x >= 0 ? 200 : -200;
        
        const siblings = Object.values(nodes).filter(n => n.parent === parentId);
        if (siblings.length > 0) {
            const maxY = Math.max(...siblings.map(s => s.y));
            childY = maxY + 60;
        }
    }
    
    nodes[childId] = {
        id: childId,
        text: "New Leaf",
        parent: parentId,
        x: childX,
        y: childY
    };
    
    saveHistory();
    render();
    
    // Focus and select the new node, then trigger edit mode
    selectNode(childId);
    scrollToNode(childId);
    
    // Small delay to let DOM render before editing
    setTimeout(() => {
        startEditingNode(childId);
        renderConnectors();
    }, 50);
}

function addSiblingNode(nodeId) {
    if (!nodeId || nodeId === "root") return; // Root cannot have siblings
    
    const parentId = nodes[nodeId].parent;
    if (!parentId || !nodes[parentId]) return;
    
    const siblingId = "node_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const targetNode = nodes[nodeId];
    
    // Sibling spawns horizontally aligned with target, but vertically below
    const childX = targetNode.x;
    const childY = targetNode.y + 70;
    
    nodes[siblingId] = {
        id: siblingId,
        text: "New Sibling",
        parent: parentId,
        x: childX,
        y: childY
    };
    
    saveHistory();
    render();
    
    selectNode(siblingId);
    scrollToNode(siblingId);
    
    setTimeout(() => {
        startEditingNode(siblingId);
        renderConnectors();
    }, 50);
}

function deleteNode(nodeId) {
    if (!nodeId || nodeId === "root") return; // Cannot delete root
    
    // Check if node has children to confirm deletion
    const childrenIds = Object.keys(nodes).filter(id => nodes[id].parent === nodeId);
    
    if (childrenIds.length > 0) {
        if (!confirm("Delete this node and all of its sub-branches?")) {
            return;
        }
    }
    
    const parentId = nodes[nodeId].parent;
    
    // Recursively delete node, descendants, and associated relationship links
    function deleteRecursive(id) {
        const subChildren = Object.keys(nodes).filter(cid => nodes[cid].parent === id);
        subChildren.forEach(cid => deleteRecursive(cid));
        delete nodes[id];
        
        // Filter out any relationships starting or ending at this node
        relationships = relationships.filter(rel => rel.from !== id && rel.to !== id);
    }
    
    deleteRecursive(nodeId);
    
    saveHistory();
    
    // Select parent as next logical node
    selectNode(parentId);
    render();
}

// --- Keyboard Navigation ---
function handleKeyDown(e) {
    // If user is typing in a text field, textarea, or modal is active, skip global shortcuts
    if (editingNodeId || helpModal.classList.contains("active") || e.target.closest("input, textarea")) {
        return;
    }

    // Tab -> Add Child Node
    if (e.key === "Tab") {
        e.preventDefault();
        addChildNode(selectedNodeId);
    }
    
    // Enter -> Add Sibling Node
    if (e.key === "Enter") {
        e.preventDefault();
        addSiblingNode(selectedNodeId);
    }
    
    // F2 -> Edit Node Text
    if (e.key === "F2") {
        e.preventDefault();
        if (selectedNodeId) startEditingNode(selectedNodeId);
    }
    
    // L -> Add Relationship Link
    if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        if (selectedNodeId) startLinkingMode(selectedNodeId);
    }
    
    // Delete / Backspace -> Delete Node or Selected Relationship
    if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedNodeId) {
            deleteNode(selectedNodeId);
        } else if (selectedRelationshipId) {
            deleteRelationship(selectedRelationshipId);
        }
    }
    
    // Escape -> Deselect / Cancel Linking
    if (e.key === "Escape") {
        if (linkingSourceId) {
            cancelLinkingMode();
        } else {
            selectNode(null);
            selectedRelationshipId = null;
            render();
        }
    }
    
    // Space -> Center View
    if (e.key === " " && !e.target.closest("input, textarea")) {
        e.preventDefault();
        viewportTransform = { x: 0, y: 0, scale: 1 };
        updateCanvasTransform();
    }
    
    // H -> Help Modal Toggle
    if (e.key === "h" || e.key === "H") {
        showHelp(true);
    }
    
    // Arrow Keys -> Geometric Navigation
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        navigateGeometrically(e.key);
    }
    
    // Ctrl + Z -> Undo
    if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
    }
    
    // Ctrl + Y -> Redo
    if (e.ctrlKey && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
    }
}

// Geometric arrow navigation between nodes
function navigateGeometrically(direction) {
    if (!selectedNodeId || !nodes[selectedNodeId]) {
        selectNode("root");
        return;
    }
    
    const currAbs = getAbsoluteCoords(selectedNodeId);
    let closestId = null;
    let minScore = Infinity;
    
    Object.keys(nodes).forEach(id => {
        if (id === selectedNodeId) return;
        
        const candAbs = getAbsoluteCoords(id);
        const dx = candAbs.x - currAbs.x;
        const dy = candAbs.y - currAbs.y;
        
        let isValidDirection = false;
        
        if (direction === "ArrowRight" && dx > 15) isValidDirection = true;
        if (direction === "ArrowLeft" && dx < -15) isValidDirection = true;
        if (direction === "ArrowDown" && dy > 15) isValidDirection = true;
        if (direction === "ArrowUp" && dy < -15) isValidDirection = true;
        
        if (isValidDirection) {
            // Scoring formula: distance along primary axis + penalty for secondary axis offset
            let score;
            if (direction === "ArrowRight" || direction === "ArrowLeft") {
                score = Math.abs(dx) + Math.abs(dy) * 2.5;
            } else {
                score = Math.abs(dy) + Math.abs(dx) * 2.5;
            }
            
            if (score < minScore) {
                minScore = score;
                closestId = id;
            }
        }
    });
    
    if (closestId) {
        selectNode(closestId);
        scrollToNode(closestId);
    }
}

// Scrolls/pans canvas to make node centered in viewport
function scrollToNode(nodeId) {
    const abs = getAbsoluteCoords(nodeId);
    
    // Viewport dimensions
    const rect = workspace.getBoundingClientRect();
    const midX = rect.width / 2;
    const midY = rect.height / 2;
    
    // Set viewport coordinates so the node sits in the exact middle of the screen.
    // Since the nodes container is already centered at 50% of the canvas in CSS,
    // the root node (0,0) is centered when canvas transform is (0,0).
    viewportTransform.x = midX - (midX + abs.x) * viewportTransform.scale;
    viewportTransform.y = midY - (midY + abs.y) * viewportTransform.scale;
    
    updateCanvasTransform();
}

function centerOnNode(nodeId) {
    scrollToNode(nodeId);
}

// --- History (Undo/Redo) ---
function saveHistory() {
    // Clear redo stack on new action
    redoStack = [];
    
    // Push deep copy of state (both nodes and relationships) to undo stack
    undoStack.push(JSON.stringify({
        nodes: nodes,
        relationships: relationships
    }));
    
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
}

function undo() {
    if (undoStack.length <= 1) return; // Preserve initial state
    
    // Pop current state and move to redo stack
    const currentState = undoStack.pop();
    redoStack.push(currentState);
    
    // Apply previous state
    const prevState = undoStack[undoStack.length - 1];
    const dataObj = JSON.parse(prevState);
    nodes = dataObj.nodes;
    relationships = dataObj.relationships || [];
    
    // Safeguard selectedNodeId
    if (!nodes[selectedNodeId]) {
        selectedNodeId = "root";
    }
    selectedRelationshipId = null;
    
    render();
}

function redo() {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack.pop();
    undoStack.push(nextState);
    
    const dataObj = JSON.parse(nextState);
    nodes = dataObj.nodes;
    relationships = dataObj.relationships || [];
    
    if (!nodes[selectedNodeId]) {
        selectedNodeId = "root";
    }
    selectedRelationshipId = null;
    
    render();
}

// --- Help Modal ---
function showHelp(show) {
    if (show) {
        helpModal.classList.add("active");
    } else {
        helpModal.classList.remove("active");
    }
}

// --- File Storage & Serialization ---

// LocalStorage Auto-Save
function saveAutosave() {
    localStorage.setItem("mindflow_autosave", JSON.stringify({
        name: currentMapName,
        nodes: nodes,
        relationships: relationships
    }));
}

// Save current map to a local file. First save prompts for location, later saves overwrite the same file when available.
async function handleSaveMap() {
    // Use explicit root text if currentMapName is not set (i.e., this is a new unsaved map)
    const suggestedName = currentMapName || (nodes.root && nodes.root.text) || "My Mindmap";
    
    const mapData = {
        format: "mindflow",
        version: "1.0",
        name: suggestedName,
        nodes: nodes,
        relationships: relationships
    };

    if (window.showSaveFilePicker) {
        if (!saveFileHandle) {
            try {
                saveFileHandle = await window.showSaveFilePicker({
                    types: [
                        {
                            description: "MindFlow map file",
                            accept: { "application/json": [".mindflow", ".json"] }
                        }
                    ],
                    suggestedName: getSuggestedMapFilename(mapData.name)
                });
            } catch (err) {
                if (err.name === "AbortError") return;
                console.error("Save file picker failed:", err);
                alert("Unable to open save file dialog.");
                return;
            }
        }

        try {
            await writeMapToHandle(saveFileHandle, mapData);
            currentMapName = saveFileHandle.name || mapData.name;
            saveAutosave();
            alert(`Map saved to ${currentMapName}`);
        } catch (err) {
            console.error("Saving map failed:", err);
            alert("Unable to save the map file.");
        }
    } else {
        // Fallback for browsers without File System Access API
        downloadMapFile(mapData);
        alert("Your browser does not support direct overwrite save. The map has been downloaded instead.");
    }
}

function getSuggestedMapFilename(name) {
    // Preserve non-ASCII characters (like Swedish å, ä, ö) and replace only problematic characters
    const safeName = String(name)
        .trim()
        .toLowerCase()
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-") // Remove filesystem-invalid characters
        .replace(/\s+/g, "-") // Replace spaces with dashes
        .replace(/^-+|-+$/g, ""); // Trim leading/trailing dashes
    
    return safeName ? `${safeName}.mindflow` : "mindflow.mindflow";
}

async function writeMapToHandle(handle, data) {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
}

function downloadMapFile(data) {
    const fileName = getSuggestedMapFilename(data.name);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// Load a map from LocalStorage list
function loadMap(name) {
    const savedMaps = JSON.parse(localStorage.getItem("mindflow_saved_maps") || "{}");
    if (savedMaps[name]) {
        nodes = savedMaps[name].nodes;
        relationships = savedMaps[name].relationships || [];
        currentMapName = name;
        
        // Safeguard selected node
        selectedNodeId = "root";
        selectedRelationshipId = null;
        
        // Reset view
        viewportTransform = { x: 0, y: 0, scale: 1 };
        updateCanvasTransform();
        
        undoStack = [];
        redoStack = [];
        saveHistory();
        
        render();
        centerOnNode("root");
        setTimeout(() => {
            renderConnectors();
        }, 100);
    }
}

// Delete map from LocalStorage
function deleteSavedMap(name, event) {
    event.stopPropagation();
    if (!confirm(`Are you sure you want to delete the saved map "${name}"?`)) {
        return;
    }
    
    const savedMaps = JSON.parse(localStorage.getItem("mindflow_saved_maps") || "{}");
    delete savedMaps[name];
    localStorage.setItem("mindflow_saved_maps", JSON.stringify(savedMaps));
    
    if (currentMapName === name) {
        currentMapName = "";
    }
    
    loadMapList();
}

// Load the list of saved maps in the sidebar
function loadMapList() {
    const savedMaps = JSON.parse(localStorage.getItem("mindflow_saved_maps") || "{}");
    const names = Object.keys(savedMaps).sort((a, b) => savedMaps[b].updatedAt - savedMaps[a].updatedAt);
    
    savedMapsList.innerHTML = "";
    
    if (names.length === 0) {
        savedMapsList.innerHTML = '<div class="empty-state">No saved maps found in browser storage.</div>';
        return;
    }
    
    names.forEach(name => {
        const item = document.createElement("div");
        item.className = "saved-map-item";
        item.addEventListener("click", () => loadMap(name));
        
        const label = document.createElement("span");
        label.className = "map-name";
        label.textContent = name;
        label.title = name;
        
        const actions = document.createElement("div");
        actions.className = "map-actions";
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "map-action-btn delete";
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.title = "Delete Saved Map";
        deleteBtn.addEventListener("click", (e) => deleteSavedMap(name, e));
        
        actions.appendChild(deleteBtn);
        item.appendChild(label);
        item.appendChild(actions);
        savedMapsList.appendChild(item);
    });
}

function handleNewMap() {
    if (!confirm("Start a new mindmap? Unsaved changes to the current map will be lost.")) {
        return;
    }
    nodes = {
        "root": { id: "root", text: "Central Topic", parent: null, x: 0, y: 0 }
    };
    relationships = [];
    selectedNodeId = "root";
    selectedRelationshipId = null;
    currentMapName = "";
    saveFileHandle = null; // Reset file handle so next save prompts for new location
    
    viewportTransform = { x: 0, y: 0, scale: 1 };
    updateCanvasTransform();
    
    undoStack = [];
    redoStack = [];
    saveHistory();
    
    render();
    centerOnNode("root");
}

// Export as local JSON file
function handleExportFile() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        format: "mindflow",
        version: "1.0",
        name: currentMapName || "My Mindmap",
        nodes: nodes,
        relationships: relationships
    }, null, 2));
    
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    
    const filename = (currentMapName || nodes.root.text || "mindmap").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".mindmap";
    downloadAnchor.setAttribute("download", filename);
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// Import from local JSON file
function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (data && data.nodes && data.nodes.root) {
                // If this is a MindFlow format file, preserve original layout
                const isMindFlowFile = data.format === "mindflow";
                importMapData({
                    nodes: data.nodes,
                    relationships: data.relationships || [],
                    name: data.name || file.name.replace(/\.[^/.]+$/, "")
                }, file.name, isMindFlowFile);
            } else {
                throw new Error("Invalid mindmap JSON format: root node is missing.");
            }
        } catch (err) {
            alert("Error importing JSON mindmap file: " + err.message);
        }
    };
    reader.readAsText(file);
    fileImportInput.value = "";
}

function handleImportMindMeisterFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const imported = parseFreemindXml(evt.target.result);
            importMapData(imported, file.name);
        } catch (err) {
            alert("Error importing MindMeister (.mm/.xml) file: " + err.message);
        }
    };
    reader.readAsText(file);
    fileImportMindMeisterInput.value = "";
}

function importMapData(imported, filename, skipLayout = false) {
    nodes = imported.nodes;
    relationships = imported.relationships || [];
    
    // Only auto-layout if this is an external format import (not a previously saved MindFlow file)
    if (!skipLayout) {
        layoutImportedMap();
    }
    
    currentMapName = imported.name || filename.replace(/\.[^/.]+$/, "");

    selectedNodeId = "root";
    selectedRelationshipId = null;
    viewportTransform = { x: 0, y: 0, scale: 1 };
    updateCanvasTransform();

    undoStack = [];
    redoStack = [];
    saveHistory();

    render();
    centerOnNode("root");
    setTimeout(() => {
        renderConnectors();
    }, 100);

    alert("Mindmap successfully imported from " + filename + "!");
}

function layoutImportedMap() {
    const childrenMap = {};
    Object.keys(nodes).forEach(id => {
        const parentId = nodes[id].parent;
        if (!parentId) return;
        if (!childrenMap[parentId]) childrenMap[parentId] = [];
        childrenMap[parentId].push(id);
    });

    function getSubtreeCount(nodeId) {
        const children = childrenMap[nodeId] || [];
        let count = 1;
        children.forEach(childId => {
            count += getSubtreeCount(childId);
        });
        return count;
    }

    const absPositions = {};
    const spacingX = 220;
    const spacingY = 100;
    const siblingGap = 30;

    function layoutNode(nodeId, x, y, side) {
        absPositions[nodeId] = { x, y, side };
        const children = (childrenMap[nodeId] || []).slice();
        if (children.length === 0) return;

        const totalHeight = children.reduce((sum, childId) => {
            return sum + getSubtreeCount(childId) * spacingY;
        }, 0) + siblingGap * Math.max(0, children.length - 1);

        let currentY = y - totalHeight / 2 + spacingY / 2;
        children.forEach(childId => {
            const childHeight = getSubtreeCount(childId) * spacingY;
            const childY = currentY + childHeight / 2 - spacingY / 2;
            currentY += childHeight + siblingGap;
            layoutNode(childId, x + spacingX * side, childY, side);
        });
    }

    const root = nodes.root;
    if (!root) return;
    absPositions.root = { x: 0, y: 0, side: 1 };

    const rootChildren = childrenMap.root || [];
    if (rootChildren.length === 0) return;

    const rightChildren = [];
    const leftChildren = [];
    rootChildren.forEach((childId, index) => {
        if (index % 2 === 0) {
            rightChildren.push(childId);
        } else {
            leftChildren.push(childId);
        }
    });

    let yRight = 0;
    rightChildren.forEach(childId => {
        const subtreeHeight = getSubtreeCount(childId) * spacingY;
        const childY = yRight + subtreeHeight / 2 - spacingY / 2;
        yRight += subtreeHeight + siblingGap;
        layoutNode(childId, spacingX, childY, 1);
    });

    let yLeft = 0;
    leftChildren.forEach(childId => {
        const subtreeHeight = getSubtreeCount(childId) * spacingY;
        const childY = yLeft + subtreeHeight / 2 - spacingY / 2;
        yLeft += subtreeHeight + siblingGap;
        layoutNode(childId, -spacingX, childY, -1);
    });

    // Convert absolute positions to relative parent-relative positions
    Object.keys(nodes).forEach(id => {
        const node = nodes[id];
        if (id === "root") {
            node.x = 0;
            node.y = 0;
            return;
        }
        const abs = absPositions[id];
        const parentAbs = absPositions[node.parent] || { x: 0, y: 0 };
        node.x = abs.x - parentAbs.x;
        node.y = abs.y - parentAbs.y;
    });
}

function parseFreemindXml(xmlText) {
    // Strip UTF-8 BOM / leading whitespace so parser sees the XML root immediately.
    xmlText = xmlText.replace(/^\uFEFF/, "");
    xmlText = xmlText.replace(/^\s+/, "");

    if (!xmlText.startsWith("<")) {
        const snippet = xmlText.slice(0, 50).replace(/\s+/g, " ").trim();
        throw new Error("File does not appear to be valid XML. First characters: " + JSON.stringify(snippet));
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    const parserErrors = xmlDoc.getElementsByTagName("parsererror");
    if (parserErrors.length > 0 || xmlDoc.documentElement.nodeName === "parsererror") {
        const errorText = parserErrors.length > 0 ? parserErrors[0].textContent : xmlDoc.documentElement.textContent;
        throw new Error("Could not parse XML file." + (errorText ? " " + errorText.trim() : ""));
    }

    const rootElement = xmlDoc.documentElement;
    let mapNode = null;
    if (rootElement && rootElement.tagName.toLowerCase() === "map") {
        mapNode = rootElement;
    } else if (rootElement && rootElement.tagName.toLowerCase() === "mindmap") {
        mapNode = rootElement;
    } else if (rootElement && rootElement.tagName.toLowerCase() === "node") {
        mapNode = xmlDoc;
    }

    if (!mapNode) {
        throw new Error("Freemind XML root <map> or <mindmap> is missing.");
    }

    const freemindRoot = mapNode.tagName.toLowerCase() === "node" ? mapNode : mapNode.querySelector("node");
    if (!freemindRoot) {
        throw new Error("Freemind XML does not contain a root <node> element.");
    }

    const nodesMap = {};
    let nodeIndex = 0;

    function createNodeEntry(text, parentId, depth, comment) {
        const id = "node_" + Date.now() + "_" + Math.floor(Math.random() * 1000000) + "_" + nodeIndex++;
        const x = depth * 220;
        const y = nodeIndex * 70;
        nodesMap[id] = {
            id,
            text: text || "Unnamed",
            parent: parentId,
            x,
            y
        };
        if (comment) {
            nodesMap[id].comment = comment;
        }
        return id;
    }

    function extractNoteText(nodeElem) {
        const richNote = nodeElem.querySelector('richcontent[type="NOTE"]');
        if (richNote) {
            return richNote.textContent.trim();
        }
        const noteElem = nodeElem.querySelector("note");
        return noteElem ? noteElem.textContent.trim() : null;
    }

    function traverse(nodeElem, parentId, depth) {
        const text = nodeElem.getAttribute("TEXT") || nodeElem.getAttribute("text") || "";
        const comment = extractNoteText(nodeElem);
        const nodeId = createNodeEntry(text, parentId, depth, comment);

        Array.from(nodeElem.children).forEach(childElem => {
            if (childElem.tagName.toLowerCase() === "node") {
                traverse(childElem, nodeId, depth + 1);
            }
        });
    }

    const rootId = "root";
    const rootText = freemindRoot.getAttribute("TEXT") || freemindRoot.getAttribute("text") || "Central Topic";
    const rootComment = extractNoteText(freemindRoot);
    nodesMap[rootId] = {
        id: rootId,
        text: rootText,
        parent: null,
        x: 0,
        y: 0
    };
    if (rootComment) {
        nodesMap[rootId].comment = rootComment;
    }

    Array.from(freemindRoot.children).forEach(childElem => {
        if (childElem.tagName.toLowerCase() === "node") {
            traverse(childElem, rootId, 1);
        }
    });

    return {
        nodes: nodesMap,
        relationships: [],
        name: rootText
    };
}

function handleExportDoc() {
    const html = generateWordHtml();
    const dataStr = "data:application/msword;charset=utf-8," + encodeURIComponent(html);
    const filename = (currentMapName || nodes.root.text || "mindmap").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".doc";
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function generateWordHtml() {
    const mapTitle = currentMapName || nodes.root.text || "Mindmap";
    const docParts = [];
    docParts.push("<!DOCTYPE html>");
    docParts.push("<html><head><meta charset=\"UTF-8\"><title>" + escapeHtml(mapTitle) + "</title></head><body>");
    docParts.push("<h1>" + escapeHtml(nodes.root.text) + "</h1>");
    appendNodeHierarchyToDoc("root", 2, docParts);
    docParts.push("</body></html>");
    return docParts.join("");
}

function appendNodeHierarchyToDoc(nodeId, level, docParts) {
    const children = Object.values(nodes)
        .filter(n => n.parent === nodeId)
        .sort((a, b) => (a.y - b.y) || (a.x - b.x));

    children.forEach(child => {
        const headingLevel = Math.min(level, 6);
        const escapedText = escapeHtml(child.text);
        if (headingLevel <= 6) {
            docParts.push("<h" + headingLevel + ">" + escapedText + "</h" + headingLevel + ">");
        } else {
            docParts.push("<p style=\"font-weight:700; margin:0;\">" + escapedText + "</p>");
        }
        if (child.comment) {
            docParts.push("<p style=\"margin: 8px 0; font-style: italic; color: #666;\"><strong>Note:</strong> " + escapeHtml(child.comment) + "</p>");
        }
        appendNodeHierarchyToDoc(child.id, level + 1, docParts);
    });
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// --- Relationship Links Helpers ---
function startLinkingMode(sourceId) {
    if (!sourceId || !nodes[sourceId]) return;
    linkingSourceId = sourceId;
    linkingMousePos = null;
    
    const banner = document.getElementById("linking-banner");
    if (banner) banner.style.display = "flex";
    
    selectNode(null);
    selectedRelationshipId = null;
    render();
}

function cancelLinkingMode() {
    linkingSourceId = null;
    linkingMousePos = null;
    
    const banner = document.getElementById("linking-banner");
    if (banner) banner.style.display = "none";
    
    render();
}

function createRelationship(fromId, toId) {
    if (fromId === toId) return; // Prevent self connection
    
    // Prevent duplicate connection in either direction
    const exists = relationships.some(r => 
        (r.from === fromId && r.to === toId) || 
        (r.from === toId && r.to === fromId)
    );
    if (exists) return;
    
    const relId = "rel_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    relationships.push({
        id: relId,
        from: fromId,
        to: toId
    });
    
    saveHistory();
    render();
}

function selectRelationship(relId) {
    selectedRelationshipId = relId;
    selectNode(null); // Clear selected node
    render();
}

function deleteRelationship(relId) {
    relationships = relationships.filter(r => r.id !== relId);
    if (selectedRelationshipId === relId) {
        selectedRelationshipId = null;
    }
    saveHistory();
    render();
}

// --- Start the App ---
document.addEventListener("DOMContentLoaded", init);
