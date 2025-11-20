import { DrawingObject } from '../DrawingObject'
import { DEFAULT_COLOR, MIN_FONT_SIZE } from '../../../shared/constants'
import type { Point, Bounds, TextData, ResizeHandle } from '../../../shared/types'
import type { Transform } from '../../transforms/Transform'
import type { ResizeConstraints } from '../../transforms/ResizeConstraints'
import { createDefaultConstraints } from '../../transforms/ResizeConstraints'
import { applyTransformToBounds } from '../../transforms/Transform'

export class Text extends DrawingObject<TextData> {
    textWidth: number = 0
    textHeight: number = 0

    constructor(id: string | null, data: TextData, zIndex: number) {
        super(id, 'text', data, zIndex)
        this.measureBounds()
    }

    measureBounds(): void {
        // Temp canvas for measurement
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const fontSize = this.data.fontSize || 16
        const fontFamily = this.data.fontFamily || 'Arial'
        ctx.font = `${fontSize}px ${fontFamily}`
        const metrics = ctx.measureText(this.data.text)

        this.textWidth = metrics.width
        this.textHeight = fontSize
    }

    override getBounds(): Bounds {
        return {
            x: this.data.x,
            y: this.data.y - this.textHeight,
            width: this.textWidth,
            height: this.textHeight * 1.2,
        }
    }

    override move(dx: number, dy: number): void {
        this.data.x += dx
        this.data.y += dy
    }

    override render(ctx: CanvasRenderingContext2D): void {
        const fontSize = this.data.fontSize || 16
        const fontFamily = this.data.fontFamily || 'Arial'
        ctx.font = `${fontSize}px ${fontFamily}`
        ctx.fillStyle = this.data.color || DEFAULT_COLOR
        ctx.textBaseline = 'alphabetic'

        if (this.data.bold) {
            ctx.font = `bold ${ctx.font}`
        }
        if (this.data.italic) {
            ctx.font = `italic ${ctx.font}`
        }

        ctx.fillText(this.data.text, this.data.x, this.data.y)

        if (this.selected) {
            this.renderSelection(ctx)
        }
    }

    override resize(
        _handleIndex: number,
        newX: number,
        newY: number,
        fixedPoint: Point,
        _initialBounds: Bounds
    ): void {
        // Text only has corner handles, no side handles
        const fixedX = fixedPoint.x
        const fixedY = fixedPoint.y

        // Create new bounds from fixed point and cursor position
        const newBounds = {
            x: Math.min(fixedX, newX),
            y: Math.min(fixedY, newY),
            width: Math.max(1, Math.abs(newX - fixedX)),
            height: Math.max(1, Math.abs(newY - fixedY)),
        }

        this.applyBounds(newBounds)
    }

    override applyBounds(newBounds: Bounds): void {
        const oldBounds = this.getBounds()
        
        // Normalize dimensions, dont see any uses for flipping text
        const normalizedBounds = {
            x: newBounds.width < 0 ? newBounds.x + newBounds.width : newBounds.x,
            y: newBounds.height < 0 ? newBounds.y + newBounds.height : newBounds.y,
            width: Math.abs(newBounds.width),
            height: Math.abs(newBounds.height)
        }
        
        const scaleX = normalizedBounds.width / oldBounds.width
        const scaleY = normalizedBounds.height / oldBounds.height
        const scale = Math.max(scaleX, scaleY)

        this.data.fontSize = Math.max(MIN_FONT_SIZE, Math.round((this.data.fontSize || 16) * scale))
        this.measureBounds()

        this.data.x = normalizedBounds.x
        this.data.y = normalizedBounds.y + this.textHeight
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

    /**
     * NEW TRANSFORM-BASED API
     */

    override getResizeConstraints(): ResizeConstraints {
        const constraints = createDefaultConstraints()
        constraints.lockAspectRatio = true // Maintain proportions by default
        constraints.resizeFont = true // Resize font size
        return constraints
    }

    override applyTransform(transform: Transform): void {
        const oldBounds = this.getBounds()
        const newBounds = applyTransformToBounds(oldBounds, transform)

        // Calculate scale factor (use max to maintain aspect ratio)
        const scaleX = Math.abs(newBounds.width / oldBounds.width)
        const scaleY = Math.abs(newBounds.height / oldBounds.height)
        const scale = Math.max(scaleX, scaleY)

        // Resize font
        this.data.fontSize = Math.max(MIN_FONT_SIZE, Math.round((this.data.fontSize || 16) * scale))
        this.measureBounds()

        // Update position
        this.data.x = newBounds.x
        this.data.y = newBounds.y + this.textHeight
    }
}
