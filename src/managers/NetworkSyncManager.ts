import type { INetworkSync } from '../interfaces/INetworkSync'
import type { INetworkManager } from '../interfaces/INetworkManager'
import type { DrawingObject } from '../objects/DrawingObject'
import type { DrawingObjectData } from '../types/common'
import type { MigrationResult } from '../types/network'
import type { ObjectStore } from './ObjectStore'
import type { HistoryManager } from './HistoryManager'
import type { LocalStorageManager } from './LocalStorageManager'

/**
 * Manages network synchronization operations
 * Handles migration from local-first to networked mode, broadcasting changes,
 * and receiving remote object updates
 */
export class NetworkSyncManager implements INetworkSync {
    private networkManager: INetworkManager | null
    private objectStore: ObjectStore
    private historyManager: HistoryManager
    private localStorageManager: LocalStorageManager
    isLocalMode: boolean

    constructor(
        networkManager: INetworkManager | null,
        objectStore: ObjectStore,
        historyManager: HistoryManager,
        localStorageManager: LocalStorageManager
    ) {
        this.networkManager = networkManager
        this.objectStore = objectStore
        this.historyManager = historyManager
        this.localStorageManager = localStorageManager
        this.isLocalMode = !networkManager
    }

    /**
     * Check if connected to network
     */
    isConnected(): boolean {
        return this.networkManager !== null && this.networkManager.isConnected()
    }

    /**
     * Attach network manager after initialization (for local-first mode)
     * Migrates local objects to networked mode and broadcasts to server
     * @param networkManager - The network manager to attach
     * @param newUserId - The server-assigned userId to replace local userId
     * @param oldUserId - The previous local userId
     * @param localObjects - Objects to migrate to network
     * @returns Promise that resolves with migration results {succeeded, failed}
     */
    async attachNetworkManager(
        networkManager: INetworkManager,
        newUserId: string,
        oldUserId: string | null,
        localObjects: DrawingObject[]
    ): Promise<MigrationResult> {
        console.log('[NetworkSyncManager] Attaching network manager, migrating from local to networked mode')

        // Update network manager and mode
        this.networkManager = networkManager
        this.isLocalMode = false

        // Clear localStorage and disable auto-save (now using network)
        this.localStorageManager.clear()
        this.localStorageManager.disable()

        // Filter local objects that belong to old userId
        const objectsToMigrate = localObjects.filter(obj => obj.userId === oldUserId)
        console.log(`[NetworkSyncManager] Migrating ${objectsToMigrate.length} local objects to userId: ${newUserId}`)

        // Update userId on objects
        objectsToMigrate.forEach(obj => {
            obj.userId = newUserId
        })

        // Migrate history manager userId
        if (oldUserId) {
            this.historyManager.migrateUserId(oldUserId, newUserId)
        }

        console.log('[NetworkSyncManager] Network attachment complete')

        // Migrate objects to network with server confirmation
        return this.migrateLocalObjectsToNetwork(objectsToMigrate, networkManager)
    }

    /**
     * Migrate local objects to network with server confirmation
     * Returns results of migration for error handling
     */
    private async migrateLocalObjectsToNetwork(
        objects: DrawingObject[],
        networkManager: INetworkManager
    ): Promise<MigrationResult> {
        if (!objects || objects.length === 0) {
            console.log('[NetworkSyncManager] No objects to migrate')
            return { succeeded: [], failed: [] }
        }

        console.log(`[NetworkSyncManager] Migrating ${objects.length} local objects to network`)

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

        console.log(`[NetworkSyncManager] Migration complete: ${succeeded.length} succeeded, ${failed.length} failed`)

        if (failed.length > 0) {
            console.error('[NetworkSyncManager] Failed objects:', failed)
        }

        return { succeeded, failed }
    }

    /**
     * Broadcast object update to network
     */
    broadcastObjectUpdate(object: DrawingObject): void {
        if (this.isConnected()) {
            this.networkManager!.broadcastObjectUpdated(object)
        }
    }

    /**
     * Broadcast object addition to network
     */
    broadcastObjectAdded(object: DrawingObject): void {
        if (this.isConnected()) {
            this.networkManager!.broadcastObjectAdded(object)
        }
    }

    /**
     * Broadcast object deletion to network
     */
    broadcastObjectDeleted(object: DrawingObject): void {
        if (this.isConnected()) {
            this.networkManager!.broadcastObjectDeleted(object)
        }
    }

    /**
     * Broadcast the effect of an operation to the network
     * @param operation - The operation whose effect to broadcast
     * @param isUndo - true if undoing, false if redoing
     */
    broadcastOperationEffect(operation: any, isUndo: boolean): void {
        if (!this.isConnected()) {
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
                            this.networkManager!.broadcastObjectDeleted(tempObj)
                        }
                    }
                } else {
                    // Object was added by redo
                    if (obj) {
                        this.networkManager!.broadcastObjectAdded(obj)
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
                        this.networkManager!.broadcastObjectAdded(obj)
                    }
                } else {
                    // Object was deleted by redo
                    if (operation.objectData) {
                        const tempObj = this.objectStore.createObjectFromData(operation.objectData)
                        if (tempObj) {
                            this.networkManager!.broadcastObjectDeleted(tempObj)
                        }
                    }
                }
                break
            }
            case 'update': {
                // Update operation: both undo and redo are updates
                const obj = this.objectStore.getObjectById(operation.objectId)
                if (obj) {
                    this.networkManager!.broadcastObjectUpdated(obj)
                }
                break
            }
            case 'move': {
                // Move operation: both undo and redo are moves
                // Broadcast all moved objects as updates
                for (const objectId of operation.objectIds) {
                    const obj = this.objectStore.getObjectById(objectId)
                    if (obj) {
                        this.networkManager!.broadcastObjectUpdated(obj)
                    }
                }
                break
            }
        }
    }

    /**
     * Add object from network (no history, no broadcast)
     */
    addRemoteObject(objectData: DrawingObjectData): DrawingObject | null {
        return this.objectStore.addRemote(objectData)
    }

    /**
     * Update object from network (no history, no broadcast)
     */
    updateRemoteObject(objectId: string, objectData: DrawingObjectData): DrawingObject | null {
        return this.objectStore.updateRemoteObject(objectId, objectData)
    }

    /**
     * Remove object from network (no history, no broadcast)
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
}
