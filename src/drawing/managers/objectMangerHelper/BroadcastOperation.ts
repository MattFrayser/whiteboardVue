/**
 * broadcasting undo/redo operations to the network messages
 */

import type { Operation } from '../../../storage/history/operations/Operation'
import type { AddObjectOperation } from '../../../storage/history/operations/AddObjectOperation'
import type { DeleteObjectOperation } from '../../../storage/history/operations/DeleteObjectOperation'
import type { UpdateObjectOperation } from '../../../storage/history/operations/UpdateObjectOperation'
import type { MoveObjectsOperation } from '../../../storage/history/operations/MoveObjectsOperation'
import type { WebSocketManager } from '../../../collaboration/network/WebSocketManager'
import type { DrawingObject } from '../../objects/DrawingObject'
import type { DrawingObjectData } from '../../../shared/types/common'
import type { NestedObjectData } from '../../../core/spatial/ObjectStore'

export interface BroadcastContext {
    networkManager: WebSocketManager
    getObjectById: (id: string) => DrawingObject | undefined
    createObjectFromData: (data: DrawingObjectData | NestedObjectData) => DrawingObject | null
}

/**
 * Undo/redo operation
 *      -> Add: undo=delete, redo=add
 *      -> Delete: undo=add, redo=delete
 *      -> Update: both=update
 *      -> Move: both=update (all moved obj)
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
 * Add operation
 *      -> Undo: broadcast delete
 *      -> Redo: broadcast add 
 */
function broadcastAddOperation(
    operation: AddObjectOperation,
    isUndo: boolean,
    ctx: BroadcastContext
): void {
    if (isUndo) {
        const tempObj = ctx.createObjectFromData(operation.objectData)
        if (tempObj) {
            ctx.networkManager.broadcastObjectDeleted(tempObj)
        }
    } else {
        const obj = ctx.getObjectById(operation.objectData.id)
        if (obj) {
            ctx.networkManager.broadcastObjectAdded(obj)
        }
    }
}

/**
 * Delete operation
 *      -> Undo: broadcast add
 *      -> Redo: broadcast delete 
 */
function broadcastDeleteOperation(
    operation: DeleteObjectOperation,
    isUndo: boolean,
    ctx: BroadcastContext
): void {
    if (isUndo) {
        const obj = ctx.getObjectById(operation.objectData.id)
        if (obj) {
            ctx.networkManager.broadcastObjectAdded(obj)
        }
    } else {
        const tempObj = ctx.createObjectFromData(operation.objectData)
        if (tempObj) {
            ctx.networkManager.broadcastObjectDeleted(tempObj)
        }
    }
}

/**
 * Update operation
 */
function broadcastUpdateOperation(operation: UpdateObjectOperation, ctx: BroadcastContext): void {
    const obj = ctx.getObjectById(operation.objectId)
    if (obj) {
        ctx.networkManager.broadcastObjectUpdated(obj)
    }
}

/**
 * Broadcast move operation
 */
function broadcastMoveOperation(operation: MoveObjectsOperation, ctx: BroadcastContext): void {
    for (const objectId of operation.objectIds) {
        const obj = ctx.getObjectById(objectId)
        if (obj) {
            ctx.networkManager.broadcastObjectUpdated(obj)
        }
    }
}
