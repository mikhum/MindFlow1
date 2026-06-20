// ============================================================================
// utils.js - Utility Functions
// ============================================================================
// General helper functions used across the application.

import { state } from './state.js';

/**
 * Get the absolute canvas coordinates of a node
 */
export function getAbsoluteCoords(nodeId, ignoreDragDelta = false) {
    const node = state.nodes[nodeId];
    if (!node) return { x: 0, y: 0 };

    let x = node.x;
    let y = node.y;

    let parentId = node.parent;
    while (parentId) {
        const parent = state.nodes[parentId];
        if (!parent) break;
        x += parent.x;
        y += parent.y;
        parentId = parent.parent;
    }

    if (!ignoreDragDelta && state.draggingNodeId === nodeId) {
        x += state.dragDelta.x;
        y += state.dragDelta.y;
    }

    return { x, y };
}

/**
 * Check if nodeId is a descendant of potentialAncestorId
 */
export function isDescendantOf(nodeId, potentialAncestorId) {
    let currentParentId = state.nodes[nodeId]?.parent;
    while (currentParentId) {
        if (currentParentId === potentialAncestorId) return true;
        currentParentId = state.nodes[currentParentId]?.parent;
    }
    return false;
}

/**
 * Get the depth of a node in the tree (0 for root, 1 for direct children, etc.)
 */
export function getNodeDepth(nodeId) {
    let depth = 0;
    let currentId = nodeId;
    while (state.nodes[currentId]?.parent) {
        depth++;
        currentId = state.nodes[currentId].parent;
    }
    return depth;
}

/**
 * Calculate contrasting text color (black or white) for a given background hex color
 */
export function getContrastingTextColor(hexColor) {
    if (!hexColor || hexColor === "none") return "#000000";
    
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? "#000000" : "#ffffff";
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Calculate edge point of a rectangle for line drawing
 */
export function getEdgePoint(fromCenter, toCenter, nodeW, nodeH) {
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return toCenter;

    const normX = dx / dist;
    const normY = dy / dist;

    const angle = Math.atan2(dy, dx);
    const halfW = nodeW / 2;
    const halfH = nodeH / 2;

    const rectCornerAngles = [
        Math.atan2(-halfH, halfW),   // top-right
        Math.atan2(halfH, halfW),    // bottom-right
        Math.atan2(halfH, -halfW),   // bottom-left
        Math.atan2(-halfH, -halfW)   // top-left
    ];

    let closestAngle = rectCornerAngles[0];
    let minDiff = Math.abs(angle - closestAngle);

    for (let i = 1; i < rectCornerAngles.length; i++) {
        const diff = Math.abs(angle - rectCornerAngles[i]);
        if (diff < minDiff) {
            minDiff = diff;
            closestAngle = rectCornerAngles[i];
        }
    }

    const edgeX = toCenter.x - halfW * Math.cos(closestAngle);
    const edgeY = toCenter.y - halfH * Math.sin(closestAngle);

    return { x: edgeX, y: edgeY };
}

/**
 * Generate a unique ID for nodes and relationships
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
