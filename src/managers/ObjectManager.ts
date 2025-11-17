import { ClipboardManager } from './ClipboardManager'
import { HistoryManager } from './HistoryManager'
import { SelectionManager } from './SelectionManager'
import { ObjectStore } from './ObjectStore'
import { LocalStorageManager } from './LocalStorageManager'
import { AddObjectOperation, DeleteObjectOperation } from './operations'
import type { WebSocketManager } from '../network/WebSocketManager'
import type { DrawingObject } from '../objects/DrawingObject'
import type { DrawingObjectData, Point, Bounds } from '../types/common'
import type { MigrationResult } from '../types/network'

// Import extracted algorithms
import { executePaste, broadcastOperationEffect, prepareNetworkMigration, broadcastLocalObjects } from './objectManagerHelper'

export class ObjectManager {
    networkManager: WebSocketManager | null
    userId: string | null
    nextZIndex: number
    isLocalMode: boolean
    objectStore: ObjectStore
    historyManager: HistoryManager
    clipboardManager: ClipboardManager
    selectionManager: SelectionManager
    localStorageManager: LocalStorageManager

    constructor(networkManager: WebSocketManager | null) {
        this.networkManager = networkManager
        this.userId = null
        this.nextZIndex = 0
        this.isLocalMode = !networkManager

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

    setUserId(userId: string): void {
        this.userId = userId

        if (this.isLocalMode) {
            const allObjects = this.objectStore.getAllObjects()
            allObjects.forEach(obj => {
                obj.userId = userId
            })
        }
    }

    loadFromLocalStorage(): void {
        const { objects: savedObjects, maxZIndex } = this.localStorageManager.loadObjects()
        if (savedObjects.length > 0) {
            console.log(`[ObjectManager] Loading ${savedObjects.length} objects from localStorage`)
            this.objectStore.loadRemoteObjects(savedObjects)
            this.nextZIndex = Math.max(this.nextZIndex, maxZIndex)
        }
    }

    saveToLocalStorage(): void {
        if (this.isLocalMode) {
            const allObjects = this.objectStore.getAllObjects()
            this.localStorageManager.saveObjects(allObjects)
        }
    }

    /**
     * Attach network manager - delegates to migration algorithm
     */
    async attachNetworkManager(
        networkManager: WebSocketManager, 
        newUserId: string
    ): Promise<MigrationResult> {
        console.log('[ObjectManager] Attaching network manager')

        const oldUserId = this.userId

        // Update state
        this.networkManager = networkManager
        this.userId = newUserId
        this.isLocalMode = false

        // Use extracted migration algorithm
        const objectsToMigrate = prepareNetworkMigration({
            oldUserId,
            newUserId,
            getAllObjects: () => this.getAllObjects(),
            clearLocalStorage: () => this.localStorageManager.clear(),
            disableLocalStorage: () => this.localStorageManager.disable(),
            migrateHistoryUserId: (oldId, newId) => this.historyManager.migrateUserId(oldId, newId)
        })

        // Broadcast to server
        return broadcastLocalObjects(objectsToMigrate, networkManager)
    }

    // ============================================================
    // Public API
    // ============================================================

    get selectedObjects(): DrawingObject[] {
        return this.selectionManager.selectedObjects
    }

    getAllObjects(): DrawingObject[] {
        return this.objectStore.getAllObjects()
    }

    getObjectById(id: string): DrawingObject | undefined {
        return this.objectStore.getObjectById(id)
    }

    getObjectAt(point: Point): DrawingObject | null {
        return this.objectStore.getObjectAt(point)
    }

    createObjectFromData(data: DrawingObjectData): DrawingObject | null {
        return this.objectStore.createObjectFromData(data)
    }

    // ============================================================
    // Object CRUD Operations
    // ============================================================

    // Add object locally (triggers history and network broadcast)
    addObject(object: DrawingObject, saveHistory: boolean = true): DrawingObject {
        // Update userId to current user when adding
        if (this.userId) {
            object.userId = this.userId
        }

        if (object.zIndex === undefined || object.zIndex === null) {
            object.zIndex = this.nextZIndex++
        } else {
            // Update nextZIndex if object has higher zIndex
            this.nextZIndex = Math.max(this.nextZIndex, object.zIndex + 1)
        }

        this.objectStore.addLocal(object)

        // Record operation to history AFTER adding
        if (saveHistory && this.userId) {
            const operation = new AddObjectOperation(object, this.userId)
            this.historyManager.recordOperation(operation)
        }

        // Save to localStorage if in local mode
        this.saveToLocalStorage()

        if (this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.broadcastObjectAdded(object)
        }

        return object
    }

    //Remove object locally (triggers history and network broadcast)
    removeObject(object: DrawingObject, saveHistory: boolean = true): boolean {
        // Record operation to history BEFORE removing (to capture object data)
        if (saveHistory && this.userId) {
            const operation = new DeleteObjectOperation(object, this.userId)
            this.historyManager.recordOperation(operation)
        }

        const result = this.objectStore.removeLocal(object)
        if (result !== null) {
            this.saveToLocalStorage()

            if (this.networkManager && this.networkManager.isConnected()) {
                this.networkManager.broadcastObjectDeleted(object)
            }
            return true
        }
        return false
    }

    updateObjectInQuadtree(object: DrawingObject, oldBounds: Bounds, newBounds: Bounds | null = null): void {
        this.objectStore.updateObjectInQuadtree(object, oldBounds, newBounds)
    }

    // ============================================================
    // Selection Operations (delegated to SelectionManager)
    // ============================================================

    selectObject(object: DrawingObject, multi = false): void {
        this.selectionManager.selectObject(object, multi)
    }

    clearSelection(): void {
        this.selectionManager.clearSelection()
    }

    deleteSelected(): void {
        this.selectionManager.deleteSelected()
    }

    selectObjectsInRect(rect: Bounds, multi = false): void {
        this.selectionManager.selectObjectsInRect(rect, multi)
    }

    moveSelected(dx: number, dy: number): void {
        this.selectionManager.moveSelected(dx, dy)
    }


    // ============================================================
    // Clipboard Operations
    // ============================================================

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

        const newObjects = executePaste({
            clipboardData: this.clipboardManager.getClipboard(),
            targetPosition: { x, y },
            createObject: (data) => this.createObjectFromData(data),
            addObjectWithoutHistory: (obj) => this.addObject(obj, false),
            selectObject: (obj, multi) => this.selectObject(obj, multi)
        })

        // Broadcast updates to network
        newObjects.forEach(obj => this.broadcastObjectUpdate(obj))

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

        const operation = this.historyManager.undo()
        if (!operation) return

        operation.undo(this.objectStore)
        this.clearSelection()
        this.saveToLocalStorage()

        if (this.networkManager) {
            broadcastOperationEffect(operation, true, {
                networkManager: this.networkManager,
                getObjectById: (id) => this.getObjectById(id),
                createObjectFromData: (data) => this.createObjectFromData(data)
            })
        }
    }

