// src/core/ObjectManager.js
import { Stroke } from '../objects/Stroke'
import { Rectangle } from '../objects/Rectangle'
import { Circle } from '../objects/Circle'
import { Line } from '../objects/Line'
import { Text } from '../objects/Text'

export class ObjectManager {
    constructor() {
        this.objects = []
        this.selectedObjects = []
        this.history = ['[]']  
        this.historyIndex = 0
        this.clipboard = []
    }
    
    addObject(object) {
        this.objects.push(object)
        this.saveState()
        return object
    }
    
    removeObject(object) {
        const index = this.objects.indexOf(object)
        if (index > -1) {
            this.objects.splice(index, 1)
            this.saveState()
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
        this.selectedObjects.forEach(obj => {
            const index = this.objects.indexOf(obj)
            if (index > -1) {
                this.objects.splice(index, 1)
            }
        })
        this.clearSelection()
        this.saveState()
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


