import { ClipboardManager } from './ClipboardManager'
import { HistoryManager } from './HistoryManager'
import { SelectionManager } from './SelectionManager'
import { ObjectStore } from './ObjectStore'
import { LocalStorageManager } from '../storage/LocalStorageManager'
import { AddObjectOperation, DeleteObjectOperation } from './operations'
import type { INetworkManager } from '../interfaces/INetworkManager'
import type { DrawingObject } from '../objects/DrawingObject'
import type { DrawingObjectData, Point, Bounds } from '../types/common'
import type { MigrationResult } from '../types/network'
import type { IObjectManager } from '../interfaces/IObjectManager'

export class ObjectManager implements IObjectManager {
    networkManager: INetworkManager | null
    userId: string | null
    nextZIndex: number
    isLocalMode: boolean
    objectStore: ObjectStore
    historyManager: HistoryManager
    clipboardManager: ClipboardManager
    selectionManager: SelectionManager
    localStorageManager: LocalStorageManager

    constructor(networkManager: INetworkManager | null) {
        this.networkManager = networkManager
        this.userId = null // Will be set by network manager
        this.nextZIndex = 0 // Track next available zIndex
        this.isLocalMode = !networkManager // Track if in local mode

        // Initialize managers
        this.objectStore = new ObjectStore()
        this.historyManager = new HistoryManager(() => this.userId)
        this.clipboardManager = new ClipboardManager()
        this.selectionManager = new SelectionManager(this, this.objectStore, this.historyManager)
        this.localStorageManager = new LocalStorageManager()

        // Load objects from localStorage if in local mode
        if (this.isLocalMode) {
            this.loadFromLocalStorage()
        }
    }

    /**
     * Set the current user ID (called by network manager)
     */
    setUserId(userId: string): void {
        this.userId = userId

        // In local mode, update loaded objects' userId
        if (this.isLocalMode) {
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
     * Load objects from localStorage (local-first mode)
     */
    loadFromLocalStorage(): void {
        const savedObjects = this.localStorageManager.loadObjects() as DrawingObjectData[]
        if (savedObjects.length > 0) {
            console.log(`[ObjectManager] Loading ${savedObjects.length} objects from localStorage`)
            this.objectStore.loadRemoteObjects(savedObjects)

            // Update nextZIndex to be higher than any loaded object
            savedObjects.forEach((obj: DrawingObjectData) => {
                if (obj.zIndex !== undefined && obj.zIndex !== null && typeof obj.zIndex === 'number') {
                    this.nextZIndex = Math.max(this.nextZIndex, obj.zIndex + 1)
                }
            })

            // Note: Don't update history here - userId isn't set yet
            // History will be updated in setUserId() after objects' userId is updated
        }
    }

    /**
     * Save objects to localStorage (local-first mode)
     */
    saveToLocalStorage(): void {
        if (this.isLocalMode) {
            const allObjects = this.objectStore.getAllObjects()
            this.localStorageManager.saveObjects(allObjects)
        }
    }

    /**
     * Attach network manager after initialization (for local-first mode)
     * Migrates local objects to networked mode and broadcasts to server
     * @param {INetworkManager} networkManager - The network manager to attach
     * @param {string} newUserId - The server-assigned userId to replace local userId
     * @returns {Promise} Promise that resolves with migration results {succeeded, failed}
     */
    attachNetworkManager(networkManager: INetworkManager, newUserId: string): Promise<MigrationResult> {
        console.log('[ObjectManager] Attaching network manager, migrating from local to networked mode')

        const oldUserId = this.userId

        // Update network manager and userId
        this.networkManager = networkManager
        this.userId = newUserId
        this.isLocalMode = false // No longer in local mode

        // Clear localStorage and disable auto-save (now using network)
        this.localStorageManager.clear()
        this.localStorageManager.disable()

        // Migrate all local objects to new userId
        const localObjects = this.getAllObjects().filter(obj => obj.userId === oldUserId)
        console.log(`[ObjectManager] Migrating ${localObjects.length} local objects to userId: ${newUserId}`)

        localObjects.forEach(obj => {
            obj.userId = newUserId
        })

        // Migrate history manager userId
        if (this.historyManager && oldUserId) {
            this.historyManager.migrateUserId(oldUserId, newUserId)
        }

        console.log('[ObjectManager] Network attachment complete')

        // Return migration promise so caller can handle results
        return this.migrateLocalObjectsToNetwork(localObjects, networkManager)
    }

    /**
     * Migrate local objects to network with server confirmation
     * Returns results of migration for error handling
     */
    async migrateLocalObjectsToNetwork(objects: DrawingObject[], networkManager: INetworkManager): Promise<MigrationResult> {
        if (!objects || objects.length === 0) {
            console.log('[ObjectManager] No objects to migrate')
            return { succeeded: [], failed: [] }
        }

        console.log(`[ObjectManager] Migrating ${objects.length} local objects to network`)

        // Use Promise.allSettled to track both successes and failures
        const results = await Promise.allSettled(
            objects.map(obj =>
                networkManager.broadcastObjectAddedWithConfirmation(obj)
                    .then(() => ({ status: 'success', objectId: obj.id }))
                    .catch(err => ({ status: 'error', objectId: obj.id, error: err.message }))
            )
        )

        // Separate succeeded and failed objects
        const succeeded: string[] = []
        const failed: Array<{ objectId: string; error: string }> = []

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const migrationResult = result.value
                if (migrationResult.status === 'success') {
                    succeeded.push(migrationResult.objectId)
                } else if (migrationResult.status === 'error' && 'error' in migrationResult) {
                    failed.push({
                        objectId: migrationResult.objectId,
                        error: migrationResult.error
                    })
                }
            } else {
                // Promise rejected
                const obj = objects[index]
                if (obj) {
                    failed.push({
                        objectId: obj.id,
                        error: result.reason?.message || 'Unknown error'
                    })
                }
            }
        })

