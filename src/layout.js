// ============================================================================
// layout.js - Map Layout & Parsing
// ============================================================================
// Handles layout of imported maps and parsing of various file formats.

import { state } from './state.js';
import { generateId } from './utils.js';
import { getAbsoluteCoords } from './utils.js';

/**
 * Arrange map in a readable left/right tree layout.
 * Root children are placed on left/right sides, and descendants continue on the same side.
 */
export function layoutImportedMap() {
    const childrenMap = {};
    Object.keys(state.nodes).forEach(id => {
        const parentId = state.nodes[id].parent;
        if (!parentId) return;
        if (!childrenMap[parentId]) childrenMap[parentId] = [];
        childrenMap[parentId].push(id);
    });

    function getSubtreeCount(nodeId) {
        const children = childrenMap[nodeId] || [];
        let count = 1;
        children.forEach(childId => {
            count += getSubtreeCount(childId);
        });
        return count;
    }

    function sortByCurrentY(ids) {
        return [...ids].sort((a, b) => {
            const ay = Number(state.nodes[a]?.y) || 0;
            const by = Number(state.nodes[b]?.y) || 0;
            return ay - by;
        });
    }

    const absPositions = {};
    const rootSpacingX = 360;
    const depthSpacingX = 180;
    const spacingY = 130;
    const siblingGap = 48;
    const rootSiblingGap = 72;

    function getNodeVisualWidth(nodeId) {
        const renderedNode = document.getElementById(`node-${nodeId}`);
        if (renderedNode && renderedNode.offsetWidth > 0) {
            return renderedNode.offsetWidth;
        }

        const node = state.nodes[nodeId];
        if (!node) return 160;

        if (Number.isFinite(node.width) && node.width > 0) {
            return node.width;
        }

        const text = String(node.text || "");
        const approx = Math.min(360, Math.max(120, text.length * 6.4 + 56));
        return approx;
    }

    function getNodeVisualHeight(nodeId) {
        const renderedNode = document.getElementById(`node-${nodeId}`);
        if (renderedNode && renderedNode.offsetHeight > 0) {
            return renderedNode.offsetHeight;
        }

        const node = state.nodes[nodeId];
        if (!node) return 48;

        if (Number.isFinite(node.height) && node.height > 0) {
            return node.height;
        }

        const text = String(node.text || "");
        const hardLineCount = text.split(/\n/).length;
        const wrapLineCount = Math.max(1, Math.ceil(text.length / 28));
        const lineCount = Math.max(hardLineCount, wrapLineCount);
        return 40 + Math.max(0, lineCount - 1) * 20;
    }

    // Place root at origin
    absPositions.root = { x: 0, y: 0 };

    // Get depth-1 children
    const rootChildren = childrenMap.root || [];
    if (rootChildren.length === 0) {
        // No children to arrange
        state.nodes.root.x = 0;
        state.nodes.root.y = 0;
        return;
    }

    // Pick side for each root child. Preserve existing side when available.
    const sideByRootChild = new Map();
    let rightCount = 0;
    let leftCount = 0;

    function getSubtreeAverageAbsoluteX(nodeId) {
        let sum = 0;
        let count = 0;

        function walk(id) {
            if (!state.nodes[id]) return;
            sum += getAbsoluteCoords(id, true).x;
            count += 1;

            const children = childrenMap[id] || [];
            children.forEach((childId) => walk(childId));
        }

        walk(nodeId);
        return count > 0 ? sum / count : 0;
    }

    sortByCurrentY(rootChildren).forEach((childId, index) => {
        const existingX = Number(state.nodes[childId]?.x) || 0;
        const nodeWidth = getNodeVisualWidth(childId);
        const leftEdge = existingX - nodeWidth / 2;
        const rightEdge = existingX + nodeWidth / 2;
        let side = 0;

        if (leftEdge > 20) {
            side = 1;
        } else if (rightEdge < -20) {
            side = -1;
        } else {
            const subtreeAvgX = getSubtreeAverageAbsoluteX(childId);
            if (subtreeAvgX > 20) {
                side = 1;
            } else if (subtreeAvgX < -20) {
                side = -1;
            }
        }

        if (side === 0) {
            // If side is unknown, balance sides while preserving order.
            side = rightCount <= leftCount ? 1 : -1;
            if (rightCount === leftCount) {
                side = index % 2 === 0 ? 1 : -1;
            }
        }

        sideByRootChild.set(childId, side);
        if (side > 0) {
            rightCount++;
        } else {
            leftCount++;
        }
    });

    function getSubtreeHeight(nodeId) {
        const children = childrenMap[nodeId] || [];
        const ownHeight = Math.max(spacingY, getNodeVisualHeight(nodeId) + 20);
        if (children.length === 0) return ownHeight;

        const totalChildrenHeight = children.reduce((sum, childId) => {
            return sum + getSubtreeHeight(childId);
        }, 0);

        return Math.max(
            ownHeight,
            totalChildrenHeight + siblingGap * Math.max(0, children.length - 1)
        );
    }

    function layoutSubtree(nodeId, parentAbsX, parentAbsY, side) {
        const children = sortByCurrentY(childrenMap[nodeId] || []);
        if (children.length === 0) return;

        const totalHeight = children.reduce((sum, childId) => {
            return sum + getSubtreeHeight(childId);
        }, 0) + siblingGap * Math.max(0, children.length - 1);

        let currentY = parentAbsY - totalHeight / 2;
        children.forEach(childId => {
            const childHeight = getSubtreeHeight(childId);
            const childY = currentY + childHeight / 2;
            const parentW = getNodeVisualWidth(nodeId);
            const childW = getNodeVisualWidth(childId);
            const linkDistance = depthSpacingX + Math.round(parentW * 0.52 + childW * 0.38);
            const childX = parentAbsX + linkDistance * side;
            absPositions[childId] = { x: childX, y: childY, side };
            currentY += childHeight + siblingGap;

            layoutSubtree(childId, childX, childY, side);
        });
    }

    // Place root children side-by-side with balanced vertical spacing on each side.
    [1, -1].forEach((side) => {
        const sideChildren = sortByCurrentY(rootChildren.filter((id) => sideByRootChild.get(id) === side));
        if (sideChildren.length === 0) return;

        const totalHeight = sideChildren.reduce((sum, childId) => {
            return sum + getSubtreeHeight(childId);
        }, 0) + rootSiblingGap * Math.max(0, sideChildren.length - 1);

        let currentY = -totalHeight / 2;
        sideChildren.forEach((childId) => {
            const childHeight = getSubtreeHeight(childId);
            const childY = currentY + childHeight / 2;
            const rootW = getNodeVisualWidth("root");
            const childW = getNodeVisualWidth(childId);
            const rootLinkDistance = rootSpacingX + Math.round(rootW * 0.48 + childW * 0.4);
            const childX = rootLinkDistance * side;

            absPositions[childId] = { x: childX, y: childY, side };
            layoutSubtree(childId, childX, childY, side);

            currentY += childHeight + rootSiblingGap;
        });
    });

    // Convert absolute positions to relative parent-relative positions
    Object.keys(state.nodes).forEach(id => {
        const node = state.nodes[id];
        if (id === "root") {
            node.x = 0;
            node.y = 0;
            return;
        }
        const abs = absPositions[id];
        const parentAbs = absPositions[node.parent] || { x: 0, y: 0 };
        node.x = abs.x - parentAbs.x;
        node.y = abs.y - parentAbs.y;
    });
}

