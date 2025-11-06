/**
 * UI-related constants
 * Includes cursor definitions, sizes, dimensions, and visual styling values
 */

// Cursor Definitions
export const CURSORS = {
    DRAW: 'url(/draw-cursor.svg) 2 17, crosshair',
    ERASER: 'url(/eraser-cursor.svg) 10 9, pointer',
    SELECT: 'url(/select-cursor.svg) 2 2, default',
} as const

// Brush and Drawing Sizes
export const DEFAULT_BRUSH_WIDTH = 5
export const REMOTE_CURSOR_RADIUS = 5

// Eraser Tool Constants
export const ERASER_TRAIL_WIDTH = 10
export const ERASER_SIZE = 1
export const ERASER_FADE_STEP = 0.08

// Selection Tool Constants
export const RESIZE_HANDLE_CLICK_SIZE = 20
export const MIN_SELECTION_PADDING = 10
export const BASE_SELECTION_PADDING = 16 // 12 + 4
export const SELECTION_RECT_DASH = [5, 5] as const

// Brush Preview Sizes
export const BRUSH_PREVIEW = {
    MIN: 8,
    MAX: 28,
    MULTIPLIER: 1.5,
} as const
