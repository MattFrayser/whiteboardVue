import { ClipboardManager } from './ClipboardManager'
import { HistoryManager } from './HistoryManager'
import { SelectionManager } from './SelectionManager'
import { ObjectStore } from './ObjectStore'

export class ObjectManager {
    constructor(networkManager) {
        this.networkManager = networkManager
        this.userId = null // Will be set by network manager
        this.nextZIndex = 0 // Track next available zIndex

        // Initialize managers
        this.objectStore = new ObjectStore()
        this.historyManager = new HistoryManager(() => this.userId)
        this.clipboardManager = new ClipboardManager()
        this.selectionManager = new SelectionManager(this, this.objectStore, this.historyManager)
    }

    /**
     * Set the current user ID (called by network manager)
     */
    setUserId(userId) {
        this.userId = userId
    }

    /**
     * Public API getters
     */
    get selectedObjects() {
        return this.selectionManager.selectedObjects
    }

    getAllObjects() {
        return this.objectStore.getAllObjects()
    }

    /**
     * Add object locally (triggers history and network broadcast)
     */
    addObject(object) {
        // Update userId to current user when adding
        if (this.userId) {
            object.userId = this.userId
        }

        // Assign zIndex if not already set
        if (object.zIndex === undefined || object.zIndex === null) {
            object.zIndex = this.nextZIndex++
        } else {
            // Update nextZIndex if object has higher zIndex
            this.nextZIndex = Math.max(this.nextZIndex, object.zIndex + 1)
        }

        // Add to store
        this.objectStore.addLocal(object)

        // Save to history
        this.historyManager.saveState(this.objectStore.getAllObjects())

        // Broadcast to network
        if (this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.broadcastObjectAdded(object)
        }

        return object
    }

    /**
     * Remove object locally (triggers history and network broadcast)
     */
    removeObject(object) {
        const result = this.objectStore.removeLocal(object)
        if (result) {
            this.historyManager.saveState(this.objectStore.getAllObjects())

            // Broadcast to network
            if (this.networkManager && this.networkManager.isConnected()) {
                this.networkManager.broadcastObjectDeleted(object)
            }
        }
        return result
    }

    /**
     * Update object's position in quadtree and rebuild if bounds exceeded
     */
    updateObjectInQuadtree(object, oldBounds, newBounds = null) {
        this.objectStore.updateObjectInQuadtree(object, oldBounds, newBounds)
    }

    /**
     * Broadcast object update to network
     */
    broadcastObjectUpdate(object) {
        if (this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.broadcastObjectUpdated(object)
        }
    }

    /**
     * Save current state to history (wrapper for tools)
     */
    saveState() {
        this.historyManager.saveState(this.objectStore.getAllObjects())
    }

    selectObject(object, multi = false) {
        this.selectionManager.selectObject(object, multi)
    }

    clearSelection() {
        this.selectionManager.clearSelection()
    }

    deleteSelected() {
        this.selectionManager.deleteSelected()
    }

    getObjectAt(point) {
        return this.objectStore.getObjectAt(point)
    }

    selectObjectsInRect(rect, multi = false) {
        this.selectionManager.selectObjectsInRect(rect, multi)
    }

    moveSelected(dx, dy) {
        this.selectionManager.moveSelected(dx, dy)
    }

    /**
     * Rebuild the entire quadtree, optionally expanding bounds
     * Call when objects exceed current bounds or structure becomes corrupted
     */
    rebuildQuadtree(expandBounds = false) {
        this.objectStore.rebuildQuadtree(expandBounds)
    }

    copySelected() {
        this.clipboardManager.copy(this.selectedObjects)
    }

    cutSelected() {
        if (this.selectedObjects.length === 0) {
            return
        }

        this.copySelected()
        this.deleteSelected()
    }