/**
 * Parse Freemind/MindMeister XML format (.mm files)
 */
export function parseFreemindXml(xmlText) {
    // Strip UTF-8 BOM / leading whitespace so parser sees the XML root immediately.
    xmlText = xmlText.replace(/^\uFEFF/, "");
    xmlText = xmlText.replace(/^\s+/, "");

    if (!xmlText.startsWith("<")) {
        const snippet = xmlText.slice(0, 50).replace(/\s+/g, " ").trim();
        throw new Error("File does not appear to be valid XML. First characters: " + JSON.stringify(snippet));
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    const parserErrors = xmlDoc.getElementsByTagName("parsererror");
    if (parserErrors.length > 0 || xmlDoc.documentElement.nodeName === "parsererror") {
        const errorText = parserErrors.length > 0 ? parserErrors[0].textContent : xmlDoc.documentElement.textContent;
        throw new Error("Could not parse XML file." + (errorText ? " " + errorText.trim() : ""));
    }

    const rootElement = xmlDoc.documentElement;
    let mapNode = null;
    if (rootElement && rootElement.tagName.toLowerCase() === "map") {
        mapNode = rootElement;
    } else {
        const maps = xmlDoc.getElementsByTagName("map");
        if (maps.length > 0) {
            mapNode = maps[0];
        }
    }

    if (!mapNode) {
        throw new Error("No <map> element found in XML.");
    }

    const nodes = {};
    const relationships = [];

    function createNodeEntry(text, parentId, depth, comment) {
        const nodeId = generateId();
        nodes[nodeId] = {
            id: nodeId,
            text: text || "Untitled",
            parent: parentId,
            x: 0,
            y: 0,
            comment: comment || null
        };
        return nodeId;
    }

    function extractNoteText(nodeElem) {
        const richContentElement = nodeElem.querySelector("richcontent[TYPE='NOTE']");
        if (richContentElement) {
            const html = richContentElement.innerHTML || richContentElement.textContent || "";
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            return tempDiv.textContent || "";
        }
        return null;
    }

    function traverse(nodeElem, parentId, depth) {
        const nodeText = nodeElem.getAttribute("TEXT") || nodeElem.getAttribute("text") || "";
        const comment = extractNoteText(nodeElem);
        const nodeId = createNodeEntry(nodeText, parentId, depth, comment);

        const children = nodeElem.querySelectorAll(":scope > node");
        children.forEach(child => {
            traverse(child, nodeId, depth + 1);
        });

        return nodeId;
    }

    // Initialize root
    const rootText = mapNode.querySelector(":scope > node")?.getAttribute("TEXT") || "Central Topic";
    nodes.root = {
        id: "root",
        text: rootText,
        parent: null,
        x: 0,
        y: 0
    };

    // Traverse nodes - if there is a single top-level node it IS the root,
    // so traverse its children directly to avoid creating a duplicate level.
    const rootNodeElements = mapNode.querySelectorAll(":scope > node");
    if (rootNodeElements.length === 1) {
        const singleRootElem = rootNodeElements[0];
        singleRootElem.querySelectorAll(":scope > node").forEach(child => {
            traverse(child, "root", 1);
        });
    } else {
        rootNodeElements.forEach(nodeElem => {
            traverse(nodeElem, "root", 1);
        });
    }

    return {
        name: mapNode.getAttribute("id") || "Imported Map",
        nodes: nodes,
        relationships: relationships
    };
}
