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
        return point.x >= bounds.x &&
               point.x <= bounds.x + bounds.width &&
               point.y >= bounds.y &&
               point.y <= bounds.y + bounds.height
    }
    
    move(dx, dy) {
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
        const handleSize = 8 / ctx.getTransform().a
        const handles = this.getResizeHandles()
        ctx.fillStyle = '#0066ff'
        handles.forEach(handle => {
            ctx.fillRect(
                handle.x - handleSize/2,
                handle.y - handleSize/2,
                handleSize,
                handleSize
            )
        })
    }
    
    getResizeHandles() {
        const bounds = this.getBounds()
        return [
            { x: bounds.x, y: bounds.y, cursor: 'nw-resize' },
            { x: bounds.x + bounds.width/2, y: bounds.y, cursor: 'n-resize' },
            { x: bounds.x + bounds.width, y: bounds.y, cursor: 'ne-resize' },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height/2, cursor: 'e-resize' },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'se-resize' },
            { x: bounds.x + bounds.width/2, y: bounds.y + bounds.height, cursor: 's-resize' },
            { x: bounds.x, y: bounds.y + bounds.height, cursor: 'sw-resize' },
            { x: bounds.x, y: bounds.y + bounds.height/2, cursor: 'w-resize' }
        ]
    }
    
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            data: this.data,
            userId: this.userId,
            zIndex: this.zIndex
        }
    }
}
