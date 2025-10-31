/**
 * ConnectionStatusIndicator
 *
 * Displays the current network connection status
 * Subscribes to network status changes from AppState and updates UI accordingly
 * Shows status dot with color and text label
 */
import { appState } from '../stores/AppState'

export class ConnectionStatusIndicator {
    constructor() {
        // Get DOM elements
        this.element = document.getElementById('connection-status')
        this.statusText = this.element ? this.element.querySelector('.status-text') : null

        if (!this.element || !this.statusText) {
            console.warn('[ConnectionStatusIndicator] Required DOM elements not found')
            return
        }

        // Status labels mapping
        this.statusLabels = {
            local: 'Local Mode',
            connected: 'Connected',
            connecting: 'Connecting...',
            disconnected: 'Connecting...',
            error: 'Failed',
        }

        // Subscribe to network status changes
        this.unsubscribe = appState.subscribe('network.status', (status) => {
            this.updateStatus(status)
        })

        // Initialize with current status
        const currentStatus = appState.get('network.status')
        if (currentStatus) {
            this.updateStatus(currentStatus)
        }
    }

    /**
     * Update the status indicator display
     * @param {string} status - The connection status (local, connected, connecting, disconnected, error)
     */
    updateStatus(status) {
        if (!this.element || !this.statusText) {
            return
        }

        // Update CSS class for styling (dot color, text color, animations)
        this.element.className = `connection-status status-${status}`

        // Update status text
        this.statusText.textContent = this.statusLabels[status] || status
    }

    /**
     * Cleanup method for component destruction
     * Unsubscribes from state changes
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe()
        }
        this.element = null
        this.statusText = null
    }
}
