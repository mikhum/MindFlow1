// ============================================================================
// viewport.js - Viewport, Zoom & Pan Management
// ============================================================================
// Handles canvas transformation, zooming, and panning.

import { state } from './state.js';
import { getDomElements } from './dom.js';

/**
 * Update canvas CSS transform based on viewport state
 */
export function updateCanvasTransform() {
    const { canvas } = getDomElements();
    if (!canvas) return;
    canvas.style.transform = `translate(${state.viewportTransform.x}px, ${state.viewportTransform.y}px) scale(${state.viewportTransform.scale})`;
    
    // Update zoom indicator
    const zoomPercent = Math.round(state.viewportTransform.scale * 100);
    const { zoomIndicator } = getDomElements();
    if (zoomIndicator) {
        zoomIndicator.textContent = `${zoomPercent}%`;
    }
}

/**
 * Zoom in or out
 */
export function zoom(factor) {
    state.viewportTransform.scale *= factor;
    state.viewportTransform.scale = Math.max(0.15, Math.min(3.0, state.viewportTransform.scale));
    updateCanvasTransform();
}

/**
 * Handle mouse wheel for zooming
 */
export function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = 1.08;
    const direction = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    
    const { workspace } = getDomElements();
    const rect = workspace.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse position to canvas coordinates before zoom
    const canvasMouseX = (mouseX - state.viewportTransform.x) / state.viewportTransform.scale;
    const canvasMouseY = (mouseY - state.viewportTransform.y) / state.viewportTransform.scale;

    // Calculate new zoom scale
    let newScale = state.viewportTransform.scale * direction;
    newScale = Math.max(0.15, Math.min(3.0, newScale));

    // Calculate new offsets to keep mouse position anchored
    state.viewportTransform.scale = newScale;
    state.viewportTransform.x = mouseX - canvasMouseX * newScale;
    state.viewportTransform.y = mouseY - canvasMouseY * newScale;

    updateCanvasTransform();
}

/**
 * Reset viewport to default position and zoom
 */
export function resetViewport() {
    state.viewportTransform = { x: 0, y: 0, scale: 1 };
    updateCanvasTransform();
}
