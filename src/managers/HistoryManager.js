import { actions } from '../stores/AppState'
import { ErrorHandler } from '../utils/ErrorHandler'

/**
 * Manages undo/redo history for objects
 */
export class HistoryManager {
    constructor(getUserId) {
        this.getUserId = getUserId // Function to get current user ID
        this.history = ['[]']
        this.historyIndex = 0
        this.MAX_HISTORY_SIZE = 50

        // Publish initial history state to sync with AppState
        this.publishHistoryChanged()
    }

    saveState(objects) {
        // Remove future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1)
        }

        // Save only THIS user's objects
        // This keeps undo/redo personal
        const userId = this.getUserId()
        const myObjects = objects.filter(obj => obj.userId === userId)
        const state = myObjects.map(obj => obj.toJSON())
        this.history.push(JSON.stringify(state))
        this.historyIndex++

        // Old history is trimmed to avoid memory congestion 
        if (this.history.length > this.MAX_HISTORY_SIZE) {
            this.history.shift()
            this.historyIndex--
        }

        this.publishHistoryChanged()
    }


    getCurrentState() {
        return this.history[this.historyIndex]
    }


    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--
            this.publishHistoryChanged()
            return this.history[this.historyIndex]
        }
        return null
    }


    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++
            this.publishHistoryChanged()
            return this.history[this.historyIndex]
        }
        return null
    }

    publishHistoryChanged() {
        actions.setHistoryState(
            this.historyIndex > 0, // canUndo
            this.historyIndex < this.history.length - 1, // canRedo
            this.historyIndex, // pointer
            this.history.length // size
        )
    }

    canUndo() {
        return this.historyIndex > 0
    }

    canRedo() {
        return this.historyIndex < this.history.length - 1
    }

    /**
     * Migrate userId in all history entries (for local-first mode transition)
     * Updates all objects in history from oldUserId to newUserId
     * @param {string} oldUserId - The temporary local userId to replace
     * @param {string} newUserId - The server-assigned userId
     */
    migrateUserId(oldUserId, newUserId) {
        console.log(`[HistoryManager] Migrating history from userId ${oldUserId} to ${newUserId}`)

        this.history = this.history.map(stateStr => {
            try {
                const state = JSON.parse(stateStr)
                const migratedState = state.map(obj => {
                    if (obj.userId === oldUserId) {
                        return { ...obj, userId: newUserId }
                    }
                    return obj
                })
                return JSON.stringify(migratedState)
            } catch (error) {
                ErrorHandler.silent(error, {
                    context: 'HistoryManager',
                    metadata: { operation: 'migrateUserId', oldUserId, newUserId }
                })
                return stateStr // Return unchanged on error
            }
        })

        console.log(`[HistoryManager] Migrated ${this.history.length} history entries`)
    }
}
