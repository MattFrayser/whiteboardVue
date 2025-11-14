import type { DrawingObjectData, Point } from '../types/common'
import type { LocalStorageManager } from './LocalStorageManager'
import { clampCoordinate, clampBrushSize, validateColor } from '../utils/validation'

/**
 * Manages persistence operations for local-first mode
 * Handles localStorage, validation, and sanitization
 */
export class PersistenceCoordinator {
    private localStorageManager: LocalStorageManager
    isLocalMode: boolean

    constructor(localStorageManager: LocalStorageManager, isLocalMode: boolean) {
        this.localStorageManager = localStorageManager
        this.isLocalMode = isLocalMode
    }

    /**
     * Update local mode status
     */
    setLocalMode(isLocalMode: boolean): void {
        this.isLocalMode = isLocalMode
    }

    /**
     * Validate and sanitize object data loaded from localStorage
     * Critical for offline mode where no backend validation exists
     */
    sanitizeObjectData(data: DrawingObjectData): DrawingObjectData {
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
                y: clampCoordinate(point.y)
            }))
        }

        return data
    }

    /**
     * Load objects from localStorage (local-first mode)
     * Returns sanitized objects and the maximum zIndex found
     */
    loadFromLocalStorage(): { objects: DrawingObjectData[], maxZIndex: number } {
        const savedObjects = this.localStorageManager.loadObjects() as DrawingObjectData[]

        if (savedObjects.length === 0) {
            return { objects: [], maxZIndex: 0 }
        }

        console.log(`[PersistenceCoordinator] Loading ${savedObjects.length} objects from localStorage`)

        // Validate and sanitize all loaded objects (critical for offline mode)
        const sanitizedObjects = savedObjects.map(obj => this.sanitizeObjectData(obj))

        // Calculate maximum zIndex
        let maxZIndex = 0
        sanitizedObjects.forEach((obj: DrawingObjectData) => {
            if (obj.zIndex !== undefined && obj.zIndex !== null && typeof obj.zIndex === 'number') {
                maxZIndex = Math.max(maxZIndex, obj.zIndex + 1)
            }
        })

        return { objects: sanitizedObjects, maxZIndex }
    }

    /**
     * Save objects to localStorage (local-first mode)
     */
    saveToLocalStorage(objects: DrawingObjectData[]): void {
        if (this.isLocalMode) {
            this.localStorageManager.saveObjects(objects)
        }
    }

    /**
     * Clear localStorage
     */
    clear(): void {
        this.localStorageManager.clear()
    }

    /**
     * Disable localStorage manager
     */
    disable(): void {
        this.localStorageManager.disable()
    }
}
