import { DrawingObject } from './DrawingObject'
import type { Point, Bounds, DrawingObjectData } from '../types'

interface ResizeHandle extends Point {
    cursor: string
}

export class Text extends DrawingObject {
    textWidth: number = 0
    textHeight: number = 0

    constructor(id: string | null, data: DrawingObjectData, zIndex: number) {
        super(id, 'text', data, zIndex)
        this.measureBounds()
    }

    measureBounds(): void {
        // Temp canvas for measurement
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const fontSize = (this.data.fontSize || 16)
        const fontFamily = (this.data as { fontFamily?: string }).fontFamily || 'Arial'
        ctx.font = `${fontSize}px ${fontFamily}`
        const metrics = ctx.measureText(this.data.text || '')

        this.textWidth = metrics.width
        this.textHeight = fontSize
    }

    override getBounds(): Bounds {
        return {
            x: this.data.x!,
            y: this.data.y! - this.textHeight,
            width: this.textWidth,
            height: this.textHeight * 1.2,
        }
    }

    override move(dx: number, dy: number): void {
        this.data.x! += dx
        this.data.y! += dy
    }

    override render(ctx: CanvasRenderingContext2D): void {
        const fontSize = (this.data.fontSize || 16)
        const fontFamily = (this.data as { fontFamily?: string }).fontFamily || 'Arial'
        ctx.font = `${fontSize}px ${fontFamily}`
        ctx.fillStyle = this.data.color || '#000000'
        ctx.textBaseline = 'alphabetic'

        if ((this.data as { bold?: boolean }).bold) {
            ctx.font = `bold ${ctx.font}`
        }
        if ((this.data as { italic?: boolean }).italic) {
            ctx.font = `italic ${ctx.font}`
        }

        ctx.fillText(this.data.text || '', this.data.x!, this.data.y!)

        if (this.selected) {
            this.renderSelection(ctx)
        }
    }

    override resize(_handleIndex: number, newX: number, newY: number, fixedPoint: Point, _initialBounds: Bounds): void {
        // Text only has corner handles, no side handles
        const fixedX = fixedPoint.x
        const fixedY = fixedPoint.y

        // Create new bounds from fixed point and cursor position
        const newBounds = {
            x: Math.min(fixedX, newX),
            y: Math.min(fixedY, newY),
            width: Math.max(1, Math.abs(newX - fixedX)),
            height: Math.max(1, Math.abs(newY - fixedY))
        }

        this.applyBounds(newBounds)
    }

    override applyBounds(newBounds: Bounds): void {
        const oldBounds = this.getBounds()
        const scale = newBounds.height / oldBounds.height

        this.data.fontSize = Math.max(8, Math.round((this.data.fontSize || 16) * scale))
        this.measureBounds()

        this.data.x = newBounds.x
        this.data.y = newBounds.y + this.textHeight
    }

    override getResizeHandles(): ResizeHandle[] {
        const bounds = this.getBounds()
        // Only corner handles
        return [
            { x: bounds.x, y: bounds.y, cursor: 'nw-resize' },
            { x: bounds.x + bounds.width, y: bounds.y, cursor: 'ne-resize' },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'se-resize' },
            { x: bounds.x, y: bounds.y + bounds.height, cursor: 'sw-resize' },
        ]
    }
}
