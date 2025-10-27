export class DrawingObject {
    constructor(id, type, data) {
        this.id = id || this.generateId()
        this.type = type
        this.data = data
        this.selected = false
        this.userId = null
        this.zIndex = 0
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2)
    }

    getBounds() {
        // Override in subclasses
        return { x: 0, y: 0, width: 0, height: 0 }
    }

    containsPoint(point) {
        const bounds = this.getBounds()
        return (
            point.x >= bounds.x &&
            point.x <= bounds.x + bounds.width &&
            point.y >= bounds.y &&
            point.y <= bounds.y + bounds.height
        )
    }

    move(dx, dy) {
        // Override in subclasses
    }

    applyBounds(newBounds, handleIndex) {
        // Override in subclasses
    }

    render(ctx) {
        // Override in subclasses
    }

    renderSelection(ctx) {
        const bounds = this.getBounds()
        ctx.strokeStyle = '#0066ff'
        ctx.lineWidth = 2 / ctx.getTransform().a
        ctx.setLineDash([5, 5])
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
        ctx.setLineDash([])

        // Render resize handles
        const handleSize = 12 / ctx.getTransform().a
        const handles = this.getResizeHandles()
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#0066ff'
        ctx.lineWidth = 2 / ctx.getTransform().a
        handles.forEach(handle => {
            ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            )
            ctx.strokeRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            )
        })
    }

    getResizeHandles() {
        const bounds = this.getBounds()
        return [
            { x: bounds.x, y: bounds.y, cursor: 'nw-resize' },
            { x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'n-resize' },
            { x: bounds.x + bounds.width, y: bounds.y, cursor: 'ne-resize' },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'e-resize' },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'se-resize' },
            { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 's-resize' },
            { x: bounds.x, y: bounds.y + bounds.height, cursor: 'sw-resize' },
            { x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'w-resize' },
        ]
    }

    resize(handleIndex, newX, newY) {
        const bounds = this.getBounds()

        const newBounds = { ...bounds }

        switch (handleIndex) {
            case 0: // north-west
                newBounds.x = newX
                newBounds.y = newY
                newBounds.width = bounds.x + bounds.width - newX
                newBounds.height = bounds.y + bounds.height - newY
                break
            case 1: // north
                newBounds.y = newY
                newBounds.height = bounds.y + bounds.height - newY
                break
            case 2: // north-east
                newBounds.y = newY
                newBounds.width = newX - bounds.x
                newBounds.height = bounds.y + bounds.height - newY
                break
            case 3: // east
                newBounds.width = newX - bounds.x
                break
            case 4: // south-east
                newBounds.width = newX - bounds.x
                newBounds.height = newY - bounds.y
                break
            case 5: // south
                newBounds.height = newY - bounds.y
                break
            case 6: // south-west
                newBounds.x = newX
                newBounds.width = bounds.x + bounds.width - newX
                newBounds.height = newY - bounds.y
                break
            case 7: // west
                newBounds.x = newX
                newBounds.width = bounds.x + bounds.width - newX
                break
        }

        // Prevent negative dimensions
        if (newBounds.width < 5) {
            newBounds.width = 5
            // Adjust x if needed to prevent flipping
            if (handleIndex === 0 || handleIndex === 6 || handleIndex === 7) {
                newBounds.x = bounds.x + bounds.width - 5
            }
        }
        if (newBounds.height < 5) {
            newBounds.height = 5
            // Adjust y if needed to prevent flipping
            if (handleIndex === 0 || handleIndex === 1 || handleIndex === 2) {
                newBounds.y = bounds.y + bounds.height - 5
            }
        }
        this.applyBounds(newBounds, handleIndex)
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            data: this.data,
            userId: this.userId,
            zIndex: this.zIndex,
        }
    }
}
