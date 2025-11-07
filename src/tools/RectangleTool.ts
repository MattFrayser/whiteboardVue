import { Rectangle } from '../objects/Rectangle'
import { Tool } from './Tool'
import type { Point, Bounds } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'
import { selectors } from '../stores/AppState'

export class RectangleTool extends Tool {
    startPoint: Point | null
    currentRect: Rectangle | null
    lastBounds: Bounds | null

    constructor(engine: DrawingEngine) {
        super(engine)
        this.startPoint = null
        this.currentRect = null
        this.lastBounds = null
    }

    override onMouseDown(worldPos: Point, e: MouseEvent): void {
        this.startPoint = worldPos
        this.currentRect = new Rectangle(null, {
            id: '',
            type: 'rectangle',
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
            (this.currentRect.data as { fill?: string }).fill = selectors.getColor()
        }
        this.lastBounds = null
    }

    override onMouseMove(worldPos: Point, _e: MouseEvent): void {
        if (this.currentRect) {
            // Mark old bounds as dirty
            if (this.lastBounds) {
                this.engine.markDirty()
            }

            this.currentRect.data.x2 = worldPos.x
            this.currentRect.data.y2 = worldPos.y

            // Mark new bounds as dirty
            const newBounds = this.currentRect.getBounds()
            this.engine.markDirty()
            this.lastBounds = newBounds

            this.engine.render()
        }
    }

    override onMouseUp(): void {
        if (this.currentRect) {
            const bounds = this.currentRect.getBounds()
            if (bounds.width > 1 && bounds.height > 1) {
                // Mark final bounds as dirty
                this.engine.markDirty()
                this.engine.objectManager.addObject(this.currentRect)
                if ((this.engine as any).toolbar) {
                    (this.engine as any).toolbar.updateUndoRedoButtons()
                }
            }
            this.currentRect = null
            this.startPoint = null
            this.lastBounds = null
            this.engine.render()
        }
    }

    override renderPreview(ctx: CanvasRenderingContext2D): void {
        if (this.currentRect) {
            this.currentRect.render(ctx)
        }
    }
}
