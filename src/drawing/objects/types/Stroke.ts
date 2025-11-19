import { DrawingObject } from '../DrawingObject'
import { DEFAULT_COLOR } from '../../../shared/constants'
import type { Bounds, DrawingObjectData } from '../../../shared/types'
import { clampCoordinate, clampBrushSize, validateColor } from '../../../shared/validation'
export class Stroke extends DrawingObject {
    constructor(id: string | null, data: DrawingObjectData, zIndex: number) {
        // Defensive validation to prevent crashes from NaN/Infinity in render loop
        if (data.color) {
            data.color = validateColor(data.color)
        }
        if (typeof data.width === 'number') {
            data.width = clampBrushSize(data.width)
        }
        if (Array.isArray(data.points)) {
            data.points = data.points.map(point => ({
                x: clampCoordinate(point.x),
                y: clampCoordinate(point.y)
            }))
        }

        super(id, 'stroke', data, zIndex)
    }

    override getBounds(): Bounds {
        if (!this.data.points || this.data.points.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 }
        }

        let minX = Infinity,
            minY = Infinity
        let maxX = -Infinity,
            maxY = -Infinity

        this.data.points.forEach(point => {
            minX = Math.min(minX, point.x)
            minY = Math.min(minY, point.y)
            maxX = Math.max(maxX, point.x)
            maxY = Math.max(maxY, point.y)
        })

        const padding = (this.data.width || 2) / 2
        return {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2,
        }
    }

    override move(dx: number, dy: number): void {
        if (this.data.points) {
            this.data.points.forEach(point => {
                point.x += dx
                point.y += dy
            })
        }
    }

    override applyBounds(newBounds: Bounds): void {
        if (!this.data.points) return

        const oldBounds = this.getBounds()
        const scaleX = newBounds.width / oldBounds.width
        const scaleY = newBounds.height / oldBounds.height

        this.data.points = this.data.points.map(point => ({
            x: newBounds.x + (point.x - oldBounds.x) * scaleX,
            y: newBounds.y + (point.y - oldBounds.y) * scaleY,
        }))
    }

    override render(ctx: CanvasRenderingContext2D): void {
        if (!this.data.points || this.data.points.length === 0) {
            return
        }

        ctx.strokeStyle = this.data.color || DEFAULT_COLOR
        ctx.lineWidth = this.data.width || 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.beginPath()
        const firstPoint = this.data.points[0]
        if (!firstPoint) return
        ctx.moveTo(firstPoint.x, firstPoint.y)

        // Use quadratic curves for smooth lines
        for (let i = 1; i < this.data.points.length - 1; i++) {
            const p1 = this.data.points[i]
            const p2 = this.data.points[i + 1]
            if (!p1 || !p2) continue
            const midX = (p1.x + p2.x) / 2
            const midY = (p1.y + p2.y) / 2
            ctx.quadraticCurveTo(p1.x, p1.y, midX, midY)
        }

        // Draw to the last point if there are multiple points
        if (this.data.points.length > 1) {
            const lastPoint = this.data.points[this.data.points.length - 1]
            if (lastPoint) {
                ctx.lineTo(lastPoint.x, lastPoint.y)
            }
        }

        ctx.stroke()

        if (this.selected) {
            this.renderSelection(ctx)
        }
    }
}
