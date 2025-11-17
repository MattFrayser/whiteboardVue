/**
 * Operation Broadcasting
 * Handles the complex logic for broadcasting undo/redo operations to the network
 * - Converts operations to network messages
 * - Handles different operation types differently
 * - Creates temporary objects for broadcasting when needed
 */

import type { Operation } from '../operations/Operation'
import type { AddObjectOperation } from '../operations/AddObjectOperation'
import type { DeleteObjectOperation } from '../operations/DeleteObjectOperation'
import type { UpdateObjectOperation } from '../operations/UpdateObjectOperation'
import type { MoveObjectsOperation } from '../operations/MoveObjectsOperation'
import type { WebSocketManager } from '../../network/WebSocketManager'
import type { DrawingObject } from '../../objects/DrawingObject'
import type { DrawingObjectData } from '../../types/common'

/**
 * Context needed for broadcasting operations
 */
export interface BroadcastContext {
    networkManager: WebSocketManager
    getObjectById: (id: string) => DrawingObject | undefined
    createObjectFromData: (data: DrawingObjectData) => DrawingObject | null
}

/**
 * Broadcast the effect of an undo/redo operation to the network
 * Different operations have different effects:
 * - Add: undo=delete, redo=add
 * - Delete: undo=add, redo=delete
 * - Update: both=update
 * - Move: both=update (for all moved objects)
 */
export function broadcastOperationEffect(
    operation: Operation,
    isUndo: boolean,
    ctx: BroadcastContext
): void {
    if (!ctx.networkManager.isConnected()) {
        return
    }

    switch (operation.type) {
        case 'add':
            broadcastAddOperation(operation as AddObjectOperation, isUndo, ctx)
            break
        case 'delete':
            broadcastDeleteOperation(operation as DeleteObjectOperation, isUndo, ctx)
            break
        case 'update':
            broadcastUpdateOperation(operation as UpdateObjectOperation, ctx)
            break
        case 'move':
            broadcastMoveOperation(operation as MoveObjectsOperation, ctx)
            break
    }
}

/**
 * Broadcast add operation
 * - Undo: object was deleted → broadcast delete
 * - Redo: object was added → broadcast add
 */
function broadcastAddOperation(
    operation: AddObjectOperation,
    isUndo: boolean,
    ctx: BroadcastContext
): void {
    if (isUndo) {
        // Object was removed by undo - broadcast deletion
        // Need to create temporary object for broadcast
        const tempObj = ctx.createObjectFromData(operation.objectData)
        if (tempObj) {
            ctx.networkManager.broadcastObjectDeleted(tempObj)
        }
    } else {
        // Object was added by redo - broadcast addition
        const obj = ctx.getObjectById(operation.objectData.id)
        if (obj) {
            ctx.networkManager.broadcastObjectAdded(obj)
        }
    }
}

/**
 * Broadcast delete operation
 * - Undo: object was restored → broadcast add
 * - Redo: object was deleted → broadcast delete
 */
function broadcastDeleteOperation(
    operation: DeleteObjectOperation,
    isUndo: boolean,
    ctx: BroadcastContext
): void {
    if (isUndo) {
        // Object was restored by undo - broadcast addition
        const obj = ctx.getObjectById(operation.objectData.id)
        if (obj) {
            ctx.networkManager.broadcastObjectAdded(obj)
        }
    } else {
        // Object was deleted by redo - broadcast deletion
        // Need to create temporary object for broadcast
        const tempObj = ctx.createObjectFromData(operation.objectData)
        if (tempObj) {
            ctx.networkManager.broadcastObjectDeleted(tempObj)
        }
    }
}

/**
 * Broadcast update operation
 * Both undo and redo result in an update
 */
function broadcastUpdateOperation(
    operation: UpdateObjectOperation,
    ctx: BroadcastContext
): void {
    const obj = ctx.getObjectById(operation.objectId)
    if (obj) {
        ctx.networkManager.broadcastObjectUpdated(obj)
    }
}

/**
 * Broadcast move operation
 * Both undo and redo result in updates for all moved objects
 */
function broadcastMoveOperation(
    operation: MoveObjectsOperation,
    ctx: BroadcastContext
): void {
    for (const objectId of operation.objectIds) {
        const obj = ctx.getObjectById(objectId)
        if (obj) {
            ctx.networkManager.broadcastObjectUpdated(obj)
        }
    }
}
