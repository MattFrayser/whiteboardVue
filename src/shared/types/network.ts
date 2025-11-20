/**
 * Type definitions for WebSocket communication, network managers,
 * and message handling.
 */

import type { NotificationManager } from './ui'
import type { DrawingEngine } from '../../core/engine/DrawingEngine'

// ============================================================================
// Network Message Types (Internal Engine Messages)
// ============================================================================

export interface NetworkMessage {
    type: string
    userId?: string
    object?: import('./common').DrawingObjectData
    objectId?: string
    objects?: import('./common').DrawingObjectData[]
    x?: number
    y?: number
    color?: string
    tool?: string
    message?: string
    code?: string
}

// ============================================================================
// WebSocket Manager Types
// ============================================================================

export type MessageHandler = (message: NetworkMessage) => void

export type StatusCallback = (status: string) => void

export interface PendingAck {
    resolve: (value: { objectId: string; success: boolean }) => void
    reject: (reason?: unknown) => void
    timeoutId: ReturnType<typeof setTimeout>
}

export interface WebSocketConfig {
    url: string
    reconnectDelay?: number
    maxReconnectAttempts?: number
    ackTimeout?: number
}

// ============================================================================
// Session Manager Types
// ============================================================================

export interface SessionManagerConfig {
    engine: DrawingEngine
    notificationManager: NotificationManager
    dialogManager: unknown
    inviteManager: unknown // Will be defined when InviteManager is typed
}

export interface SessionState {
    roomCode: string | null
    localUserId: string | null
    isConnected: boolean
}

// ============================================================================
// Migration Result Types
// ============================================================================

export interface MigrationResult {
    succeeded: string[] // Array of object IDs that succeeded
    failed: Array<{ objectId: string; error: string }> // Array of failed objects with error messages
}

// ============================================================================
// Cursor Broadcast Types
// ============================================================================

export interface CursorData {
    x: number
    y: number
    color: string
    tool: string
}

// ============================================================================
// Type Guards
// ============================================================================

export function isNetworkMessage(value: unknown): value is NetworkMessage {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const obj = value as Record<string, unknown>
    return typeof obj.type === 'string'
}

export function isPendingAck(value: unknown): value is PendingAck {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const obj = value as Record<string, unknown>
    return typeof obj.resolve === 'function' && typeof obj.reject === 'function'
}
