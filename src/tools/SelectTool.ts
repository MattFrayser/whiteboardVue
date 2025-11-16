import { Tool } from './Tool'
import { MoveObjectsOperation, UpdateObjectOperation } from '../managers/operations'
import { SELECTION_COLOR, SELECTION_RECT_FILL, SELECTION_RECT_DASH, CURSORS, RESIZE_HANDLE_CLICK_SIZE, MIN_SELECTION_PADDING, BASE_SELECTION_PADDING } from '../constants'
import type { Point, Bounds, DrawingObjectData } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'
import type { DrawingObject } from '../objects/DrawingObject'
import { actions } from '../stores/AppState'

export class SelectTool extends Tool {
    dragStart: Point | null
    dragStartOriginal: Point | null // Track the initial drag start position for history
    isDragging: boolean
    dragOffset: Point | null

    isResizing: boolean
    resizeHandleIndex: number | null
    resizeObject: DrawingObject | null
    resizeFixedPoint: Point | null
    resizeInitialBounds: Bounds | null
    resizeInitialData: DrawingObjectData | null // Store initial data for resize undo

    isSelecting: boolean
    selectionStart: Point | null
    selectionEnd: Point | null

    // Store old bounds for quadtree updates
    draggedObjectsBounds: Map<DrawingObject, Bounds>

    // Store bound handler for cleanup
    boundMouseMoveHandler: ((e: MouseEvent) => void) | null

    constructor(engine: DrawingEngine) {
        super(engine)
        this.dragStart = null
        this.dragStartOriginal = null
        this.isDragging = false
        this.dragOffset = null

        this.isResizing = false
        this.resizeHandleIndex = null
        this.resizeObject = null
        this.resizeFixedPoint = null
        this.resizeInitialBounds = null
        this.resizeInitialData = null

        this.isSelecting = false
        this.selectionStart = null
        this.selectionEnd = null

        this.draggedObjectsBounds = new Map()
        this.boundMouseMoveHandler = null

        this.setupMouseMoveListener()
    }

