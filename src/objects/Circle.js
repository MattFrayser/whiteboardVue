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
    
    applyBounds(newBounds, handleIndex) {
        // For side handles, use the dimension being changed (not the fixed one)
        let size
        const isSideHandle = handleIndex !== undefined && [1, 3, 5, 7].includes(handleIndex)

        if (isSideHandle) {
            // For side handles, use the dimension that's being actively changed
            if (handleIndex === 1 || handleIndex === 5) {
                // North or South: height is being changed
                size = newBounds.height
            } else {
                // East or West: width is being changed
                size = newBounds.width
            }
        } else {
            // For corner handles, use the larger dimension to maintain circle
            size = Math.max(newBounds.width, newBounds.height)
        }

        const radius = size / 2

        let centerX, centerY

        if (handleIndex !== undefined) {
            // Lock the opposite corner/edge based on which handle is being dragged
            switch(handleIndex) {
                case 0: // nw - lock se corner
                    centerX = newBounds.x + newBounds.width - radius
                    centerY = newBounds.y + newBounds.height - radius
                    break
                case 1: // n - lock bottom edge
                    centerX = newBounds.x + newBounds.width / 2
                    centerY = newBounds.y + newBounds.height - radius
                    break
                case 2: // ne - lock sw corner
                    centerX = newBounds.x + radius
                    centerY = newBounds.y + newBounds.height - radius
                    break
                case 3: // e - lock left edge
                    centerX = newBounds.x + radius
                    centerY = newBounds.y + newBounds.height / 2
                    break
                case 4: // se - lock nw corner
                    centerX = newBounds.x + radius
                    centerY = newBounds.y + radius
                    break
                case 5: // s - lock top edge
                    centerX = newBounds.x + newBounds.width / 2
                    centerY = newBounds.y + radius
                    break
                case 6: // sw - lock ne corner
                    centerX = newBounds.x + newBounds.width - radius
                    centerY = newBounds.y + radius
                    break
                case 7: // w - lock right edge
                    centerX = newBounds.x + newBounds.width - radius
                    centerY = newBounds.y + newBounds.height / 2
                    break
                default:
                    centerX = newBounds.x + newBounds.width / 2
                    centerY = newBounds.y + newBounds.height / 2
            }
        } else {
            // Default: center in bounds
            centerX = newBounds.x + newBounds.width / 2
            centerY = newBounds.y + newBounds.height / 2
        }

        // Update center position
        this.data.x1 = centerX
        this.data.y1 = centerY

        // Update radius point (to the right of center)
        this.data.x2 = centerX + radius
        this.data.y2 = centerY
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
