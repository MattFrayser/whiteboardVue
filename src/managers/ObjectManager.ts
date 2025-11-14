import { ClipboardManager } from './ClipboardManager'
import { ClipboardCoordinator } from './ClipboardCoordinator'
import { HistoryManager } from './HistoryManager'
import { SelectionManager } from './SelectionManager'
import { ObjectStore } from './ObjectStore'
import { NetworkSyncManager } from './NetworkSyncManager'
import { PersistenceCoordinator } from './PersistenceCoordinator'
import { ObjectLifecycleManager } from './ObjectLifecycleManager'
import { LocalStorageManager } from './LocalStorageManager'
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
    lifecycleManager: ObjectLifecycleManager
    networkSyncManager: NetworkSyncManager
    persistenceCoordinator: PersistenceCoordinator
    historyManager: HistoryManager
    clipboardManager: ClipboardManager
    clipboardCoordinator: ClipboardCoordinator
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
        this.localStorageManager = new LocalStorageManager()
        this.persistenceCoordinator = new PersistenceCoordinator(
            this.localStorageManager,
            this.isLocalMode
        )
        this.networkSyncManager = new NetworkSyncManager(
            networkManager,
            this.objectStore,
            this.historyManager,
            this.localStorageManager
        )
        this.lifecycleManager = new ObjectLifecycleManager(
            this.objectStore,
            this.historyManager,
            {
                onObjectAdded: () => this.saveToLocalStorage(),
                onObjectRemoved: () => this.saveToLocalStorage(),
                onBroadcastAdd: (obj) => this.networkSyncManager.broadcastObjectAdded(obj),
                onBroadcastDelete: (obj) => this.networkSyncManager.broadcastObjectDeleted(obj)
            }
        )
        this.clipboardManager = new ClipboardManager()
        this.clipboardCoordinator = new ClipboardCoordinator(this.clipboardManager)
        this.selectionManager = new SelectionManager(this.lifecycleManager, this.objectStore, this.historyManager)

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
        this.lifecycleManager.setUserId(userId, this.isLocalMode)
    }

    /**
     * Load objects from localStorage (local-first mode)
     */
    loadFromLocalStorage(): void {
        const { objects, maxZIndex } = this.persistenceCoordinator.loadFromLocalStorage()

        if (objects.length > 0) {
            this.objectStore.loadRemoteObjects(objects)
            this.nextZIndex = maxZIndex
            this.lifecycleManager.setNextZIndex(maxZIndex)

            // Note: Don't update history here - userId isn't set yet
            // History will be updated in setUserId() after objects' userId is updated
        }
    }

    /**
     * Save objects to localStorage (local-first mode)
     */
    saveToLocalStorage(): void {
        const allObjects = this.objectStore.getAllObjects()
        this.persistenceCoordinator.saveToLocalStorage(allObjects)
    }

    /**
     * Attach network manager after initialization (for local-first mode)
     * Migrates local objects to networked mode and broadcasts to server
     * @param {INetworkManager} networkManager - The network manager to attach
     * @param {string} newUserId - The server-assigned userId to replace local userId
     * @returns {Promise} Promise that resolves with migration results {succeeded, failed}
     */
    async attachNetworkManager(networkManager: INetworkManager, newUserId: string): Promise<MigrationResult> {
        const oldUserId = this.userId

        // Update userId and mode
        this.networkManager = networkManager
        this.userId = newUserId
        this.isLocalMode = false
        this.persistenceCoordinator.setLocalMode(false)

        // Get local objects to migrate
        const localObjects = this.getAllObjects().filter(obj => obj.userId === oldUserId)

        // Delegate to NetworkSyncManager
        return this.networkSyncManager.attachNetworkManager(networkManager, newUserId, oldUserId, localObjects)
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
        const result = this.lifecycleManager.addObject(object, saveHistory)
        // Sync nextZIndex with lifecycleManager
        this.nextZIndex = this.lifecycleManager.nextZIndex
        return result
    }

    /**
     * Remove object locally (triggers history and network broadcast)
     */
    removeObject(object: DrawingObject, saveHistory: boolean = true): boolean {
        return this.lifecycleManager.removeObject(object, saveHistory)
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
        this.networkSyncManager.broadcastObjectUpdate(object)
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
        this.clipboardCoordinator.copySelected(this.selectedObjects)
    }

    cutSelected(): void {
        this.clipboardCoordinator.cutSelected(this.selectedObjects, () => {
            this.deleteSelected()
        })
    }

    paste(x: number, y: number): void {
        if (!this.clipboardCoordinator.hasContent()) {
            return
        }

        this.clearSelection()

        // Use clipboardCoordinator to create positioned objects
        const newObjects = this.clipboardCoordinator.paste(x, y, (data) => {
            return this.createObjectFromData(data)
        })

        // Add all objects (without individual history records)
        newObjects.forEach(obj => {
            this.addObject(obj, false)
        })

        // Select all pasted objects
        newObjects.forEach(obj => {
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
        this.networkSyncManager.broadcastOperationEffect(operation, true)
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
        this.networkSyncManager.broadcastOperationEffect(operation, false)
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
        return this.networkSyncManager.addRemoteObject(objectData)
    }

    /**
     * Update object from network (no history, no local broadcast)
     */
    updateRemoteObject(objectId: string, objectData: DrawingObjectData): DrawingObject | null {
        return this.networkSyncManager.updateRemoteObject(objectId, objectData)
    }

    /**
     * Remove object from network (no history, no local broadcast)
     */
    removeRemoteObject(objectId: string): boolean {
        return this.networkSyncManager.removeRemoteObject(objectId)
    }

    /**
     * Load objects from network (full sync)
     */
    loadRemoteObjects(objectDataArray: DrawingObjectData[]): void {
        this.networkSyncManager.loadRemoteObjects(objectDataArray)
    }

    render(ctx: CanvasRenderingContext2D, viewport: Bounds | null = null): void {
        this.objectStore.render(ctx, viewport, this.selectedObjects)
    }

}
