import { Line } from '../objects/Line'
import { Tool } from './Tool'

export class LineTool extends Tool {
    constructor(engine) {
        super(engine)
        this.lastBounds = null
    }

    onMouseDown(worldPos, e) {
        this.startPoint = worldPos
        this.currentLine = new Line(null, {
            x1: worldPos.x,
            y1: worldPos.y,
            x2: worldPos.x,
            y2: worldPos.y,
            color: this.engine.currentColor,
            width: this.engine.currentWidth,
        })
        this.lastBounds = null
    }

    onMouseMove(worldPos, e) {
        if (this.currentLine) {
            // Mark old bounds as dirty
            if (this.lastBounds) {
                this.engine.markDirty(this.lastBounds)
            }

            this.currentLine.data.x2 = worldPos.x
            this.currentLine.data.y2 = worldPos.y

            // Mark new bounds as dirty
            const newBounds = this.currentLine.getBounds()
            this.engine.markDirty(newBounds)
            this.lastBounds = newBounds
        }
        this.engine.render()
    }

    onMouseUp(worldPos, e) {
        if (this.currentLine) {
            const length = Math.sqrt(
                Math.pow(this.currentLine.data.x2 - this.currentLine.data.x1, 2) +
                    Math.pow(this.currentLine.data.y2 - this.currentLine.data.y1, 2)
            )
            if (length > 1) {
                // Mark final bounds as dirty
                const bounds = this.currentLine.getBounds()
                this.engine.markDirty(bounds)
                this.engine.objectManager.addObject(this.currentLine)
            }
            this.currentLine = null
            this.startPoint = null
            this.lastBounds = null
            this.engine.render()
        }
    }

    renderPreview(ctx) {
        if (this.currentLine) {
            this.currentLine.render(ctx)
        }
    }
}
