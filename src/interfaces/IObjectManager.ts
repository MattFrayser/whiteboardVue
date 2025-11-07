import type { DrawingObject } from '../objects/DrawingObject'
import type { DrawingObjectData, Bounds, Point } from '../types/common'
import type { MigrationResult } from '../types/network'
import type { INetworkManager } from './INetworkManager'
import type { HistoryManager } from '../managers/HistoryManager'

/**
 * IObjectManager - Object lifecycle and state management abstraction
 *
 * Defines the contract for managing drawing objects, including:
 * - Adding/removing/updating objects
 * - Undo/redo history
 * - Selection management
 * - Network synchronization
 * - Rendering
 */
export interface IObjectManager {
    /**
     * Current user ID (may be exposed for tools that need it)
     */
    userId: string | null

    /**
     * History manager (exposed for tools that need direct access)
     * TODO: Consider refactoring to hide this implementation detail
     */
    historyManager: HistoryManager

    /**
     * Currently selected objects
     */
    selectedObjects: DrawingObject[]

    /**
     * Set the current user ID
     */
    setUserId(userId: string): void

    /**
     * Get all objects
     */
    getAllObjects(): DrawingObject[]

    /**
     * Get object by ID
     */
    getObjectById(id: string): DrawingObject | undefined

    /**
     * Get object at a specific point
     */
    getObjectAt(point: Point): DrawingObject | null

    /**
     * Add object locally (triggers history and network broadcast)
     */
    addObject(object: DrawingObject, saveHistory?: boolean): DrawingObject

    /**
     * Remove object locally (triggers history and network broadcast)
     */
    removeObject(object: DrawingObject, saveHistory?: boolean): boolean

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

    /**
     * Attach network manager after initialization (for local-first mode)
     * Migrates local objects to networked mode
     */
    attachNetworkManager(networkManager: INetworkManager, newUserId: string): Promise<MigrationResult>

    /**
     * Undo last operation
     */
    undo(): void

    /**
     * Redo last undone operation
     */
    redo(): void

    /**
     * Select an object
     */
    selectObject(object: DrawingObject, multi?: boolean): void

    /**
     * Select objects within a rectangle
     */
    selectObjectsInRect(rect: Bounds, multi?: boolean): void

    /**
     * Clear current selection
     */
    clearSelection(): void

    /**
     * Delete selected objects
     */
    deleteSelected(): void

    /**
     * Copy selected objects to clipboard
     */
    copySelected(): void

    /**
     * Cut selected objects to clipboard
     */
    cutSelected(): void

    /**
     * Paste clipboard contents at position
     */
    paste(x: number, y: number): void

    /**
     * Update object's position in quadtree
     */
    updateObjectInQuadtree(object: DrawingObject, oldBounds: Bounds, newBounds?: Bounds | null): void

    /**
     * Broadcast object update to network
     */
    broadcastObjectUpdate(object: DrawingObject): void

    /**
     * Render all objects to canvas
     */
    render(ctx: CanvasRenderingContext2D, viewport: Bounds | null): void
}