    redo(): void {
        if (!this.historyManager.canRedo() || !this.userId) {
            return
        }

        const operation = this.historyManager.redo()
        if (!operation) return

        operation.execute(this.objectStore)
        this.clearSelection()
        this.saveToLocalStorage()

        if (this.networkManager) {
            broadcastOperationEffect(operation, false, {
                networkManager: this.networkManager,
                getObjectById: (id) => this.getObjectById(id),
                createObjectFromData: (data) => this.createObjectFromData(data)
            })
        }}

    // ============================================================
    // Remote Operations (from network)
    // - remote ops dont affect history
    // ============================================================

    addRemoteObject(objectData: DrawingObjectData): DrawingObject | null {
        return this.objectStore.addRemote(objectData)
    }

    updateRemoteObject(objectId: string, objectData: DrawingObjectData): DrawingObject | null {
        return this.objectStore.updateRemoteObject(objectId, objectData)
    }

    removeRemoteObject(objectId: string): boolean {
        const result = this.objectStore.removeRemote(objectId)
        return result !== null
    }

    loadRemoteObjects(objectDataArray: DrawingObjectData[]): void {
        this.objectStore.loadRemoteObjects(objectDataArray)
    }

    // ============================================================
    // Rendering
    // ============================================================

    render(ctx: CanvasRenderingContext2D, viewport: Bounds | null = null): void {
        this.objectStore.render(ctx, viewport, this.selectedObjects)
    }

}
