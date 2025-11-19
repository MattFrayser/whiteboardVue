/**
 * Data sanitization functions
 */

import type { DrawingObjectData } from '../types/common'
import { isTextData, isStrokeData } from '../types/common'

const MAX_COORD = 1000000
const MIN_COORD = -1000000
const MAX_STROKE_WIDTH = 100
const MAX_FONT_SIZE = 500
const MAX_TEXT_LENGTH = 10000

/**
 * Sanitize object data by clamping values to safe ranges
 * Uses type narrowing for safe property access
 */
export function sanitizeObjectData(data: DrawingObjectData): DrawingObjectData {
    const sanitized: any = { ...data }

    // Use type guards for type-specific sanitization
    if (isTextData(sanitized)) {
        // Clamp text coordinates
        sanitized.x = Math.max(MIN_COORD, Math.min(MAX_COORD, sanitized.x))
        sanitized.y = Math.max(MIN_COORD, Math.min(MAX_COORD, sanitized.y))

        // Clamp font size
        if (sanitized.fontSize !== undefined) {
            sanitized.fontSize = Math.max(1, Math.min(MAX_FONT_SIZE, sanitized.fontSize))
        }

        // Truncate text
        if (typeof sanitized.text === 'string' && sanitized.text.length > MAX_TEXT_LENGTH) {
            sanitized.text = sanitized.text.substring(0, MAX_TEXT_LENGTH)
        }
    } else if (isStrokeData(sanitized)) {
        // Sanitize points array
        if (Array.isArray(sanitized.points)) {
            sanitized.points = sanitized.points.map(p => ({
                x: Math.max(MIN_COORD, Math.min(MAX_COORD, p.x)),
                y: Math.max(MIN_COORD, Math.min(MAX_COORD, p.y))
            }))
        }
    } else {
        // Rectangle, Circle, Line - have x1, y1, x2, y2
        if ('x1' in sanitized && typeof sanitized.x1 === 'number') {
            sanitized.x1 = Math.max(MIN_COORD, Math.min(MAX_COORD, sanitized.x1))
        }
        if ('y1' in sanitized && typeof sanitized.y1 === 'number') {
            sanitized.y1 = Math.max(MIN_COORD, Math.min(MAX_COORD, sanitized.y1))
        }
        if ('x2' in sanitized && typeof sanitized.x2 === 'number') {
            sanitized.x2 = Math.max(MIN_COORD, Math.min(MAX_COORD, sanitized.x2))
        }
        if ('y2' in sanitized && typeof sanitized.y2 === 'number') {
            sanitized.y2 = Math.max(MIN_COORD, Math.min(MAX_COORD, sanitized.y2))
        }
    }

    // Clamp stroke width (common to all types)
    if ('width' in sanitized && typeof sanitized.width === 'number') {
        sanitized.width = Math.max(0.1, Math.min(MAX_STROKE_WIDTH, sanitized.width))
    }

    return sanitized as DrawingObjectData
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
