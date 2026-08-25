// ============================================================================
// autosave.js - Debounced Google Drive Autosave
// ============================================================================

import { state } from './state.js';
import { getGoogleAuthState, isGoogleDriveConfigured, saveJsonToGoogleDrive } from './googleDrive.js';

const AUTOSAVE_DELAY_MS = 2000;

let autosaveTimerId = null;
let autosaveDirty = false;
let autosaveInFlight = null;
let autosaveQueuedWhileSaving = false;
let lifecycleInitialized = false;

function getMapDisplayName() {
    const rootText = String(state.nodes?.root?.text || "").trim();
    return rootText || state.currentMapName || "My Mindmap";
}

function buildMapData() {
    const suggestedName = getMapDisplayName();
    return {
        format: "mindflow",
        version: "1.0",
        name: suggestedName,
        nodes: state.nodes,
        relationships: state.relationships
    };
}

function getSuggestedMapFilename(name) {
    const safeName = String(name)
        .trim()
        .toLowerCase()
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
        .replace(/\s+/g, "-")
        .replace(/^-+|-+$/g, "");

    return safeName ? `${safeName}.mmh` : "mindmap.mmh";
}

function clearAutosaveTimer() {
    if (autosaveTimerId !== null) {
        window.clearTimeout(autosaveTimerId);
        autosaveTimerId = null;
    }
}

function canAutosaveNow() {
    return isGoogleDriveConfigured() && getGoogleAuthState().signedIn;
}

function queueAutosave() {
    clearAutosaveTimer();
    autosaveTimerId = window.setTimeout(() => {
        void flushAutosaveNow();
    }, AUTOSAVE_DELAY_MS);
}

export function scheduleAutosave() {
    autosaveDirty = true;

    if (autosaveInFlight) {
        autosaveQueuedWhileSaving = true;
        return;
    }

    queueAutosave();
}

export function markAutosaveClean() {
    autosaveDirty = false;
    autosaveQueuedWhileSaving = false;
    clearAutosaveTimer();
}

export async function flushAutosaveNow() {
    clearAutosaveTimer();

    if (!autosaveDirty) {
        return false;
    }

    if (autosaveInFlight) {
        autosaveQueuedWhileSaving = true;
        return autosaveInFlight;
    }

    if (!canAutosaveNow()) {
        return false;
    }

    const mapData = buildMapData();
    const fileName = getSuggestedMapFilename(mapData.name);
    autosaveDirty = false;

    autosaveInFlight = (async () => {
        try {
            await saveJsonToGoogleDrive(fileName, mapData);
            return true;
        } catch (err) {
            autosaveDirty = true;
            console.error("Autosave to Google Drive failed:", err);
            return false;
        } finally {
            autosaveInFlight = null;

            if (autosaveQueuedWhileSaving) {
                autosaveQueuedWhileSaving = false;
                if (autosaveDirty) {
                    queueAutosave();
                }
            }
        }
    })();

    return autosaveInFlight;
}

export function initAutosaveLifecycle() {
    if (lifecycleInitialized) {
        return;
    }

    lifecycleInitialized = true;

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            void flushAutosaveNow();
        }
    });

    window.addEventListener("pagehide", () => {
        void flushAutosaveNow();
    });
}