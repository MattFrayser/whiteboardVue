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

import type { NotificationManager, DialogManager } from '../types'
import {
    ErrorCategory,
    
    ErrorMessages,
    DefaultMessages,
    type ErrorCategoryType,
    type ErrorCodeType,
} from './ErrorTypes'

interface ErrorHandlerOptions {
    context?: string
    userMessage?: string | null
    code?: ErrorCodeType | null
    showNotification?: boolean
    _onRetry?: (() => void) | null
    metadata?: unknown
}

interface ErrorHandleResult {
    error: Error | string
    category: ErrorCategoryType
    code: ErrorCodeType | null | undefined
    handled: boolean
}

export class ErrorHandler {
    static notificationManager: NotificationManager | null = null
    static dialogManager: DialogManager | null = null

    /**
     * Initialize ErrorHandler with UI managers
     */
    static init(
        notificationManager: NotificationManager,
        dialogManager: DialogManager
    ): void {
        this.notificationManager = notificationManager
        this.dialogManager = dialogManager
    }

    /**
     * Handle an error with automatic logging and user notification
     */
    static handle(
        error: Error | string,
        category: ErrorCategoryType = ErrorCategory.CRITICAL,
        options: ErrorHandlerOptions = {}
    ): ErrorHandleResult {
        const {
            context = 'App',
            userMessage = null,
            code = null,
            showNotification = this.shouldShowNotification(category),
            _onRetry = null,
            metadata = null,
        } = options

        // 1. Always log to console with context
        this.logError(error, category, context, metadata)

        // 2. Show user notification if appropriate
        if (showNotification && this.notificationManager) {
            const message = this.getUserMessage(error, category, code, userMessage)
            this.showNotification(message, category, _onRetry)
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
    static logError(
        error: Error | string,
        category: ErrorCategoryType,
        context: string,
        metadata: unknown
    ): void {
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
    static getUserMessage(
        error: Error | string,
        category: ErrorCategoryType,
        code: ErrorCodeType | null,
        customMessage: string | null
    ): string {
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
    static showNotification(
        message: string,
        category: ErrorCategoryType,
        _onRetry: (() => void) | null
    ): void {
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
    static shouldShowNotification(category: ErrorCategoryType): boolean {
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
    static getNotificationDuration(category: ErrorCategoryType): number {
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
    static network(error: Error | string, options: ErrorHandlerOptions = {}): ErrorHandleResult {
        return this.handle(error, ErrorCategory.NETWORK, options)
    }

    /**
     * Convenience method for validation errors
     */
    static validation(
        error: Error | string,
        options: ErrorHandlerOptions = {}
    ): ErrorHandleResult {
        return this.handle(error, ErrorCategory.VALIDATION, options)
    }

    /**
     * Convenience method for storage errors
     */
    static storage(error: Error | string, options: ErrorHandlerOptions = {}): ErrorHandleResult {
        return this.handle(error, ErrorCategory.STORAGE, options)
    }

    /**
     * Convenience method for critical errors
     */
    static critical(error: Error | string, options: ErrorHandlerOptions = {}): ErrorHandleResult {
        return this.handle(error, ErrorCategory.CRITICAL, options)
    }

    /**
     * Convenience method for silent errors (logged but not shown)
     */
    static silent(error: Error | string, options: ErrorHandlerOptions = {}): ErrorHandleResult {
        return this.handle(error, ErrorCategory.SILENT, options)
    }
}

// Export error types for convenience
export { ErrorCategory, ErrorCode } from './ErrorTypes'
