/**
 * LocalStorageManager
 * Handles persistence of local objects to browser localStorage
 * Enables local-first mode where users can draw before creating a session
 */

import { ErrorHandler, ErrorCategory, ErrorCode } from '../utils/ErrorHandler'

const STORAGE_KEY = 'whiteboard_local_objects'
const DEBOUNCE_MS = 500 // Save after 500ms of inactivity

export class LocalStorageManager {
    constructor() {
        this.saveTimeout = null
        this.enabled = true
    }

    /**
     * Save objects to localStorage (debounced)
     * @param {Array} objects - Array of serializable objects
     */
    saveObjects(objects) {
        if (!this.enabled) return

        // Debounce saves to avoid excessive localStorage writes
        clearTimeout(this.saveTimeout)
        this.saveTimeout = setTimeout(() => {
            try {
                const serialized = objects.map(obj => obj.toJSON())
                localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
                console.log(`[LocalStorage] Saved ${objects.length} objects`)
            } catch (error) {
                // Disable if quota exceeded
                if (error.name === 'QuotaExceededError') {
                    this.enabled = false
                    ErrorHandler.storage(error, {
                        context: 'LocalStorageManager',
                        code: ErrorCode.STORAGE_QUOTA_EXCEEDED,
                        metadata: { objectCount: objects.length }
                    })
                } else {
                    ErrorHandler.storage(error, {
                        context: 'LocalStorageManager',
                        code: ErrorCode.SAVE_FAILED,
                        metadata: { objectCount: objects.length }
                    })
                }
            }
        }, DEBOUNCE_MS)
    }

    /**
     * Load objects from localStorage
     * @returns {Array} Array of object data (not instantiated objects)
     */
    loadObjects() {
        if (!this.enabled) return []

        try {
            const data = localStorage.getItem(STORAGE_KEY)
            if (!data) {
                console.log('[LocalStorage] No saved objects found')
                return []
            }

            const objects = JSON.parse(data)
            console.log(`[LocalStorage] Loaded ${objects.length} objects`)
            return objects
        } catch (error) {
            ErrorHandler.storage(error, {
                context: 'LocalStorageManager',
                code: ErrorCode.LOAD_FAILED
            })
            return []
        }
    }

    /**
     * Clear all saved objects from localStorage
     * Called when transitioning from local mode to networked mode
     */
    clear() {
        try {
            localStorage.removeItem(STORAGE_KEY)
            console.log('[LocalStorage] Cleared saved objects')
        } catch (error) {
            // Use silent error - clearing is not critical
            ErrorHandler.silent(error, {
                context: 'LocalStorageManager',
                metadata: { operation: 'clear' }
            })
        }
    }

    /**
     * Check if there are saved objects in localStorage
     * @returns {boolean}
     */
    hasSavedObjects() {
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
    disable() {
        this.enabled = false
        clearTimeout(this.saveTimeout)
    }

    /**
     * Enable auto-save
     */
    enable() {
        this.enabled = true
    }
}
