// ============================================================================
// nodes.js - Node Operations (Create, Read, Update, Delete, Selection)
// ============================================================================

import { state } from './state.js';
import { saveHistory } from './history.js';
import { generateId } from './utils.js';

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
    state.editingNodeId = nodeId;
}

/**
 * Finish editing node text and commit changes
 */
export function finishEditingNode(nodeId, newText) {
    if (newText.trim()) {
        const originalText = state.nodes[nodeId].text;
        if (newText !== originalText) {
            state.nodes[nodeId].text = newText;
            saveHistory();
        }
    }
    state.editingNodeId = null;
}

/**
 * Add a child node to a parent
 */
export function addChildNode(parentId) {
    if (!state.nodes[parentId]) return;

    const childId = generateId();
    const childNode = {
        id: childId,
        text: "New Topic",
        parent: parentId,
        x: 150,
        y: 0
    };

    state.nodes[childId] = childNode;
    state.selectedNodeId = childId;
    state.editingNodeId = childId;
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
    const siblingId = generateId();
    const siblingNode = {
        id: siblingId,
        text: "New Topic",
        parent: parentId,
        x: 150,
        y: 80
    };

    state.nodes[siblingId] = siblingNode;
    state.selectedNodeId = siblingId;
    state.editingNodeId = siblingId;
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
 * Move a node to a new parent (reparenting)
 */
export function reparentNode(nodeId, newParentId) {
    if (!state.nodes[nodeId] || !state.nodes[newParentId]) return;
    
    // Prevent circular dependencies
    if (isDescendantOf(newParentId, nodeId)) {
        return false;
    }

    state.nodes[nodeId].parent = newParentId;
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
