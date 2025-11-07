import { Line } from '../objects/Line'
import { Tool } from './Tool'
import type { Point, Bounds } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'
import { selectors } from '../stores/AppState'

export class LineTool extends Tool {
    startPoint: Point | null
    currentLine: Line | null
    lastBounds: Bounds | null

    constructor(engine: DrawingEngine) {
        super(engine)
        this.startPoint = null
        this.currentLine = null
        this.lastBounds = null
    }

    override onMouseDown(worldPos: Point, _e: MouseEvent): void {
        this.startPoint = worldPos
        this.currentLine = new Line(null, {
            id: '',
            type: 'line',
            x: worldPos.x,
            y: worldPos.y,
            x1: worldPos.x,
            y1: worldPos.y,
            x2: worldPos.x,
            y2: worldPos.y,
            color: selectors.getColor(),
            width: selectors.getBrushSize(),
        }, 0)
        this.lastBounds = null
    }

    override onMouseMove(worldPos: Point, _e: MouseEvent): void {
        if (this.currentLine) {
            // Mark old bounds as dirty
            if (this.lastBounds) {
                this.engine.markDirty()
            }

            this.currentLine.data.x2 = worldPos.x
            this.currentLine.data.y2 = worldPos.y

            // Mark new bounds as dirty
            const newBounds = this.currentLine.getBounds()
            this.engine.markDirty()
            this.lastBounds = newBounds
        }
        this.engine.render()
    }

    override onMouseUp(_worldPos: Point, _e: MouseEvent): void {
        if (this.currentLine) {
            const length = Math.sqrt(
                Math.pow(this.currentLine.data.x2! - this.currentLine.data.x1!, 2) +
                    Math.pow(this.currentLine.data.y2! - this.currentLine.data.y1!, 2)
            )
            if (length > 1) {
                // Mark final bounds as dirty
                // const _bounds = this.currentLine.getBounds()
                this.engine.markDirty()
                this.engine.objectManager.addObject(this.currentLine)
            }
            this.currentLine = null
            this.startPoint = null
            this.lastBounds = null
            this.engine.render()
        }
    }

    override renderPreview(ctx: CanvasRenderingContext2D): void {
        if (this.currentLine) {
            this.currentLine.render(ctx)
        }
    }
}
