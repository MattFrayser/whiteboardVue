/**
 * Handles box/rectangle selection 
 * - Tracks selection rectangle start/end
 * - Renders selection rectangle preview
 * - Selects objects within rectangle
 */

import type { Point, Bounds } from '../../types'
import type { DrawingEngine } from '../../engine/DrawingEngine'
import { SELECTION_COLOR, SELECTION_RECT_FILL, SELECTION_RECT_DASH } from '../../constants'
import { actions } from '../../stores/AppState'

export class SelectionBox {
    private engine: DrawingEngine

    // Box selection state
    isSelecting: boolean
    selectionStart: Point | null
    selectionEnd: Point | null

    constructor(engine: DrawingEngine) {
        this.engine = engine
        this.isSelecting = false
        this.selectionStart = null
        this.selectionEnd = null
    }


    startSelection(worldPos: Point, clearExisting: boolean): void {
        if (clearExisting) {
            this.engine.objectManager.clearSelection()
        }
        
        this.isSelecting = true
        this.selectionStart = worldPos
        this.selectionEnd = worldPos
    }

    /**
     * Update selection box as mouse moves
     */
    updateSelection(worldPos: Point): void {
        if (!this.isSelecting) {
            return
        }

        this.selectionEnd = worldPos
        actions.setCursor('crosshair')
        this.engine.renderDirty()
    }

    /**
     * Finish box selection - select all objects in rectangle
     */
    finishSelection(addToSelection: boolean): void {
        if (!this.isSelecting) {
            return
        }

        const rect = this.getSelectionRect()
        if (rect) {
            this.engine.objectManager.selectObjectsInRect(rect, addToSelection)
        }

        this.reset()
        this.engine.renderDirty()
    }

    /**
     * Calculate selection rectangle bounds
     */
    private getSelectionRect(): Bounds | null {
        if (!this.selectionStart || !this.selectionEnd) {
            return null
        }

        const x = Math.min(this.selectionStart.x, this.selectionEnd.x)
        const y = Math.min(this.selectionStart.y, this.selectionEnd.y)
        const width = Math.abs(this.selectionEnd.x - this.selectionStart.x)
        const height = Math.abs(this.selectionEnd.y - this.selectionStart.y)

        return { x, y, width, height }
    }

    /**
     * Render selection rectangle preview
     */
    renderPreview(ctx: CanvasRenderingContext2D): void {
        if (!this.isSelecting || !this.selectionStart || !this.selectionEnd) {
            return
        }

        const rect = this.getSelectionRect()
        if (!rect) return

        ctx.strokeStyle = SELECTION_COLOR
        ctx.fillStyle = SELECTION_RECT_FILL
        ctx.lineWidth = 1 / ctx.getTransform().a
        ctx.setLineDash(SELECTION_RECT_DASH)

        ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

        ctx.setLineDash([])
    }

    reset(): void {
        this.isSelecting = false
        this.selectionStart = null
        this.selectionEnd = null
    }
}