    setupMouseMoveListener(): void {
        // Store bound handler for cleanup
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

    override deactivate(): void {
        super.deactivate()

        // Remove mousemove listener when tool is deactivated
        if (this.boundMouseMoveHandler) {
            this.engine.canvas.removeEventListener('mousemove', this.boundMouseMoveHandler)
            this.boundMouseMoveHandler = null
        }
    }

    isActive(): boolean {
        return this.engine.getCurrentTool() === this
    }

    updateCursor(worldPos: Point): void {
        // Don't change cursor while dragging or resizing
        if (this.isDragging || this.isResizing) {
            return
        }

        // Hovering over a resize handle
        if (this.engine.objectManager.selectedObjects.length === 1) {
            const obj = this.engine.objectManager.selectedObjects[0]
            if (obj) {
                const handleIndex = this.getHandleAt(worldPos, obj)

                if (handleIndex !== -1) {
                    const handles = obj.getResizeHandles()
                    const handle = handles[handleIndex]
                    if (handle) {
                        actions.setCursor(handle.cursor)
                    }
                    return // Don't check for objects below, we're over a handle
                }
            }
        }

        // Hovering over an object
        const object = this.engine.objectManager.getObjectAt(worldPos)
        if (object) {
            actions.setCursor('move')
        } else {
            // Use custom select cursor when not hovering over anything
            actions.setCursor(CURSORS.SELECT)
        }
    }

    override onMouseDown(worldPos: Point, e: MouseEvent): void {
        // Clear any previous interaction state (defensive - ensures clean start)
        // This handles cases where mouseup events were missed or didn't fire
        this.isResizing = false
        this.resizeHandleIndex = null
        this.resizeObject = null
        this.resizeFixedPoint = null
        this.resizeInitialBounds = null
        this.isDragging = false
        this.isSelecting = false

        // Resize handles?
        if (this.engine.objectManager.selectedObjects.length === 1) {
            const obj = this.engine.objectManager.selectedObjects[0]
            if (obj) {
                const handleIndex = this.getHandleAt(worldPos, obj)

                if (handleIndex != -1) {
                    this.isResizing = true
                    this.resizeHandleIndex = handleIndex
                    this.resizeObject = obj
                    this.dragStart = worldPos

                    // Store the initial bounds and data for undo
                    const bounds = obj.getBounds()
                    this.resizeInitialBounds = { ...bounds }
                    this.resizeInitialData = JSON.parse(JSON.stringify(obj.data))

                switch (handleIndex) {
                    case 0: // NW - fix SE corner
                        this.resizeFixedPoint = { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
                        break
                    case 1: // N - fix bottom edge
                        this.resizeFixedPoint = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }
                        break
                    case 2: // NE - fix SW corner
                        this.resizeFixedPoint = { x: bounds.x, y: bounds.y + bounds.height }
                        break
                    case 3: // E - fix left edge
                        this.resizeFixedPoint = { x: bounds.x, y: bounds.y + bounds.height / 2 }
                        break
                    case 4: // SE - fix NW corner
                        this.resizeFixedPoint = { x: bounds.x, y: bounds.y }
                        break
                    case 5: // S - fix top edge
                        this.resizeFixedPoint = { x: bounds.x + bounds.width / 2, y: bounds.y }
                        break
                    case 6: // SW - fix NE corner
                        this.resizeFixedPoint = { x: bounds.x + bounds.width, y: bounds.y }
                        break
                    case 7: // W - fix right edge
                        this.resizeFixedPoint = { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
                        break
                }

                    return
                }
            }
        }

        // Normal selection
        const object = this.engine.objectManager.getObjectAt(worldPos)

        if (object) {
            if (!object.selected) {
                this.engine.objectManager.selectObject(object, e.shiftKey)
            }

            // Store old bounds for all selected objects before dragging
            this.draggedObjectsBounds.clear()
            this.engine.objectManager.selectedObjects.forEach(obj => {
                this.draggedObjectsBounds.set(obj, obj.getBounds())
            })

            this.dragStart = worldPos
            this.dragStartOriginal = worldPos // Track original start for history
            this.isDragging = true
        } else {
            // select Drag
            if (!e.shiftKey) {
                this.engine.objectManager.clearSelection()
            }
            this.isSelecting = true
            this.selectionStart = worldPos
            this.selectionEnd = worldPos
        }

        this.engine.render()
    }

    /**
     * Get scale-aware padding for selection visuals
     */
    getSelectionPadding(): number {
        const scale = this.engine.coordinates.scale
        return Math.max(MIN_SELECTION_PADDING, Math.ceil(BASE_SELECTION_PADDING / scale))
    }

    override onMouseMove(worldPos: Point): void {
        // Resize
        if (this.isResizing && this.resizeObject && this.resizeHandleIndex !== null && this.resizeFixedPoint && this.resizeInitialBounds) {
            this.resizeObject.resize(this.resizeHandleIndex, worldPos.x, worldPos.y, this.resizeFixedPoint, this.resizeInitialBounds)

            this.engine.renderDirty()

            // Keep cursor during resize
            const handles = this.resizeObject.getResizeHandles()
            const handle = handles[this.resizeHandleIndex]
            if (handle) {
                actions.setCursor(handle.cursor)
            }
            return
        }

        // Drag Selection
        if (this.isSelecting) {
            this.selectionEnd = worldPos

            actions.setCursor('crosshair')
            this.engine.renderDirty()
            return
        }

        // Moving
        if (this.isDragging && this.dragStart) {
            const dx = worldPos.x - this.dragStart.x
            const dy = worldPos.y - this.dragStart.y

            // Update each object
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
    }

    override onMouseUp(worldPos: Point, e: MouseEvent): void {
        if (this.isResizing || this.isDragging) {
            // Finalize quadtree updates
            if (this.isDragging) {
                this.engine.objectManager.selectedObjects.forEach(obj => {
                    const oldBounds = this.draggedObjectsBounds.get(obj)
                    const newBounds = obj.getBounds()
                    if (oldBounds) {
                        this.engine.objectManager.updateObjectInQuadtree(obj, oldBounds, newBounds)
                    }
                })

                this.draggedObjectsBounds.clear()
                // Broadcast updates for all dragged objects
                this.engine.objectManager.selectedObjects.forEach(obj => {
                    this.engine.objectManager.broadcastObjectUpdate(obj)
                })
            }

            if (this.isResizing && this.resizeObject && this.resizeInitialData) {
                const bounds = this.resizeObject.getBounds()
                this.engine.objectManager.updateObjectInQuadtree(this.resizeObject, bounds, bounds)

                // Record resize as an update operation
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

                // Broadcast update for resized object
                this.engine.objectManager.broadcastObjectUpdate(this.resizeObject)
            }

            // Record move operation for dragged objects
            if (this.isDragging && this.dragStartOriginal && this.engine.objectManager.selectedObjects.length > 0) {
                const totalDx = worldPos.x - this.dragStartOriginal.x
                const totalDy = worldPos.y - this.dragStartOriginal.y

                // Only record if there was actual movement
                if (Math.abs(totalDx) > 0.01 || Math.abs(totalDy) > 0.01) {
                    const userId = this.engine.objectManager.userId
                    if (userId) {
                        const objectIds = this.engine.objectManager.selectedObjects.map(obj => obj.id)
                        const operation = new MoveObjectsOperation(objectIds, totalDx, totalDy, userId)
                        this.engine.objectManager.historyManager.recordOperation(operation)
                    }
                }
            }

            // Mark final positions as dirty
            this.engine.renderDirty() // Ensure moved/resized objects are visible
        }

        // Finish drag selection
        if (this.isSelecting) {
            const rect = this.getSelectionRect()
            if (rect) this.engine.objectManager.selectObjectsInRect(rect, e.shiftKey)
            this.isSelecting = false
            this.selectionStart = null
            this.selectionEnd = null
            this.engine.renderDirty()
        }

        this.isDragging = false
        this.dragStart = null

        this.isResizing = false
        this.resizeHandleIndex = null
        this.resizeObject = null
        this.resizeFixedPoint = null
        this.resizeInitialBounds = null

        // Update cursor after mouse up
        this.updateCursor(worldPos)
    }

    getHandleAt(point: Point, obj: DrawingObject): number {
        const handles = obj.getResizeHandles()

        const clickableSize = RESIZE_HANDLE_CLICK_SIZE / this.engine.coordinates.scale // Larger clickable area
        const halfSize = clickableSize / 2

        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i]

            // Use rectangle
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

    getSelectionRect(): Bounds | null {
        if (!this.selectionStart || !this.selectionEnd) {
            return null
        }

        const x = Math.min(this.selectionStart.x, this.selectionEnd.x)
        const y = Math.min(this.selectionStart.y, this.selectionEnd.y)
        const width = Math.abs(this.selectionEnd.x - this.selectionStart.x)
        const height = Math.abs(this.selectionEnd.y - this.selectionStart.y)

        return { x, y, width, height }
    }

    override renderPreview(ctx: CanvasRenderingContext2D): void {
        if (this.isSelecting && this.selectionStart && this.selectionEnd) {
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
    }
}
