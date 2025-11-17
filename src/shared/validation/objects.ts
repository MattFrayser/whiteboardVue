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
 * Validate common fields present in all drawing objects
 */
function hasValidCommonFields(data: Record<string, unknown>): boolean {
    // Required common fields
    if (!isString(data.id) || data.id.length === 0) return false
    if (!isString(data.type)) return false
    
    // Optional common fields
    if (data.color !== undefined && !isHexColor(data.color)) return false
    if (data.userId !== undefined && !isString(data.userId)) return false
    
    return true
}

/**
 * Validate Stroke object
 */
function isValidStroke(data: Record<string, unknown>): boolean {
    if (data.type !== 'stroke') return false
    if (!hasValidCommonFields(data)) return false
    
    // Stroke-specific required fields
    if (!isValidPointArray(data.points)) return false
    
    // Stroke-specific optional fields
    if (data.strokeWidth !== undefined && !isPositiveNumber(data.strokeWidth)) return false
    
    return true
}

/**
 * Validate Rectangle object
 */
function isValidRectangle(data: Record<string, unknown>): boolean {
    if (data.type !== 'rectangle') return false
    if (!hasValidCommonFields(data)) return false
    
    // Rectangle-specific required fields
    if (!isNumber(data.x)) return false
    if (!isNumber(data.y)) return false
    if (!isNumber(data.width) || data.width <= 0) return false
    if (!isNumber(data.height) || data.height <= 0) return false  // ✅ ONLY Rectangle needs height
    
    // Rectangle-specific optional fields
    if (data.strokeWidth !== undefined && !isPositiveNumber(data.strokeWidth)) return false
    
    return true
}

/**
 * Validate Circle object
 */
function isValidCircle(data: Record<string, unknown>): boolean {
    if (data.type !== 'circle') return false
    if (!hasValidCommonFields(data)) return false
    
    // Circle-specific required fields
    if (!isNumber(data.x)) return false
    if (!isNumber(data.y)) return false
    if (!isNumber(data.radius) || data.radius <= 0) return false
    
    // Circle-specific optional fields
    if (data.strokeWidth !== undefined && !isPositiveNumber(data.strokeWidth)) return false
    
    return true
}

/**
 * Validate Line object
 */
function isValidLine(data: Record<string, unknown>): boolean {
    if (data.type !== 'line') return false
    if (!hasValidCommonFields(data)) return false
    
    // Line-specific required fields
    if (!isNumber(data.x1)) return false
    if (!isNumber(data.y1)) return false
    if (!isNumber(data.x2)) return false
    if (!isNumber(data.y2)) return false
    
    // Line-specific optional fields
    if (data.strokeWidth !== undefined && !isPositiveNumber(data.strokeWidth)) return false
    
    return true
}

/**
 * Validate Text object
 */
function isValidText(data: Record<string, unknown>): boolean {
    if (data.type !== 'text') return false
    if (!hasValidCommonFields(data)) return false
    
    // Text-specific required fields
    if (!isNumber(data.x)) return false
    if (!isNumber(data.y)) return false
    if (!isString(data.text)) return false
    if (!isPositiveNumber(data.fontSize)) return false
    
    return true
}

/**
 * Main validator - dispatches to type-specific validators
 */
export function isValidDrawingObjectData(data: unknown): data is DrawingObjectData {
    if (!isObject(data)) return false
    
    // Dispatch to type-specific validator
    switch (data.type) {
        case 'stroke':
            return isValidStroke(data)
        case 'rectangle':
            return isValidRectangle(data)
        case 'circle':
            return isValidCircle(data)
        case 'line':
            return isValidLine(data)
        case 'text':
            return isValidText(data)
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
    return isValidDrawingObjectData(data.data)
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
