import { DrawingObject } from '../DrawingObject'
import { DEFAULT_COLOR, LINE_CLICK_TOLERANCE } from '../../../shared/constants'
import type { Point, Bounds, LineData } from '../../../shared/types'
import type { Transform } from '../../transforms/Transform'
import type { ResizeConstraints } from '../../transforms/ResizeConstraints'
import { createDefaultConstraints } from '../../transforms/ResizeConstraints'
import { applyTransformToPoint } from '../../transforms/Transform'

export class Line extends DrawingObject<LineData> {
    constructor(id: string | null, data: LineData, zIndex: number) {
        super(id, 'line', data, zIndex)
    }

    override getBounds(): Bounds {
        const padding = (this.data.width || 2) / 2
        return {
            x: Math.min(this.data.x1, this.data.x2) - padding,
            y: Math.min(this.data.y1, this.data.y2) - padding,
            width: Math.abs(this.data.x2 - this.data.x1) + padding * 2,
            height: Math.abs(this.data.y2 - this.data.y1) + padding * 2,
        }
    }

    override containsPoint(point: Point): boolean {
        const distance = this.pointToLineDistance(
            point,
            { x: this.data.x1, y: this.data.y1 },
            { x: this.data.x2, y: this.data.y2 }
        )

        return distance <= (this.data.width || 2) + LINE_CLICK_TOLERANCE
    }

    pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
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

        let xx: number, yy: number

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

    override move(dx: number, dy: number): void {
        this.data.x1 += dx
        this.data.y1 += dy
        this.data.x2 += dx
        this.data.y2 += dy
    }

    override resize(
        handleIndex: number,
        newX: number,
        newY: number,
        fixedPoint: Point,
        initialBounds: Bounds
    ): void {
        // Use parent's calculation, then adjust for padding
        const visualBounds = this.calculateResizedBounds(
            handleIndex,
            newX,
            newY,
            fixedPoint,
            initialBounds
        )
        const padding = (this.data.width || 2) / 2

        // Convert visual bounds to content bounds (remove padding)
        const contentBounds = {
            x: visualBounds.x + padding,
            y: visualBounds.y + padding,
            width: Math.max(1, visualBounds.width - padding * 2),
            height: Math.max(1, visualBounds.height - padding * 2),
        }

        this.applyBounds(contentBounds)
    }

    override applyBounds(newBounds: Bounds): void {
        // applyBounds expects content bounds (no padding)
        const padding = (this.data.width || 2) / 2
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

    /**
     * NEW TRANSFORM-BASED API
     */

    override getResizeConstraints(): ResizeConstraints {
        return createDefaultConstraints() // Free resize
    }

    override applyTransform(transform: Transform): void {
        // Transform both endpoints of the line
        const p1 = applyTransformToPoint({ x: this.data.x1, y: this.data.y1 }, transform)
        const p2 = applyTransformToPoint({ x: this.data.x2, y: this.data.y2 }, transform)

        this.data.x1 = p1.x
        this.data.y1 = p1.y
        this.data.x2 = p2.x
        this.data.y2 = p2.y
    }

    override render(ctx: CanvasRenderingContext2D): void {
        ctx.strokeStyle = this.data.color || DEFAULT_COLOR
        ctx.lineWidth = this.data.width || 2
        ctx.lineCap = 'round'

        // Check for dashed property (optional, stored via index signature)
        if (this.data.dashed) {
            ctx.setLineDash([(this.data.width || 2) * 2, this.data.width || 2])
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
