/**
 * Common type definitions shared across the application
 */

// ============================================================================
// Geometry Types
// ============================================================================

export interface Point {
    x: number
    y: number
}

export interface Bounds {
    x: number
    y: number
    width: number
    height: number
}

// ============================================================================
// Drawing Types
// ============================================================================

export interface DrawingObjectData {
    id: string
    type: string
    x: number
    y: number
    color?: string
    width?: number
    points?: Point[]
    text?: string
    fontSize?: number
    startX?: number
    startY?: number
    endX?: number
    endY?: number
    radius?: number
    timestamp?: number
    userId?: string
    // Additional properties for shapes
    x1?: number
    y1?: number
    x2?: number
    y2?: number
    // Any additional dynamic properties
    [key: string]: unknown
}

export interface ToolOptions {
    color: string
    width: number
}

export interface RemoteCursor {
    userId: string
    x: number
    y: number
    color: string
    tool: string
    lastUpdate: number
}

// ============================================================================
// Network Message Types
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
    objects: DrawingObjectData[]
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
    object: DrawingObjectData
}

export interface ObjectUpdatedMessage extends BaseMessage {
    type: 'object_updated'
    object: DrawingObjectData
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
// UI Manager Types
// ============================================================================

export interface NotificationManager {
    showSuccess(message: string, duration?: number): void
    showError(message: string, duration?: number): void
    showWarning(message: string, duration?: number): void
    showInfo(message: string, duration?: number): void
}

export interface DialogManager {
    showDialog(title: string, message: string, options?: DialogOptions): void
    closeDialog(): void
}

export interface DialogOptions {
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
    onCancel?: () => void
}

// ============================================================================
// State Store Types
// ============================================================================

export type StateListener<T> = (value: T) => void

export interface StateSubscription {
    unsubscribe: () => void
}
