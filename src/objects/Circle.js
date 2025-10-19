import { DrawingObject } from '../core/DrawingObject'

export class Circle extends DrawingObject {
    constructor(id, data) {
        super(id, 'circle', data)
    }

    getBounds() {
        const radius = Math.sqrt(
            Math.pow(this.data.x2 - this.data.x1, 2) +
            Math.pow(this.data.y2 - this.data.y1, 2) 
        )
        return {
            x: this.data.x1 - radius,
            y: this.data.y1 - radius,
            width: radius * 2,
            height: radius * 2
        }
    }

    containsPoint(point) {
        const radius = Math.sqrt(
            Math.pow(this.data.x2 - this.data.x1, 2) +
            Math.pow(this.data.y2 - this.data.y1, 2)
        )
        const distance = Math.sqrt(
            Math.pow(point.x - this.data.x1, 2) +
            Math.pow(point.y - this.data.y1, 2)
        )

        return distance <= radius
    }

    move(dx, dy) {
        this.data.x1 += dx
        this.data.y1 += dy
        this.data.x2 += dx
        this.data.y2 += dy

    }

    render(ctx) {
        const radius = Math.sqrt(
            Math.pow(this.data.x2 - this.data.x1, 2) +
            Math.pow(this.data.y2 - this.data.y1, 2) 
        )

        ctx.strokeStyle = this.data.color
        ctx.lineWidth = this.data.width
        ctx.fillStyle = this.data.fill || 'transparent'

        ctx.beginPath()
        ctx.arc(this.data.x1, this.data.y1, radius, 0, Math.PI * 2)

        if (this.data.fill) {
            ctx.fill()
        }
        ctx.stroke()

        if (this.selected) {
            this.renderSelection(ctx)
        }
    }
}
