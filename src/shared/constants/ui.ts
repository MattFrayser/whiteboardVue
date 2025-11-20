//----------------------
// Cursor
//-----------------------
export const CURSORS = {
    DRAW: 'url(/draw-cursor.svg) 2 17, crosshair',
    ERASER: 'url(/eraser-cursor.svg) 10 9, pointer',
    SELECT: 'url(/select-cursor.svg) 2 2, default',
} as const

//----------------------
// Brush and Drawing Sizes
//-----------------------
export const DEFAULT_BRUSH_WIDTH = 5
export const REMOTE_CURSOR_RADIUS = 5

//----------------------
// Eraser Tool 
//-----------------------
export const ERASER_TRAIL_WIDTH = 10
export const ERASER_SIZE = 1
export const ERASER_FADE_STEP = 0.08
export const ERASER_TRAIL_OPACITY = 0.5

//----------------------
// Selection Tool 
//-----------------------
export const RESIZE_HANDLE_CLICK_SIZE = 20
export const MIN_SELECTION_PADDING = 10
export const BASE_SELECTION_PADDING = 16 // 12 + 4
export const SELECTION_RECT_DASH = [5, 5] as const

//----------------------
// Brush Preview SizesTool 
//-----------------------
export const BRUSH_PREVIEW = {
    MIN: 8,
    MAX: 28,
    MULTIPLIER: 1.5,
} as const

//----------------------
// Object-Specific
//-----------------------
export const LINE_CLICK_TOLERANCE = 5
export const MIN_SHAPE_SIZE = 1
export const MIN_FONT_SIZE = 8

//----------------------
// Colors-Specific
//-----------------------
export const SELECTION_COLOR = '#0066ff'
export const DEFAULT_COLOR = '#000000'
export const SELECTION_HANDLE_BG = '#ffffff'
export const ERROR_MESSAGE_COLOR = '#ff6b6b'
export const ERASER_TRAIL_COLOR = '#888888'
export const DEFAULT_REMOTE_CURSOR_COLOR = '#444444'
export const SELECTION_RECT_FILL = 'rgba(0, 102, 255, 0.1)'
export const COLOR_PALETTE = [
    '#000000',
    '#ffffff',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#ff00ff',
    '#00ffff',
    '#ff6b6b',
    '#4ecdc4',
    '#45b7d1',
    '#96ceb4',
    '#ffeaa7',
    '#dfe6e9',
    '#a29bfe',
    '#fd79a8',
    '#e17055',
    '#74b9ff',
    '#55efc4',
    '#fab1a0',
    '#fdcb6e',
    '#6c5ce7',
    '#b2bec3',
    '#2d3436',
]
