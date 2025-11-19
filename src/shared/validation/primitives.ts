/**
 * Low-level type guards and validators
 */

export function isString(value: unknown): value is string {
    return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value)
}

export function isHexColor(value: unknown): value is string {
    return isString(value) && /^#[0-9A-Fa-f]{6}$/.test(value)
}

export function isPositiveNumber(value: unknown): value is number {
    return isNumber(value) && value > 0
}

export function isNonNegativeInteger(value: unknown): value is number {
    return isNumber(value) && value >= 0 && Number.isInteger(value)
}

export function isValidPoint(value: unknown): value is { x: number; y: number } {
    if (!isObject(value)) return false
    return isNumber(value.x) && isNumber(value.y)
}

export function isValidPointArray(value: unknown): value is Array<{ x: number; y: number }> {
    if (!isArray(value)) return false
    return value.every(isValidPoint)
}

/**
 * Safely parses JSON with error handling
 */
export function parseJSON(data: string): unknown | null {
    // Silently ignore empty or whitespace-only data (e.g., WebSocket heartbeats)
    if (!data || data.trim().length === 0) {
        return null
    }

    try {
        return JSON.parse(data)
    } catch (error) {
        console.error('Failed to parse JSON:', error)
        return null
    }
}

/**
 * Validates basic message structure (must be object with type field)
 */
export function isValidMessageStructure(msg: unknown): msg is { type: string } {
    return isObject(msg) && isString(msg.type)
}
