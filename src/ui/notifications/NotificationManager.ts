/**
 * NotificationManager
 *
 * Centralized notification system for displaying toast-style messages
 * Supports multiple types (success, error, warning, info) with auto-dismiss
 * Handles notification queueing when multiple notifications are triggered
 */

interface NotificationQueueItem {
    message: string
    type: string
    duration: number
}

export class NotificationManager {
    notification: HTMLElement | null
    queue: NotificationQueueItem[]
    isShowing: boolean
    currentTimeout: ReturnType<typeof setTimeout> | null

    constructor() {
        // Get or create notification element
        this.notification = document.querySelector('.invite-notification')

        if (!this.notification) {
            console.warn('[NotificationManager] .invite-notification element not found in DOM')
        }

        // Queue for managing multiple notifications
        this.queue = []
        this.isShowing = false
        this.currentTimeout = null
    }

    /**
     * Show a notification with specified type and duration
     * @param {string} message - Message to display
     * @param {string} type - Type of notification: 'success', 'error', 'warning', 'info'
     * @param {number} duration - How long to show notification in ms (default: 5000ms)
     */
    show(message: string, type = 'success', duration = 5000): void {
        if (!this.notification) {
            console.warn('[NotificationManager] Cannot show notification - element not found')
            return
        }

        // Add to queue
        this.queue.push({ message, type, duration })

        // Process queue if not currently showing a notification
        if (!this.isShowing) {
            this.processQueue()
        }
    }

    /**
     * Show a success notification
     * @param {string} message - Message to display
     * @param {number} duration - How long to show notification in ms
     */
    showSuccess(message: string, duration = 5000): void {
        this.show(message, 'success', duration)
    }

    /**
     * Show an error notification
     * @param {string} message - Message to display
     * @param {number} duration - How long to show notification in ms
     */
    showError(message: string, duration = 5000): void {
        this.show(message, 'error', duration)
    }

    /**
     * Show a warning notification
     * @param {string} message - Message to display
     * @param {number} duration - How long to show notification in ms
     */
    showWarning(message: string, duration = 5000): void {
        this.show(message, 'warning', duration)
    }

    /**
     * Show an info notification
     * @param {string} message - Message to display
     * @param {number} duration - How long to show notification in ms
     */
    showInfo(message: string, duration = 5000): void {
        this.show(message, 'info', duration)
    }

    /**
     * Show migration result notification (specialized for object sync)
     * Only shows notification if there are failures - success is silent
     * @param {number} succeeded - Number of objects that succeeded
     * @param {number} failed - Number of objects that failed
     */
    showMigrationResult(succeeded: number, failed: number) {
        // Only notify users about failures, not successes
        if (failed > 0) {
            const message = `⚠️ ${failed} object${failed > 1 ? 's' : ''} failed to sync. ${succeeded} succeeded.`
            this.showWarning(message, 5000)
        }
        // Success case: silent - no need to interrupt users when everything works
    }

    /**
     * Process the notification queue
     * Shows one notification at a time with proper timing
     */
    processQueue() {
        // If queue is empty or already showing, return
        if (this.queue.length === 0) {
            this.isShowing = false
            return
        }

        // Get next notification from queue
        const notification = this.queue.shift()
        if (!notification) return

        const { message, type, duration } = notification
        this.isShowing = true

        // Update notification element
        if (!this.notification) return

        this.notification.textContent = message
        this.notification.className = `invite-notification ${type}`
        this.notification.classList.add('show')

        // Clear any existing timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout)
        }

        // Auto-dismiss after duration
        this.currentTimeout = setTimeout(() => {
            this.notification?.classList.remove('show')

            // Wait for fade-out animation to complete before processing next
            setTimeout(() => {
                this.processQueue()
            }, 300) // CSS transition duration
        }, duration)
    }

    /**
     * Clear current notification and queue
     */
    clear() {
        // Clear queue
        this.queue = []

        // Clear timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout)
            this.currentTimeout = null
        }

        // Hide notification
        if (this.notification) {
            this.notification.classList.remove('show')
        }

        this.isShowing = false
    }

    /**
     * Cleanup method for component destruction
     */
    destroy() {
        this.clear()
        this.notification = null
    }
}
