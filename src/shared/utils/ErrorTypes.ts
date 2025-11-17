/**
 * ErrorTypes
 *
 * Centralized error categories, codes, and user-friendly messages
 */

// Error Categories
export const ErrorCategory = {
    NETWORK: 'network',
    VALIDATION: 'validation',
    STORAGE: 'storage',
    CRITICAL: 'critical',
    SILENT: 'silent', // Logged but not shown to user
} as const

export type ErrorCategoryType = (typeof ErrorCategory)[keyof typeof ErrorCategory]

// Error Codes
export const ErrorCode = {
    // Network errors
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    TIMEOUT: 'TIMEOUT',
    SERVER_ERROR: 'SERVER_ERROR',
    DISCONNECT: 'DISCONNECT',

    // Validation errors
    INVALID_INPUT: 'INVALID_INPUT',
    INVALID_PASSWORD: 'INVALID_PASSWORD',
    INVALID_ROOM_CODE: 'INVALID_ROOM_CODE',

    // Storage errors
    STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
    STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
    SAVE_FAILED: 'SAVE_FAILED',
    LOAD_FAILED: 'LOAD_FAILED',

    // Critical errors
    COMPONENT_INIT_FAILED: 'COMPONENT_INIT_FAILED',
    RENDER_FAILED: 'RENDER_FAILED',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]

// User-friendly error messages
export const ErrorMessages: Record<ErrorCodeType, string> = {
    // Network
    [ErrorCode.CONNECTION_FAILED]: 'Unable to connect to the server. Please check your internet connection and try again.',
    [ErrorCode.AUTHENTICATION_FAILED]: 'Authentication failed. Please try reconnecting.',
    [ErrorCode.TIMEOUT]: 'The connection timed out. Please try again.',
    [ErrorCode.SERVER_ERROR]: 'Server error occurred. Please try again later.',
    [ErrorCode.DISCONNECT]: 'You have been disconnected from the session.',

    // Validation
    [ErrorCode.INVALID_INPUT]: 'Invalid input. Please check your entry and try again.',
    [ErrorCode.INVALID_PASSWORD]: 'Incorrect password. Please try again.',
    [ErrorCode.INVALID_ROOM_CODE]: 'Invalid room code. Please check and try again.',

    // Storage
    [ErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded. Your work is still saved in memory, but automatic saving is disabled. Consider exporting your work.',
    [ErrorCode.STORAGE_UNAVAILABLE]: 'Local storage is unavailable. Your work will not be saved automatically.',
    [ErrorCode.SAVE_FAILED]: 'Failed to save your work. Please try exporting your data.',
    [ErrorCode.LOAD_FAILED]: 'Failed to load saved data. Starting with a blank canvas.',

    // Critical
    [ErrorCode.COMPONENT_INIT_FAILED]: 'A component failed to initialize. Some features may not work correctly.',
    [ErrorCode.RENDER_FAILED]: 'Rendering error occurred. Please refresh the page.',
    [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
}

// Default messages by category (fallback if specific error code not found)
export const DefaultMessages: Record<ErrorCategoryType, string> = {
    [ErrorCategory.NETWORK]: 'Network error occurred. Please check your connection.',
    [ErrorCategory.VALIDATION]: 'Validation error. Please check your input.',
    [ErrorCategory.STORAGE]: 'Storage error occurred.',
    [ErrorCategory.CRITICAL]: 'An error occurred. Please refresh the page.',
    [ErrorCategory.SILENT]: '', // No user message for silent errors
}
