import { Tool } from "./Tool";

export class SelectTool extends Tool {
    constructor(engine) {
        super(engine)
        this.dragStart = null
        this.isDragging = false
        this.dragOffset = null

        this.isResizing = false
        this.resizeHandleIndex = null
        this.resizeObject = null

        this.setupMouseMoveListener()
    }

    setupMouseMoveListener() {
        this.engine.canvas.addEventListener('mousemove', (e) => {
            if (!this.isActive()) return

            const worldPos = this.engine.coordinates.viewportToWorld(
                { x: e.clientX, y: e.clientY },
                this.engine.canvas
            )

            this.updateCursor(worldPos)
        })
    }

    isActive() {
        return this.engine.currentTool === this
    }

    updateCursor(worldPos) {
        // Don't change cursor while dragging or resizing
        if (this.isDragging || this.isResizing) return

        // Check if hovering over a resize handle
        if (this.engine.objectManager.selectedObjects.length === 1) {
            const obj = this.engine.objectManager.selectedObjects[0]
            const handleIndex = this.getHandleAt(worldPos, obj)

            if (handleIndex !== -1) {
                const handles = obj.getResizeHandles()
                this.engine.canvas.style.cursor = handles[handleIndex].cursor
                return
            }
        }

        // Check if hovering over an object
        const object = this.engine.objectManager.getObjectAt(worldPos)
        if (object) {
            this.engine.canvas.style.cursor = 'move'
        } else {
            this.engine.canvas.style.cursor = 'default'
        }
    }

    onMouseDown(worldPos, e) {
        // Resize handles?
        if (this.engine.objectManager.selectedObjects.length === 1) {
            const obj = this.engine.objectManager.selectedObjects[0]
            const handleIndex = this.getHandleAt(worldPos, obj)

            if (handleIndex != -1) {
                this.isResizing = true
                this.resizeHandleIndex = handleIndex
                this.resizeObject = obj
                this.dragStart = worldPos
                return
            }
        }

        // Normal selection 
        const object = this.engine.objectManager.getObjectAt(worldPos)

        if (object) {
            if (!object.selected) {
                this.engine.objectManager.selectObject(object, e.shiftKey)
            }
            this.dragStart = worldPos
            this.isDragging = true
        } else {
            this.engine.objectManager.clearSelection()
        }

        this.engine.render()
}

    onMouseMove(worldPos, e) {
        // Resize
        if (this.isResizing) {
            this.resizeObject.resize(this.resizeHandleIndex, worldPos.x, worldPos.y)
            this.engine.render()

            // Keep cursor during resize
            const handles = this.resizeObject.getResizeHandles()
            this.engine.canvas.style.cursor = handles[this.resizeHandleIndex].cursor
            return
        }

        // Moving
        if (this.isDragging && this.dragStart) {
            const dx = worldPos.x - this.dragStart.x
            const dy = worldPos.y - this.dragStart.y

            this.engine.objectManager.selectedObjects.forEach(obj => {
                obj.move(dx, dy)
            })

            this.dragStart = worldPos
            this.engine.canvas.style.cursor = 'move'
            this.engine.render()
        }
    }

    onMouseUp(worldPos, e) {
        if (this.isResizing || this.isDragging) {
            this.engine.objectManager.saveState()
            if (this.engine.toolbar) {
                this.engine.toolbar.updateUndoRedoButtons()
            }
        }
        this.isDragging = false
        this.dragStart = null

        this.isResizing = false
        this.resizeHandleIndex = null
        this.resizeObject = null

        // Update cursor after mouse up
        this.updateCursor(worldPos)
    }

    getHandleAt(point, obj) {
        const handles = obj.getResizeHandles()
        // Visual handle size is 12px, but make clickable area larger for easier interaction
        const visualHandleSize = 12 / this.engine.coordinates.scale
        const clickableSize = 20 / this.engine.coordinates.scale  // Larger clickable area
        const halfSize = clickableSize / 2

        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i]

            // Use rectangular (square) hit test with larger clickable area
            if (point.x >= handle.x - halfSize &&
                point.x <= handle.x + halfSize &&
                point.y >= handle.y - halfSize &&
                point.y <= handle.y + halfSize) {
                return i
            }
        }

        return -1

    }

}
