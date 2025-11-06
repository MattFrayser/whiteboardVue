import type { ObjectStore } from '../ObjectStore'

/**
 * Base interface for all undo/redo operations
 * Operations must be reversible and serializable
 */
export interface Operation {
    /**
     * Unique identifier for the operation
     */
    readonly id: string

    /**
     * Type identifier for serialization/deserialization
     */
    readonly type: string

    /**
     * User ID who performed the operation
     */
    readonly userId: string

    /**
     * Timestamp when operation was created
     */
    readonly timestamp: number

    /**
     * Execute the operation (apply changes to object store)
     * Used for redo
     */
    execute(objectStore: ObjectStore): void

    /**
     * Reverse the operation (undo changes from object store)
     * Used for undo
     */
    undo(objectStore: ObjectStore): void

    /**
     * Serialize operation to JSON for potential persistence
     */
    toJSON(): Record<string, unknown>

    /**
     * Check if this operation can be merged with another operation
     * Used for compressing history (e.g., multiple move operations)
     */
    canMergeWith?(other: Operation): boolean

    /**
     * Merge with another operation to create a single combined operation
     * Returns new merged operation
     */
    mergeWith?(other: Operation): Operation
}

/**
 * Factory function type for deserializing operations from JSON
 */
export type OperationFactory = (data: Record<string, unknown>) => Operation
