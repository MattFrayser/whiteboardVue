import {
    isString,
    isNumber,
    isObject,
    isHexColor,
    isPositiveNumber,
    isNonNegativeInteger,
    isValidPointArray
} from './primitives'
import type { DrawingObjectData } from '../types/common'

/**
 * Validate common fields for flat format (has id and type)
 */
function hasValidCommonFields(data: Record<string, unknown>): boolean {
    // Required common fields for flat format
    if (!isString(data.id) || data.id.length === 0) return false
    if (!isString(data.type)) return false

    // Optional common fields
    if (data.color !== undefined && !isHexColor(data.color)) return false
    if (data.userId !== undefined && !isString(data.userId)) return false

    return true
}

/**
 * Validate common fields for nested format's inner data (no id or type)
 */
function hasValidInnerDataFields(data: Record<string, unknown>): boolean {
    // In nested format, id and type are at outer level, NOT in inner data
    // Only validate optional common fields
    if (data.color !== undefined && !isHexColor(data.color)) return false
    if (data.userId !== undefined && !isString(data.userId)) return false

    return true
}

/**
 * Validate Stroke object
 */
function isValidStroke(data: Record<string, unknown>, isInnerData = false): boolean {
    // For inner data, type is at outer level; for flat data, check type here
    if (!isInnerData && data.type !== 'stroke') return false

    if (isInnerData) {
        if (!hasValidInnerDataFields(data)) return false
    } else {
        if (!hasValidCommonFields(data)) return false
    }

    // Stroke-specific required fields
    if (!isValidPointArray(data.points)) return false

    // Stroke-specific optional fields
    // Check for both 'width' (new) and 'strokeWidth' (legacy) for backward compatibility
    if (data.width !== undefined && !isPositiveNumber(data.width)) return false
    if (data.strokeWidth !== undefined && !isPositiveNumber(data.strokeWidth)) return false

    return true
}

/**
 * Validate Rectangle object
 */
function isValidRectangle(data: Record<string, unknown>, isInnerData = false): boolean {
    // For inner data, type is at outer level; for flat data, check type here
    if (!isInnerData && data.type !== 'rectangle') return false

    if (isInnerData) {
        if (!hasValidInnerDataFields(data)) return false
    } else {
        if (!hasValidCommonFields(data)) return false
    }

    // Accept backend format: x1, y1, x2, y2
    if (!isNumber(data.x1)) return false
    if (!isNumber(data.y1)) return false
    if (!isNumber(data.x2)) return false
    if (!isNumber(data.y2)) return false

    // Check for both 'width' (stroke width) and 'strokeWidth' (legacy) for backward compatibility
    if (data.width !== undefined && !isPositiveNumber(data.width)) return false
    if (data.strokeWidth !== undefined && !isPositiveNumber(data.strokeWidth)) return false

    return true
}

/**
 * Validate Circle object
 */
function isValidCircle(data: Record<string, unknown>, isInnerData = false): boolean {
    // For inner data, type is at outer level; for flat data, check type here
    if (!isInnerData && data.type !== 'circle') return false

    if (isInnerData) {
        if (!hasValidInnerDataFields(data)) return false
    } else {
        if (!hasValidCommonFields(data)) return false
    }

    if (!isNumber(data.x1)) return false
    if (!isNumber(data.y1)) return false
    if (!isNumber(data.x2)) return false
    if (!isNumber(data.y2)) return false

    // Check for both 'width' (stroke width) and 'strokeWidth' (legacy) for backward compatibility
    if (data.width !== undefined && !isPositiveNumber(data.width)) return false
    if (data.strokeWidth !== undefined && !isPositiveNumber(data.strokeWidth)) return false

    return true
}

/**
 * Validate Line object
 */
function isValidLine(data: Record<string, unknown>, isInnerData = false): boolean {
    // For inner data, type is at outer level; for flat data, check type here
    if (!isInnerData && data.type !== 'line') return false

    if (isInnerData) {
        if (!hasValidInnerDataFields(data)) return false
    } else {
        if (!hasValidCommonFields(data)) return false
    }

    // Line-specific required fields
    if (!isNumber(data.x1)) return false
    if (!isNumber(data.y1)) return false
    if (!isNumber(data.x2)) return false
    if (!isNumber(data.y2)) return false

    // Line-specific optional fields
    // Check for both 'width' (stroke width) and 'strokeWidth' (legacy) for backward compatibility
    if (data.width !== undefined && !isPositiveNumber(data.width)) return false
    if (data.strokeWidth !== undefined && !isPositiveNumber(data.strokeWidth)) return false

    return true
}

/**
 * Validate Text object
 */
function isValidText(data: Record<string, unknown>, isInnerData = false): boolean {
    // For inner data, type is at outer level; for flat data, check type here
    if (!isInnerData && data.type !== 'text') return false

    if (isInnerData) {
        if (!hasValidInnerDataFields(data)) return false
    } else {
        if (!hasValidCommonFields(data)) return false
    }

    // Text-specific required fields
    if (!isNumber(data.x)) return false
    if (!isNumber(data.y)) return false
    if (!isString(data.text)) return false
    if (!isPositiveNumber(data.fontSize)) return false

    return true
}

/**
 * Main validator - dispatches to type-specific validators for flat format
 */
export function isValidDrawingObjectData(data: unknown, isInnerData = false): data is DrawingObjectData {
    if (!isObject(data)) return false

    // Dispatch to type-specific validator
    switch (data.type) {
        case 'stroke':
            return isValidStroke(data, isInnerData)
        case 'rectangle':
            return isValidRectangle(data, isInnerData)
        case 'circle':
            return isValidCircle(data, isInnerData)
        case 'line':
            return isValidLine(data, isInnerData)
        case 'text':
            return isValidText(data, isInnerData)
        default:
            console.warn('[Validation] Unknown object type:', data.type)
            return false
    }
}

/**
 * Validate nested object format (from backend)
 */
export function isValidNestedObject(data: unknown): data is {
    id: string;
    type: string;
    data: DrawingObjectData;
    zIndex: number
} {
    if (!isObject(data)) return false
    if (!isString(data.id)) return false
    if (!isString(data.type)) return false
    if (!isNonNegativeInteger(data.zIndex)) return false
    if (!isObject(data.data)) return false

    // Dispatch to type-specific validator based on OUTER type
    // Pass isInnerData=true since inner data doesn't have id/type
    switch (data.type) {
        case 'stroke':
            return isValidStroke(data.data, true)
        case 'rectangle':
            return isValidRectangle(data.data, true)
        case 'circle':
            return isValidCircle(data.data, true)
        case 'line':
            return isValidLine(data.data, true)
        case 'text':
            return isValidText(data.data, true)
        default:
            console.warn('[Validation] Unknown nested object type:', data.type)
            return false
    }
}

/**
 * Validate object (either nested or flat format)
 */
export function isValidObject(data: unknown): data is DrawingObjectData | {
    id: string;
    type: string;
    data: DrawingObjectData;
    zIndex: number
} {
    return isValidDrawingObjectData(data) || isValidNestedObject(data)
}
