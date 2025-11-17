/**
 * Data sanitization functions
 */

import type { DrawingObjectData } from '../types/common'

const MAX_COORD = 1000000
const MIN_COORD = -1000000
const MAX_STROKE_WIDTH = 100
const MAX_FONT_SIZE = 500
const MAX_TEXT_LENGTH = 10000

/**
 * Sanitize object data by clamping values to safe ranges
 */
export function sanitizeObjectData(data: DrawingObjectData): DrawingObjectData {
    const sanitized = { ...data }

    // Clamp coordinates
    if (sanitized.x !== undefined) {
        sanitized.x = Math.max(MIN_COORD, Math.min(MAX_COORD, sanitized.x))
    }
    if (sanitized.y !== undefined) {
        sanitized.y = Math.max(MIN_COORD, Math.min(MAX_COORD, sanitized.y))
    }
    if (sanitized.width !== undefined) {
        sanitized.width = Math.max(0, Math.min(MAX_COORD, sanitized.width))
    }
    if (sanitized.height !== undefined) {
        sanitized.height = Math.max(0, Math.min(MAX_COORD, sanitized.height))
    }

    // Clamp stroke width
    if (sanitized.strokeWidth !== undefined) {
        sanitized.strokeWidth = Math.max(0.1, Math.min(MAX_STROKE_WIDTH, sanitized.strokeWidth))
    }

    // Clamp font size
    if (sanitized.fontSize !== undefined) {
        sanitized.fontSize = Math.max(1, Math.min(MAX_FONT_SIZE, sanitized.fontSize))
    }

    // Truncate text
    if (sanitized.text !== undefined && sanitized.text.length > MAX_TEXT_LENGTH) {
        sanitized.text = sanitized.text.substring(0, MAX_TEXT_LENGTH)
    }

    // Sanitize points array
    if (sanitized.points !== undefined && Array.isArray(sanitized.points)) {
        sanitized.points = sanitized.points.map(p => ({
            x: Math.max(MIN_COORD, Math.min(MAX_COORD, p.x)),
            y: Math.max(MIN_COORD, Math.min(MAX_COORD, p.y))
        }))
    }

    return sanitized
}

/**
 * Sanitize room code 
 */
export function sanitizeRoomCode(code: string): string {
    if (typeof code !== 'string') {
        return 'INVALID'
    }
    const sanitized = code.replace(/[^A-Z0-9]/gi, '').substring(0, 10).toUpperCase()
    return sanitized || 'INVALID'
}

/**
 * Clamp brush size (already exists, keep for consistency)
 */
export function clampBrushSize(size: number): number {
    const MIN_BRUSH_SIZE = 1
    const MAX_BRUSH_SIZE = 25
    if (!isFinite(size) || isNaN(size)) {
        return MIN_BRUSH_SIZE
    }
    return Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, Math.floor(size)))
}

/**
 * Clamp coordinate
 */
export function clampCoordinate(coord: number): number {
    if (!isFinite(coord) || isNaN(coord)) {
        return 0
    }
    return Math.max(MIN_COORD, Math.min(MAX_COORD, coord))
}

/**
 * Validate hex color
 */
export function validateColor(color: string): string {
    const DEFAULT_COLOR = '#000000'
    const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
    if (typeof color !== 'string' || !HEX_COLOR_REGEX.test(color)) {
        return DEFAULT_COLOR
    }
    return color
}
