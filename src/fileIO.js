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
import { getEdgePoint } from './utils.js';
import {
    getGoogleClientId,
    setGoogleClientId,
    isGoogleDriveConfigured,
    signInToGoogleDrive,
    signOutFromGoogleDrive,
    getGoogleAuthState,
    listJsonFilesFromGoogleDrive,
    getJsonFromGoogleDrive,
    deleteJsonFromGoogleDrive,
    saveJsonToGoogleDrive
} from './googleDrive.js';

const DEFAULT_ROOT_COLOR = "#0ea5e9";
let pdfLibrariesPromise = null;
let googleMapsCache = [];
let showGoogleClientConfig = false;

function clearCurrentFileBinding() {
    state.saveFileHandle = null;
}

function isFileSystemAccessRestrictedError(err) {
    if (!err) return false;
    const name = String(err.name || "");
    const message = String(err.message || "").toLowerCase();
    return (
        name === "NotAllowedError" ||
        name === "SecurityError" ||
        message.includes("not allowed by user agent") ||
        message.includes("platform in the current context")
    );
}

function openViaFileInputFallback() {
    const { fileImportInput } = getDomElements();
    if (fileImportInput) {
        fileImportInput.click();
    } else {
        alert("Could not open file picker in this browser context.");
    }
}

function shouldUseFileInputForOpen() {
    // File System Access API is commonly restricted in file:// contexts.
    if (window.location?.protocol === "file:") {
        return true;
    }

    return !window.showOpenFilePicker;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-mindflow-lib="${src}"]`);
        if (existing) {
            if (existing.getAttribute("data-loaded") === "true") {
                resolve();
                return;
            }
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.defer = true;
        script.setAttribute("data-mindflow-lib", src);
        script.addEventListener("load", () => {
            script.setAttribute("data-loaded", "true");
            resolve();
        }, { once: true });
        script.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}

async function getPdfLibraries() {
    if (!pdfLibrariesPromise) {
        pdfLibrariesPromise = (async () => {
            await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js");
            const html2canvasModule = await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm");
            const html2canvas = html2canvasModule.default || html2canvasModule;
            const JsPdfCtor = window.jspdf?.jsPDF;

            if (!html2canvas || !JsPdfCtor) {
                throw new Error("PDF libraries unavailable");
            }

            return { html2canvas, JsPdfCtor };
        })();
    }

    return pdfLibrariesPromise;
}

function ensureRootColor() {
    if (!state.nodes?.root) return;
    if (!state.nodes.root.color) {
        state.nodes.root.color = {};
    }
    if (!state.nodes.root.color.bg) {
        state.nodes.root.color.bg = DEFAULT_ROOT_COLOR;
    }
}

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

function buildMapData() {
    const suggestedName = state.currentMapName || (state.nodes.root && state.nodes.root.text) || "My Mindmap";
    return {
        format: "mindflow",
        version: "1.0",
        name: suggestedName,
        nodes: state.nodes,
        relationships: state.relationships
    };
}

async function ensureFileHandlePermission(handle) {
    if (!handle?.queryPermission || !handle?.requestPermission) {
        return !!handle;
    }

    const options = { mode: "readwrite" };
    if (await handle.queryPermission(options) === "granted") {
        return true;
    }

    return (await handle.requestPermission(options)) === "granted";
}

/**
 * Handle saving map to file
 */
export async function handleSaveMap() {
    const mapData = buildMapData();
    saveMapToBrowserStorage(mapData.name, mapData);
    saveAutosave();
    loadMapList();

    if (!state.saveFileHandle) {
        // No bound file handle: fall back to normal file download behavior.
        downloadMapFile(mapData);
        return;
    }

    try {
        const hasPermission = await ensureFileHandlePermission(state.saveFileHandle);
        if (!hasPermission) {
            downloadMapFile(mapData);
            return;
        }

        const writable = await state.saveFileHandle.createWritable();
        await writable.write(JSON.stringify(mapData, null, 2));
        await writable.close();

        state.currentMapName = state.saveFileHandle.name || mapData.name;
        saveMapToBrowserStorage(state.currentMapName, {
            ...mapData,
            name: state.currentMapName
        });
        saveAutosave();
        loadMapList();
    } catch (err) {
        console.error("Saving map failed:", err);
        if (isFileSystemAccessRestrictedError(err)) {
            clearCurrentFileBinding();
            downloadMapFile(mapData);
            return;
        }

        alert("Could not save to the opened file. Use Save As.");
    }
}

export function handleSaveAsMap() {
    const mapData = buildMapData();

    saveMapToBrowserStorage(mapData.name, mapData);
    saveAutosave();
    loadMapList();
    downloadMapFile(mapData);
}

function loadMindflowFromText(fileText, filename) {
    const normalizedText = String(fileText)
        .replace(/^\uFEFF/, "")
        .trim();

    if (!normalizedText) {
        throw new Error("The selected file is empty.");
    }

    const data = JSON.parse(normalizedText);
    if (!data || !data.nodes || !data.nodes.root) {
        throw new Error("Invalid MindFlow file format: root node is missing.");
    }

    const isMindFlowFile = data.format === "mindflow";
    importMapData({
        nodes: data.nodes,
        relationships: data.relationships || [],
        name: data.name || filename.replace(/\.[^/.]+$/, "")
    }, filename, isMindFlowFile);
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
        reader.readAsText(file);
    });
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

function normalizeCloudMapName(fileName) {
    return String(fileName || "")
        .replace(/\.mindflow$/i, "")
        .replace(/\.json$/i, "")
        .trim() || "Cloud map";
}

function updateGoogleAuthUi() {
    const {
        googleAuthStatus,
        googleClientIdInput,
        googleClientIdConfigContainer,
        btnGoogleEditClientId
    } = getDomElements();
    if (!googleAuthStatus) return;

    const currentClientId = getGoogleClientId();
    const hasSavedClientId = !!currentClientId;
    const showConfigEditor = !hasSavedClientId || showGoogleClientConfig;

    if (googleClientIdInput && googleClientIdInput.value !== currentClientId) {
        googleClientIdInput.value = currentClientId;
    }

    if (googleClientIdConfigContainer) {
        googleClientIdConfigContainer.style.display = showConfigEditor ? "" : "none";
    }
    if (btnGoogleEditClientId) {
        btnGoogleEditClientId.style.display = hasSavedClientId && !showConfigEditor ? "" : "none";
    }

    if (!isGoogleDriveConfigured()) {
        googleAuthStatus.textContent = "Google: ingen Client ID konfigurerad.";
        return;
    }

    if (window.location?.protocol === "file:") {
        googleAuthStatus.textContent = "Google: OAuth kraver https:// eller http://localhost (inte file://).";
        return;
    }

    const authState = getGoogleAuthState();
    if (authState.signedIn) {
        const emailPart = authState.email ? ` (${authState.email})` : "";
        googleAuthStatus.textContent = `Google: inloggad${emailPart}.`;
    } else {
        googleAuthStatus.textContent = "Google: inte inloggad.";
    }
}

function renderGoogleMapList(files = []) {
    const { googleMapsList } = getDomElements();
    if (!googleMapsList) return;

    googleMapsList.innerHTML = "";

    if (!isGoogleDriveConfigured()) {
        googleMapsList.innerHTML = '<div class="empty-state">Lagg in Google Client ID och logga in for att anvanda molnlagring.</div>';
        return;
    }

    const authState = getGoogleAuthState();
    if (!authState.signedIn) {
        googleMapsList.innerHTML = '<div class="empty-state">Logga in for att lista JSON i Google Drive.</div>';
        return;
    }

    if (!files.length) {
        googleMapsList.innerHTML = '<div class="empty-state">Inga JSON-filer hittades i Google Drive app storage.</div>';
        return;
    }

    files.forEach((file) => {
        const item = document.createElement("div");
        item.className = "saved-map-item";
        item.setAttribute("data-google-file-id", file.id);

        const label = document.createElement("span");
        label.className = "map-name";
        label.textContent = normalizeCloudMapName(file.name);
        label.title = `${file.name}${file.modifiedTime ? ` (${new Date(file.modifiedTime).toLocaleString()})` : ""}`;

        const actions = document.createElement("div");
        actions.className = "map-actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "map-action-btn delete";
        deleteBtn.setAttribute("data-google-file-id", file.id);
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.title = "Delete Google Drive JSON";

        actions.appendChild(deleteBtn);
        item.appendChild(label);
        item.appendChild(actions);
        googleMapsList.appendChild(item);
    });
}

function ensureGoogleClientIdConfigured() {
    if (isGoogleDriveConfigured()) {
        return true;
    }

    const dom = getDomElements();
    const inputFromDomRef = String(dom.googleClientIdInput?.value || "").trim();
    const inputFromDocument = String(document.getElementById("google-client-id-input")?.value || "").trim();
    const entered = inputFromDomRef || inputFromDocument;

    if (!entered) {
        alert("Fyll i Google Client ID i Mappar-menyn och klicka Spara.");
        return false;
    }

    // Accept typed Client ID directly on sign-in even if user forgot to press Save.
    setGoogleClientId(entered);
    updateGoogleAuthUi();
    return true;
}

export function handleGoogleClientIdSave(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
        alert("Google Client ID kan inte vara tomt.");
        return false;
    }

    setGoogleClientId(trimmed);
    showGoogleClientConfig = false;
    updateGoogleAuthUi();
    return true;
}

export function showGoogleClientIdEditor() {
    showGoogleClientConfig = true;
    updateGoogleAuthUi();
}

export async function handleGoogleDriveSignIn() {
    try {
        const configured = ensureGoogleClientIdConfigured();
        if (!configured) return;

        await signInToGoogleDrive();
        await refreshGoogleMapList();
    } catch (err) {
        console.error("Google sign-in failed:", err);
        alert(`Google sign-in failed: ${err.message}`);
        updateGoogleAuthUi();
        renderGoogleMapList([]);
    }
}

export function handleGoogleDriveSignOut() {
    signOutFromGoogleDrive();
    googleMapsCache = [];
    updateGoogleAuthUi();
    renderGoogleMapList([]);
}

export async function refreshGoogleMapList(showErrorAlert = false) {
    updateGoogleAuthUi();

    if (!isGoogleDriveConfigured() || !getGoogleAuthState().signedIn) {
        googleMapsCache = [];
        renderGoogleMapList([]);
        return;
    }

    try {
        const files = await listJsonFilesFromGoogleDrive();
        googleMapsCache = files;
        renderGoogleMapList(files);
    } catch (err) {
        console.error("Failed to list Google Drive files:", err);
        googleMapsCache = [];
        renderGoogleMapList([]);
        if (showErrorAlert) {
            alert(`Could not list Google Drive JSON files: ${err.message}`);
        }
    }
}

export async function handleSaveToGoogleDrive() {
    try {
        const configured = ensureGoogleClientIdConfigured();
        if (!configured) return;

        if (!getGoogleAuthState().signedIn) {
            await signInToGoogleDrive();
        }

        const mapData = buildMapData();
        const fileName = getSuggestedMapFilename(mapData.name);
        await saveJsonToGoogleDrive(fileName, mapData);

        await refreshGoogleMapList();
        alert(`Saved map to Google Drive as ${fileName}.`);
    } catch (err) {
        console.error("Failed to save map to Google Drive:", err);
        alert(`Could not save to Google Drive: ${err.message}`);
    }
}

export async function handleOpenGoogleMap(fileId) {
    try {
        const data = await getJsonFromGoogleDrive(fileId);
        if (!data || !data.nodes || !data.nodes.root) {
            throw new Error("Invalid MindFlow JSON structure.");
        }

        importMapData({
            nodes: data.nodes,
            relationships: data.relationships || [],
            name: data.name || normalizeCloudMapName(googleMapsCache.find((f) => f.id === fileId)?.name || "")
        }, data.name || "Google Drive", true);
    } catch (err) {
        console.error("Failed to load map from Google Drive:", err);
        alert(`Could not load JSON from Google Drive: ${err.message}`);
    }
}

export async function handleDeleteGoogleMap(fileId) {
    const fileName = normalizeCloudMapName(googleMapsCache.find((f) => f.id === fileId)?.name || "selected map");
    if (!confirm(`Delete Google Drive map \"${fileName}\"?`)) {
        return;
    }

    try {
        await deleteJsonFromGoogleDrive(fileId);
        await refreshGoogleMapList();
    } catch (err) {
        console.error("Failed to delete Google Drive file:", err);
        alert(`Could not delete JSON from Google Drive: ${err.message}`);
    }
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
 * Download map as JSON file
 */
