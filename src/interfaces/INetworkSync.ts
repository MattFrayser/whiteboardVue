import type { DrawingObject } from '../objects/DrawingObject'
import type { DrawingObjectData } from '../types/common'
import type { MigrationResult } from '../types/network'
import type { INetworkManager } from './INetworkManager'

/**
 * Interface for network synchronization operations
 * Handles migration from local-first to networked mode, broadcasting changes,
 * and receiving remote object updates
 */
export interface INetworkSync {
    /**
     * Check if currently in local (offline) mode
     */
    readonly isLocalMode: boolean

    /**
     * Check if connected to network
     */
    isConnected(): boolean

    /**
     * Attach network manager after initialization (for local-first mode)
     * Migrates local objects to networked mode and broadcasts to server
     * @param networkManager - The network manager to attach
     * @param newUserId - The server-assigned userId to replace local userId
     * @param oldUserId - The previous local userId
     * @param localObjects - Objects to migrate to network
     * @returns Promise that resolves with migration results {succeeded, failed}
     */
    attachNetworkManager(
        networkManager: INetworkManager,
        newUserId: string,
        oldUserId: string | null,
        localObjects: DrawingObject[]
    ): Promise<MigrationResult>

    /**
     * Broadcast object update to network
     */
    broadcastObjectUpdate(object: DrawingObject): void

    /**
     * Broadcast object addition to network
     */
    broadcastObjectAdded(object: DrawingObject): void

    /**
     * Broadcast object deletion to network
     */
    broadcastObjectDeleted(object: DrawingObject): void

    /**
     * Add object from network (no history, no broadcast)
     */
    addRemoteObject(objectData: DrawingObjectData): DrawingObject | null

    /**
     * Update object from network (no history, no broadcast)
     */
    updateRemoteObject(objectId: string, objectData: DrawingObjectData): DrawingObject | null

    /**
     * Remove object from network (no history, no broadcast)
     */
    removeRemoteObject(objectId: string): boolean

    /**
     * Load objects from network (full sync)
     */
    loadRemoteObjects(objectDataArray: DrawingObjectData[]): void
}
