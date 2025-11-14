import type { IObjectLifecycle } from '../interfaces/IObjectLifecycle'
import type { DrawingObject } from '../objects/DrawingObject'
import type { ObjectStore } from './ObjectStore'
import type { HistoryManager } from './HistoryManager'
import { AddObjectOperation, DeleteObjectOperation } from './operations'

/**
 * Callbacks for side effects during object lifecycle operations
 */
export interface LifecycleCallbacks {
    /**
     * Called after object is added (for persistence)
     */
    onObjectAdded?: (object: DrawingObject) => void

    /**
     * Called after object is removed (for persistence)
     */
    onObjectRemoved?: (object: DrawingObject) => void

    /**
     * Called to broadcast object addition to network
     */
    onBroadcastAdd?: (object: DrawingObject) => void

    /**
     * Called to broadcast object deletion to network
     */
    onBroadcastDelete?: (object: DrawingObject) => void
}

/**
 * Manages core object lifecycle operations
 * Handles CRUD, z-index assignment, user ID management, and history recording
 */
export class ObjectLifecycleManager implements IObjectLifecycle {
    private objectStore: ObjectStore
    private historyManager: HistoryManager
    private callbacks: LifecycleCallbacks
    private _userId: string | null
    private _nextZIndex: number

    constructor(
        objectStore: ObjectStore,
        historyManager: HistoryManager,
        callbacks: LifecycleCallbacks = {}
    ) {
        this.objectStore = objectStore
        this.historyManager = historyManager
        this.callbacks = callbacks
        this._userId = null
        this._nextZIndex = 0
    }

    /**
     * Get current user ID
     */
    get userId(): string | null {
        return this._userId
    }

    /**
     * Get next available z-index
     */
    get nextZIndex(): number {
        return this._nextZIndex
    }

    /**
     * Set next z-index (used when loading from storage)
     */
    setNextZIndex(value: number): void {
        this._nextZIndex = value
    }

    /**
     * Set the current user ID
     * Updates userId on all loaded objects in local mode
     */
    setUserId(userId: string, isLocalMode: boolean): void {
        this._userId = userId

        // In local mode, update loaded objects' userId
        if (isLocalMode) {
            const allObjects = this.objectStore.getAllObjects()
            // Update userId of all loaded objects to current session
            allObjects.forEach(obj => {
                obj.userId = userId
            })
            // Note: With operation-based history, we don't need to update history here
            // History will be populated as the user makes changes
        }
    }

    /**
     * Add object locally (triggers history and side effects)
     * @param object - Object to add
     * @param saveHistory - Whether to record in history (default: true)
     * @returns The added object
     */
    addObject(object: DrawingObject, saveHistory: boolean = true): DrawingObject {
        // Update userId to current user when adding
        if (this._userId) {
            object.userId = this._userId
        }

        // Assign zIndex if not already set
        if (object.zIndex === undefined || object.zIndex === null) {
            object.zIndex = this._nextZIndex++
        } else {
            // Update nextZIndex if object has higher zIndex
            this._nextZIndex = Math.max(this._nextZIndex, object.zIndex + 1)
        }

        // Add to store
        this.objectStore.addLocal(object)

        // Record operation to history AFTER adding
        if (saveHistory && this._userId) {
            const operation = new AddObjectOperation(object, this._userId)
            this.historyManager.recordOperation(operation)
        }

        // Trigger callbacks
        if (this.callbacks.onObjectAdded) {
            this.callbacks.onObjectAdded(object)
        }

        if (this.callbacks.onBroadcastAdd) {
            this.callbacks.onBroadcastAdd(object)
        }

        return object
    }

    /**
     * Remove object locally (triggers history and side effects)
     * @param object - Object to remove
     * @param saveHistory - Whether to record in history (default: true)
     * @returns True if removed successfully
     */
    removeObject(object: DrawingObject, saveHistory: boolean = true): boolean {
        // Record operation to history BEFORE removing (to capture object data)
        if (saveHistory && this._userId) {
            const operation = new DeleteObjectOperation(object, this._userId)
            this.historyManager.recordOperation(operation)
        }

        const result = this.objectStore.removeLocal(object)
        if (result !== null) {
            // Trigger callbacks
            if (this.callbacks.onObjectRemoved) {
                this.callbacks.onObjectRemoved(object)
            }

            if (this.callbacks.onBroadcastDelete) {
                this.callbacks.onBroadcastDelete(object)
            }

            return true
        }
        return false
    }
}
