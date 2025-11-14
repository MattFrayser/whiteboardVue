/**
 * Network Type Definitions
 *
 * Type definitions for WebSocket communication, network managers,
 * and message handling.
 */

import type { NotificationManager } from './ui'
import type { DrawingEngine } from '../engine/DrawingEngine'

// ============================================================================
// Network Message Types (Internal Engine Messages)
// ============================================================================

/**
 * Internal network messages used by DrawingEngine
 * These are processed after being transformed from server messages
 */
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
// WebSocket Protocol Message Types
// ============================================================================

export type ServerMessageType =
    | 'session_created'
    | 'session_joined'
    | 'user_joined'
    | 'user_left'
    | 'drawing_data'
    | 'object_added'
    | 'object_updated'
    | 'object_deleted'
    | 'cursor_move'
    | 'error'
    | 'ping'
    | 'pong'

export type ClientMessageType =
    | 'create_session'
    | 'join_session'
    | 'add_object'
    | 'update_object'
    | 'delete_object'
    | 'cursor_move'
    | 'pong'

export interface BaseMessage {
    type: string
    timestamp?: number
}

export interface SessionCreatedMessage extends BaseMessage {
    type: 'session_created'
    sessionId: string
    userId: string
}

export interface SessionJoinedMessage extends BaseMessage {
    type: 'session_joined'
    sessionId: string
    userId: string
    objects: import('./common').DrawingObjectData[]
}

export interface UserJoinedMessage extends BaseMessage {
    type: 'user_joined'
    userId: string
}

export interface UserLeftMessage extends BaseMessage {
    type: 'user_left'
    userId: string
}

export interface ObjectAddedMessage extends BaseMessage {
    type: 'object_added'
    object: import('./common').DrawingObjectData
}

export interface ObjectUpdatedMessage extends BaseMessage {
    type: 'object_updated'
    object: import('./common').DrawingObjectData
}

export interface ObjectDeletedMessage extends BaseMessage {
    type: 'object_deleted'
    objectId: string
}

export interface CursorMoveMessage extends BaseMessage {
    type: 'cursor_move'
    userId: string
    x: number
    y: number
    color: string
    tool: string
}

export interface ErrorMessage extends BaseMessage {
    type: 'error'
    error: string
    code?: string
}

export interface PingMessage extends BaseMessage {
    type: 'ping'
}

export interface PongMessage extends BaseMessage {
    type: 'pong'
}

export type ServerMessage =
    | SessionCreatedMessage
    | SessionJoinedMessage
    | UserJoinedMessage
    | UserLeftMessage
    | ObjectAddedMessage
    | ObjectUpdatedMessage
    | ObjectDeletedMessage
    | CursorMoveMessage
    | ErrorMessage
    | PingMessage
    | PongMessage

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
    return (
        typeof obj.resolve === 'function' &&
        typeof obj.reject === 'function'
    )
}
