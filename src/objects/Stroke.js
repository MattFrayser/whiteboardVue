import { DrawingObject } from '../core/DrawingObject'
import { Coordinates } from '../core/Coordinates'

export class Stroke extends DrawingObject {
    constructor(id, data) {
        super(id, 'stroke', data)
        this.coordinates = new Coordinates()
    }
    
    getBounds() {
        if (this.data.points.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 }
        }
        
        let minX = Infinity, minY = Infinity
        let maxX = -Infinity, maxY = -Infinity
        
        this.data.points.forEach(point => {
            minX = Math.min(minX, point.x)
            minY = Math.min(minY, point.y)
            maxX = Math.max(maxX, point.x)
            maxY = Math.max(maxY, point.y)
        })
        
        const padding = this.data.width / 2
        return {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2
        } 
    }
    
    move(dx, dy) {
        this.data.points.forEach(point => {
            point.x += dx
            point.y += dy
        })
    }

    applyBounds(newBounds) {
        const oldBounds = this.getBounds()
        const scaleX = newBounds.width / oldBounds.width
        const scaleY = newBounds.height / oldBounds.height
        
        this.data.points = this.data.points.map(point => ({
            x: newBounds.x + (point.x - oldBounds.x) * scaleX,
            y: newBounds.y + (point.y - oldBounds.y) * scaleY
        }))
    }
    
    render(ctx) {
        if (this.data.points.length === 0) return

        ctx.strokeStyle = this.data.color
        ctx.lineWidth = this.data.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.beginPath()
        const firstPoint = this.data.points[0]
        ctx.moveTo(firstPoint.x, firstPoint.y)

        // Use quadratic curves for smooth lines
        for (let i = 1; i < this.data.points.length - 1; i++) {
            const p1 = this.data.points[i]
            const p2 = this.data.points[i + 1]
            const midX = (p1.x + p2.x) / 2
            const midY = (p1.y + p2.y) / 2
            ctx.quadraticCurveTo(p1.x, p1.y, midX, midY)
        }

        // Draw to the last point if there are multiple points
        if (this.data.points.length > 1) {
            const lastPoint = this.data.points[this.data.points.length - 1]
            ctx.lineTo(lastPoint.x, lastPoint.y)
        }

        ctx.stroke()

        if (this.selected) {
            this.renderSelection(ctx)
        }
    }
}

