// ============================================================================
// relationships.js - Relationship Link Management
// ============================================================================
// Manages creation, selection, and deletion of relationships between nodes.

import { state } from './state.js';
import { saveHistory } from './history.js';
import { generateId } from './utils.js';
import { getDomElements } from './dom.js';

/**
 * Start linking mode (creating a relationship)
 */
export function startLinkingMode(sourceId) {
    state.linkingSourceId = sourceId;
    state.linkingMousePos = null;
    
    const { linkingBanner } = getDomElements();
    if (linkingBanner) {
        linkingBanner.style.display = "flex";
    }
}

/**
 * Cancel linking mode
 */
export function cancelLinkingMode() {
    state.linkingSourceId = null;
    state.linkingMousePos = null;
    
    const { linkingBanner } = getDomElements();
    if (linkingBanner) {
        linkingBanner.style.display = "none";
    }
}

/**
 * Create a relationship between two nodes
 */
export function createRelationship(fromId, toId) {
    if (fromId === toId) {
        alert("Cannot create a relationship from a node to itself.");
        return false;
    }

    // Check if relationship already exists
    const exists = state.relationships.some(rel => rel.fromId === fromId && rel.toId === toId);
    if (exists) {
        return false;
    }

    const relId = generateId();
    state.relationships.push({
        id: relId,
        fromId: fromId,
        toId: toId
    });

    saveHistory();
    return true;
}

/**
 * Select a relationship
 */
export function selectRelationship(relId) {
    state.selectedRelationshipId = relId;
    state.selectedNodeId = null;
}

/**
 * Delete a relationship
 */
export function deleteRelationship(relId) {
    state.relationships = state.relationships.filter(r => r.id !== relId);
    
    if (state.selectedRelationshipId === relId) {
        state.selectedRelationshipId = null;
    }
    
    saveHistory();
}

/**
 * Set relationship color
 */
export function setRelationshipColor(relId, color) {
    const relationship = state.relationships.find(rel => rel.id === relId);
    if (!relationship) return;

    relationship.color = color;
    saveHistory();
}

/**
 * Clear relationship color
 */
export function clearRelationshipColor(relId) {
    const relationship = state.relationships.find(rel => rel.id === relId);
    if (!relationship) return;

    delete relationship.color;
    saveHistory();
}

/**
 * Set relationship comment
 */
export function setRelationshipComment(relId, comment) {
    const relationship = state.relationships.find(rel => rel.id === relId);
    if (!relationship) return;

    const trimmedComment = comment.trim();
    if (trimmedComment) {
        relationship.comment = trimmedComment;
    } else {
        delete relationship.comment;
    }

    saveHistory();
}

/**
 * Get all relationships for a node (both incoming and outgoing)
 */
export function getNodeRelationships(nodeId) {
    return state.relationships.filter(rel => rel.fromId === nodeId || rel.toId === nodeId);
}

/**
 * Check if a relationship exists between two nodes
 */
export function hasRelationship(fromId, toId) {
    return state.relationships.some(rel => rel.fromId === fromId && rel.toId === toId);
}
