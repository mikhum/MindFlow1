// ============================================================================
// nodes.js - Node Operations (Create, Read, Update, Delete, Selection)
// ============================================================================

import { state } from './state.js';
import { saveHistory } from './history.js';
import { generateId, getAbsoluteCoords } from './utils.js';

const NEW_NODE_HORIZONTAL_OFFSET = 180;
const NEW_SIBLING_VERTICAL_OFFSET = 110;

/**
 * Select a node
 */
export function selectNode(nodeId) {
    state.selectedNodeId = nodeId;
    state.selectedRelationshipId = null;
}

/**
 * Start editing a node's text
 */
export function startEditingNode(nodeId) {
    if (!state.nodes[nodeId]) return;
    state.editingNodeId = nodeId;
    state.editingBuffer = state.nodes[nodeId].text;
    state.editingReplaceOnType = true;
}

/**
 * Finish editing node text and commit changes
 */
export function finishEditingNode(nodeId, newText) {
    if (!state.nodes[nodeId]) {
        state.editingNodeId = null;
        state.editingBuffer = null;
        state.editingReplaceOnType = false;
        return;
    }

    const originalText = state.nodes[nodeId].text;
    const candidateText = (newText ?? "").trim() ? newText : originalText;
    if (candidateText !== originalText) {
        state.nodes[nodeId].text = candidateText;
        saveHistory();
    }

    state.editingNodeId = null;
    state.editingBuffer = null;
    state.editingReplaceOnType = false;
}

/**
 * Add a child node to a parent
 */
export function addChildNode(parentId) {
    if (!state.nodes[parentId]) return;

    // Ensure parent expands when a new child is added.
    if (state.nodes[parentId].collapsed) {
        state.nodes[parentId].collapsed = false;
    }

    const rootX = getAbsoluteCoords("root", true).x;
    const parentX = getAbsoluteCoords(parentId, true).x;
    const sideOffset = parentX < rootX ? -NEW_NODE_HORIZONTAL_OFFSET : NEW_NODE_HORIZONTAL_OFFSET;

    const childId = generateId();
    const childNode = {
        id: childId,
        text: "New Topic",
        parent: parentId,
        x: sideOffset,
        y: 0
    };

    state.nodes[childId] = childNode;
    state.selectedNodeId = childId;
    startEditingNode(childId);
    saveHistory();
    
    return childId;
}

/**
 * Add a sibling node to a given node
 */
export function addSiblingNode(nodeId) {
    const node = state.nodes[nodeId];
    if (!node || !node.parent) return;

    const parentId = node.parent;
    if (state.nodes[parentId].collapsed) {
        state.nodes[parentId].collapsed = false;
    }
    const rootX = getAbsoluteCoords("root", true).x;
    const parentX = getAbsoluteCoords(parentId, true).x;
    const sideOffset = parentX < rootX ? -NEW_NODE_HORIZONTAL_OFFSET : NEW_NODE_HORIZONTAL_OFFSET;
    const siblingId = generateId();
    const siblingNode = {
        id: siblingId,
        text: "New Topic",
        parent: parentId,
        x: sideOffset,
        y: (node.y || 0) + NEW_SIBLING_VERTICAL_OFFSET
    };

    state.nodes[siblingId] = siblingNode;
    state.selectedNodeId = siblingId;
    startEditingNode(siblingId);
    saveHistory();

    return siblingId;
}

/**
 * Delete a node and all its descendants
 */
export function deleteNode(nodeId) {
    if (nodeId === "root") {
        alert("Cannot delete the root node.");
        return;
    }

    function deleteRecursive(id) {
        Object.keys(state.nodes).forEach(key => {
            if (state.nodes[key].parent === id) {
                deleteRecursive(key);
            }
        });

        delete state.nodes[id];

        // Clean up any relationships involving this node
        state.relationships = state.relationships.filter(rel => {
            return rel.fromId !== id && rel.toId !== id;
        });
    }

    deleteRecursive(nodeId);

    // Update selection
    if (state.selectedNodeId === nodeId) {
        state.selectedNodeId = "root";
    }
    state.selectedRelationshipId = null;

    saveHistory();
}

/**
 * Set node color
 */
export function setNodeColor(nodeId, color) {
    if (!state.nodes[nodeId]) return;
    
    if (!state.nodes[nodeId].color) {
        state.nodes[nodeId].color = {};
    }
    
    state.nodes[nodeId].color.bg = color;
    saveHistory();
}

/**
 * Clear node color
 */