    paste(x, y) {
        if (!this.clipboardManager.hasContent()) {
            return
        }

        this.clearSelection()

        const clipboard = this.clipboardManager.getClipboard()
        const newObjects = clipboard.map(data => {
            // Deep clone
            const clonedData = JSON.parse(JSON.stringify(data))
            clonedData.id = null // setting null will trigger new ID
            const newObject = this.createObjectFromData(clonedData)
            this.addObject(newObject)
            return newObject
        })

        // Bounding box of all objects
        let minX = Infinity,
            minY = Infinity
        let maxX = -Infinity,
            maxY = -Infinity

        newObjects.forEach(obj => {
            const bounds = obj.getBounds()
            minX = Math.min(minX, bounds.x)
            minY = Math.min(minY, bounds.y)
            maxX = Math.max(maxX, bounds.x + bounds.width)
            maxY = Math.max(maxY, bounds.y + bounds.height)
        })

        // Group center offset to cursor
        const groupCenterX = (minX + maxX) / 2
        const groupCenterY = (minY + maxY) / 2

        const dx = x - groupCenterX
        const dy = y - groupCenterY

        newObjects.forEach(obj => {
            obj.move(dx, dy)
            this.selectObject(obj, true)
        })

        // Broadcast updates to network
        newObjects.forEach(obj => {
            this.broadcastObjectUpdate(obj)
        })

        this.historyManager.saveState(this.objectStore.getAllObjects())
    }

    undo() {
        if (this.historyManager.canUndo()) {
            const before = this.objectStore.getAllObjects().filter(o => o.userId === this.userId)

            // Apply undo
            const stateStr = this.historyManager.undo()
            this.loadState(stateStr)

            const after = this.objectStore.getAllObjects().filter(o => o.userId === this.userId)

            this.publishDiff(before, after)
        }
    }

    redo() {
        if (this.historyManager.canRedo()) {
            const before = this.objectStore.getAllObjects().filter(o => o.userId === this.userId)

            // Apply redo
            const stateStr = this.historyManager.redo()
            this.loadState(stateStr)

            const after = this.objectStore.getAllObjects().filter(o => o.userId === this.userId)

            this.publishDiff(before, after)
        }
    }

    loadState(stateStr) {
        const state = JSON.parse(stateStr)
        this.objectStore.loadUserState(this.userId, state)
        this.clearSelection()
    }

    publishDiff(before, after) {
        const beforeMap = new Map(before.map(obj => [obj.id, obj]))
        const afterMap = new Map(after.map(obj => [obj.id, obj]))

        const deleted = []
        const added = []
        const modified = []

        // Find deleted (in before but not in after)
        for (const obj of before) {
            if (!afterMap.has(obj.id)) {
                deleted.push(obj)
            }
        }

        // Find added and modified
        for (const obj of after) {
            const beforeObj = beforeMap.get(obj.id)
            if (!beforeObj) {
                added.push(obj)
            } else if (JSON.stringify(beforeObj.data) !== JSON.stringify(obj.data)) {
                modified.push(obj)
            }
        }

        deleted.forEach(obj => {
            if (this.networkManager && this.networkManager.isConnected()) {
                this.networkManager.broadcastObjectDeleted(obj)
            }
        })
        added.forEach(obj => {
            if (this.networkManager && this.networkManager.isConnected()) {
                this.networkManager.broadcastObjectAdded(obj)
            }
        })
        modified.forEach(obj => {
            if (this.networkManager && this.networkManager.isConnected()) {
                this.networkManager.broadcastObjectUpdated(obj)
            }
        })
    }

    createObjectFromData(data) {
        return this.objectStore.createObjectFromData(data)
    }

    /**
     * Get object by ID (for remote updates)
     */
    getObjectById(id) {
        return this.objectStore.getObjectById(id)
    }

    /**
     * Add object from network (no history, no local broadcast)
     */
    addRemoteObject(objectData) {
        return this.objectStore.addRemote(objectData)
    }

    /**
     * Update object from network (no history, no local broadcast)
     */
    updateRemoteObject(objectId, objectData) {
        return this.objectStore.updateRemoteObject(objectId, objectData)
    }

    /**
     * Remove object from network (no history, no local broadcast)
     */
    removeRemoteObject(objectId) {
        return this.objectStore.removeRemote(objectId)
    }

    /**
     * Load objects from network (full sync)
     */
    loadRemoteObjects(objectDataArray) {
        this.objectStore.loadRemoteObjects(objectDataArray)
    }

    render(ctx, viewport = null) {
        this.objectStore.render(ctx, viewport, this.selectedObjects)
    }

}
