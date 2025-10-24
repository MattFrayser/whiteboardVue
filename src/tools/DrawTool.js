import { Tool } from './Tool'
import { Stroke } from '../objects/Stroke'
import { simplifyStroke } from '../utils/simplify'

export class DrawTool extends Tool {
    constructor(engine) {
        super(engine)
        this.currentStroke = null
        this.isDrawing = false
        this.lastBounds = null
    }

    onMouseDown(worldPos, e) {
        this.isDrawing = true
        this.currentStroke = new Stroke(null, {
            points: [worldPos],
            color: this.engine.currentColor,
            width: this.engine.currentWidth
        })
        this.lastBounds = null
    }

    onMouseMove(worldPos, e) {
        if (this.isDrawing && this.currentStroke) {
            // Mark previous bounds as dirty
            if (this.lastBounds) {
                this.engine.markDirty(this.lastBounds, this.engine.currentWidth)
            }

            this.currentStroke.data.points.push(worldPos)

            // Mark new bounds as dirty
            const newBounds = this.currentStroke.getBounds()
            this.engine.markDirty(newBounds, this.engine.currentWidth)
            this.lastBounds = newBounds

            this.engine.render()
        }
    }

    onMouseUp(worldPos, e) {
        if (this.currentStroke && this.currentStroke.data.points.length > 1) {
            // Apply Douglas-Peucker simplification to reduce point count
            // Only simplify if we have more than 5 points (otherwise not worth it)
            if (this.currentStroke.data.points.length > 5) {
                const originalCount = this.currentStroke.data.points.length
                this.currentStroke.data.points = simplifyStroke(
                    this.currentStroke.data.points,
                    this.currentStroke.data.width,
                    3 // Minimum 3 points to preserve some curve detail
                )

                // Optional: Log simplification results for debugging
                if (originalCount !== this.currentStroke.data.points.length) {
                    console.debug(`Stroke simplified: ${originalCount} → ${this.currentStroke.data.points.length} points (${Math.round((1 - this.currentStroke.data.points.length / originalCount) * 100)}% reduction)`)
                }
            }

            // Mark final bounds as dirty
            const finalBounds = this.currentStroke.getBounds()
            this.engine.markDirty(finalBounds, this.engine.currentWidth)

            this.engine.objectManager.addObject(this.currentStroke)
            if (this.engine.toolbar) {
                this.engine.toolbar.updateUndoRedoButtons()
            }
        }
        this.currentStroke = null
        this.isDrawing = false
        this.lastBounds = null
        this.engine.render()
    }
    
    renderPreview(ctx) {
        if (this.currentStroke) {
            this.currentStroke.render(ctx)
        }
    }
}
