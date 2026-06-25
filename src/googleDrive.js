// ============================================================================
// googleDrive.js - Google OAuth + Drive AppData JSON Storage
// ============================================================================
// Handles Google sign-in and CRUD operations for JSON files in appDataFolder.

const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_TOKEN_SCOPES = [
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/userinfo.email"
].join(" ");

const GOOGLE_CONFIG_STORAGE_KEY = "mindflow_google_client_id";

let gsiLoadPromise = null;
let tokenClient = null;
let tokenResponse = null;
let userEmail = "";

function loadGoogleIdentityScript() {
    if (window.google?.accounts?.oauth2) {
        return Promise.resolve();
    }

    if (!gsiLoadPromise) {
        gsiLoadPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-mindflow-lib="${GOOGLE_GSI_SRC}"]`);
            if (existing) {
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services.")), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = GOOGLE_GSI_SRC;
            script.async = true;
            script.defer = true;
            script.setAttribute("data-mindflow-lib", GOOGLE_GSI_SRC);
            script.addEventListener("load", () => resolve(), { once: true });
            script.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services.")), { once: true });
            document.head.appendChild(script);
        });
    }

    return gsiLoadPromise;
}

function getConfiguredClientId() {
    const fromWindow = window.MIND_FLOW_GOOGLE_CLIENT_ID || window.MIND_FLOW_CONFIG?.googleClientId;
    if (fromWindow && String(fromWindow).trim()) {
        return String(fromWindow).trim();
    }

    const fromStorage = localStorage.getItem(GOOGLE_CONFIG_STORAGE_KEY);
    if (fromStorage && String(fromStorage).trim()) {
        return String(fromStorage).trim();
    }

    return "";
}

function ensureTokenClient(clientId) {
    if (tokenClient) return tokenClient;

    tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_TOKEN_SCOPES,
        callback: () => {}
    });

    return tokenClient;
}

async function requestAccessToken(interactivePrompt) {
    const clientId = getConfiguredClientId();
    if (!clientId) {
        throw new Error("Google Client ID is not configured.");
    }

    await loadGoogleIdentityScript();
    const client = ensureTokenClient(clientId);

    return new Promise((resolve, reject) => {
        client.callback = (resp) => {
            if (!resp || resp.error) {
                reject(new Error(resp?.error_description || resp?.error || "Google sign-in failed."));
                return;
            }

            tokenResponse = resp;
            resolve(resp);
        };

        client.requestAccessToken({ prompt: interactivePrompt ? "consent" : "" });
    });
}

async function ensureAccessToken(interactivePrompt = false) {
    if (tokenResponse?.access_token) {
        return tokenResponse.access_token;
    }

    const resp = await requestAccessToken(interactivePrompt);
    return resp.access_token;
}

function buildDriveHeaders(accessToken, extraHeaders = {}) {
    return {
        Authorization: `Bearer ${accessToken}`,
        ...extraHeaders
    };
}

async function fetchGoogleUserEmail(accessToken) {
    try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: buildDriveHeaders(accessToken)
        });
        if (!res.ok) return "";
        const data = await res.json();
        return data?.email || "";
    } catch {
        return "";
    }
}

async function driveFetch(url, options = {}, interactiveRetry = false) {
    const accessToken = await ensureAccessToken(interactiveRetry);
    const response = await fetch(url, {
        ...options,
        headers: buildDriveHeaders(accessToken, options.headers || {})
    });

    if (response.status === 401 && !interactiveRetry) {
        tokenResponse = null;
        return driveFetch(url, options, true);
    }

    return response;
}

function escapeQueryLiteral(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildMultipartBody(metadata, jsonContent, boundary) {
    const metadataPart = JSON.stringify(metadata);
    const dataPart = JSON.stringify(jsonContent, null, 2);
    return [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        metadataPart,
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        dataPart,
        `--${boundary}--`
    ].join("\r\n");
}

export function isGoogleDriveConfigured() {
    return !!getConfiguredClientId();
}

export function getGoogleClientId() {
    return getConfiguredClientId();
}

export function setGoogleClientId(clientId) {
    const value = String(clientId || "").trim();
    if (!value) {
        localStorage.removeItem(GOOGLE_CONFIG_STORAGE_KEY);
        tokenClient = null;
        tokenResponse = null;
        userEmail = "";
        return;
    }

    localStorage.setItem(GOOGLE_CONFIG_STORAGE_KEY, value);
    tokenClient = null;
    tokenResponse = null;
    userEmail = "";
}

export async function signInToGoogleDrive() {
    const token = await ensureAccessToken(true);
    userEmail = await fetchGoogleUserEmail(token);
    return { email: userEmail };
}

export function signOutFromGoogleDrive() {
    const accessToken = tokenResponse?.access_token;
    if (accessToken && window.google?.accounts?.oauth2?.revoke) {
        window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    tokenResponse = null;
    userEmail = "";
}

export function getGoogleAuthState() {
    return {
        signedIn: !!tokenResponse?.access_token,
        email: userEmail
    };
}

export async function listJsonFilesFromGoogleDrive() {
    const query = [
        "'appDataFolder' in parents",
        "trashed = false",
        "mimeType = 'application/json'"
    ].join(" and ");

    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(query)}&fields=${encodeURIComponent("files(id,name,modifiedTime,size)")}&orderBy=modifiedTime desc&pageSize=200`;
    const response = await driveFetch(url);
    if (!response.ok) {
        throw new Error(`Could not list Google Drive files (${response.status}).`);
    }

    const data = await response.json();
    return data.files || [];
}

