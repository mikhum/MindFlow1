// ============================================================================
// layout.js - Map Layout & Parsing
// ============================================================================
// Handles layout of imported maps and parsing of various file formats.

import { state } from './state.js';
import { generateId } from './utils.js';

/**
 * Auto-layout imported map with balanced tree layout
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

    const absPositions = {};
    const spacingX = 220;
    const spacingY = 100;
    const siblingGap = 30;

    function layoutNode(nodeId, x, y, side) {
        absPositions[nodeId] = { x, y, side };
        const children = (childrenMap[nodeId] || []).slice();
        if (children.length === 0) return;

        const totalHeight = children.reduce((sum, childId) => {
            return sum + getSubtreeCount(childId) * spacingY;
        }, 0) + siblingGap * Math.max(0, children.length - 1);

        let currentY = y - totalHeight / 2 + spacingY / 2;
        children.forEach(childId => {
            const childHeight = getSubtreeCount(childId) * spacingY;
            const childY = currentY + childHeight / 2 - spacingY / 2;
            currentY += childHeight + siblingGap;
            layoutNode(childId, x + spacingX * side, childY, side);
        });
    }

    const root = state.nodes.root;
    if (!root) return;
    absPositions.root = { x: 0, y: 0, side: 1 };

    const rootChildren = childrenMap.root || [];
    if (rootChildren.length === 0) return;

    const rightChildren = [];
    const leftChildren = [];
    rootChildren.forEach((childId, index) => {
        if (index % 2 === 0) {
            rightChildren.push(childId);
        } else {
            leftChildren.push(childId);
        }
    });

    let yRight = 0;
    rightChildren.forEach(childId => {
        const subtreeHeight = getSubtreeCount(childId) * spacingY;
        const childY = yRight + subtreeHeight / 2 - spacingY / 2;
        yRight += subtreeHeight + siblingGap;
        layoutNode(childId, spacingX, childY, 1);
    });

    let yLeft = 0;
    leftChildren.forEach(childId => {
        const subtreeHeight = getSubtreeCount(childId) * spacingY;
        const childY = yLeft + subtreeHeight / 2 - spacingY / 2;
        yLeft += subtreeHeight + siblingGap;
        layoutNode(childId, -spacingX, childY, -1);
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

    // Traverse all nodes
    const rootNodeElements = mapNode.querySelectorAll(":scope > node");
    rootNodeElements.forEach(nodeElem => {
        traverse(nodeElem, "root", 1);
    });

    return {
        name: mapNode.getAttribute("id") || "Imported Map",
        nodes: nodes,
        relationships: relationships
    };
}
