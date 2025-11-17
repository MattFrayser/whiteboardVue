import { Stroke } from '../objects/Stroke'
import { simplifyStroke } from '../utils/simplify'
import { Tool } from './Tool'
import type { Point, Bounds } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'
import { selectors } from '../stores/AppState'

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
            color: selectors.getColor(),
            width: selectors.getBrushSize(),
        }, 0)
        this.lastBounds = null
    }

    override onMouseMove(worldPos: Point, _e: MouseEvent): void {
        if (this.isDrawing && this.currentStroke) {
            this.currentStroke.data.points!.push(worldPos)

            const newBounds = this.currentStroke.getBounds()
            this.lastBounds = newBounds

            this.engine.renderDirty()
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

            this.engine.objectManager.addObject(this.currentStroke)
        }
        this.currentStroke = null
        this.isDrawing = false
        this.lastBounds = null
        this.engine.renderDirty()
    }

    override renderPreview(ctx: CanvasRenderingContext2D): void {
        if (this.currentStroke) {
            this.currentStroke.render(ctx)
        }
    }
}
