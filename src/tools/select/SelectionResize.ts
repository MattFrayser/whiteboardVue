/**
 * Handles resize operations for selected objects
 * - Detects resize handles under cursor
 * - Manages resize state (which handle, fixed point)
 * - Executes resize operations
 */

import type { Point, Bounds, DrawingObjectData } from '../../types'
import type { DrawingObject } from '../../objects/DrawingObject'
import type { DrawingEngine } from '../../engine/DrawingEngine'
import { UpdateObjectOperation } from '../../managers/operations'
import { RESIZE_HANDLE_CLICK_SIZE } from '../../constants'
import { actions } from '../../stores/AppState'

export class SelectionResize {
    private engine: DrawingEngine
    
    // Resize state
    isResizing: boolean
    resizeHandleIndex: number | null
    resizeObject: DrawingObject | null
    resizeFixedPoint: Point | null
    resizeInitialBounds: Bounds | null
    resizeInitialData: DrawingObjectData | null
    dragStart: Point | null

    constructor(engine: DrawingEngine) {
        this.engine = engine
        this.isResizing = false
        this.resizeHandleIndex = null
        this.resizeObject = null
        this.resizeFixedPoint = null
        this.resizeInitialBounds = null
        this.resizeInitialData = null
        this.dragStart = null
    }

    /**
     * Check if cursor is over a resize handle
     * Returns: handle index or -1 
     */
    getHandleAt(point: Point, obj: DrawingObject): number {
        const handles = obj.getResizeHandles()
        const clickableSize = RESIZE_HANDLE_CLICK_SIZE / this.engine.coordinates.scale
        const halfSize = clickableSize / 2

        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i]
            if (handle &&
                point.x >= handle.x - halfSize &&
                point.x <= handle.x + halfSize &&
                point.y >= handle.y - halfSize &&
                point.y <= handle.y + halfSize
            ) {
                return i
            }
        }

        return -1
    }

    /**
     * Called when user clicks on a resize handle
     */
    startResize(worldPos: Point, handleIndex: number, obj: DrawingObject): void {
        this.isResizing = true
        this.resizeHandleIndex = handleIndex
        this.resizeObject = obj
        this.dragStart = worldPos

        // Store initial state for undo
        const bounds = obj.getBounds()
        this.resizeInitialBounds = { ...bounds }
        this.resizeInitialData = JSON.parse(JSON.stringify(obj.data))

        // Calculate fixed point based on which handle was grabbed
        this.resizeFixedPoint = this.calculateFixedPoint(handleIndex, bounds)
    }

    /**
     * Calculate the fixed point (anchor) for resize based on handle index
     */
    private calculateFixedPoint(handleIndex: number, bounds: Bounds): Point {
        switch (handleIndex) {
            case 0: // NW - fix SE corner
                return { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
            case 1: // N - fix bottom edge
                return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }
            case 2: // NE - fix SW corner
                return { x: bounds.x, y: bounds.y + bounds.height }
            case 3: // E - fix left edge
                return { x: bounds.x, y: bounds.y + bounds.height / 2 }
            case 4: // SE - fix NW corner
                return { x: bounds.x, y: bounds.y }
            case 5: // S - fix top edge
                return { x: bounds.x + bounds.width / 2, y: bounds.y }
            case 6: // SW - fix NE corner
                return { x: bounds.x + bounds.width, y: bounds.y }
            case 7: // W - fix right edge
                return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
            default:
                return { x: bounds.x, y: bounds.y }
        }
    }

    /**
     * Continue resize operation as mouse moves
     */
    updateResize(worldPos: Point): void {
        if (!this.isResizing || !this.resizeObject || this.resizeHandleIndex === null || 
            !this.resizeFixedPoint || !this.resizeInitialBounds) {
            return
        }

        this.resizeObject.resize(
            this.resizeHandleIndex, 
            worldPos.x, 
            worldPos.y, 
            this.resizeFixedPoint, 
            this.resizeInitialBounds
        )

        // Change cursor to reflect handle operation
        const handles = this.resizeObject.getResizeHandles()
        const handle = handles[this.resizeHandleIndex]
        if (handle) {
            actions.setCursor(handle.cursor)
        }

        this.engine.renderDirty()
    }

    finishResize(): void {
        if (!this.isResizing || !this.resizeObject || !this.resizeInitialData) {
            return
        }

        const bounds = this.resizeObject.getBounds()
        this.engine.objectManager.updateObjectInQuadtree(this.resizeObject, bounds, bounds)

        // Record resize in undo history
        const userId = this.engine.objectManager.userId
        if (userId) {
            const operation = new UpdateObjectOperation(
                this.resizeObject.id,
                this.resizeInitialData,
                JSON.parse(JSON.stringify(this.resizeObject.data)),
                userId
            )
            this.engine.objectManager.historyManager.recordOperation(operation)
        }

        this.engine.objectManager.broadcastObjectUpdate(this.resizeObject)
    }

    // used for cancel/reset
    reset(): void {
        this.isResizing = false
        this.resizeHandleIndex = null
        this.resizeObject = null
        this.resizeFixedPoint = null
        this.resizeInitialBounds = null
        this.resizeInitialData = null
        this.dragStart = null
    }
}
