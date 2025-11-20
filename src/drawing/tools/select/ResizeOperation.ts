/**
 * Handles resize operations for selected objects 
 */

import type { Point, Bounds, DrawingObjectData } from '../../../shared/types'
import type { DrawingObject } from '../../objects/DrawingObject'
import type { DrawingEngine } from '../../../core/engine/DrawingEngine'
import { HandleManager, ResizeHandle } from '../../transforms/ResizeHandles'
import {
    HandleType,
    calculateAnchorPoint,
    calculateResizeTransform,
} from '../../transforms/Transform'
import { ConstraintSolver, KeyModifiers } from '../../transforms/ResizeConstraints'
import { UpdateObjectOperation } from '../../../storage/history/operations'
import { actions } from '../../../shared/stores/AppState'


interface ElementResizeState {
    element: DrawingObject
    initialData: DrawingObjectData
    initialBounds: Bounds
}


export class ResizeOperation {
    private engine: DrawingEngine
    private handleManager: HandleManager
    private constraintSolver: ConstraintSolver

    // Resize state
    isResizing: boolean = false
    private activeHandle: ResizeHandle | null = null
    private anchorPoint: Point | null = null
    private elementStates: Map<string, ElementResizeState> = new Map()
    private initialGroupBounds: Bounds | null = null

    // Keyboard mods
    private modifiers: KeyModifiers = {
        shift: false,
    }

    constructor(engine: DrawingEngine) {
        this.engine = engine
        this.handleManager = new HandleManager()
        this.constraintSolver = new ConstraintSolver()
        this.setupKeyboardListeners()
    }

    private setupKeyboardListeners(): void {
        window.addEventListener('keydown', (e) => {
            this.modifiers.shift = e.shiftKey

            // Re-render if resizing to apply constraint changes
            // same idea for below
            if (this.isResizing) {
                this.engine.renderDirty()
            }
        })

        window.addEventListener('keyup', (e) => {
            this.modifiers.shift = e.shiftKey

            if (this.isResizing) {
                this.engine.renderDirty()
            }
        })
    }


    getHandleAtForSelection(point: Point, objects: DrawingObject[]): ResizeHandle | null {
        const groupBounds = this.calculateGroupBounds(objects)
        const handles = this.handleManager.getHandlesForBounds(
            groupBounds,
            this.engine.coordinates.scale
        )

        return this.handleManager.getHandleAt(point, handles)
    }

    // ui purpose only
    getCursorForHandle(handle: ResizeHandle | null): string {
        return handle?.cursor || 'default'
    }

    private calculateGroupBounds(objects: DrawingObject[]): Bounds {
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity

        objects.forEach(obj => {
            const bounds = obj.getBounds()
            minX = Math.min(minX, bounds.x)
            minY = Math.min(minY, bounds.y)
            maxX = Math.max(maxX, bounds.x + bounds.width)
            maxY = Math.max(maxY, bounds.y + bounds.height)
        })

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        }
    }

    startResize(_worldPos: Point, handle: ResizeHandle, objects: DrawingObject[]): void {
        this.isResizing = true
        this.activeHandle = handle
        this.initialGroupBounds = this.calculateGroupBounds(objects)
        this.anchorPoint = calculateAnchorPoint(handle.type, this.initialGroupBounds)

        this.elementStates.clear()
        objects.forEach(obj => {
            this.elementStates.set(obj.id, {
                element: obj,
                initialData: structuredClone(obj.data),
                initialBounds: obj.getBounds(),
            })
        })

        // Update cursor
        actions.setCursor(handle.cursor)
    }

    updateResize(worldPos: Point): void {
        if (!this.isResizing || !this.activeHandle || !this.anchorPoint || !this.initialGroupBounds) {
            return
        }

        const handleType = this.activeHandle.type

        // single vs multi
        if (this.elementStates.size === 1) {
            const state = Array.from(this.elementStates.values())[0]
            if (state) {
                this.resizeSingleObject(state, handleType, worldPos)
            }
        } else {
            this.resizeGroup(handleType, worldPos)
        }

        this.engine.renderDirty()
    }

    private resizeSingleObject(
        state: ElementResizeState,
        handleType: HandleType,
        currentPoint: Point
    ): void {
        const { element, initialBounds } = state

        const constraints = element.getResizeConstraints()

        // Calculate transform
        const anchorPoint = calculateAnchorPoint(handleType, initialBounds)
        let transform = calculateResizeTransform(
            handleType,
            initialBounds,
            currentPoint,
            anchorPoint,
            false // Don't lock aspect ratio here, ConstraintSolver handles it
        )

        transform = this.constraintSolver.solve(
            transform,
            constraints,
            this.modifiers,
            handleType,
            initialBounds.width,
            initialBounds.height
        )

        // Restore initial state
        element.data = structuredClone(state.initialData)

        // Apply transform
        const oldBounds = element.getBounds()
        element.applyTransform(transform)
        const newBounds = element.getBounds()

        // Update quadtree (live feedback)
        this.engine.objectManager.updateObjectInQuadtree(element, oldBounds, newBounds)
    }

    private resizeGroup(handleType: HandleType, currentPoint: Point): void {
        if (!this.anchorPoint || !this.initialGroupBounds) return

        // use same logic as single object resize
        // ensures fixed anchor point and gradual scaling
        const transform = calculateResizeTransform(
            handleType,
            this.initialGroupBounds,
            currentPoint,
            this.anchorPoint,
            false // Don't lock aspect ratio for group resize
        )

        // apply same transform for every obj in group
        this.elementStates.forEach((state) => {
            const { element, initialData } = state

            // Restore initial state
            element.data = structuredClone(initialData)

            // Apply transform
            const oldBounds = element.getBounds()
            element.applyTransform(transform)
            const newBounds = element.getBounds()

            // Update quadtree
            this.engine.objectManager.updateObjectInQuadtree(element, oldBounds, newBounds)
        })
    }

    finishResize(): void {
        if (!this.isResizing) {
            return
        }

        // Record history operations for all changed objects
        const userId = this.engine.objectManager.userId || 'local'

        this.elementStates.forEach((state) => {
            const { element, initialData } = state

            // Only record if data actually changed
            if (JSON.stringify(initialData) !== JSON.stringify(element.data)) {
                const operation = new UpdateObjectOperation(
                    element.id,
                    initialData,
                    element.data,
                    userId
                )
                this.engine.objectManager.historyManager.recordOperation(operation)

                // Broadcast update
                this.engine.objectManager.broadcastObjectUpdate(element)
            }
        })

        this.reset()
    }

    cancelResize(): void {
        if (!this.isResizing) {
            return
        }

        // Restore all objects to initial state
        this.elementStates.forEach((state) => {
            const { element, initialData } = state
            const oldBounds = element.getBounds()
            element.data = structuredClone(initialData)
            const newBounds = element.getBounds()
            this.engine.objectManager.updateObjectInQuadtree(element, oldBounds, newBounds)
        })

        this.reset()
        this.engine.renderDirty()
    }

    private reset(): void {
        this.isResizing = false
        this.activeHandle = null
        this.anchorPoint = null
        this.elementStates.clear()
        this.initialGroupBounds = null
        actions.setCursor('default')
    }
}
