/**
 * LocalStorageManager
 * Handles persistence of local objects to browser localStorage
 * Enables local-first mode where users can draw before creating a session
 */
import { ErrorHandler, ErrorCode } from '../../shared/utils/ErrorHandler'
import type { DrawingObjectData, Point } from '../../shared/types/common'
import {
    clampCoordinate,
    clampBrushSize,
    validateColor,
    isValidObject,
} from '../../shared/validation'

import { createLogger } from '../../shared/utils/logger'
const log = createLogger('LocalStorage')

const STORAGE_KEY = 'whiteboard_local_objects'
const DEBOUNCE_MS = 500 // Save after 500ms of inactivity

interface SerializableObject {
    toJSON(): unknown
}

export class LocalStorageManager {
    saveTimeout: ReturnType<typeof setTimeout> | null
    enabled: boolean
    isLocal: boolean

    constructor() {
        this.saveTimeout = null
        this.enabled = true
        this.isLocal = false
    }

    setLocalMode(isLocal: boolean): void {
        this.isLocal = isLocal
    }

    /**
     * For offline mode where no backend validation exists
     */
    private sanitizeObjectData(data: DrawingObjectData): DrawingObjectData {
        // Validate coordinates
        if (typeof data.x === 'number') {
            data.x = clampCoordinate(data.x)
        }
        if (typeof data.y === 'number') {
            data.y = clampCoordinate(data.y)
        }

        // Validate color (for strokes, shapes with color property)
        if (typeof data.color === 'string') {
            data.color = validateColor(data.color)
        }

        // Validate width (for strokes)
        if (typeof data.width === 'number') {
            data.width = clampBrushSize(data.width)
        }

        // Validate points array (for strokes)
        if (Array.isArray(data.points)) {
            data.points = data.points.map((point: Point) => ({
                x: clampCoordinate(point.x),
                y: clampCoordinate(point.y),
            }))
        }

        return data
    }

    /**
     * Save objects to localStorage (debounced)
     * @param {Array} objects - Array of serializable objects
     */
    saveObjects(objects: SerializableObject[]): void {
        if (!this.enabled || !this.isLocal) return

        // Debounce saves to avoid excessive localStorage writes
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout)
        }
        this.saveTimeout = setTimeout(() => {
            try {
                const serialized = objects.map(obj => obj.toJSON())
                localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
            } catch (error) {
                // Disable if quota exceeded
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    this.enabled = false
                    ErrorHandler.storage(error, {
                        context: 'LocalStorageManager',
                        code: ErrorCode.STORAGE_QUOTA_EXCEEDED,
                        metadata: { objectCount: objects.length },
                    })
                } else {
                    ErrorHandler.storage(error as Error, {
                        context: 'LocalStorageManager',
                        code: ErrorCode.SAVE_FAILED,
                        metadata: { objectCount: objects.length },
                    })
                }
            }
        }, DEBOUNCE_MS)
    }

    /**
     * Load objects from localStorage
     * @returns {Array} Array of object data (not instantiated objects)
     */
    loadObjects(): { objects: DrawingObjectData[]; maxZIndex: number } {
        if (!this.enabled) {
            return { objects: [], maxZIndex: 0 }
        }

        try {
            const data = localStorage.getItem(STORAGE_KEY)
            if (!data) {
                return { objects: [], maxZIndex: 0 }
            }

            const parsed = JSON.parse(data)

            if (!Array.isArray(parsed)) {
                log.error('Invalid data format (not an array), clearing storage')
                this.clear() // Clear corrupted data
                return { objects: [], maxZIndex: 0 }
            }

            if (parsed.length === 0) {
                return { objects: [], maxZIndex: 0 }
            }

            const validObjects = parsed.filter((obj: unknown) => {
                if (!isValidObject(obj)) {
                    log.warn('Skipping invalid object:', obj)
                    return false
                }
                return true
            })

            const sanitizeObjects = validObjects.map(obj => this.sanitizeObjectData(obj))

            let maxZIndex = 0
            sanitizeObjects.forEach((obj: DrawingObjectData) => {
                if (
                    obj.zIndex !== undefined &&
                    obj.zIndex !== null &&
                    typeof obj.zIndex === 'number'
                ) {
                    maxZIndex = Math.max(maxZIndex, obj.zIndex + 1)
                }
            })

            return { objects: sanitizeObjects, maxZIndex }
        } catch (error) {
            ErrorHandler.storage(error as Error, {
                context: 'LocalStorageManager',
                code: ErrorCode.LOAD_FAILED,
            })
            this.clear() // clear currupt data
            return { objects: [], maxZIndex: 0 }
        }
    }

    /**
     * Called when transitioning from local mode to networked mode
     */
    clear(): void {
        try {
            localStorage.removeItem(STORAGE_KEY)
            console.log('[LocalStorage] Cleared saved objects')
        } catch (error) {
            // Use silent error - clearing is not critical
            ErrorHandler.silent(error as Error, {
                context: 'LocalStorageManager',
                metadata: { operation: 'clear' },
            })
        }
    }

    /**
     * Check if there are saved objects in localStorage
     * @returns {boolean}
     */
    hasSavedObjects(): boolean {
        try {
            const data = localStorage.getItem(STORAGE_KEY)
            return data !== null && data !== '[]'
        } catch (error) {
            return false
        }
    }

    /**
     * Disable auto-save (useful during network sync)
     */
    disable(): void {
        this.enabled = false
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout)
        }
    }

    /**
     * Enable auto-save
     */
    enable(): void {
        this.enabled = true
    }
}
