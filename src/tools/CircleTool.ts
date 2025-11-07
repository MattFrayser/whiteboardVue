import { Circle } from '../objects/Circle'
import { Tool } from './Tool'
import type { Point, Bounds } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'
import { selectors } from '../stores/AppState'

export class CircleTool extends Tool {
    startPoint: Point | null
    currentCircle: Circle | null
    lastBounds: Bounds | null

    constructor(engine: DrawingEngine) {
        super(engine)
        this.startPoint = null
        this.currentCircle = null
        this.lastBounds = null
    }

    override onMouseDown(worldPos: Point, e: MouseEvent): void {
        this.startPoint = worldPos
        this.currentCircle = new Circle(null, {
            id: '',
            type: 'circle',
            x: worldPos.x,
            y: worldPos.y,
            x1: worldPos.x,
            y1: worldPos.y,
            x2: worldPos.x,
            y2: worldPos.y,
            color: selectors.getColor(),
            width: selectors.getBrushSize(),
        }, 0)
        if (e.shiftKey) {
            (this.currentCircle.data as { fill?: string }).fill = selectors.getColor()
        }
        this.lastBounds = null
    }

    override onMouseMove(worldPos: Point, _e: MouseEvent): void {
        if (this.currentCircle) {
            // Mark old bounds as dirty
            if (this.lastBounds) {
                this.engine.markDirty()
            }

            this.currentCircle.data.x2 = worldPos.x
            this.currentCircle.data.y2 = worldPos.y

            // Mark new bounds as dirty
            const newBounds = this.currentCircle.getBounds()
            this.engine.markDirty()
            this.lastBounds = newBounds

            this.engine.render()
        }
    }

    override onMouseUp(_worldPos: Point, _e: MouseEvent): void {
        if (this.currentCircle) {
            const radius = Math.sqrt(
                Math.pow(this.currentCircle.data.x2! - this.currentCircle.data.x1!, 2) +
                    Math.pow(this.currentCircle.data.y2! - this.currentCircle.data.y1!, 2)
            )

            if (radius > 1) {
                // Mark final bounds as dirty
                // const _bounds = this.currentCircle.getBounds()
                this.engine.markDirty()
                this.engine.objectManager.addObject(this.currentCircle)
                if ((this.engine as any).toolbar) {
                    (this.engine as any).toolbar.updateUndoRedoButtons()
                }
            }

            this.currentCircle = null
            this.startPoint = null
            this.lastBounds = null
            this.engine.render()
        }
    }

    override renderPreview(ctx: CanvasRenderingContext2D): void {
        if (this.currentCircle) {
            this.currentCircle.render(ctx)
        }
    }
}
