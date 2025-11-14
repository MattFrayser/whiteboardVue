/**
 * CursorManager
 *
 * Centralized cursor management - the ONLY component that sets canvas.style.cursor
 * Subscribes to ui.cursor state and applies cursor changes to the canvas element
 *
 * Single Responsibility: React to cursor state changes and update DOM
 * All other components should call actions.setCursor() instead of setting directly
 */

import { appState } from '../stores/AppState'

export class CursorManager {
    canvas: HTMLCanvasElement
    unsubscribe: (() => void) | null

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
        this.unsubscribe = null

        // Subscribe to cursor state changes
        this.unsubscribe = appState.subscribe('ui.cursor', (cursor) => {
            this.canvas.style.cursor = cursor as string
        })

        // Set initial cursor from current state
        const initialCursor = appState.get('ui.cursor') as string
        this.canvas.style.cursor = initialCursor
    }

    /**
     * Cleanup - unsubscribe from state changes
     */
    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe()
            this.unsubscribe = null
        }
    }
}
