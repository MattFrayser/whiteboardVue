import { DrawingObject } from "../core/DrawingObject";

export class Rectangle extends DrawingObject {
    constructor(id, data) {
        super(id, 'rectangle', data)
    }

    getBounds() {
        return {
            x: Math.min(this.data.x1, this.data.x2),
            y: Math.min(this.data.y1, this.data.y2),
            width: Math.abs(this.data.x2 - this.data.x1),
            height: Math.abs(this.data.y2 - this.data.y1)
        }
    }
    
    move() {
      this.data.x1 += dx
      this.data.y1 += dy
      this.data.x2 += dx
      this.data.y2 += dy
    }

    render() {
        const bounds = this.getBounds()

        ctx.strokeStyle = this.data.color
        ctx.lineWidth = this.data.width
        ctx.fillStyle = this.data.fill || 'transparent'

        if (this.data.fill) {
            ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
        }
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)

        if (this.selected) {
            this.renderSelection(ctx)
        }
    }
}
