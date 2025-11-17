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

export interface ResizeHandle extends Point {
    cursor: string
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
// State Store Types
// ============================================================================

export type StateListener<T> = (value: T) => void

export interface StateSubscription {
    unsubscribe: () => void
}
