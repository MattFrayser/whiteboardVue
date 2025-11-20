import { DrawingObject } from '../DrawingObject'
import { DEFAULT_COLOR } from '../../../shared/constants'
import type { Bounds, RectangleData } from '../../../shared/types'
import type { Transform } from '../../transforms/Transform'
import type { ResizeConstraints } from '../../transforms/ResizeConstraints'
import { createDefaultConstraints } from '../../transforms/ResizeConstraints'
import { applyTransformToBounds } from '../../transforms/Transform'

export class Rectangle extends DrawingObject<RectangleData> {
    constructor(id: string | null, data: RectangleData, zIndex: number) {
        super(id, 'rectangle', data, zIndex)
    }

    override getBounds(): Bounds {
        return {
            x: Math.min(this.data.x1, this.data.x2),
            y: Math.min(this.data.y1, this.data.y2),
            width: Math.abs(this.data.x2 - this.data.x1),
            height: Math.abs(this.data.y2 - this.data.y1),
        }
    }

    override applyBounds(newBounds: Bounds): void {
        // Negative width/height = flipped
        this.data.x1 = newBounds.x
        this.data.y1 = newBounds.y
        this.data.x2 = newBounds.x + newBounds.width  // w < 0 || x2 < x1 = flip
        this.data.y2 = newBounds.y + newBounds.height // h< 0 || y2 < y1 = flip
    }

    override move(dx: number, dy: number): void {
        this.data.x1 += dx
        this.data.y1 += dy
        this.data.x2 += dx
        this.data.y2 += dy
    }

    /**
     * NEW TRANSFORM-BASED API
     */

    override getResizeConstraints(): ResizeConstraints {
        return createDefaultConstraints() // Free resize by default
    }

    override applyTransform(transform: Transform): void {
        const bounds = this.getBounds()
        const newBounds = applyTransformToBounds(bounds, transform)

        // Apply new bounds (supports flipping with negative width/height)
        this.data.x1 = newBounds.x
        this.data.y1 = newBounds.y
        this.data.x2 = newBounds.x + newBounds.width
        this.data.y2 = newBounds.y + newBounds.height
    }

    override render(ctx: CanvasRenderingContext2D): void {
        const bounds = this.getBounds()

        ctx.strokeStyle = this.data.color || DEFAULT_COLOR
        ctx.lineWidth = this.data.width || 2
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
