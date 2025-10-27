/**
 * Manages undo/redo history for objects
 */
export class HistoryManager {
    constructor(eventBus, getUserId) {
        this.eventBus = eventBus
        this.getUserId = getUserId // Function to get current user ID
        this.history = ['[]']
        this.historyIndex = 0
    }

    /**
     * Save current state to history
     */
    saveState(objects) {
        // Remove future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1)
        }

        // Save only THIS user's objects (personal undo/redo)
        const userId = this.getUserId()
        const myObjects = objects.filter(obj => obj.userId === userId)
        const state = myObjects.map(obj => obj.toJSON())
        this.history.push(JSON.stringify(state))
        this.historyIndex++

        // Limit history size
        if (this.history.length > 50) {
            this.history.shift()
            this.historyIndex--
        }

        // Emit history changed event
        this.eventBus.publish('objectManager:historyChanged', {
            canUndo: this.historyIndex > 0,
            canRedo: this.historyIndex < this.history.length - 1,
        })
    }

    /**
     * Get state at current history index
     */
    getCurrentState() {
        return this.history[this.historyIndex]
    }

    /**
     * Move back in history
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--
            this.emitHistoryChanged()
            return this.history[this.historyIndex]
        }
        return null
    }

    /**
     * Move forward in history
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++
            this.emitHistoryChanged()
            return this.history[this.historyIndex]
        }
        return null
    }

    emitHistoryChanged() {
        this.eventBus.publish('objectManager:historyChanged', {
            canUndo: this.historyIndex > 0,
            canRedo: this.historyIndex < this.history.length - 1,
        })
    }

    canUndo() {
        return this.historyIndex > 0
    }

    canRedo() {
        return this.historyIndex < this.history.length - 1
    }
}
