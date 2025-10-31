/**
 * ErrorHandler
 *
 * Centralized error handling utility
 * Automatically logs errors and shows user notifications based on error category
 *
 * Usage:
 *   ErrorHandler.handle(error, ErrorCategory.NETWORK, {
 *     context: 'WebSocketManager',
 *     userMessage: 'Custom message',
 *     code: ErrorCode.CONNECTION_FAILED
 *   })
 */

import { ErrorCategory, ErrorCode, ErrorMessages, DefaultMessages } from './ErrorTypes'

export class ErrorHandler {
    static notificationManager = null
    static dialogManager = null

    /**
     * Initialize ErrorHandler with UI managers
     * @param {NotificationManager} notificationManager
     * @param {DialogManager} dialogManager
     */
    static init(notificationManager, dialogManager) {
        this.notificationManager = notificationManager
        this.dialogManager = dialogManager
    }

    /**
     * Handle an error with automatic logging and user notification
     *
     * @param {Error|string} error - The error object or message
     * @param {string} category - Error category from ErrorCategory
     * @param {Object} options - Additional options
     * @param {string} options.context - Component/module name for logging (e.g., 'WebSocketManager')
     * @param {string} options.userMessage - Custom user-facing message (overrides default)
     * @param {string} options.code - Error code from ErrorCode (for default messages)
     * @param {boolean} options.showNotification - Override whether to show notification (default: based on category)
     * @param {function} options.onRetry - Callback for retry action
     * @param {Object} options.metadata - Additional data to log (not shown to user)
     */
    static handle(error, category = ErrorCategory.CRITICAL, options = {}) {
        const {
            context = 'App',
            userMessage = null,
            code = null,
            showNotification = this.shouldShowNotification(category),
            onRetry = null,
            metadata = null,
        } = options

        // 1. Always log to console with context
        this.logError(error, category, context, metadata)

        // 2. Show user notification if appropriate
        if (showNotification && this.notificationManager) {
            const message = this.getUserMessage(error, category, code, userMessage)
            this.showNotification(message, category, onRetry)
        }

        // 3. Return structured error info (useful for caller)
        return {
            error,
            category,
            code,
            handled: true,
        }
    }

    /**
     * Log error to console with consistent formatting
     */
    static logError(error, category, context, metadata) {
        const prefix = `[${context}]`
        const categoryLabel = `[${category.toUpperCase()}]`

        if (category === ErrorCategory.SILENT || category === ErrorCategory.VALIDATION) {
            console.warn(prefix, categoryLabel, error)
        } else {
            console.error(prefix, categoryLabel, error)
        }

        if (metadata) {
            console.error(`${prefix} Metadata:`, metadata)
        }
    }

    /**
     * Get user-friendly error message
     */
    static getUserMessage(error, category, code, customMessage) {
        // 1. Custom message (highest priority)
        if (customMessage) {
            return customMessage
        }

        // 2. Message from error code
        if (code && ErrorMessages[code]) {
            return ErrorMessages[code]
        }

        // 3. Extract message from Error object
        if (error instanceof Error && error.message) {
            // Only use error.message if it's user-friendly (not technical stack traces)
            const msg = error.message
            if (!msg.includes('at ') && !msg.includes('Error:') && msg.length < 200) {
                return msg
            }
        }

        // 4. Default message for category
        return DefaultMessages[category] || DefaultMessages[ErrorCategory.CRITICAL]
    }

    /**
     * Show notification to user based on category
     */
    static showNotification(message, category, onRetry) {
        if (!this.notificationManager) {
            console.warn('[ErrorHandler] NotificationManager not initialized')
            return
        }

        const duration = this.getNotificationDuration(category)

        switch (category) {
            case ErrorCategory.CRITICAL:
                this.notificationManager.showError(message, duration)
                break

            case ErrorCategory.NETWORK:
                this.notificationManager.showError(message, duration)
                // TODO: Add retry button support when NotificationManager supports actions
                break

            case ErrorCategory.STORAGE:
                this.notificationManager.showError(message, duration)
                break

            case ErrorCategory.VALIDATION:
                this.notificationManager.showWarning(message, duration)
                break

            default:
                this.notificationManager.showError(message, duration)
        }
    }

    /**
     * Determine if notification should be shown for this category
     */
    static shouldShowNotification(category) {
        switch (category) {
            case ErrorCategory.SILENT:
                return false
            case ErrorCategory.NETWORK:
            case ErrorCategory.STORAGE:
            case ErrorCategory.CRITICAL:
            case ErrorCategory.VALIDATION:
                return true
            default:
                return true
        }
    }

    /**
     * Get notification duration based on category
     */
    static getNotificationDuration(category) {
        switch (category) {
            case ErrorCategory.CRITICAL:
                return 8000 // Longer for critical errors
            case ErrorCategory.NETWORK:
            case ErrorCategory.STORAGE:
                return 5000
            case ErrorCategory.VALIDATION:
                return 3000 // Shorter for validation
            default:
                return 4000
        }
    }

    /**
     * Convenience method for network errors
     */
    static network(error, options = {}) {
        return this.handle(error, ErrorCategory.NETWORK, options)
    }

    /**
     * Convenience method for validation errors
     */
    static validation(error, options = {}) {
        return this.handle(error, ErrorCategory.VALIDATION, options)
    }

    /**
     * Convenience method for storage errors
     */
    static storage(error, options = {}) {
        return this.handle(error, ErrorCategory.STORAGE, options)
    }

    /**
     * Convenience method for critical errors
     */
    static critical(error, options = {}) {
        return this.handle(error, ErrorCategory.CRITICAL, options)
    }

    /**
     * Convenience method for silent errors (logged but not shown)
     */
    static silent(error, options = {}) {
        return this.handle(error, ErrorCategory.SILENT, options)
    }
}

// Export error types for convenience
export { ErrorCategory, ErrorCode } from './ErrorTypes'
