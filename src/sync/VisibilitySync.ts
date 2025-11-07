/**
 * VisibilitySync
 *
 * Handles automatic sync requests when user returns to the tab
 * Debounces requests to prevent spam from rapid visibility changes
 * Monitors both document visibility and window focus events
 */

interface SessionManager {
    getNetworkManager(): { isConnected(): boolean; send(msg: unknown): void } | null
}

export class VisibilitySync {
    sessionManager: SessionManager
    debounceMs: number
    syncDebounceTimer: ReturnType<typeof setTimeout> | null
    boundHandleVisibilityChange: (() => void) | null
    boundHandleFocus: (() => void) | null

    constructor(sessionManager: SessionManager, debounceMs = 1000) {
        this.sessionManager = sessionManager
        this.debounceMs = debounceMs
        this.syncDebounceTimer = null
        this.boundHandleVisibilityChange = null
        this.boundHandleFocus = null

        // Setup event listeners
        this.setupListeners()
    }

    /**
     * Setup event listeners for visibility changes
     */
    setupListeners(): void {
        // Store bound handlers for cleanup
        this.boundHandleVisibilityChange = () => this.handleVisibilityChange()
        this.boundHandleFocus = () => this.handleFocus()

        // Sync when tab becomes visible (handles tab switches, minimization)
        document.addEventListener('visibilitychange', this.boundHandleVisibilityChange)

        // Sync when window gains focus (handles dual-monitor, side-by-side scenarios)
        window.addEventListener('focus', this.boundHandleFocus)
    }

    /**
     * Handle visibility change event
     */
    private handleVisibilityChange(): void {
        if (document.visibilityState === 'visible') {
            this.requestSyncDebounced()
        }
    }

    /**
     * Handle window focus event
     */
    private handleFocus(): void {
        this.requestSyncDebounced()
    }

    /**
     * Request sync with debouncing
     * Groups rapid events within debounce period
     */
    requestSyncDebounced(): void {
        // Clear any existing timer
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer)
        }

        // Set new timer
        this.syncDebounceTimer = setTimeout(() => {
            const networkManager = this.sessionManager.getNetworkManager()
            if (networkManager && networkManager.isConnected()) {
                console.log('[VisibilitySync] Requesting room sync')
                networkManager.send({ type: 'requestSync' })
            }
        }, this.debounceMs)
    }

    /**
     * Cleanup method for component destruction
     * Removes event listeners and clears timers
     */
    destroy(): void {
        // Remove event listeners using stored references
        if (this.boundHandleVisibilityChange) {
            document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange)
            this.boundHandleVisibilityChange = null
        }
        if (this.boundHandleFocus) {
            window.removeEventListener('focus', this.boundHandleFocus)
            this.boundHandleFocus = null
        }

        // Clear any pending timer
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer)
        }
        this.syncDebounceTimer = null
    }
}