export async function getJsonFromGoogleDrive(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    const response = await driveFetch(url);
    if (!response.ok) {
        throw new Error(`Could not load file from Google Drive (${response.status}).`);
    }
    return response.json();
}

export async function deleteJsonFromGoogleDrive(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
    const response = await driveFetch(url, { method: "DELETE" });
    if (!response.ok && response.status !== 204) {
        throw new Error(`Could not delete file from Google Drive (${response.status}).`);
    }
}

async function findAppDataFileByName(fileName) {
    const query = [
        "'appDataFolder' in parents",
        "trashed = false",
        "mimeType = 'application/json'",
        `name = '${escapeQueryLiteral(fileName)}'`
    ].join(" and ");

    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(query)}&fields=${encodeURIComponent("files(id,name)")}&pageSize=1`;
    const response = await driveFetch(url);
    if (!response.ok) {
        throw new Error(`Could not query file by name (${response.status}).`);
    }

    const data = await response.json();
    return data.files?.[0] || null;
}

export async function saveJsonToGoogleDrive(fileName, jsonContent) {
    const existing = await findAppDataFileByName(fileName);

    if (existing?.id) {
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media`;
        const updateResponse = await driveFetch(updateUrl, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json; charset=UTF-8"
            },
            body: JSON.stringify(jsonContent, null, 2)
        });

        if (!updateResponse.ok) {
            throw new Error(`Could not update file in Google Drive (${updateResponse.status}).`);
        }

        const updatedMeta = await updateResponse.json();
        return { id: updatedMeta.id || existing.id, name: updatedMeta.name || fileName, updated: true };
    }

    const boundary = `mindflow-${Math.random().toString(36).slice(2)}`;
    const createBody = buildMultipartBody(
        {
            name: fileName,
            parents: ["appDataFolder"],
            mimeType: "application/json"
        },
        jsonContent,
        boundary
    );

    const createUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime";
    const createResponse = await driveFetch(createUrl, {
        method: "POST",
        headers: {
            "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: createBody
    });

    if (!createResponse.ok) {
        throw new Error(`Could not create file in Google Drive (${createResponse.status}).`);
    }

    const createdMeta = await createResponse.json();
    return { id: createdMeta.id, name: createdMeta.name || fileName, updated: false };
}