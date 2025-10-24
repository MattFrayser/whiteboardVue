import { Stroke } from '../objects/Stroke'
import { Rectangle } from '../objects/Rectangle'
import { Circle } from '../objects/Circle'
import { Line } from '../objects/Line'
import { Text } from '../objects/Text'
import { Quadtree } from './Quadtree'

export class ObjectManager {
    constructor(engine = null) {
        this.objects = []
        this.selectedObjects = []
        this.history = ['[]']
        this.historyIndex = 0
        this.clipboard = []
        this.engine = engine

        // Initialize quadtree with large bounds (will expand as needed)
        this.quadtree = new Quadtree(
            { x: -10000, y: -10000, width: 20000, height: 20000 },
            10, // max objects per node
            8   // max levels
        )
    }
    
    addObject(object) {
        // Update userId to current user when adding
        if (this.engine && this.engine.wsManager) {
            object.userId = this.engine.wsManager.userId
        }

        this.objects.push(object)

        // Add to quadtree
        const bounds = object.getBounds()
        this.quadtree.insert(object, bounds)

        this.saveState()

        // Broadcast to other clients
        this.broadcast('add', object)

        return object
    }
    
    removeObject(object) {
        const index = this.objects.indexOf(object)
        if (index > -1) {
            // Remove from quadtree
            const bounds = object.getBounds()
            this.quadtree.remove(object, bounds)

            this.objects.splice(index, 1)
            this.saveState()

            // Broadcast to other clients
            this.broadcast('delete', object)
        }
    }

    broadcast(action, data) {
        if (!this.engine || !this.engine.wsManager) return

        // Normalize to array for uniform handling
        const objects = Array.isArray(data) ? data : [data]

        switch(action) {
            case 'add':
                objects.forEach(obj => this.engine.wsManager.broadcastObjectAdded(obj))
                break
            case 'update':
                objects.forEach(obj => this.engine.wsManager.broadcastObjectUpdated(obj))
                break
            case 'delete':
                objects.forEach(obj => this.engine.wsManager.broadcastObjectDeleted(obj))
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
        this.selectedObjects.forEach(obj => obj.selected = false)
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
        // Use quadtree for efficient spatial query
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

        // Use quadtree for efficient spatial query
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
        // Update quadtree for moved objects
        this.selectedObjects.forEach(obj => {
            const oldBounds = obj.getBounds()
            this.quadtree.remove(obj, oldBounds)

            obj.move(dx, dy)

            const newBounds = obj.getBounds()
            this.quadtree.insert(obj, newBounds)
        })
        this.saveState()
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
    
    saveState() {
        // Remove future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1)
        }

        // Save only THIS user's objects (personal undo/redo)
        const userId = this.engine?.wsManager?.userId
        const myObjects = this.objects.filter(obj => obj.userId === userId)
        const state = myObjects.map(obj => obj.toJSON())
        this.history.push(JSON.stringify(state))
        this.historyIndex++

        // Limit history size
        if (this.history.length > 50) {
            this.history.shift()
            this.historyIndex--
        }
    }
    
    copySelected() {
        if (this.selectedObjects.length === 0) return

        this.clipboard = this.selectedObjects.map(obj => obj.toJSON())
    }

    cutSelected() {
        if (this.selectedObjects.length === 0) return 
        
        this.copySelected()
        this.deleteSelected()

    }
    paste(x, y) {
        if (this.clipboard.length === 0) return

        this.clearSelection()

        const newObjects = this.clipboard.map(data => {
           // Deep clone
           const clonedData = JSON.parse(JSON.stringify(data))
           clonedData.id = null // will trigger new ID
           const newObject = this.createObjectFromData(clonedData)
           this.addObject(newObject)
           return newObject
        })

        // Bounding box of all objects 
        let minX = Infinity, minY = Infinity
        let maxX = -Infinity, maxY = -Infinity

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

        // Broadcast the moved positions to other clients
        this.broadcast('update', newObjects)

        this.saveState()
    }
    
    undo() {
        if (this.historyIndex > 0) {
            const userId = this.engine?.wsManager?.userId

            const before = this.objects.filter(o => o.userId === userId)

            // Apply undo
            this.historyIndex--
            this.loadState(this.history[this.historyIndex])

            const after = this.objects.filter(o => o.userId === userId)

            this.broadcastDiff(before, after)
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            const userId = this.engine?.wsManager?.userId

            const before = this.objects.filter(o => o.userId === userId)

            // Apply redo
            this.historyIndex++
            this.loadState(this.history[this.historyIndex])

            const after = this.objects.filter(o => o.userId === userId)

            this.broadcastDiff(before, after)
        }
    }

    loadState(stateStr) {
        const state = JSON.parse(stateStr)
        const userId = this.engine?.wsManager?.userId

        // Remove only THIS user's objects
        this.objects = this.objects.filter(obj => obj.userId !== userId)

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
            if (!beforeObj) return false
            return JSON.stringify(beforeObj.data) !== JSON.stringify(a.data)
        })

        if (deleted.length > 0) this.broadcast('delete', deleted)
        if (added.length > 0) this.broadcast('add', added)
        if (modified.length > 0) this.broadcast('update', modified)
    }
    
    createObjectFromData(data) {
        let obj = null
        switch (data.type) {
            case 'stroke':
                obj = new Stroke(data.id, data.data)
                break
            case 'rectangle':
                obj = new Rectangle(data.id, data.data)
                break
            case 'circle':
                obj = new Circle(data.id, data.data)
                break
            case 'line':
                obj = new Line(data.id, data.data)
                break
            case 'text':
                obj = new Text(data.id, data.data)
                break
        }

        // Preserve userId and zIndex from remote data
        if (obj) {
            obj.userId = data.userId
            obj.zIndex = data.zIndex || 0
        }

        return obj
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


