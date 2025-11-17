import { actions } from '../../shared/stores/AppState'
import { ErrorHandler } from '../../shared/utils/ErrorHandler'
import type { Operation } from './operations/Operation'

import { createLogger } from '../../shared/utils/logger'
const log = createLogger('HistoryManager')

/**
 * Manages undo/redo history using operation-based approach
 * Each history entry is an operation that can be reversed
 */
export class HistoryManager {
    private getUserId: () => string | null
    private history: Operation[]
    private historyIndex: number
    private MAX_HISTORY_SIZE: number

    constructor(getUserId: () => string | null) {
        this.getUserId = getUserId // Function to get current user ID
        this.history = []
        this.historyIndex = -1 // -1 means no operations yet
        this.MAX_HISTORY_SIZE = 50

        // Publish initial history state to sync with AppState
        this.publishHistoryChanged()
    }

    /**
     * Record a new operation to history
     * Clears any redo stack if we're not at the end
     */
    recordOperation(operation: Operation): void {
        const userId = this.getUserId()

        // Only record operations from current user
        if (operation.userId !== userId) {
            return
        }

        // Remove future history if we're not at the end (clears redo stack)
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1)
        }

        // Try to merge with previous operation if possible
        if (this.history.length > 0 && this.historyIndex >= 0) {
            const lastOp = this.history[this.historyIndex]
            if (lastOp && lastOp.canMergeWith && lastOp.canMergeWith(operation)) {
                // Replace last operation with merged version
                this.history[this.historyIndex] = lastOp.mergeWith!(operation)
                this.publishHistoryChanged()
                return
            }
        }

        // Add new operation
        this.history.push(operation)
        this.historyIndex++

        // Trim old history to avoid memory congestion
        if (this.history.length > this.MAX_HISTORY_SIZE) {
            this.history.shift()
            this.historyIndex--
        }

        this.publishHistoryChanged()
    }

    /**
     * Undo the last operation
     * Returns the operation that was undone, or null if nothing to undo
     */
    undo(): Operation | null {
        if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
            const operation = this.history[this.historyIndex]
            if (operation) {
                this.historyIndex--
                this.publishHistoryChanged()
                return operation
            }
        }
        return null
    }

    /**
     * Redo the next operation
     * Returns the operation that was redone, or null if nothing to redo
     */
    redo(): Operation | null {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++
            const operation = this.history[this.historyIndex]
            if (operation) {
                this.publishHistoryChanged()
                return operation
            }
        }
        return null
    }

    publishHistoryChanged(): void {
        actions.setHistoryState(
            this.historyIndex >= 0, // canUndo
            this.historyIndex < this.history.length - 1, // canRedo
            this.historyIndex + 1, // pointer (adjusted for display, +1 because -1 means empty)
            this.history.length // size
        )
    }

    canUndo(): boolean {
        return this.historyIndex >= 0
    }

    canRedo(): boolean {
        return this.historyIndex < this.history.length - 1
    }

    /**
     * Migrate userId in all history entries (for local-first mode transition)
     * Updates all operations from oldUserId to newUserId
     * @param {string} oldUserId - The temporary local userId to replace
     * @param {string} newUserId - The server-assigned userId
     */
    migrateUserId(oldUserId: string, newUserId: string): void {
        log.debug('Migrating history', { from: oldUserId, to: newUserId })

        this.history = this.history.map((operation: Operation) => {
            try {
                if (operation.userId === oldUserId) {
                    // Modify readonly userId property for local→network migration
                    // Uses Object.defineProperty to maintain readonly semantics after modification
                    // This is an exceptional case - userId migration only occurs once during
                    // the transition from local-first to networked mode
                    // Pattern matches MoveObjectsOperation.mergeWith() approach
                    Object.defineProperty(operation, 'userId', {
                        value: newUserId,
                        writable: false,
                        enumerable: true,
                        configurable: true
                    })
                }
                return operation
            } catch (error) {
                ErrorHandler.silent(error as Error, {
                    context: 'HistoryManager',
                    metadata: { operation: 'migrateUserId', oldUserId, newUserId }
                })
                return operation // Return unchanged on error
            }
        })

        log.debug('Migration complete', { entries: this.history.length })
    }

    /**
     * Get current history size (for debugging/metrics)
     */
    getHistorySize(): number {
        return this.history.length
    }

    /**
     * Clear all history (useful for testing or reset)
     */
    clear(): void {
        this.history = []
        this.historyIndex = -1
        this.publishHistoryChanged()
    }
}
