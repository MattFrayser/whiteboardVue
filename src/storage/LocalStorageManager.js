/**
 * LocalStorageManager
 * Handles persistence of local objects to browser localStorage
 * Enables local-first mode where users can draw before creating a session
 */

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
                console.error('[LocalStorage] Failed to save objects:', error)
                // Disable if quota exceeded
                if (error.name === 'QuotaExceededError') {
                    console.warn('[LocalStorage] Storage quota exceeded, disabling auto-save')
                    this.enabled = false
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
            console.error('[LocalStorage] Failed to load objects:', error)
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
            console.error('[LocalStorage] Failed to clear objects:', error)
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
