// ============================================================================
// dom.js - Centralized DOM Element References
// ============================================================================
// All DOM element references are stored here to avoid redundancy.

let domElements = null;

/**
 * Initialize all DOM element references
 * Should be called once during app initialization
 */
export function initDomElements() {
    domElements = {
        // Main containers
        workspace: document.getElementById("workspace"),
        canvas: document.getElementById("canvas"),
        nodesContainer: document.getElementById("nodes-container"),
        svgOverlay: document.getElementById("svg-overlay"),
        zoomIndicator: document.getElementById("zoom-indicator"),
        sidebar: document.getElementById("sidebar"),

        // Floating controls
        ctrlZoomIn: document.getElementById("ctrl-zoom-in"),
        ctrlZoomOut: document.getElementById("ctrl-zoom-out"),
        ctrlResetView: document.getElementById("ctrl-reset-view"),
        ctrlAddChild: document.getElementById("ctrl-add-child"),
        ctrlAddRelationship: document.getElementById("ctrl-add-relationship"),
        ctrlDeleteNode: document.getElementById("ctrl-delete-node"),
        ctrlHelp: document.getElementById("ctrl-help"),

        // Sidebar buttons
        btnHideSidebar: document.getElementById("hide-sidebar"),
        btnShowSidebar: document.getElementById("show-sidebar"),
        btnNewMap: document.getElementById("btn-new-map"),
        btnSaveMap: document.getElementById("btn-save-map"),
        btnArrangeMap: document.getElementById("btn-arrange-map"),
        btnExportFile: document.getElementById("btn-export-file"),
        btnExportDoc: document.getElementById("btn-export-doc"),
        btnOpenMindflow: document.getElementById("btn-open-mindflow"),
        btnImportFile: document.getElementById("btn-import-file"),
        btnImportMindMeister: document.getElementById("btn-import-mindmeister"),
        savedMapsList: document.getElementById("saved-maps-list"),

        // File inputs
        fileImportInput: document.getElementById("file-import-input"),
        fileImportMindMeisterInput: document.getElementById("file-import-mindmeister-input"),

        // Node styling controls
        nodeColorPicker: document.getElementById("node-color-picker"),
        nodeColorClearBtn: document.getElementById("node-color-clear"),
        nodeColorPalette: document.getElementById("node-color-palette"),
        nodeCommentTextarea: document.getElementById("node-comment"),

        // Help modal
        helpModal: document.getElementById("help-modal"),
        btnCloseHelpModal: document.getElementById("close-help-modal"),
        btnCloseHelp: document.getElementById("btn-close-help"),

        // Linking banner
        linkingBanner: document.getElementById("linking-banner")
    };

    return domElements;
}

/**
 * Get all DOM element references
 */
export function getDomElements() {
    if (!domElements) {
        throw new Error("DOM elements not initialized. Call initDomElements() first.");
    }
    return domElements;
}

/**
 * Get a specific DOM element by key
 */
export function getElement(key) {
    if (!domElements) {
        throw new Error("DOM elements not initialized. Call initDomElements() first.");
    }
    return domElements[key];
}
