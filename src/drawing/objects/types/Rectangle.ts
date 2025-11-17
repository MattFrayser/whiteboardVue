import { DrawingObject } from '../DrawingObject'
import { DEFAULT_COLOR } from '../../../shared/constants'
import type { Bounds, DrawingObjectData } from '../../../shared/types'

export class Rectangle extends DrawingObject {
    constructor(id: string | null, data: DrawingObjectData, zIndex: number) {
        super(id, 'rectangle', data, zIndex)
    }

    override getBounds(): Bounds {
        return {
            x: Math.min(this.data.x1!, this.data.x2!),
            y: Math.min(this.data.y1!, this.data.y2!),
            width: Math.abs(this.data.x2! - this.data.x1!),
            height: Math.abs(this.data.y2! - this.data.y1!),
        }
    }

    override applyBounds(newBounds: Bounds): void {
        this.data.x1 = newBounds.x
        this.data.y1 = newBounds.y
        this.data.x2 = newBounds.x + newBounds.width
        this.data.y2 = newBounds.y + newBounds.height
    }

    override move(dx: number, dy: number): void {
        this.data.x1! += dx
        this.data.y1! += dy
        this.data.x2! += dx
        this.data.y2! += dy
    }

    override render(ctx: CanvasRenderingContext2D): void {
        const bounds = this.getBounds()

        ctx.strokeStyle = this.data.color || DEFAULT_COLOR
        ctx.lineWidth = this.data.width || 2
        ctx.fillStyle = (this.data as { fill?: string }).fill || 'transparent'

        if ((this.data as { fill?: string }).fill) {
            ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
        }
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)

        if (this.selected) {
            this.renderSelection(ctx)
        }
    }
}
