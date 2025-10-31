/**
 * VisibilitySync
 *
 * Handles automatic sync requests when user returns to the tab
 * Debounces requests to prevent spam from rapid visibility changes
 * Monitors both document visibility and window focus events
 */
export class VisibilitySync {
    constructor(sessionManager, debounceMs = 1000) {
        this.sessionManager = sessionManager
        this.debounceMs = debounceMs
        this.syncDebounceTimer = null

        // Bind event handlers
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
        this.handleFocus = this.handleFocus.bind(this)

        // Setup event listeners
        this.setupListeners()
    }

    /**
     * Setup event listeners for visibility changes
     */
    setupListeners() {
        // Sync when tab becomes visible (handles tab switches, minimization)
        document.addEventListener('visibilitychange', this.handleVisibilityChange)

        // Sync when window gains focus (handles dual-monitor, side-by-side scenarios)
        window.addEventListener('focus', this.handleFocus)
    }

    /**
     * Handle visibility change event
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.requestSyncDebounced()
        }
    }

    /**
     * Handle window focus event
     */
    handleFocus() {
        this.requestSyncDebounced()
    }

    /**
     * Request sync with debouncing
     * Groups rapid events within debounce period
     */
    requestSyncDebounced() {
        // Clear any existing timer
        clearTimeout(this.syncDebounceTimer)

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
    destroy() {
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange)
        window.removeEventListener('focus', this.handleFocus)

        // Clear any pending timer
        clearTimeout(this.syncDebounceTimer)
        this.syncDebounceTimer = null
    }
}
