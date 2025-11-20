/**
 * Main coordinator for selection tool
 * Delegates to 
 *    ResizeOperation: Handles resize operations 
 *    SelectionDrag: Handles drag/move operations
 *    SelectionBox: Handles box selection
 */

import { Tool } from '../base/Tool'
import { ResizeOperation } from './ResizeOperation'
import { SelectionDrag } from './SelectionDrag'
import { SelectionBox } from './SelectionBox'
import { CURSORS, MIN_SELECTION_PADDING, BASE_SELECTION_PADDING } from '../../../shared/constants'
import type { Point } from '../../../shared/types'
import type { DrawingEngine } from '../../../core/engine/DrawingEngine'
import { actions } from '../../../shared/stores/AppState'

export class SelectTool extends Tool {
    private resize: ResizeOperation
    private drag: SelectionDrag
    private box: SelectionBox
    private boundMouseMoveHandler: ((e: MouseEvent) => void) | null

    constructor(engine: DrawingEngine) {
        super(engine)

        // Initialize sub-handlers
        this.resize = new ResizeOperation(engine)
        this.drag = new SelectionDrag(engine)
        this.box = new SelectionBox(engine)

        this.boundMouseMoveHandler = null
        this.setupMouseMoveListener()
    }


    override deactivate(): void {
        super.deactivate()

        if (this.boundMouseMoveHandler) {
            this.engine.canvas.removeEventListener('mousemove', this.boundMouseMoveHandler)
            this.boundMouseMoveHandler = null
        }
    }

    isActive(): boolean {
        return this.engine.getCurrentTool() === this
    }

    // update mouse cursor ui
    private setupMouseMoveListener(): void {
        this.boundMouseMoveHandler = (e: MouseEvent) => {
            if (!this.isActive()) {
                return
            }

            const worldPos = this.engine.coordinates.viewportToWorld(
                { x: e.clientX, y: e.clientY },
                this.engine.canvas
            )

            this.updateCursor(worldPos)
        }

        this.engine.canvas.addEventListener('mousemove', this.boundMouseMoveHandler)
    }

    private updateCursor(worldPos: Point): void {
        // Don't change cursor while performing operations
        if (this.drag.isDragging || this.resize.isResizing) {
            return
        }

        const selectedObjects = this.engine.objectManager.selectedObjects
        if (selectedObjects.length >= 1) {
            const handle = this.resize.getHandleAtForSelection(worldPos, selectedObjects)
            if (handle) {
                // Get cursor based on handle
                const cursor = this.resize.getCursorForHandle(handle)
                actions.setCursor(cursor)
                return
            }
        }

        // Check for objects under cursor
        const object = this.engine.objectManager.getObjectAt(worldPos)
        if (object) {
            actions.setCursor('move')
        } else {
            actions.setCursor(CURSORS.SELECT)
        }
    }

    override onMouseDown(worldPos: Point, e: MouseEvent): void {
        // Reset all states; ensure clean start
        this.drag.reset()
        this.box.reset()

        const selectedObjects = this.engine.objectManager.selectedObjects
        if (selectedObjects.length >= 1) {
            const handle = this.resize.getHandleAtForSelection(worldPos, selectedObjects)
            if (handle) {
                this.resize.startResize(worldPos, handle, selectedObjects)
                return
            }
        }

        // obj -> start drag
        const object = this.engine.objectManager.getObjectAt(worldPos)
        if (object) {
            this.drag.startDrag(worldPos, object, e.shiftKey)
            this.engine.render()
            return
        }

        // empty space -> box selection
        this.box.startSelection(worldPos, !e.shiftKey)
        this.engine.render()
    }

    override onMouseMove(worldPos: Point): void {
        // Delegate to active handler
        if (this.resize.isResizing) {
            this.resize.updateResize(worldPos)
        } else if (this.box.isSelecting) {
            this.box.updateSelection(worldPos)
        } else if (this.drag.isDragging) {
            this.drag.updateDrag(worldPos)
        }
    }

    override onMouseUp(worldPos: Point, e: MouseEvent): void {
        // Finish active operation
        if (this.resize.isResizing) {
            this.resize.finishResize()
            this.engine.renderDirty()
        }

        if (this.drag.isDragging) {
            this.drag.finishDrag(worldPos)
            this.drag.reset()
        }

        if (this.box.isSelecting) {
            this.box.finishSelection(e.shiftKey)
        }

        // Update cursor after operation completes
        this.updateCursor(worldPos)
    }

    getSelectionPadding(): number {
        const scale = this.engine.coordinates.scale
        return Math.max(MIN_SELECTION_PADDING, Math.ceil(BASE_SELECTION_PADDING / scale))
    }

    override renderPreview(ctx: CanvasRenderingContext2D): void {
        // Delegate rendering to box selection handler
        this.box.renderPreview(ctx)
    }
}
