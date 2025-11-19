import { describe, it, expect } from 'vitest'
import {
  sanitizeObjectData,
  sanitizeRoomCode,
  validateColor,
  clampBrushSize,
  clampCoordinate,
  isValidDrawingObjectData,
  isAuthenticatedMessage,
} from '../../src/shared/validation'
import type { DrawingObjectData } from '../../src/shared/types/common'

describe('Sanitization', () => {
    it('should clamp extreme coordinates', () => {
        const data: DrawingObjectData = {
            id: 'test-1',
            type: 'rectangle',
            x: 999999999,
            y: -999999999,
            width: 100,
            height: 100,
        }

        const sanitized = sanitizeObjectData(data)

        expect(sanitized.x).toBeLessThanOrEqual(1000000)
        expect(sanitized.x).toBeGreaterThanOrEqual(-1000000)
        expect(sanitized.y).toBeLessThanOrEqual(1000000)
        expect(sanitized.y).toBeGreaterThanOrEqual(-1000000)
    })

    it('should truncate very long text', () => {
        const longText = 'A'.repeat(20000)
        const data: DrawingObjectData = {
            id: 'test-2',
            type: 'text',
            x: 0,
            y: 0,
            text: longText,
            fontSize: 12,
        }

        const sanitized = sanitizeObjectData(data)

        expect(sanitized.text!.length).toBeLessThanOrEqual(10000)
    })

    it('should clamp stroke width', () => {
        const data: DrawingObjectData = {
            id: 'test-3',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            strokeWidth: 999,
        }

        const sanitized = sanitizeObjectData(data)

        expect(sanitized.strokeWidth).toBeLessThanOrEqual(100)
    })

    it('should sanitize room codes', () => {
        expect(sanitizeRoomCode('ABC123')).toBe('ABC123')
        expect(sanitizeRoomCode('abc-123')).toBe('ABC123')
        expect(sanitizeRoomCode('<script>alert("xss")</script>')).toBe('SCRIPTALERT')
        expect(sanitizeRoomCode('')).toBe('INVALID')
    })

    it('should validate hex colors', () => {
        expect(validateColor('#000000')).toBe('#000000')
        expect(validateColor('#FF5733')).toBe('#FF5733')
        expect(validateColor('red')).toBe('#000000') // Invalid, returns default
        expect(validateColor('#FFF')).toBe('#000000') // Invalid (must be 6 digits)
    })

    it('should clamp brush size', () => {
        expect(clampBrushSize(5)).toBe(5)
        expect(clampBrushSize(0)).toBe(1) // Min
        expect(clampBrushSize(100)).toBe(25) // Max
        expect(clampBrushSize(NaN)).toBe(1)
    })

    it('should clamp coordinates', () => {
        expect(clampCoordinate(500)).toBe(500)
        expect(clampCoordinate(2000000)).toBe(1000000)
        expect(clampCoordinate(-2000000)).toBe(-1000000)
        expect(clampCoordinate(NaN)).toBe(0)
    })
})

describe('createMessageValidator', () => {
    it('should validate correct authenticated message', () => {
        const msg = { type: 'authenticated', userId: 'user123' }
        expect(isAuthenticatedMessage(msg)).toBe(true)
    })
    
    it('should reject invalid type', () => {
        const msg = { type: 'wrong', userId: 'user123' }
        expect(isAuthenticatedMessage(msg)).toBe(false)
    })
    
    it('should reject invalid optional field', () => {
        const msg = { type: 'authenticated', userId: 123 }  // number instead of string
        expect(isAuthenticatedMessage(msg)).toBe(false)
    })
})

describe('Object Validation', () => {
    it('should validate valid rectangle', () => {
        const data = {
            id: 'rect-1',
            type: 'rectangle',
            x: 10,
            y: 20,
            width: 100,
            height: 50,
            color: '#FF0000',
        }

        expect(isValidDrawingObjectData(data)).toBe(true)
    })

    it('should reject rectangle with missing required fields', () => {
        const data = {
            id: 'rect-2',
            type: 'rectangle',
            x: 10,
            y: 20,
            // Missing width and height
        }

        expect(isValidDrawingObjectData(data)).toBe(false)
    })

    it('should validate valid stroke', () => {
        const data = {
            id: 'stroke-1',
            type: 'stroke',
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            color: '#000000',
        }

        expect(isValidDrawingObjectData(data)).toBe(true)
    })

    it('should reject stroke with invalid points', () => {
        const data = {
            id: 'stroke-2',
            type: 'stroke',
            points: [{ x: 0 }], // Missing y
            color: '#000000',
        }

        expect(isValidDrawingObjectData(data)).toBe(false)
    })

    it('should reject object with missing id', () => {
        const data = {
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
        }

        expect(isValidDrawingObjectData(data)).toBe(false)
    })

    it('should reject object with invalid color', () => {
        const data = {
            id: 'test-1',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            color: 'not-a-hex-color',
        }

        expect(isValidDrawingObjectData(data)).toBe(false)
    })
})
