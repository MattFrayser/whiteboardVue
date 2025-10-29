import { DrawingObject } from './DrawingObject'

export class Text extends DrawingObject {
    constructor(id, data, zIndex) {
        super(id, 'text', data, zIndex)
        this.measureBounds()
    }

    measureBounds() {
        // Temp canvas for measurement
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        ctx.font = `${this.data.fontSize}px ${this.data.fontFamily}`
        const metrics = ctx.measureText(this.data.text)

        this.textWidth = metrics.width
        this.textHeight = this.data.fontSize
    }

    getBounds() {
        return {
            x: this.data.x,
            y: this.data.y - this.textHeight,
            width: this.textWidth,
            height: this.textHeight * 1.2,
        }
    }

    move(dx, dy) {
        this.data.x += dx
        this.data.y += dy
    }

    render(ctx) {
        ctx.font = `${this.data.fontSize}px ${this.data.fontFamily}`
        ctx.fillStyle = this.data.color
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

    resize(handleIndex, newX, newY, fixedPoint, initialBounds) {
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

        this.applyBounds(newBounds, handleIndex)
    }

    applyBounds(newBounds) {
        const oldBounds = this.getBounds()
        const scale = newBounds.height / oldBounds.height

        this.data.fontSize = Math.max(8, Math.round(this.data.fontSize * scale))
        this.measureBounds()

        this.data.x = newBounds.x
        this.data.y = newBounds.y + this.textHeight
    }

    getResizeHandles() {
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