export function clearNodeColor(nodeId) {
    if (!state.nodes[nodeId]) return;
    
    if (state.nodes[nodeId].color) {
        state.nodes[nodeId].color.bg = null;
    }
    
    saveHistory();
}

/**
 * Set node comment
 */
export function setNodeComment(nodeId, comment) {
    if (!state.nodes[nodeId]) return;
    
    state.nodes[nodeId].comment = comment || null;
    saveHistory();
}

/**
 * Set node text alignment
 */
export function setNodeTextAlign(nodeId, align) {
    if (!state.nodes[nodeId]) return;

    const normalizedAlign = align === "left" ? "left" : "center";
    state.nodes[nodeId].textAlign = normalizedAlign;
    saveHistory();
}

/**
 * Move a node to a new parent (reparenting)
 */
export function reparentNode(nodeId, newParentId, newAbsolutePos = null) {
    if (!state.nodes[nodeId] || !state.nodes[newParentId]) return;
    
    // Prevent circular dependencies
    if (isDescendantOf(newParentId, nodeId)) {
        return false;
    }

    const rootX = getAbsoluteCoords("root", true).x;
    const parentAbs = getAbsoluteCoords(newParentId, true);
    const targetAbsX = newAbsolutePos ? newAbsolutePos.x : parentAbs.x;
    const isLeftSide = targetAbsX < rootX;
    const sideOffset = isLeftSide ? -180 : 180;

    // Collect current siblings under the new parent before inserting this node.
    const siblings = Object.keys(state.nodes).filter(
        (id) => id !== nodeId && state.nodes[id].parent === newParentId
    );

    let proposedY = newAbsolutePos ? newAbsolutePos.y - parentAbs.y : 0;
    const minSiblingDistance = 90;
    const siblingStep = 110;

    // Avoid dropping directly on top of existing siblings in the target branch.
    while (siblings.some((id) => Math.abs((state.nodes[id].y || 0) - proposedY) < minSiblingDistance)) {
        proposedY += siblingStep;
    }

    state.nodes[nodeId].parent = newParentId;
    state.nodes[nodeId].x = sideOffset;
    state.nodes[nodeId].y = proposedY;

    saveHistory();
    return true;
}

/**
 * Check if a node is a descendant of another
 */
function isDescendantOf(nodeId, potentialAncestorId) {
    let currentParentId = state.nodes[nodeId]?.parent;
    while (currentParentId) {
        if (currentParentId === potentialAncestorId) return true;
        currentParentId = state.nodes[currentParentId]?.parent;
    }
    return false;
}

/**
 * Get all direct children of a node
 */
export function getChildren(nodeId) {
    return Object.keys(state.nodes).filter(id => state.nodes[id].parent === nodeId);
}

/**
 * Get all descendants of a node (recursive)
 */
export function getDescendants(nodeId) {
    const descendants = [];
    const children = getChildren(nodeId);
    
    children.forEach(childId => {
        descendants.push(childId);
        descendants.push(...getDescendants(childId));
    });
    
    return descendants;
}

/**
 * Mirror a node subtree horizontally around each parent-child link.
 * Useful when moving a top-level branch from one side of root to the other.
 */
export function mirrorSubtreeHorizontally(nodeId) {
    if (!state.nodes[nodeId]) return;

    const descendants = getDescendants(nodeId);
    descendants.forEach((descendantId) => {
        if (!state.nodes[descendantId]) return;
        state.nodes[descendantId].x = -state.nodes[descendantId].x;
    });
}

/**
 * Check if a node is hidden because one of its ancestors is collapsed.
 */
export function isNodeHiddenByCollapsedAncestor(nodeId) {
    if (!state.nodes[nodeId]) return true;

    let currentParentId = state.nodes[nodeId].parent;
    while (currentParentId) {
        const parentNode = state.nodes[currentParentId];
        if (!parentNode) break;
        if (parentNode.collapsed) return true;
        currentParentId = parentNode.parent;
    }

    return false;
}

/**
 * Toggle collapsed/expanded state for a node's subtree.
 */
export function toggleNodeCollapsed(nodeId) {
    if (!state.nodes[nodeId]) return false;

    const hasChildren = getChildren(nodeId).length > 0;
    if (!hasChildren) return !!state.nodes[nodeId].collapsed;

    state.nodes[nodeId].collapsed = !state.nodes[nodeId].collapsed;

    if (state.selectedNodeId && isNodeHiddenByCollapsedAncestor(state.selectedNodeId)) {
        state.selectedNodeId = nodeId;
        state.selectedRelationshipId = null;
    }

    saveHistory();
    return state.nodes[nodeId].collapsed;
}
