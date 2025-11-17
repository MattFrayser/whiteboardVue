import type { Operation } from './Operation'
import type { ObjectStore, NestedObjectData } from '../../../core/spatial/ObjectStore'
import type { DrawingObject } from '../../../drawing/objects/DrawingObject'

/**
 * Operation for deleting an object from the canvas
 * Stores the complete object data to enable restoration
 */
export class DeleteObjectOperation implements Operation {
    readonly id: string
    readonly type = 'delete'
    readonly userId: string
    readonly timestamp: number

    readonly objectData: NestedObjectData

    constructor(object: DrawingObject, userId: string) {
        this.id = `delete_${object.id}_${Date.now()}`
        this.userId = userId
        this.timestamp = Date.now()

        // Store the complete object data for restoration
        this.objectData = object.toJSON()
    }

    execute(objectStore: ObjectStore): void {
        // Remove the object from the store
        objectStore.removeById(this.objectData.id)
    }

    undo(objectStore: ObjectStore): void {
        // Restore the object to the store
        objectStore.addRemote(this.objectData)
    }

    toJSON(): Record<string, unknown> {
        return {
            id: this.id,
            type: this.type,
            userId: this.userId,
            timestamp: this.timestamp,
            objectData: this.objectData,
        }
    }

    // Static method to create from JSON
    static fromJSON(data: Record<string, unknown>): DeleteObjectOperation {
        const op = Object.create(DeleteObjectOperation.prototype)
        op.id = data.id as string
        op.userId = data.userId as string
        op.timestamp = data.timestamp as number
        op.objectData = data.objectData as NestedObjectData
        return op
    }
}
