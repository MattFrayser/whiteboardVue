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

        this.isSelecting = false
        this.selectionStart = null
        this.selectionEnd = null

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

        // Hovering over a resize handle
        if (this.engine.objectManager.selectedObjects.length === 1) {
            const obj = this.engine.objectManager.selectedObjects[0]
            const handleIndex = this.getHandleAt(worldPos, obj)

            if (handleIndex !== -1) {
                const handles = obj.getResizeHandles()
                this.engine.canvas.style.cursor = handles[handleIndex].cursor
                return
            }
        }

        // Hovering over an object
        const object = this.engine.objectManager.getObjectAt(worldPos)
        if (object) {
            this.engine.canvas.style.cursor = 'move'
        } else {
            // Use custom select cursor when not hovering over anything
            this.engine.canvas.style.cursor = 'url(/select-cursor.svg) 2 2, pointer'
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
            // select Drag 
            if (!e.shiftKey) {
                this.engine.objectManager.clearSelection()
            }
            this.isSelecting = true
            this.selectionStart = worldPos
            this.selectionEnd = worldPos
        }

        this.engine.render()
}

    onMouseMove(worldPos, e) {
        // Resize
        if (this.isResizing) {
            // Mark old bounds as dirty
            const oldBounds = this.resizeObject.getBounds()
            this.engine.markDirty(oldBounds)

            this.resizeObject.resize(this.resizeHandleIndex, worldPos.x, worldPos.y)

            // Mark new bounds as dirty
            const newBounds = this.resizeObject.getBounds()
            this.engine.markDirty(newBounds)

            this.engine.render()

            // Keep cursor during resize
            const handles = this.resizeObject.getResizeHandles()
            this.engine.canvas.style.cursor = handles[this.resizeHandleIndex].cursor
            return
        }

        // Drag Selection
        if (this.isSelecting) {
            // Mark old selection rectangle as dirty
            if (this.selectionEnd) {
                const oldRect = this.getSelectionRect()
                this.engine.markDirty(oldRect)
            }

            this.selectionEnd = worldPos

            // Mark new selection rectangle as dirty
            const newRect = this.getSelectionRect()
            this.engine.markDirty(newRect)

            this.engine.canvas.style.cursor = 'crosshair'
            this.engine.render()
            return
        }

        // Moving
        if (this.isDragging && this.dragStart) {
            // Mark old positions as dirty
            this.engine.objectManager.selectedObjects.forEach(obj => {
                const bounds = obj.getBounds()
                this.engine.markDirty(bounds)
            })

            const dx = worldPos.x - this.dragStart.x
            const dy = worldPos.y - this.dragStart.y

            this.engine.objectManager.selectedObjects.forEach(obj => {
                obj.move(dx, dy)
            })

            // Mark new positions as dirty
            this.engine.objectManager.selectedObjects.forEach(obj => {
                const bounds = obj.getBounds()
                this.engine.markDirty(bounds)
            })

            this.dragStart = worldPos
            this.engine.canvas.style.cursor = 'move'
            this.engine.render()
        }
    }

    onMouseUp(worldPos, e) {
        if (this.isResizing || this.isDragging) {
            // Update quadtree for moved/resized objects
            if (this.isDragging) {
                // Note: Objects already moved, just need to update quadtree
                // ObjectManager.moveSelected() handles this, but in SelectTool we move directly
                // So we need to rebuild the quadtree for these objects
                this.engine.objectManager.selectedObjects.forEach(obj => {
                    // The object has already moved, we just need to update the quadtree
                    // Use a dummy old bounds - quadtree will handle it
                    this.engine.objectManager.quadtree.remove(obj, obj.getBounds())
                    this.engine.objectManager.quadtree.insert(obj, obj.getBounds())
                })
                this.engine.objectManager.broadcast('update', this.engine.objectManager.selectedObjects)
            }
            if (this.isResizing && this.resizeObject) {
                // Update quadtree for resized object
                this.engine.objectManager.quadtree.remove(this.resizeObject, this.resizeObject.getBounds())
                this.engine.objectManager.quadtree.insert(this.resizeObject, this.resizeObject.getBounds())
                this.engine.objectManager.broadcast('update', this.resizeObject)
            }

            // Mark final positions as dirty
            this.engine.objectManager.selectedObjects.forEach(obj => {
                this.engine.markDirty(obj.getBounds())
            })

            this.engine.objectManager.saveState()
            if (this.engine.toolbar) {
                this.engine.toolbar.updateUndoRedoButtons()
            }
        }

        // Finish drag selection
        if (this.isSelecting) {
            // Mark final selection rect as dirty
            const rect = this.getSelectionRect()
            this.engine.markDirty(rect)

            this.engine.objectManager.selectObjectsInRect(rect, e.shiftKey)
            this.isSelecting = false
            this.selectionStart = null
            this.selectionEnd = null
            this.engine.render()
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

        const clickableSize = 20 / this.engine.coordinates.scale   // Larger clickable area
        const halfSize = clickableSize / 2

        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i]

            // Use rectangle 
            if (point.x >= handle.x - halfSize &&
                point.x <= handle.x + halfSize &&
                point.y >= handle.y - halfSize &&
                point.y <= handle.y + halfSize) {
                return i
            }
        }

        return -1
    }

    getSelectionRect() {
        if (!this.selectionStart || !this.selectionEnd) return null

        const x = Math.min(this.selectionStart.x, this.selectionEnd.x)
        const y = Math.min(this.selectionStart.y, this.selectionEnd.y)
        const width = Math.abs(this.selectionEnd.x - this.selectionStart.x)
        const height = Math.abs(this.selectionEnd.y - this.selectionStart.y)

        return { x, y, width, height }
    }

    renderPreview(ctx) {
        if (this.isSelecting && this.selectionStart && this.selectionEnd) {
            const rect = this.getSelectionRect()

            ctx.strokeStyle = '#0066ff'
            ctx.fillStyle = 'rgba(0, 102, 255, 0.1)'
            ctx.lineWidth = 1 / ctx.getTransform().a
            ctx.setLineDash([5, 5])

            ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

            ctx.setLineDash([])
        }
    }

}
