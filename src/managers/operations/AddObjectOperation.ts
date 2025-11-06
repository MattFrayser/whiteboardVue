import type { Operation } from './Operation'
import type { ObjectStore, NestedObjectData } from '../ObjectStore'
import type { DrawingObject } from '../../objects/DrawingObject'

/**
 * Operation for adding an object to the canvas
 * Stores the complete object data needed to recreate it
 */
export class AddObjectOperation implements Operation {
    readonly id: string
    readonly type = 'add'
    readonly userId: string
    readonly timestamp: number

    private objectData: NestedObjectData

    constructor(object: DrawingObject, userId: string) {
        this.id = `add_${object.id}_${Date.now()}`
        this.userId = userId
        this.timestamp = Date.now()

        // Store the complete object data
        this.objectData = object.toJSON()
    }

    execute(objectStore: ObjectStore): void {
        // Add the object to the store
        objectStore.addRemote(this.objectData)
    }

    undo(objectStore: ObjectStore): void {
        // Remove the object from the store
        objectStore.removeById(this.objectData.id)
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
    static fromJSON(data: Record<string, unknown>): AddObjectOperation {
        const op = Object.create(AddObjectOperation.prototype)
        op.id = data.id as string
        op.userId = data.userId as string
        op.timestamp = data.timestamp as number
        op.objectData = data.objectData as NestedObjectData
        return op
    }
}
