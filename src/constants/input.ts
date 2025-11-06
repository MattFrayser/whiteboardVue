/**
 * Input-related constants
 * Includes mouse button codes and keyboard shortcuts
 */

// Mouse Button Constants
export const MOUSE_BUTTON = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
} as const

// Mouse Buttons Bitmask (for e.buttons property)
export const MOUSE_BUTTONS = {
    NONE: 0,
    LEFT: 1,
    RIGHT: 2,
    MIDDLE: 4,
} as const

// Tool Keyboard Shortcuts
export const TOOL_SHORTCUTS = {
    's': 'select',
    'd': 'draw',
    'r': 'rectangle',
    'c': 'circle',
    'l': 'line',
    't': 'text',
    'e': 'eraser',
} as const
