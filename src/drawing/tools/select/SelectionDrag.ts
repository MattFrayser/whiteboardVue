import type { Point, Bounds } from '../../../shared/types'
import type { DrawingObject } from '../../objects/DrawingObject'
import type { DrawingEngine } from '../../../core/engine/DrawingEngine'
import { MoveObjectsOperation } from '../../../storage/history/operations'
import { actions } from '../../../shared/stores/AppState'

export class SelectionDrag {
    private engine: DrawingEngine

    isDragging: boolean
    dragStart: Point | null
    dragStartOriginal: Point | null // For calculating total displacement

    // Store original bounds for quadtree updates
    draggedObjectsBounds: Map<DrawingObject, Bounds>

    constructor(engine: DrawingEngine) {
        this.engine = engine
        this.isDragging = false
        this.dragStart = null
        this.dragStartOriginal = null
        this.draggedObjectsBounds = new Map()
    }

    startDrag(worldPos: Point, object: DrawingObject, addToSelection: boolean): void {
        if (!object.selected) {
            this.engine.objectManager.selectObject(object, addToSelection)
        }

        this.draggedObjectsBounds.clear()
        this.engine.objectManager.selectedObjects.forEach(obj => {
            this.draggedObjectsBounds.set(obj, obj.getBounds())
        })

        this.dragStart = worldPos
        this.dragStartOriginal = worldPos // Track for history
        this.isDragging = true
    }

    updateDrag(worldPos: Point): void {
        if (!this.isDragging || !this.dragStart) {
            return
        }

        const dx = worldPos.x - this.dragStart.x
        const dy = worldPos.y - this.dragStart.y

        this.engine.objectManager.selectedObjects.forEach(obj => {
            const oldBounds = obj.getBounds()
            obj.move(dx, dy)
            const newBounds = obj.getBounds()
            this.engine.objectManager.updateObjectInQuadtree(obj, oldBounds, newBounds)
        })

        this.dragStart = worldPos
        actions.setCursor('move')
        this.engine.renderDirty()
    }

    // Records operation in history and broadcasts updates
    finishDrag(worldPos: Point): void {
        if (!this.isDragging) {
            return
        }

        // Update quadtree with final positions
        this.engine.objectManager.selectedObjects.forEach(obj => {
            const oldBounds = this.draggedObjectsBounds.get(obj)
            const newBounds = obj.getBounds()
            if (oldBounds) {
                this.engine.objectManager.updateObjectInQuadtree(obj, oldBounds, newBounds)
            }
        })

        this.draggedObjectsBounds.clear()

        this.engine.objectManager.selectedObjects.forEach(obj => {
            this.engine.objectManager.broadcastObjectUpdate(obj)
        })

        if (this.dragStartOriginal && this.engine.objectManager.selectedObjects.length > 0) {
            const totalDx = worldPos.x - this.dragStartOriginal.x
            const totalDy = worldPos.y - this.dragStartOriginal.y

            // only want to add to history if actual movement happened
            if (Math.abs(totalDx) > 0.01 || Math.abs(totalDy) > 0.01) {
                const userId = this.engine.objectManager.userId
                if (userId) {
                    const objectIds = this.engine.objectManager.selectedObjects.map(obj => obj.id)
                    const operation = new MoveObjectsOperation(objectIds, totalDx, totalDy, userId)
                    this.engine.objectManager.historyManager.recordOperation(operation)
                }
            }
        }

        this.engine.renderDirty()
    }

    // Cancel/reset drag state
    reset(): void {
        this.isDragging = false
        this.dragStart = null
        this.dragStartOriginal = null
        this.draggedObjectsBounds.clear()
    }
}