export function downloadMapFile(data) {
    const fileName = getSuggestedMapFilename(data.name);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", blobUrl);
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

/**
 * Load a saved map from LocalStorage
 */
export function loadMap(name) {
    const savedMaps = JSON.parse(localStorage.getItem("mindflow_saved_maps") || "{}");
    if (savedMaps[name]) {
        clearCurrentFileBinding();
        state.nodes = savedMaps[name].nodes;
        state.relationships = savedMaps[name].relationships || [];
        ensureRootColor();
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

    // Refresh cloud list in the background without blocking local list rendering.
    void refreshGoogleMapList();

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
    resetState();
    clearCurrentFileBinding();
    
    state.viewportTransform = { x: 0, y: 0, scale: 1 };

    state.undoStack = [];
    state.redoStack = [];
    saveHistory();
    
    render();
    centerOnNode("root");
}

/**
 * Import map from local MindFlow file
 */
export async function handleOpenMindflow() {
    if (shouldUseFileInputForOpen()) {
        openViaFileInputFallback();
        return;
    }

    try {
        const [fileHandle] = await window.showOpenFilePicker({
            multiple: false,
            types: [
                {
                    description: "MindFlow map file",
                    accept: { "application/json": [".mindflow", ".json"] }
                }
            ]
        });
        if (!fileHandle) return;

        const file = await fileHandle.getFile();
        const fileText = await readFileAsText(file);
        loadMindflowFromText(fileText, file.name);
        state.saveFileHandle = fileHandle;
        state.currentMapName = fileHandle.name || state.currentMapName;
        saveAutosave();
    } catch (err) {
        if (err.name === "AbortError") return;
        if (isFileSystemAccessRestrictedError(err)) {
            console.warn("Open via File System Access API is not available in this context. Falling back to file input.", err);
            openViaFileInputFallback();
            return;
        }

        console.error("Error opening MindFlow file:", err);
        alert(`Could not open the selected MindFlow file: ${err.message}`);
    }
}

export function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    readFileAsText(file)
        .then((fileText) => {
            loadMindflowFromText(fileText, file.name);
            clearCurrentFileBinding();
        })
        .catch((err) => {
            console.error("Error importing MindFlow file:", err);
            alert(`Could not open the selected MindFlow file: ${err.message}`);
        });
    const { fileImportInput } = getDomElements();
    if (fileImportInput) fileImportInput.value = "";
}

/**
 * Import Freemind .mm file
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
            console.error("Error importing Freemind (.mm/.xml) file:", err);
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
    ensureRootColor();
    
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
 * Export map as PDF document using browser print flow
 */
export function handleExportPdf() {
    exportMindmapPdf().catch((err) => {
        console.error("PDF export failed:", err);
        alert("Could not generate PDF. Please try again.");
    });
}

async function exportMindmapPdf() {
    const { html2canvas, JsPdfCtor } = await getPdfLibraries();
    const mapTitle = state.currentMapName || state.nodes.root?.text || "mindmap";
    const { nodesContainer } = getDomElements();
    const nodeElements = Array.from(nodesContainer?.querySelectorAll(".node") || []);
    const orientationSetting = getDomElements().pdfOrientationSelect?.value === "portrait" ? "portrait" : "landscape";

    if (!nodesContainer || nodeElements.length === 0) {
        throw new Error("No visible nodes to export");
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodeElements.forEach((nodeEl) => {
        const x = parseFloat(nodeEl.style.left || "0");
        const y = parseFloat(nodeEl.style.top || "0");
        const width = nodeEl.offsetWidth;
        const height = nodeEl.offsetHeight;
        minX = Math.min(minX, x - width / 2);
        maxX = Math.max(maxX, x + width / 2);
        minY = Math.min(minY, y - height / 2);
        maxY = Math.max(maxY, y + height / 2);
    });

    const padding = 120;
    const viewX = Math.floor(minX - padding);
    const viewY = Math.floor(minY - padding);
    const viewWidth = Math.max(600, Math.ceil(maxX - minX + padding * 2));
    const viewHeight = Math.max(400, Math.ceil(maxY - minY + padding * 2));

    const stage = document.createElement("div");
    stage.style.position = "fixed";
    stage.style.left = "-100000px";
    stage.style.top = "0";
    stage.style.width = `${viewWidth}px`;
    stage.style.height = `${viewHeight}px`;
    stage.style.backgroundColor = "transparent";
    stage.style.overflow = "hidden";

    const lineCanvas = document.createElement("canvas");
    lineCanvas.width = viewWidth;
    lineCanvas.height = viewHeight;
    lineCanvas.style.position = "absolute";
    lineCanvas.style.left = "0";
    lineCanvas.style.top = "0";
    lineCanvas.style.width = `${viewWidth}px`;
    lineCanvas.style.height = `${viewHeight}px`;
    lineCanvas.style.zIndex = "1";
    drawLineLayer(lineCanvas, nodeElements, viewX, viewY);
    stage.appendChild(lineCanvas);

    const nodesLayer = document.createElement("div");
    nodesLayer.style.position = "absolute";
    nodesLayer.style.left = `${-viewX}px`;
    nodesLayer.style.top = `${-viewY}px`;
    nodesLayer.style.width = "0";
    nodesLayer.style.height = "0";
    nodesLayer.style.overflow = "visible";

    nodeElements.forEach((nodeEl) => {
        const clone = nodeEl.cloneNode(true);
        clone.classList.remove("selected", "editing", "dragging", "potential-parent");
        clone.querySelectorAll(".node-collapse-toggle").forEach((button) => button.remove());
        clone.querySelectorAll("[contenteditable]").forEach((editableEl) => {
            editableEl.removeAttribute("contenteditable");
            editableEl.classList.remove("editing-text", "node-text-edit");
        });
        nodesLayer.appendChild(clone);
    });

    stage.appendChild(nodesLayer);
    document.body.appendChild(stage);

    try {
        const canvas = await html2canvas(stage, {
            backgroundColor: "#f8fafc",
            scale: 2,
            width: viewWidth,
            height: viewHeight,
            useCORS: true,
            logging: false
        });

        const imageData = canvas.toDataURL("image/png");
        const pxToPt = 72 / 96;
        const sourceWidthPt = Math.max(200, Math.round(viewWidth * pxToPt));
        const sourceHeightPt = Math.max(200, Math.round(viewHeight * pxToPt));

        let pageWidthPt = sourceWidthPt;
        let pageHeightPt = sourceHeightPt;

        if (orientationSetting === "portrait" && sourceWidthPt > sourceHeightPt) {
            pageWidthPt = sourceHeightPt;
            pageHeightPt = sourceWidthPt;
        } else if (orientationSetting === "landscape" && sourceHeightPt > sourceWidthPt) {
            pageWidthPt = sourceHeightPt;
            pageHeightPt = sourceWidthPt;
        }

        const pdf = new JsPdfCtor({
            orientation: orientationSetting,
            unit: "pt",
            format: [pageWidthPt, pageHeightPt],
            compress: true
        });

        const margin = 18;
        const availableWidth = Math.max(50, pageWidthPt - margin * 2);
        const availableHeight = Math.max(50, pageHeightPt - margin * 2 - 18);
        const scale = Math.min(availableWidth / sourceWidthPt, availableHeight / sourceHeightPt);
        const drawWidth = sourceWidthPt * scale;
        const drawHeight = sourceHeightPt * scale;
        const drawX = (pageWidthPt - drawWidth) / 2;
        const drawY = 14 + (availableHeight - drawHeight) / 2;

        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105);
        pdf.text(state.nodes.root?.text || mapTitle, margin, 11);
        pdf.addImage(imageData, "PNG", drawX, drawY, drawWidth, drawHeight, undefined, "FAST");

        const filename = (mapTitle || "mindmap").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";
        pdf.save(filename);
    } finally {
        stage.remove();
    }
}

function drawLineLayer(lineCanvas, nodeElements, viewX, viewY) {
    const ctx = lineCanvas.getContext("2d");
    if (!ctx) return;

    const nodeById = {};
    nodeElements.forEach((nodeEl) => {
        const nodeId = nodeEl.id?.replace("node-", "");
        if (!nodeId) return;
        nodeById[nodeId] = {
            x: parseFloat(nodeEl.style.left || "0"),
            y: parseFloat(nodeEl.style.top || "0"),
            width: nodeEl.offsetWidth,
            height: nodeEl.offsetHeight
        };
    });

    ctx.save();

    // Parent-child connectors
    Object.keys(nodeById).forEach((nodeId) => {
        const node = state.nodes[nodeId];
        if (!node?.parent || !nodeById[node.parent]) return;

        const child = nodeById[nodeId];
        const parent = nodeById[node.parent];

        let startX;
        let startY;
        let endX;
        let endY;

        if (child.x > parent.x) {
            startX = parent.x + parent.width / 2;
            startY = parent.y;
            endX = child.x - child.width / 2;
            endY = child.y;
        } else {
            startX = parent.x - parent.width / 2;
            startY = parent.y;
            endX = child.x + child.width / 2;
            endY = child.y;
        }

        const dx = endX - startX;
        const controlOffset = Math.sign(dx) * Math.min(100, Math.abs(dx) * 0.5);

        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(startX - viewX, startY - viewY);
        ctx.bezierCurveTo(
            startX + controlOffset - viewX,
            startY - viewY,
            endX - controlOffset - viewX,
            endY - viewY,
            endX - viewX,
            endY - viewY
        );
        ctx.stroke();
    });

    // Free relationships
    state.relationships.forEach((rel) => {
        const fromNode = nodeById[rel.fromId];
        const toNode = nodeById[rel.toId];
        if (!fromNode || !toNode) return;

        const startPort = getEdgePoint(
            { x: fromNode.x, y: fromNode.y },
            { x: toNode.x, y: toNode.y },
            fromNode.width,
            fromNode.height
        );
        const endPort = getEdgePoint(
            { x: toNode.x, y: toNode.y },
            { x: fromNode.x, y: fromNode.y },
            toNode.width,
            toNode.height
        );

        const dx = endPort.x - startPort.x;
        const dy = endPort.y - startPort.y;
        const length = Math.hypot(dx, dy);
        if (length < 10) return;

        const perpendicularX = -dy / length;
        const perpendicularY = dx / length;
        const offset = Math.min(80, length * 0.2);
        const controlX = (startPort.x + endPort.x) / 2 + perpendicularX * offset;
        const controlY = (startPort.y + endPort.y) / 2 + perpendicularY * offset;

        ctx.strokeStyle = rel.color || "#f43f5e";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(startPort.x - viewX, startPort.y - viewY);
        ctx.quadraticCurveTo(controlX - viewX, controlY - viewY, endPort.x - viewX, endPort.y - viewY);
        ctx.stroke();
    });

    ctx.restore();
}

/**
 * Generate HTML for Word export
 */
function generateWordHtml() {
    const mapTitle = state.currentMapName || state.nodes.root?.text || "mindmap";
    const docParts = [];
    docParts.push("<!DOCTYPE html>");
    docParts.push("<html>");
    docParts.push(`<head><meta charset='utf-8'><title>${escapeHtml(mapTitle)}</title></head>`);
    docParts.push("<body>");

    if (state.nodes.root?.text) {
        docParts.push(`<p style="font-size: 1.6em; font-weight: 700; margin: 0 0 0.75em 0;">${escapeHtml(state.nodes.root.text)}</p>`);
    }

    appendNodeHierarchyToDoc("root", 1, docParts);
    
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

    Object.values(state.nodes)
        .filter((child) => child.parent === nodeId)
        .sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0))
        .forEach((child) => {
            const headingLevel = Math.min(level, 6);
            docParts.push(`<h${headingLevel}>${escapeHtml(child.text)}</h${headingLevel}>`);

            if (child.comment) {
                docParts.push(`<p><em>${escapeHtml(child.comment)}</em></p>`);
            }

            appendNodeHierarchyToDoc(child.id, level + 1, docParts);
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
