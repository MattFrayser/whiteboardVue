/**
 * Shared TypeScript interfaces for dialog components
 */

export interface PasswordDialogConfig {
    roomCode: string
    errorMessage?: string | null
}

export interface JoinRoomDialogConfig {
    roomCode: string
    onJoin?: (() => void | Promise<void>) | null
    onCancel?: (() => void) | null
}

export interface ConfirmDialogConfig {
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    confirmClass?: string
}
