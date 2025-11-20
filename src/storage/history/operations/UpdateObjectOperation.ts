import type { Operation } from './Operation'
import type { ObjectStore } from '../../../core/spatial/ObjectStore'
import type { DrawingObjectData } from '../../../shared/types/common'

/**
 * Operation for updating an existing object
 * Stores both before and after states to enable undo/redo
 */
export class UpdateObjectOperation implements Operation {
    readonly id: string
    readonly type = 'update'
    readonly userId: string
    readonly timestamp: number

    readonly objectId: string
    readonly beforeData: DrawingObjectData
    readonly afterData: DrawingObjectData

    // TODO: history is storing data flat, vs nested in rest of project.
    //       Deciding if i should switch rest of proj to flat for easier
    //       clarity of obj attributes. or just change this to nested
    constructor(
        objectId: string,
        beforeData: DrawingObjectData,
        afterData: DrawingObjectData,
        userId: string
    ) {
        this.id = `update_${objectId}_${Date.now()}`
        this.userId = userId
        this.timestamp = Date.now()
        this.objectId = objectId

        // Deep clone to prevent mutation
        this.beforeData = structuredClone(beforeData)
        this.afterData = structuredClone(afterData)
    }

    execute(objectStore: ObjectStore): void {
        // Apply the after state
        const obj = objectStore.getObjectById(this.objectId)
        if (obj) {
            const oldBounds = obj.getBounds()
            obj.data = structuredClone(this.afterData)
            const newBounds = obj.getBounds()
            objectStore.updateObjectInQuadtree(obj, oldBounds, newBounds)
        }
    }

    undo(objectStore: ObjectStore): void {
        // Restore the before state
        const obj = objectStore.getObjectById(this.objectId)
        if (obj) {
            const oldBounds = obj.getBounds()
            obj.data = structuredClone(this.beforeData)
            const newBounds = obj.getBounds()
            objectStore.updateObjectInQuadtree(obj, oldBounds, newBounds)
        }
    }

    toJSON(): Record<string, unknown> {
        return {
            id: this.id,
            type: this.type,
            userId: this.userId,
            timestamp: this.timestamp,
            objectId: this.objectId,
            beforeData: this.beforeData,
            afterData: this.afterData,
        }
    }

    // Static method to create from JSON
    static fromJSON(data: Record<string, unknown>): UpdateObjectOperation {
        const op = Object.create(UpdateObjectOperation.prototype)
        op.id = data.id as string
        op.userId = data.userId as string
        op.timestamp = data.timestamp as number
        op.objectId = data.objectId as string
        op.beforeData = data.beforeData as DrawingObjectData
        op.afterData = data.afterData as DrawingObjectData
        return op
    }
}
