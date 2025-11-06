/**
 * UI Component Type Definitions
 *
 * Type definitions for UI components including Toolbar, DialogManager,
 * NotificationManager, and other UI-related interfaces.
 */

import type { DrawingEngine } from '../engine/DrawingEngine'

// ============================================================================
// Toolbar Types
// ============================================================================

export interface ToolbarOptions {
    engine: DrawingEngine
    initialColor?: string
    initialBrushSize?: number
}

export interface SwatchData {
    color: string
    size?: number
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

export interface PasswordDialogOptions {
    roomCode: string
    errorMessage?: string | null
    onSubmit: (password: string) => void
    onCancel: () => void
}

export interface JoinRoomDialogOptions {
    roomCode: string
    onJoin: (roomCode: string) => void
    onCancel: () => void
}

export interface ConfirmDialogConfig {
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
