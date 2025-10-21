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

    resize(handleIndex, newX, newY) {
        const bounds = this.getBounds()
        let newBounds = {...bounds}

        switch (handleIndex) {
            case 0: // NW
                newBounds.x = newX
                newBounds.y = newY
                newBounds.width = bounds.x + bounds.width - newX
                newBounds.height = bounds.y + bounds.height - newY
                break
            case 1: // NE
                newBounds.y = newY
                newBounds.width = newX - bounds.x
                newBounds.height = bounds.y + bounds.height - newY
                break
            case 2: // SE
                newBounds.width = newX - bounds.x
                newBounds.height = newY - bounds.y
                break
            case 3: // SW
                newBounds.x = newX
                newBounds.width = bounds.x + bounds.width - newX
                newBounds.height = newY - bounds.y
                break
        }

        // Prevent negative dimensions
        if (newBounds.width < 5) {
            newBounds.width = 5
            if (handleIndex === 0 || handleIndex === 3) {
                newBounds.x = bounds.x + bounds.width - 5
            }
        }
        if (newBounds.height < 5) {
            newBounds.height = 5
            if (handleIndex === 0 || handleIndex === 1) {
                newBounds.y = bounds.y + bounds.height - 5
            }
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
