import type { DrawingEngine } from '../../core/engine/DrawingEngine'
// ============================================================================
// Toolbar Types
// ============================================================================

export interface ToolbarOptions {
    engine: DrawingEngine
    initialColor?: string
    initialBrushSize?: number
}

// ============================================================================
// Dialog Types
// ============================================================================

export interface DialogOptions {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
    onCancel?: () => void
}

// ============================================================================
// Notification Types
// ============================================================================

export interface NotificationOptions {
    duration?: number
    type?: 'success' | 'error' | 'warning' | 'info'
}

export interface NotificationManager {
    showSuccess(message: string, duration?: number): void
    showError(message: string, duration?: number): void
    showWarning(message: string, duration?: number): void
    showInfo(message: string, duration?: number): void
}

// ============================================================================
// Dialog Manager Types
// ============================================================================

export interface DialogManager {
    showPasswordDialog(roomCode: string, errorMessage?: string | null): Promise<string | null>
    showJoinRoomDialog(
        roomCode: string,
        onJoin?: (() => void | Promise<void>) | null,
        onCancel?: (() => void) | null
    ): Promise<boolean>
    showConfirmDialog(config?: {
        title?: string
        message?: string
        confirmText?: string
        cancelText?: string
        confirmClass?: string
    }): Promise<boolean>
    close(): void
    destroy(): void
}

// ============================================================================
// Connection Status Types
// ============================================================================

export type ConnectionStatus = 'local' | 'connected' | 'connecting' | 'disconnected' | 'error'

export interface StatusLabels {
    [key: string]: string
}

// ============================================================================
// Invite Manager Types
// ============================================================================

export interface InviteManagerConfig {
    roomCode: string
    notificationManager: NotificationManager
    sessionManager: unknown // Will be typed properly in network.ts
}

export interface InviteManager {
    setRoomCode(roomCode: string): void
    setSessionManager(sessionManager: unknown): void
    updateUI(): void
    destroy(): void
}
