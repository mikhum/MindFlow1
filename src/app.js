// ============================================================================
// app.js - Main Application Entry Point
// ============================================================================
// Coordinates initialization and loads all modules.

import { state, resetState } from './state.js';
import { initDomElements, getDomElements } from './dom.js';
import { setupEventListeners } from './events.js';
import { initAutosaveLifecycle } from './autosave.js';
import { render, renderConnectors, updateNodeStyleControls } from './rendering.js';
import { loadMapList } from './fileIO.js';
import { centerOnNode } from './navigation.js';
import { updateCanvasTransform } from './viewport.js';
import { saveHistory } from './history.js';

/**
 * Initialize the application
 */
async function init() {
    // Initialize DOM element references
    initDomElements();

    // Setup event listeners
    setupEventListeners();
    initAutosaveLifecycle();

    // Refresh available cloud maps
    loadMapList();

    // Ensure we have a valid root node
    if (!state.nodes || !state.nodes.root) {
        resetState();
    }

    // Save initial state to history
    saveHistory({ triggerAutosave: false });

    // Render the mindmap
    render();
    centerOnNode("root");
    updateCanvasTransform();

    // Delayed redraw to calculate accurate node sizes once browser layout completes
    setTimeout(() => {
        renderConnectors();
    }, 150);
    console.log("MindMap app initialized successfully!");
}

// Start the app when DOM is ready
document.addEventListener("DOMContentLoaded", init);

// Export for module usage
export { init };
