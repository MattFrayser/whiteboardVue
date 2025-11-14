import type { DrawingObject } from '../objects/DrawingObject'

/**
 * Minimal interface for object lifecycle operations
 * Used to break circular dependencies (e.g., with SelectionManager)
 */
export interface IObjectLifecycle {
    /**
     * Current user ID
     */
    readonly userId: string | null

    /**
     * Add object to the system
     * @param object - Object to add
     * @param saveHistory - Whether to record in history (default: true)
     * @returns The added object
     */
    addObject(object: DrawingObject, saveHistory?: boolean): DrawingObject

    /**
     * Remove object from the system
     * @param object - Object to remove
     * @param saveHistory - Whether to record in history (default: true)
     * @returns True if removed successfully
     */
    removeObject(object: DrawingObject, saveHistory?: boolean): boolean
}
