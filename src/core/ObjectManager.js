// src/core/ObjectManager.js
import { Stroke } from '../objects/Stroke'
import { Rectangle } from '../objects/Rectangle'
import { Circle } from '../objects/Circle'
import { Line } from '../objects/Line'
import { Text } from '../objects/Text'

export class ObjectManager {
    constructor(engine = null) {
        this.objects = []
        this.selectedObjects = []
        this.history = ['[]']
        this.historyIndex = 0
        this.clipboard = []
        this.engine = engine
    }
    
    addObject(object) {
        this.objects.push(object)
        this.saveState()

        // Broadcast to other clients
        if (this.engine && this.engine.wsManager) {
            this.engine.wsManager.broadcastObjectAdded(object)
        }

        return object
    }
    
    removeObject(object) {
        const index = this.objects.indexOf(object)
        if (index > -1) {
            this.objects.splice(index, 1)
            this.saveState()

            // Broadcast to other clients
            if (this.engine && this.engine.wsManager) {
                this.engine.wsManager.broadcastObjectDeleted(object)
            }
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
        // Search from top to bottom
        for (let i = this.objects.length - 1; i >= 0; i--) {
            if (this.objects[i].containsPoint(point)) {
                return this.objects[i]
            }
        }
        return null
    }

    selectObjectsInRect(rect, multi = false) {
        if (!multi) {
            this.clearSelection()
        }

        // Check each object intersection with select rectangle 
        this.objects.forEach(obj => {
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
        this.selectedObjects.forEach(obj => obj.move(dx, dy))
        this.saveState()
    }
    
    bringToFront() {
        this.selectedObjects.forEach(obj => {
            const index = this.objects.indexOf(obj)
            if (index > -1) {
                this.objects.splice(index, 1)
                this.objects.push(obj)
            }
        })
        this.saveState()
    }
    
    sendToBack() {
        this.selectedObjects.forEach(obj => {
            const index = this.objects.indexOf(obj)
            if (index > -1) {
                this.objects.splice(index, 1)
                this.objects.unshift(obj)
            }
        })
        this.saveState()
    }
    
    saveState() {
        // Remove future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1)
        }
        
        // Save current state
        const state = this.objects.map(obj => obj.toJSON())
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
           const newObject = this.createObjectFromData(clonedData)
           this.objects.push(newObject)
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

        this.saveState()
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--
            this.loadState(this.history[this.historyIndex])
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++
            this.loadState(this.history[this.historyIndex])
        }
    }
    
    loadState(stateStr) {
        const state = JSON.parse(stateStr)
        this.objects = state.map(data => this.createObjectFromData(data))
        this.clearSelection()
    }
    
    createObjectFromData(data) {
        const typeMap = {
            'stroke': Stroke,
            'rectangle': Rectangle,
            'circle': Circle,
            'line': Line,
            'text': Text
        }

        const ObjectClass = typeMap[data.type]
        if (ObjectClass) {
            return new ObjectClass(data.id, data.data)
        }
    }
    
    render(ctx) {
        this.objects.forEach(obj => obj.render(ctx))
    }
}


