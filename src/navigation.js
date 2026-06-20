// ============================================================================
// navigation.js - Navigation & Viewport Positioning
// ============================================================================
// Handles centering and scrolling to specific nodes.

import { state } from './state.js';
import { getAbsoluteCoords } from './utils.js';
import { getDomElements } from './dom.js';
import { updateCanvasTransform } from './viewport.js';

/**
 * Scroll viewport to show a node
 */
export function scrollToNode(nodeId) {
    const { workspace } = getDomElements();
    if (!workspace) return;

    const nodeDiv = document.getElementById(`node-${nodeId}`);
    if (!nodeDiv) return;

    const nodeRect = nodeDiv.getBoundingClientRect();
    const viewportRect = workspace.getBoundingClientRect();

    const scrollX = nodeRect.left - viewportRect.left - viewportRect.width / 2 + nodeRect.width / 2;
    const scrollY = nodeRect.top - viewportRect.top - viewportRect.height / 2 + nodeRect.height / 2;

    state.viewportTransform.x -= scrollX;
    state.viewportTransform.y -= scrollY;

    updateCanvasTransform();
}

/**
 * Center viewport on a node with specific zoom
 */
export function centerOnNode(nodeId) {
    const { workspace, canvas } = getDomElements();
    if (!workspace || !canvas) return;

    const coords = getAbsoluteCoords(nodeId);
    const viewportWidth = workspace.clientWidth;
    const viewportHeight = workspace.clientHeight;

    state.viewportTransform.scale = 1;
    state.viewportTransform.x = viewportWidth / 2 - coords.x;
    state.viewportTransform.y = viewportHeight / 2 - coords.y;

    updateCanvasTransform();
}

/**
 * Navigate to adjacent node based on geometric proximity
 */
export function navigateGeometrically(direction) {
    if (!state.selectedNodeId) return;

    const currentCoords = getAbsoluteCoords(state.selectedNodeId);
    const allNodeIds = Object.keys(state.nodes);

    if (allNodeIds.length <= 1) return;

    let targetId = null;
    let bestScore = Infinity;

    allNodeIds.forEach(nodeId => {
        if (nodeId === state.selectedNodeId) return;

        const coords = getAbsoluteCoords(nodeId);
        const dx = coords.x - currentCoords.x;
        const dy = coords.y - currentCoords.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 50) return; // Too close, skip

        let score = Infinity;
        switch (direction) {
            case "up":
                if (dy < 0) score = Math.abs(dx) + dist * 0.1;
                break;
            case "down":
                if (dy > 0) score = Math.abs(dx) + dist * 0.1;
                break;
            case "left":
                if (dx < 0) score = Math.abs(dy) + dist * 0.1;
                break;
            case "right":
                if (dx > 0) score = Math.abs(dy) + dist * 0.1;
                break;
        }

        if (score < bestScore) {
            bestScore = score;
            targetId = nodeId;
        }
    });

    if (targetId) {
        state.selectedNodeId = targetId;
        scrollToNode(targetId);
    }
}
