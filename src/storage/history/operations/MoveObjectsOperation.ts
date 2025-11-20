import type { Operation } from './Operation'
import type { ObjectStore } from '../../../core/spatial/ObjectStore'

/**
 * Operation for moving one or more objects
 * Stores object IDs and delta position to enable undo/redo
 * Can be merged with other move operations for the same objects
 */
export class MoveObjectsOperation implements Operation {
    readonly id: string
    readonly type = 'move'
    readonly userId: string
    readonly timestamp: number

    readonly objectIds: string[]
    readonly dx: number
    readonly dy: number

    constructor(objectIds: string[], dx: number, dy: number, userId: string) {
        this.id = `move_${objectIds.join('_')}_${Date.now()}`
        this.userId = userId
        this.timestamp = Date.now()
        this.objectIds = [...objectIds] // Clone array
        this.dx = dx
        this.dy = dy
    }

    execute(objectStore: ObjectStore): void {
        // Move all objects forward by dx, dy
        for (const objectId of this.objectIds) {
            const obj = objectStore.getObjectById(objectId)
            if (obj) {
                const oldBounds = obj.getBounds()
                obj.move(this.dx, this.dy)
                const newBounds = obj.getBounds()
                objectStore.updateObjectInQuadtree(obj, oldBounds, newBounds)
            }
        }
    }

    undo(objectStore: ObjectStore): void {
        // Move all objects backward by -dx, -dy
        for (const objectId of this.objectIds) {
            const obj = objectStore.getObjectById(objectId)
            if (obj) {
                const oldBounds = obj.getBounds()
                obj.move(-this.dx, -this.dy)
                const newBounds = obj.getBounds()
                objectStore.updateObjectInQuadtree(obj, oldBounds, newBounds)
            }
        }
    }

    toJSON(): Record<string, unknown> {
        return {
            id: this.id,
            type: this.type,
            userId: this.userId,
            timestamp: this.timestamp,
            objectIds: this.objectIds,
            dx: this.dx,
            dy: this.dy,
        }
    }

    /**
     * Check if this operation can be merged with another move operation
     * Can merge if it's for the same set of objects within a time threshold
     */
    canMergeWith(other: Operation): boolean {
        if (other.type !== 'move') return false

        const otherMove = other as MoveObjectsOperation

        // Check if same objects (order doesn't matter)
        if (this.objectIds.length !== otherMove.objectIds.length) return false

        const thisIds = new Set(this.objectIds)
        const otherIds = new Set(otherMove.objectIds)

        for (const id of thisIds) {
            if (!otherIds.has(id)) return false
        }

        // Check if within time threshold (500ms)
        return Math.abs(this.timestamp - other.timestamp) < 500
    }

    /**
     * Merge with another move operation
     * Combines the deltas to create a single operation
     */
    mergeWith(other: Operation): Operation {
        if (!this.canMergeWith(other)) {
            throw new Error('Cannot merge incompatible operations')
        }

        const otherMove = other as MoveObjectsOperation

        // Create new operation with combined delta
        const merged = new MoveObjectsOperation(
            this.objectIds,
            this.dx + otherMove.dx,
            this.dy + otherMove.dy,
            this.userId
        )

        // Keep the earlier timestamp - modify the readonly property
        Object.defineProperty(merged, 'timestamp', {
            value: Math.min(this.timestamp, otherMove.timestamp),
            writable: false,
            enumerable: true,
            configurable: true,
        })

        return merged
    }

    // Static method to create from JSON
    static fromJSON(data: Record<string, unknown>): MoveObjectsOperation {
        const op = Object.create(MoveObjectsOperation.prototype)
        op.id = data.id as string
        op.userId = data.userId as string
        op.timestamp = data.timestamp as number
        op.objectIds = data.objectIds as string[]
        op.dx = data.dx as number
        op.dy = data.dy as number
        return op
    }
}
