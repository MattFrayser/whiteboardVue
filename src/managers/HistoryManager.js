import { actions } from '../stores/AppState'

/**
 * Manages undo/redo history for objects
 */
export class HistoryManager {
    constructor(getUserId) {
        this.getUserId = getUserId // Function to get current user ID
        this.history = ['[]']
        this.historyIndex = 0
        this.MAX_HISTORY_SIZE = 50
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
}
