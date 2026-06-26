// ============================================================================
// state.js - Global Application State
// ============================================================================
// Manages all shared state variables for the mindmap application.
// All state is centralized here for easier tracking and debugging.

export const state = {
    // --- Node & Relationship Data ---
    nodes: {
        "root": { id: "root", text: "Central Topic", parent: null, x: 0, y: 0, color: { bg: "#0ea5e9" } }
    },
    relationships: [],

    // --- Selection & Editing ---
    selectedNodeId: "root",
    editingNodeId: null,
    editingBuffer: null,
    editingReplaceOnType: false,
    selectedRelationshipId: null,

    // --- Viewport & Transform ---
    viewportTransform: { x: 0, y: 0, scale: 1 },

    // --- Panning State ---
    isPanning: false,
    panStart: { x: 0, y: 0 },
    panOffset: { x: 0, y: 0 },

    // --- Node Dragging ---
    draggingNodeId: null,
    dragStartMouse: { x: 0, y: 0 },
    dragStartNodePos: { x: 0, y: 0 },
    dragDelta: { x: 0, y: 0 },
    hoveredParentId: null,
    resizingNodeId: null,
    resizeStartMouse: { x: 0, y: 0 },
    resizeStartSize: { width: 0, height: 0 },
    lastPointerDownNodeId: null,
    lastPointerDownAt: 0,

    // --- Relationship Linking ---
    linkingSourceId: null,
    linkingMousePos: null,

    // --- History (Undo/Redo) ---
    undoStack: [],
    redoStack: [],

    // --- File & Map Info ---
    currentMapName: "",
    saveFileHandle: null,

    // --- Topic Search ---
    topicSearchQuery: "",
    topicSearchMatches: [],
    topicSearchIndex: -1,

    // --- View Filters ---
    visibleDepthLimit: null
};

export const constants = {
    MAX_HISTORY: 50
};

// Helper functions for state mutations
export function resetState() {
    state.nodes = {
        "root": { id: "root", text: "Central Topic", parent: null, x: 0, y: 0, color: { bg: "#0ea5e9" } }
    };
    state.relationships = [];
    state.selectedNodeId = "root";
    state.editingNodeId = null;
    state.editingBuffer = null;
    state.editingReplaceOnType = false;
    state.selectedRelationshipId = null;
    state.viewportTransform = { x: 0, y: 0, scale: 1 };
    state.isPanning = false;
    state.panStart = { x: 0, y: 0 };
    state.panOffset = { x: 0, y: 0 };
    state.draggingNodeId = null;
    state.dragStartMouse = { x: 0, y: 0 };
    state.dragStartNodePos = { x: 0, y: 0 };
    state.dragDelta = { x: 0, y: 0 };
    state.hoveredParentId = null;
    state.resizingNodeId = null;
    state.resizeStartMouse = { x: 0, y: 0 };
    state.resizeStartSize = { width: 0, height: 0 };
    state.lastPointerDownNodeId = null;
    state.lastPointerDownAt = 0;
    state.linkingSourceId = null;
    state.linkingMousePos = null;
    state.undoStack = [];
    state.redoStack = [];
    state.currentMapName = "";
    state.saveFileHandle = null;
    state.topicSearchQuery = "";
    state.topicSearchMatches = [];
    state.topicSearchIndex = -1;
    state.visibleDepthLimit = null;
}
