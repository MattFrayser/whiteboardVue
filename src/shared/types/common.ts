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

// ============================================================================
// Drawing Types
// ============================================================================

/**
 * Base properties common to all drawing objects
 */
export interface BaseObjectData {
    id: string
    type: string
    timestamp?: number
    userId?: string
    [key: string]: unknown
}

/**
 * Type-specific data schemas matching backend object_schema.go
 */

// LineCoordinates-based shapes (Rectangle, Circle, Line)
export interface RectangleData extends BaseObjectData {
    type: 'rectangle'
    x1: number
    y1: number
    x2: number
    y2: number
    color?: string
    width?: number  // stroke width
    fill?: string
    [key: string]: unknown
}

export interface CircleData extends BaseObjectData {
    type: 'circle'
    x1: number  // center x
    y1: number  // center y
    x2: number  // point on radius x
    y2: number  // point on radius y
    color?: string
    width?: number  // stroke width
    fill?: string
    [key: string]: unknown
}

export interface LineData extends BaseObjectData {
    type: 'line'
    x1: number
    y1: number
    x2: number
    y2: number
    color?: string
    width?: number  // stroke width
    [key: string]: unknown
}

// Position-based shapes (Text)
export interface TextData extends BaseObjectData {
    type: 'text'
    x: number
    y: number
    text: string
    fontSize?: number
    fontFamily?: string
    color?: string
    bold?: boolean
    italic?: boolean
    background?: string
    [key: string]: unknown
}

// Path-based shapes (Stroke)
export interface StrokeData extends BaseObjectData {
    type: 'stroke'
    points: Point[]
    color?: string
    width?: number  // stroke width
    [key: string]: unknown
}

/**
 * Main drawing object data type - strict discriminated union
 * Use type guards to narrow to specific types
 */
export type DrawingObjectData =
    | RectangleData
    | CircleData
    | LineData
    | TextData
    | StrokeData

/**
 * Type guard functions for discriminated unions
 */
export function isRectangleData(data: DrawingObjectData): data is RectangleData {
    return data.type === 'rectangle'
}

export function isCircleData(data: DrawingObjectData): data is CircleData {
    return data.type === 'circle'
}

export function isLineData(data: DrawingObjectData): data is LineData {
    return data.type === 'line'
}

export function isTextData(data: DrawingObjectData): data is TextData {
    return data.type === 'text'
}

export function isStrokeData(data: DrawingObjectData): data is StrokeData {
    return data.type === 'stroke'
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
