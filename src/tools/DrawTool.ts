import { Stroke } from '../objects/Stroke'
import { simplifyStroke } from '../utils/simplify'
import { Tool } from './Tool'
import type { Point, Bounds } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'

export class DrawTool extends Tool {
    currentStroke: Stroke | null
    isDrawing: boolean
    lastBounds: Bounds | null

    constructor(engine: DrawingEngine) {
        super(engine)
        this.currentStroke = null
        this.isDrawing = false
        this.lastBounds = null
    }

    override onMouseDown(worldPos: Point, _e: MouseEvent): void {
        this.isDrawing = true
        this.currentStroke = new Stroke(null, {
            id: '',
            type: 'stroke',
            x: worldPos.x,
            y: worldPos.y,
            points: [worldPos],
            color: this.engine.currentColor,
            width: this.engine.currentWidth,
        }, 0)
        this.lastBounds = null
    }

    override onMouseMove(worldPos: Point, _e: MouseEvent): void {
        if (this.isDrawing && this.currentStroke) {
            // Mark previous bounds as dirty
            if (this.lastBounds) {
                this.engine.markDirty()
            }

            this.currentStroke.data.points!.push(worldPos)

            // Mark new bounds as dirty
            const newBounds = this.currentStroke.getBounds()
            this.engine.markDirty()
            this.lastBounds = newBounds

            this.engine.render()
        }
    }

    override onMouseUp(_worldPos: Point, _e: MouseEvent): void {
        if (this.currentStroke && this.currentStroke.data.points && this.currentStroke.data.points.length > 1) {
            // Apply Douglas-Peucker simplification to reduce point count
            // Only simplify if we have more than 5 points (otherwise not worth it)
            if (this.currentStroke.data.points.length > 5) {
                this.currentStroke.data.points = simplifyStroke(
                    this.currentStroke.data.points,
                    this.currentStroke.data.width || 2,
                    3 // Minimum 3 points to preserve some curve detail
                )
            }

            // Mark final bounds as dirty
            // const _finalBounds = this.currentStroke.getBounds()
            this.engine.markDirty()

            this.engine.objectManager.addObject(this.currentStroke)
            if ((this.engine as any).toolbar) {
                (this.engine as any).toolbar.updateUndoRedoButtons()
            }
        }
        this.currentStroke = null
        this.isDrawing = false
        this.lastBounds = null
        this.engine.render()
    }

    override renderPreview(ctx: CanvasRenderingContext2D): void {
        if (this.currentStroke) {
            this.currentStroke.render(ctx)
        }
    }
}
