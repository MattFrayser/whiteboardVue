import { ClipboardManager } from './ClipboardManager'
import { HistoryManager } from './HistoryManager'
import { ObjectSerializer } from './ObjectSerializer'
import { Quadtree } from '../utils/Quadtree'

export class ObjectManager {
    constructor(engine, eventBus) {
        this.objects = []
        this.selectedObjects = []
        this.engine = engine
        this.eventBus = eventBus
        this.userId = null // Will be set via event

        // Initialize quadtree with large bounds (will expand as needed)
        this.quadtree = new Quadtree(
            { x: -10000, y: -10000, width: 20000, height: 20000 },
            10, // max objects per node
            8 // max levels
        )

        // Initialize managers
        this.historyManager = new HistoryManager(eventBus, () => this.userId)
        this.clipboardManager = new ClipboardManager()

        this.subscribeToEvents()
    }

    subscribeToEvents() {
        // Listen for authenticated user ID from network
        this.eventBus.subscribe('network:authenticated', ({ userId }) => {
            this.userId = userId
        })
    }

    addObject(object) {
        // Update userId to current user when adding
        if (this.userId) {
            object.userId = this.userId
        }

        this.objects.push(object)

        // Add to quadtree
        const bounds = object.getBounds()
        this.quadtree.insert(object, bounds)

        this.historyManager.saveState(this.objects)

        this.eventBus.publish('objectManager:objectAdded', { object })

        return object
    }

    removeObject(object) {
        const index = this.objects.indexOf(object)
        if (index > -1) {
            // Remove from quadtree
            const bounds = object.getBounds()
            this.quadtree.remove(object, bounds)

            this.objects.splice(index, 1)
            this.historyManager.saveState(this.objects)

            // Emit event for broadcasting
            this.eventBus.publish('objectManager:objectDeleted', { object })
        }
    }

    broadcast(action, data) {
        // Normalize to array for uniform handling
        const objects = Array.isArray(data) ? data : [data]

        switch (action) {
            case 'add':
                objects.forEach(obj =>
                    this.eventBus.publish('objectManager:objectAdded', { object: obj })
                )
                break
            case 'update':
                objects.forEach(obj =>
                    this.eventBus.publish('objectManager:objectUpdated', { object: obj })
                )
                break
            case 'delete':
                objects.forEach(obj =>
                    this.eventBus.publish('objectManager:objectDeleted', { object: obj })
                )
                break
        }
    }

    selectObject(object, multi = false) {
        if (!multi) {
            this.clearSelection()
        }
        object.selected = true
        this.selectedObjects.push(object)
    }

    clearSelection() {
        this.selectedObjects.forEach(obj => (obj.selected = false))
        this.selectedObjects = []
    }

    deleteSelected() {
        const toDelete = [...this.selectedObjects]
        this.clearSelection()

        // Use removeObject to trigger broadcasts
        toDelete.forEach(obj => {
            this.removeObject(obj)
        })
    }

    getObjectAt(point) {
        const candidates = this.quadtree.queryPoint(point)

        // Search from top to bottom (reverse order for z-index)
        for (let i = candidates.length - 1; i >= 0; i--) {
            if (candidates[i].containsPoint(point)) {
                return candidates[i]
            }
        }
        return null
    }

    selectObjectsInRect(rect, multi = false) {
        if (!multi) {
            this.clearSelection()
        }

        const candidates = this.quadtree.query(rect)

        // Check each candidate for intersection with select rectangle
        candidates.forEach(obj => {
            const bounds = obj.getBounds()

            const intersects = !(
                bounds.x + bounds.width < rect.x ||
                bounds.x > rect.x + rect.width ||
                bounds.y + bounds.height < rect.y ||
                bounds.y > rect.y + rect.height
            )

            if (intersects && !obj.selected) {
                obj.selected = true
                this.selectedObjects.push(obj)
            }
        })
    }

    moveSelected(dx, dy) {
        this.selectedObjects.forEach(obj => {
            const oldBounds = obj.getBounds()
            this.quadtree.remove(obj, oldBounds)

            obj.move(dx, dy)

            const newBounds = obj.getBounds()
            this.quadtree.insert(obj, newBounds)
        })
        this.historyManager.saveState(this.objects)
    }

    /**
     * Update quadtree entry when an object's bounds change
     * Call this after resizing or transforming objects
     */
    updateObjectInQuadtree(object, oldBounds) {
        this.quadtree.remove(object, oldBounds)
        const newBounds = object.getBounds()
        this.quadtree.insert(object, newBounds)
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
            clonedData.id = null // will trigger new ID
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

        this.broadcast('update', newObjects)

        this.historyManager.saveState(this.objects)
    }

    undo() {
        if (this.historyManager.canUndo()) {
            const before = this.objects.filter(o => o.userId === this.userId)

            // Apply undo
            const stateStr = this.historyManager.undo()
            this.loadState(stateStr)

            const after = this.objects.filter(o => o.userId === this.userId)

            this.broadcastDiff(before, after)
        }
    }

    redo() {
        if (this.historyManager.canRedo()) {
            const before = this.objects.filter(o => o.userId === this.userId)

            // Apply redo
            const stateStr = this.historyManager.redo()
            this.loadState(stateStr)

            const after = this.objects.filter(o => o.userId === this.userId)

            this.broadcastDiff(before, after)
        }
    }

    loadState(stateStr) {
        const state = JSON.parse(stateStr)

        // Remove only THIS user's objects
        this.objects = this.objects.filter(obj => obj.userId !== this.userId)

        // Restore THIS user's objects from history
        const myRestoredObjects = state.map(data => this.createObjectFromData(data))
        this.objects.push(...myRestoredObjects)

        this.clearSelection()

        // Rebuild quadtree after state change
        this.quadtree.rebuild(this.objects)
    }

    broadcastDiff(before, after) {
        // deleted (in before but not in after)
        const deleted = before.filter(b => !after.find(a => a.id === b.id))

        // added (in after but not in before)
        const added = after.filter(a => !before.find(b => b.id === a.id))

        // modified (same ID, different data)
        const modified = after.filter(a => {
            const beforeObj = before.find(b => b.id === a.id)
            if (!beforeObj) {
                return false
            }
            return JSON.stringify(beforeObj.data) !== JSON.stringify(a.data)
        })

        if (deleted.length > 0) {
            this.broadcast('delete', deleted)
        }
        if (added.length > 0) {
            this.broadcast('add', added)
        }
        if (modified.length > 0) {
            this.broadcast('update', modified)
        }
    }

    createObjectFromData(data) {
        return ObjectSerializer.createObjectFromData(data)
    }

    render(ctx, viewport = null) {
        // If viewport is provided, use quadtree for culling
        if (viewport) {
            const visibleObjects = this.quadtree.query(viewport)
            visibleObjects.forEach(obj => obj.render(ctx))
        } else {
            // Full render (fallback)
            this.objects.forEach(obj => obj.render(ctx))
        }
    }
}
