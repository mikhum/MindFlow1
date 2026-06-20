// ============================================================================
// fileIO.js - File Input/Output & Storage
// ============================================================================
// Handles saving, loading, importing, and exporting mindmaps.

import { state, resetState } from './state.js';
import { render, renderConnectors } from './rendering.js';
import { centerOnNode } from './navigation.js';
import { layoutImportedMap, parseFreemindXml } from './layout.js';
import { saveHistory } from './history.js';
import { getDomElements } from './dom.js';

/**
 * Save current state to LocalStorage autosave
 */
export function saveAutosave() {
    localStorage.setItem("mindflow_autosave", JSON.stringify({
        name: state.currentMapName,
        nodes: state.nodes,
        relationships: state.relationships
    }));
}

/**
 * Handle saving map to file
 */
export async function handleSaveMap() {
    // Use explicit root text if currentMapName is not set (i.e., this is a new unsaved map)
    const suggestedName = state.currentMapName || (state.nodes.root && state.nodes.root.text) || "My Mindmap";
    
    const mapData = {
        format: "mindflow",
        version: "1.0",
        name: suggestedName,
        nodes: state.nodes,
        relationships: state.relationships
    };

    saveMapToBrowserStorage(suggestedName, mapData);
    saveAutosave();
    loadMapList();

    if (window.showSaveFilePicker) {
        if (!state.saveFileHandle) {
            try {
                state.saveFileHandle = await window.showSaveFilePicker({
                    types: [
                        {
                            description: "MindFlow map file",
                            accept: { "application/json": [".mindflow", ".json"] }
                        }
                    ],
                    suggestedName: getSuggestedMapFilename(mapData.name)
                });
            } catch (err) {
                if (err.name === "AbortError") return;
                console.error("Save file picker failed:", err);
                alert("Unable to open save file dialog.");
                return;
            }
        }

        try {
            await writeMapToHandle(state.saveFileHandle, mapData);
            state.currentMapName = state.saveFileHandle.name || mapData.name;
            saveMapToBrowserStorage(state.currentMapName, {
                ...mapData,
                name: state.currentMapName
            });
            saveAutosave();
            loadMapList();
            alert(`Map saved to ${state.currentMapName}`);
        } catch (err) {
            console.error("Saving map failed:", err);
            alert("Unable to save the map file.");
        }
    } else {
        // Fallback for browsers without File System Access API
        downloadMapFile(mapData);
        alert("Your browser does not support direct overwrite save. The map has been downloaded instead.");
    }
}

function saveMapToBrowserStorage(name, mapData) {
    const savedMaps = JSON.parse(localStorage.getItem("mindflow_saved_maps") || "{}");
    savedMaps[name] = {
        name,
        nodes: mapData.nodes,
        relationships: mapData.relationships,
        updatedAt: Date.now()
    };
    localStorage.setItem("mindflow_saved_maps", JSON.stringify(savedMaps));
}

/**
 * Generate safe filename from map name
 */
export function getSuggestedMapFilename(name) {
    // Preserve non-ASCII characters (like Swedish å, ä, ö) and replace only problematic characters
    const safeName = String(name)
        .trim()
        .toLowerCase()
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-") // Remove filesystem-invalid characters
        .replace(/\s+/g, "-") // Replace spaces with dashes
        .replace(/^-+|-+$/g, ""); // Trim leading/trailing dashes
    
    return safeName ? `${safeName}.mindflow` : "mindflow.mindflow";
}

/**
 * Write map data to file handle
 */
async function writeMapToHandle(handle, data) {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
}

/**
 * Download map as JSON file
 */
