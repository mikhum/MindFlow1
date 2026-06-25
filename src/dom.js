// ============================================================================
// dom.js - Centralized DOM Element References
// ============================================================================
// All DOM element references are stored here to avoid redundancy.

let domElements = null;

function ensureCloudMenuMarkup() {
    const hasGoogleControls = !!document.getElementById("btn-google-signin");
    if (hasGoogleControls) {
        return;
    }

    const mapparTrigger = Array.from(document.querySelectorAll(".menu-trigger")).find(
        (btn) => (btn.textContent || "").trim().toLowerCase() === "mappar"
    );
    const dropdown = mapparTrigger?.closest(".menu-item")?.querySelector(".menu-dropdown");
    if (!dropdown) {
        return;
    }

    const existingLocalList = dropdown.querySelector("#saved-maps-list");
    const localListMarkup = existingLocalList
        ? existingLocalList.outerHTML
        : '<div class="saved-maps-list" id="saved-maps-list"><div class="empty-state">No saved maps found in browser storage.</div></div>';

    dropdown.innerHTML = `
        <div class="cloud-auth-row">
            <button class="btn btn-outline" id="btn-google-signin" title="Sign in with Google">
                <i class="fa-brands fa-google"></i> Logga in Google
            </button>
            <button class="btn btn-outline" id="btn-google-signout" title="Sign out from Google">
                <i class="fa-solid fa-right-from-bracket"></i> Logga ut
            </button>
        </div>
        <button class="btn btn-outline" id="btn-google-refresh" title="Refresh Google Drive files">
            <i class="fa-solid fa-rotate"></i> Uppdatera Google-lista
        </button>
        <label class="form-label" for="google-client-id-input">Google Client ID</label>
        <div class="button-group-row">
            <input id="google-client-id-input" class="topic-search-input" type="text" placeholder="1234567890-xxxx.apps.googleusercontent.com" aria-label="Google Client ID">
            <button class="btn btn-outline" id="btn-google-save-client-id" title="Save Google Client ID">
                <i class="fa-solid fa-check"></i> Spara
            </button>
        </div>
        <p class="field-hint" id="google-auth-status">Google: inte inloggad.</p>
        <div class="saved-maps-list" id="google-maps-list">
            <div class="empty-state">Logga in for att lista JSON i Google Drive.</div>
        </div>
        <div class="menu-separator"></div>
        ${localListMarkup}
    `;
}

/**
 * Initialize all DOM element references
 * Should be called once during app initialization
 */
export function initDomElements() {
    ensureCloudMenuMarkup();

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
        menuOpenHelp: document.getElementById("menu-open-help"),

        // Sidebar buttons
        btnHideSidebar: document.getElementById("hide-sidebar"),
        btnShowSidebar: document.getElementById("show-sidebar"),
        btnNewMap: document.getElementById("btn-new-map"),
        btnSaveMap: document.getElementById("btn-save-map"),
        btnSaveAsMap: document.getElementById("btn-save-as-map"),
        btnSaveGoogleMap: document.getElementById("btn-save-google-map"),
        btnArrangeMap: document.getElementById("btn-arrange-map"),
        btnExportDoc: document.getElementById("btn-export-doc"),
        btnExportPdf: document.getElementById("btn-export-pdf"),
        pdfOrientationSelect: document.getElementById("pdf-orientation"),
        btnOpenMindflow: document.getElementById("btn-open-mindflow"),
        btnImportMindMeister: document.getElementById("btn-import-mindmeister"),
        savedMapsList: document.getElementById("saved-maps-list"),
        googleMapsList: document.getElementById("google-maps-list"),
        btnGoogleSignin: document.getElementById("btn-google-signin"),
        btnGoogleSignout: document.getElementById("btn-google-signout"),
        btnGoogleRefresh: document.getElementById("btn-google-refresh"),
        googleAuthStatus: document.getElementById("google-auth-status"),
        topicSearchInput: document.getElementById("topic-search-input"),
        topicSearchPrev: document.getElementById("topic-search-prev"),
        topicSearchNext: document.getElementById("topic-search-next"),
        topicSearchStatus: document.getElementById("topic-search-status"),

        // File inputs
        fileImportInput: document.getElementById("file-import-input"),
        fileImportMindMeisterInput: document.getElementById("file-import-mindmeister-input"),

        // Node styling controls
        nodeColorPicker: document.getElementById("node-color-picker"),
        nodeColorClearBtn: document.getElementById("node-color-clear"),
        nodeColorPalette: document.getElementById("node-color-palette"),
        topicAlignControls: document.getElementById("topic-align-controls"),
        topicAlignCenter: document.getElementById("topic-align-center"),
        topicAlignLeft: document.getElementById("topic-align-left"),
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
