import { Circle } from '../objects/Circle'
import { Tool } from './Tool'

export class CircleTool extends Tool {
    constructor(engine) {
        super(engine)
        this.startPoint = null
        this.currentCircle = null
        this.lastBounds = null
    }

    onMouseDown(worldPos, e) {
        this.startPoint = worldPos
        this.currentCircle = new Circle(null, {
            x1: worldPos.x,
            y1: worldPos.y,
            x2: worldPos.x,
            y2: worldPos.y,
            color: this.engine.currentColor,
            width: this.engine.currentWidth,
            fill: e.shiftKey ? this.engine.currentColor : null,
        })
        this.lastBounds = null
    }

    onMouseMove(worldPos, e) {
        if (this.currentCircle) {
            // Mark old bounds as dirty
            if (this.lastBounds) {
                this.engine.markDirty(this.lastBounds)
            }

            this.currentCircle.data.x2 = worldPos.x
            this.currentCircle.data.y2 = worldPos.y

            // Mark new bounds as dirty
            const newBounds = this.currentCircle.getBounds()
            this.engine.markDirty(newBounds)
            this.lastBounds = newBounds

            this.engine.render()
        }
    }

    onMouseUp(worldPos, e) {
        if (this.currentCircle) {
            const radius = Math.sqrt(
                Math.pow(this.currentCircle.data.x2 - this.currentCircle.data.x1, 2) +
                    Math.pow(this.currentCircle.data.y2 - this.currentCircle.data.y1, 2)
            )

            if (radius > 1) {
                // Mark final bounds as dirty
                const bounds = this.currentCircle.getBounds()
                this.engine.markDirty(bounds)
                this.engine.objectManager.addObject(this.currentCircle)
                if (this.engine.toolbar) {
                    this.engine.toolbar.updateUndoRedoButtons()
                }
            }

            this.currentCircle = null
            this.startPoint = null
            this.lastBounds = null
            this.engine.render()
        }
    }

    renderPreview(ctx) {
        if (this.currentCircle) {
            this.currentCircle.render(ctx)
        }
    }
}
