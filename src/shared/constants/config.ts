/**
 * Input-related constants
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

/**
 * Limits, thresholds, and boundary values
 */

// History Management
export const MAX_HISTORY_SIZE = 50

// Zoom and Pan Limits
export const ZOOM_SCALE_FACTOR = 1.1
export const MIN_ZOOM_SCALE = 0.1
export const MAX_ZOOM_SCALE = 10

// Stroke and Path Limits
export const MIN_STROKE_POINTS = 3
export const SIMPLIFY_EPSILON_MULTIPLIER = 0.5

// Movement and Interaction Thresholds
export const MIN_MOVEMENT_THRESHOLD = 0.01

// Font and Text
export const FONT_SIZE_MULTIPLIER = 3

// Quadtree (Spatial Index)
export const QUADTREE_MIN_SIZE = 20000
export const QUADTREE_PADDING_MULTIPLIER = 1.2

/**
 * Network-related constants
 */

// API Endpoints - use Vite's import.meta.env (not process.env for browser)
// Vite automatically loads .env files and exposes variables prefixed with VITE_
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || ''

// Connection Retry Limits
export const MAX_RECONNECT_ATTEMPTS = 3
export const MAX_PASSWORD_ATTEMPTS = 3

// Network Timeouts (milliseconds)
export const RECONNECT_DELAY = 2000
export const AUTH_TIMEOUT = 6000 // 6 seconds - slightly longer than backend's 5s
export const ACK_TIMEOUT = 5000
export const PASSWORD_RETRY_DELAY = 500

/**
 * UI Timeouts and Delays (milliseconds)
 */

// UI Interaction Delays
export const DIALOG_FOCUS_DELAY = 100
export const TEXT_BLUR_DELAY = 200
export const TEXT_FOCUS_DELAY = 10

// Notification Timing
export const DEFAULT_NOTIFICATION_DURATION = 5000
export const NOTIFICATION_FADE_DURATION = 300

// Input and Cursor Throttling
export const CURSOR_THROTTLE_MS = 33 // ~30fps (1000/30)

// Sync and Debounce
export const DEFAULT_SYNC_DEBOUNCE = 1000