export function downloadMapFile(data) {
    const fileName = getSuggestedMapFilename(data.name);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

/**
 * Load a saved map from LocalStorage
 */
export function loadMap(name) {
    const savedMaps = JSON.parse(localStorage.getItem("mindflow_saved_maps") || "{}");
    if (savedMaps[name]) {
        state.nodes = savedMaps[name].nodes;
        state.relationships = savedMaps[name].relationships || [];
        state.currentMapName = savedMaps[name].name || name;
        
        // Safeguard selected node
        state.selectedNodeId = "root";
        state.selectedRelationshipId = null;
        
        // Reset view
        state.viewportTransform = { x: 0, y: 0, scale: 1 };

        state.undoStack = [];
        state.redoStack = [];
        saveHistory();
        
        render();
        centerOnNode("root");
        setTimeout(() => {
            renderConnectors();
        }, 100);
    }
}

/**
 * Delete a saved map from LocalStorage
 */
export function deleteSavedMap(name, event) {
    event.stopPropagation();
    if (!confirm(`Are you sure you want to delete the saved map "${name}"?`)) {
        return;
    }
    
    const savedMaps = JSON.parse(localStorage.getItem("mindflow_saved_maps") || "{}");
    delete savedMaps[name];
    localStorage.setItem("mindflow_saved_maps", JSON.stringify(savedMaps));

    if (state.currentMapName === name) {
        state.currentMapName = "";
    }
    
    loadMapList();
}

/**
 * Load list of saved maps into sidebar
 */
export function loadMapList() {
    const { savedMapsList } = getDomElements();
    if (!savedMapsList) return;

    savedMapsList.innerHTML = "";

    const savedMaps = JSON.parse(localStorage.getItem("mindflow_saved_maps") || "{}");
    const names = Object.keys(savedMaps).sort((a, b) => (savedMaps[b].updatedAt || 0) - (savedMaps[a].updatedAt || 0));

    if (names.length === 0) {
        savedMapsList.innerHTML = '<div class="empty-state">No saved maps found in browser storage.</div>';
        return;
    }

    names.forEach(name => {
        const item = document.createElement("div");
        item.className = "saved-map-item";
        item.addEventListener("click", () => loadMap(name));
        
        const label = document.createElement("span");
        label.className = "map-name";
        label.textContent = name;
        label.title = name;
        
        const actions = document.createElement("div");
        actions.className = "map-actions";
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "map-action-btn delete";
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.title = "Delete Saved Map";
        deleteBtn.addEventListener("click", (e) => deleteSavedMap(name, e));
        
        actions.appendChild(deleteBtn);
        item.appendChild(label);
        item.appendChild(actions);
        savedMapsList.appendChild(item);
    });
}

/**
 * Create new mindmap
 */
export function handleNewMap() {
    if (!confirm("Start a new mindmap? Unsaved changes to the current map will be lost.")) {
        return;
    }
    resetState();
    state.saveFileHandle = null;
    
    state.viewportTransform = { x: 0, y: 0, scale: 1 };

    state.undoStack = [];
    state.redoStack = [];
    saveHistory();
    
    render();
    centerOnNode("root");
}

/**
 * Export map as JSON file
 */
export function handleExportFile() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        format: "mindflow",
        version: "1.0",
        name: state.currentMapName || "My Mindmap",
        nodes: state.nodes,
        relationships: state.relationships
    }, null, 2));
    
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    
    const filename = (state.currentMapName || state.nodes.root.text || "mindmap").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".mindmap";
    downloadAnchor.setAttribute("download", filename);
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

/**
 * Import map from JSON file
 */
export function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (data && data.nodes && data.nodes.root) {
                // If this is a MindFlow format file, preserve original layout
                const isMindFlowFile = data.format === "mindflow";
                importMapData({
                    nodes: data.nodes,
                    relationships: data.relationships || [],
                    name: data.name || file.name.replace(/\.[^/.]+$/, "")
                }, file.name, isMindFlowFile);
            } else {
                throw new Error("Invalid mindmap JSON format: root node is missing.");
            }
        } catch (err) {
            alert("Error importing JSON mindmap file: " + err.message);
        }
    };
    reader.readAsText(file);
    const { fileImportInput } = getDomElements();
    if (fileImportInput) fileImportInput.value = "";
}

/**
 * Import MindMeister .mm file
 */
export function handleImportMindMeisterFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const imported = parseFreemindXml(evt.target.result);
            importMapData(imported, file.name);
        } catch (err) {
            alert("Error importing MindMeister (.mm/.xml) file: " + err.message);
        }
    };
    reader.readAsText(file);
    const { fileImportMindMeisterInput } = getDomElements();
    if (fileImportMindMeisterInput) fileImportMindMeisterInput.value = "";
}

/**
 * Import map data (internal helper)
 */
export function importMapData(imported, filename, skipLayout = false) {
    state.nodes = imported.nodes;
    state.relationships = imported.relationships || [];
    
    // Only auto-layout if this is an external format import (not a previously saved MindFlow file)
    if (!skipLayout) {
        layoutImportedMap();
    }
    
    state.currentMapName = imported.name || filename.replace(/\.[^/.]+$/, "");

    state.selectedNodeId = "root";
    state.selectedRelationshipId = null;
    state.viewportTransform = { x: 0, y: 0, scale: 1 };

    state.undoStack = [];
    state.redoStack = [];
    saveHistory();

    render();
    centerOnNode("root");
    setTimeout(() => {
        renderConnectors();
    }, 100);

    alert("Mindmap successfully imported from " + filename + "!");
}

/**
 * Export map as Word document
 */
export function handleExportDoc() {
    const html = generateWordHtml();
    const blob = new Blob([html], { type: "application/msword" });
    const blobUrl = URL.createObjectURL(blob);
    
    const filename = (state.currentMapName || state.nodes.root.text || "mindmap").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".doc";
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
}

/**
 * Generate HTML for Word export
 */
function generateWordHtml() {
    const docParts = [];
    docParts.push("<!DOCTYPE html>");
    docParts.push("<html>");
    docParts.push("<head><meta charset='utf-8'></head>");
    docParts.push("<body>");
    
    appendNodeHierarchyToDoc("root", 0, docParts);
    
    docParts.push("</body>");
    docParts.push("</html>");
    return docParts.join("");
}

/**
 * Recursively append node hierarchy to Word export
 */
function appendNodeHierarchyToDoc(nodeId, level, docParts) {
    const node = state.nodes[nodeId];
    if (!node) return;

    const headingLevel = Math.min(level + 1, 6);
    docParts.push(`<h${headingLevel}>${escapeHtml(node.text)}</h${headingLevel}>`);

    if (node.comment) {
        docParts.push(`<p><em>${escapeHtml(node.comment)}</em></p>`);
    }

    // Find and render children
    Object.keys(state.nodes).forEach(id => {
        if (state.nodes[id].parent === nodeId) {
            appendNodeHierarchyToDoc(id, level + 1, docParts);
        }
    });
}

/**
 * Escape HTML for Word export
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
