import { DrawingObject } from './DrawingObject'

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
            height: Math.abs(this.data.y2 - this.data.y1) + padding * 2,
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

    resize(handleIndex, newX, newY) {
        // Override resize to handle padding correctly
        const padding = this.data.width / 2
        const bounds = this.getBounds()
        const newBounds = { ...bounds }

        // Calculate new visual bounds based on handle dragging
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
        const minVisualSize = padding * 2 + 5

        if (newBounds.width < minVisualSize) {
            newBounds.width = minVisualSize
            if (handleIndex === 0 || handleIndex === 6 || handleIndex === 7) {
                newBounds.x = bounds.x + bounds.width - minVisualSize
            }
        }
        if (newBounds.height < minVisualSize) {
            newBounds.height = minVisualSize
            if (handleIndex === 0 || handleIndex === 1 || handleIndex === 2) {
                newBounds.y = bounds.y + bounds.height - minVisualSize
            }
        }

        // Convert visual bounds to content bounds (remove padding)
        const contentBounds = {
            x: newBounds.x + padding,
            y: newBounds.y + padding,
            width: newBounds.width - padding * 2,
            height: newBounds.height - padding * 2,
        }

        this.applyBounds(contentBounds)
    }

    applyBounds(newBounds) {
        // applyBounds expects content bounds (no padding)
        const padding = this.data.width / 2
        const oldBounds = this.getBounds()

        // Extract old content area (remove padding from visual bounds)
        const oldContentX = oldBounds.x + padding
        const oldContentY = oldBounds.y + padding
        const oldContentWidth = oldBounds.width - padding * 2
        const oldContentHeight = oldBounds.height - padding * 2

        // Calculate scale based on content dimensions
        const scaleX = newBounds.width / oldContentWidth
        const scaleY = newBounds.height / oldContentHeight

        // Apply transformation to line endpoints
        this.data.x1 = newBounds.x + (this.data.x1 - oldContentX) * scaleX
        this.data.y1 = newBounds.y + (this.data.y1 - oldContentY) * scaleY
        this.data.x2 = newBounds.x + (this.data.x2 - oldContentX) * scaleX
        this.data.y2 = newBounds.y + (this.data.y2 - oldContentY) * scaleY
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