        console.log(`[ObjectManager] Migration complete: ${succeeded.length} succeeded, ${failed.length} failed`)

        if (failed.length > 0) {
            console.error('[ObjectManager] Failed objects:', failed)
        }

        return { succeeded, failed }
    }

    /**
     * Public API getters
     */
    get selectedObjects(): DrawingObject[] {
        return this.selectionManager.selectedObjects
    }

    getAllObjects(): DrawingObject[] {
        return this.objectStore.getAllObjects()
    }

    /**
     * Add object locally (triggers history and network broadcast)
     */
    addObject(object: DrawingObject, saveHistory: boolean = true): DrawingObject {
        // Update userId to current user when adding
        if (this.userId) {
            object.userId = this.userId
        }

        // Assign zIndex if not already set
        if (object.zIndex === undefined || object.zIndex === null) {
            object.zIndex = this.nextZIndex++
        } else {
            // Update nextZIndex if object has higher zIndex
            this.nextZIndex = Math.max(this.nextZIndex, object.zIndex + 1)
        }

        // Add to store
        this.objectStore.addLocal(object)

        // Record operation to history AFTER adding
        if (saveHistory && this.userId) {
            const operation = new AddObjectOperation(object, this.userId)
            this.historyManager.recordOperation(operation)
        }

        // Save to localStorage if in local mode
        this.saveToLocalStorage()

        // Broadcast to network
        if (this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.broadcastObjectAdded(object)
        }

        return object
    }

    /**
     * Remove object locally (triggers history and network broadcast)
     */
    removeObject(object: DrawingObject, saveHistory: boolean = true): boolean {
        // Record operation to history BEFORE removing (to capture object data)
        if (saveHistory && this.userId) {
            const operation = new DeleteObjectOperation(object, this.userId)
            this.historyManager.recordOperation(operation)
        }

        const result = this.objectStore.removeLocal(object)
        if (result !== null) {
            // Save to localStorage if in local mode
            this.saveToLocalStorage()

            // Broadcast to network
            if (this.networkManager && this.networkManager.isConnected()) {
                this.networkManager.broadcastObjectDeleted(object)
            }
            return true
        }
        return false
    }

    /**
     * Update object's position in quadtree and rebuild if bounds exceeded
     */
    updateObjectInQuadtree(object: DrawingObject, oldBounds: Bounds, newBounds: Bounds | null = null): void {
        this.objectStore.updateObjectInQuadtree(object, oldBounds, newBounds)
    }

    /**
     * Broadcast object update to network
     */
    broadcastObjectUpdate(object: DrawingObject): void {
        if (this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.broadcastObjectUpdated(object)
        }
    }

    selectObject(object: DrawingObject, multi = false): void {
        this.selectionManager.selectObject(object, multi)
    }

    clearSelection(): void {
        this.selectionManager.clearSelection()
    }

    deleteSelected(): void {
        this.selectionManager.deleteSelected()
    }

    getObjectAt(point: Point): DrawingObject | null {
        return this.objectStore.getObjectAt(point)
    }

    selectObjectsInRect(rect: Bounds, multi = false): void {
        this.selectionManager.selectObjectsInRect(rect, multi)
    }

    moveSelected(dx: number, dy: number): void {
        this.selectionManager.moveSelected(dx, dy)
    }

    /**
     * Rebuild the entire quadtree, optionally expanding bounds
     * Call when objects exceed current bounds or structure becomes corrupted
     */
    rebuildQuadtree(expandBounds = false): void {
        this.objectStore.rebuildQuadtree(expandBounds)
    }

    copySelected(): void {
        this.clipboardManager.copy(this.selectedObjects)
    }

    cutSelected(): void {
        if (this.selectedObjects.length === 0) {
            return
        }

        this.copySelected()
        this.deleteSelected()
    }

    paste(x: number, y: number): void {
        if (!this.clipboardManager.hasContent()) {
            return
        }

        this.clearSelection()

        const clipboard = this.clipboardManager.getClipboard()
        const newObjects: DrawingObject[] = []

        clipboard.forEach(data => {
            // Deep clone
            const clonedData = JSON.parse(JSON.stringify(data))
            clonedData.id = null // setting null will trigger new ID
            const newObject = this.createObjectFromData(clonedData)
            if (newObject) {
                // Don't save history for each object - we'll save once at the end
                this.addObject(newObject, false)
                newObjects.push(newObject)
            }
        })

        // Bounding box of all objects
        let minX = Infinity,
            minY = Infinity
        let maxX = -Infinity,
            maxY = -Infinity

        newObjects.forEach(obj => {
            const bounds = obj.getBounds()
            minX = Math.min(minX, bounds.x)
            minY = Math.min(minY, bounds.y)
            maxX = Math.max(maxX, bounds.x + bounds.width)
            maxY = Math.max(maxY, bounds.y + bounds.height)
        })

        // Group center offset to cursor
        const groupCenterX = (minX + maxX) / 2
        const groupCenterY = (minY + maxY) / 2

        const dx = x - groupCenterX
        const dy = y - groupCenterY

        newObjects.forEach(obj => {
            obj.move(dx, dy)
            this.selectObject(obj, true)
        })

        // Broadcast updates to network
        newObjects.forEach(obj => {
            this.broadcastObjectUpdate(obj)
        })

        // Record add operations for all pasted objects
        if (this.userId) {
            newObjects.forEach(obj => {
                const operation = new AddObjectOperation(obj, this.userId!)
                this.historyManager.recordOperation(operation)
            })
        }

        // Save to localStorage if in local mode
        this.saveToLocalStorage()
    }

    undo(): void {
        if (!this.historyManager.canUndo() || !this.userId) {
            return
        }

        // Get the operation to undo
        const operation = this.historyManager.undo()
        if (!operation) {
            return
        }

        // Execute the undo (reverses the operation)
        operation.undo(this.objectStore)

        // Clear selection after undo
        this.clearSelection()

        // Save to localStorage if in local mode
        this.saveToLocalStorage()

        // Broadcast the change to network based on operation type
        this.broadcastOperationEffect(operation, true)
    }

    redo(): void {
        if (!this.historyManager.canRedo() || !this.userId) {
            return
        }

        // Get the operation to redo
        const operation = this.historyManager.redo()
        if (!operation) {
            return
        }

        // Execute the redo (re-applies the operation)
        operation.execute(this.objectStore)

        // Clear selection after redo
        this.clearSelection()

        // Save to localStorage if in local mode
        this.saveToLocalStorage()

        // Broadcast the change to network based on operation type
        this.broadcastOperationEffect(operation, false)
    }

    /**
     * Broadcast the effect of an operation to the network
     * @param operation - The operation whose effect to broadcast
     * @param isUndo - true if undoing, false if redoing
     */
    private broadcastOperationEffect(operation: any, isUndo: boolean): void {
        if (!this.networkManager || !this.networkManager.isConnected()) {
            return
        }

        switch (operation.type) {
            case 'add': {
                // Add operation: undo = delete, redo = add
                const obj = this.objectStore.getObjectById(operation.objectData.id)
                if (isUndo) {
                    // Object was deleted by undo
                    if (operation.objectData) {
                        // Create temp object to broadcast deletion
                        const tempObj = this.objectStore.createObjectFromData(operation.objectData)
                        if (tempObj) {
                            this.networkManager.broadcastObjectDeleted(tempObj)
                        }
                    }
                } else {
                    // Object was added by redo
                    if (obj) {
                        this.networkManager.broadcastObjectAdded(obj)
                    }
                }
                break
            }
            case 'delete': {
                // Delete operation: undo = add, redo = delete
                const obj = this.objectStore.getObjectById(operation.objectData.id)
                if (isUndo) {
                    // Object was added back by undo
                    if (obj) {
                        this.networkManager.broadcastObjectAdded(obj)
                    }
                } else {
                    // Object was deleted by redo
                    if (operation.objectData) {
                        const tempObj = this.objectStore.createObjectFromData(operation.objectData)
                        if (tempObj) {
                            this.networkManager.broadcastObjectDeleted(tempObj)
                        }
                    }
                }
                break
            }
            case 'update': {
                // Update operation: both undo and redo are updates
                const obj = this.objectStore.getObjectById(operation.objectId)
                if (obj) {
                    this.networkManager.broadcastObjectUpdated(obj)
                }
                break
            }
            case 'move': {
                // Move operation: both undo and redo are moves
                // Broadcast all moved objects as updates
                for (const objectId of operation.objectIds) {
                    const obj = this.objectStore.getObjectById(objectId)
                    if (obj) {
                        this.networkManager.broadcastObjectUpdated(obj)
                    }
                }
                break
            }
        }
    }

    createObjectFromData(data: DrawingObjectData): DrawingObject | null {
        return this.objectStore.createObjectFromData(data)
    }

    /**
     * Get object by ID (for remote updates)
     */
    getObjectById(id: string): DrawingObject | undefined {
        return this.objectStore.getObjectById(id)
    }

    /**
     * Add object from network (no history, no local broadcast)
     */
    addRemoteObject(objectData: DrawingObjectData): DrawingObject | null {
        return this.objectStore.addRemote(objectData)
    }

    /**
     * Update object from network (no history, no local broadcast)
     */
    updateRemoteObject(objectId: string, objectData: DrawingObjectData): DrawingObject | null {
        return this.objectStore.updateRemoteObject(objectId, objectData)
    }

    /**
     * Remove object from network (no history, no local broadcast)
     */
    removeRemoteObject(objectId: string): boolean {
        const result = this.objectStore.removeRemote(objectId)
        return result !== null
    }

    /**
     * Load objects from network (full sync)
     */
    loadRemoteObjects(objectDataArray: DrawingObjectData[]): void {
        this.objectStore.loadRemoteObjects(objectDataArray)
    }

    render(ctx: CanvasRenderingContext2D, viewport: Bounds | null = null): void {
        this.objectStore.render(ctx, viewport, this.selectedObjects)
    }

}
