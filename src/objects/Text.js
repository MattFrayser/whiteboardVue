import { DrawingObject } from '../core/DrawingObject'

export class Text extends DrawingObject {
    constructor(id, data) {
        super(id, 'text', data)
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
            height: this.textHeight * 1.2
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

    setText(text) {
        this.data.text = text
        this.measureBounds()
    }
}
