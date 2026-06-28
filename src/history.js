// ============================================================================
// history.js - Undo/Redo History Management
// ============================================================================
// Manages action history for undo and redo functionality.

import { state, constants } from './state.js';
import { scheduleAutosave } from './autosave.js';

/**
 * Save current state to undo stack
 */
export function saveHistory(options = {}) {
    const { triggerAutosave = true } = options;
    const snapshot = {
        nodes: JSON.parse(JSON.stringify(state.nodes)),
        relationships: JSON.parse(JSON.stringify(state.relationships))
    };

    state.undoStack.push(snapshot);

    // Limit history size
    if (state.undoStack.length > constants.MAX_HISTORY) {
        state.undoStack.shift();
    }

    // Clear redo stack when new action is performed
    state.redoStack = [];

    if (triggerAutosave) {
        scheduleAutosave();
    }
}

/**
 * Undo the last action
 */
export function undo() {
    if (state.undoStack.length === 0) return;

    // Save current state to redo stack
    const currentSnapshot = {
        nodes: JSON.parse(JSON.stringify(state.nodes)),
        relationships: JSON.parse(JSON.stringify(state.relationships))
    };
    state.redoStack.push(currentSnapshot);

    // Restore previous state
    const previousSnapshot = state.undoStack.pop();
    state.nodes = previousSnapshot.nodes;
    state.relationships = previousSnapshot.relationships;

    // Update selection to valid state
    if (!state.nodes[state.selectedNodeId]) {
        state.selectedNodeId = "root";
    }
    state.selectedRelationshipId = null;
    scheduleAutosave();
}

/**
 * Redo the last undone action
 */
export function redo() {
    if (state.redoStack.length === 0) return;

    // Save current state to undo stack
    const currentSnapshot = {
        nodes: JSON.parse(JSON.stringify(state.nodes)),
        relationships: JSON.parse(JSON.stringify(state.relationships))
    };
    state.undoStack.push(currentSnapshot);

    // Restore next state
    const nextSnapshot = state.redoStack.pop();
    state.nodes = nextSnapshot.nodes;
    state.relationships = nextSnapshot.relationships;

    // Update selection to valid state
    if (!state.nodes[state.selectedNodeId]) {
        state.selectedNodeId = "root";
    }
    state.selectedRelationshipId = null;
    scheduleAutosave();
}
