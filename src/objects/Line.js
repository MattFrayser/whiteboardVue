import { DrawingObject } from '../core/DrawingObject'

export class Line extends DrawingObject {
    constructor(id, data) {
        super(id, 'line', data)
    }

    getBounds() {
        const padding = this.data.width / 2
        return {
            x: Math.min(this.data.x1, this.data.x2) - padding,
            y: Math.min(this.data.y1, this.data.y2) - padding,
            width: Math.abs(this.data.x2 - this.data.x1) + padding * 2,
            height: Math.abs(this.data.y2 - this.data.y1) + padding * 2
        }
    }

    containsPoint(point) {
        const distance = this.pointToLineDistance(
            point, 
            { x: this.data.x1, y: this.data.y1 },
            { x: this.data.x2, y: this.data.y2 }
        )

        return distance <= this.data.width + 5
    }

    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x
        const B = point.y - lineStart.y
        const C = lineEnd.x - lineStart.x
        const D = lineEnd.y - lineStart.y
        
        const dot = A * C + B * D
        const lenSq = C * C + D * D
        let param = -1
        
        if (lenSq !== 0) {
            param = dot / lenSq
        }
        
        let xx, yy
        
        if (param < 0) {
            xx = lineStart.x
            yy = lineStart.y
        } else if (param > 1) {
            xx = lineEnd.x
            yy = lineEnd.y
        } else {
            xx = lineStart.x + param * C
            yy = lineStart.y + param * D
        }
        
        const dx = point.x - xx
        const dy = point.y - yy
        
        return Math.sqrt(dx * dx + dy * dy)
    }

    move(dx, dy) {
        this.data.x1 += dx
        this.data.y1 += dy
        this.data.x2 += dx
        this.data.y2 += dy
    }

    applyBounds(newBounds) {
    const oldBounds = this.getBounds()
    const scaleX = newBounds.width / oldBounds.width
    const scaleY = newBounds.height / oldBounds.height
    
    this.data.x1 = newBounds.x + (this.data.x1 - oldBounds.x) * scaleX
    this.data.y1 = newBounds.y + (this.data.y1 - oldBounds.y) * scaleY
    this.data.x2 = newBounds.x + (this.data.x2 - oldBounds.x) * scaleX
    this.data.y2 = newBounds.y + (this.data.y2 - oldBounds.y) * scaleY
}

    render(ctx) {
        ctx.strokeStyle = this.data.color
        ctx.lineWidth = this.data.width
        ctx.lineCap = 'round'
        
        if (this.data.dashed) {
            ctx.setLineDash([this.data.width * 2, this.data.width])
        }
        
        ctx.beginPath()
        ctx.moveTo(this.data.x1, this.data.y1)
        ctx.lineTo(this.data.x2, this.data.y2)
        ctx.stroke()
        
        ctx.setLineDash([])
              
        if (this.selected) {
            this.renderSelection(ctx)
        }
    }
}
