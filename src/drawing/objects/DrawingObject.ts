import type { Point, Bounds, DrawingObjectData, ResizeHandle } from '../../shared/types'
import { SELECTION_COLOR, SELECTION_HANDLE_BG } from '../../shared/constants'
import type { Transform } from '../transforms/Transform'
import type { ResizeConstraints } from '../transforms/ResizeConstraints'
import { createDefaultConstraints } from '../transforms/ResizeConstraints'
import { applyTransformToBounds } from '../transforms/Transform'

/**
 * Base class for all drawing objects
 * Generic over data type for strong typing in subclasses
 */
export class DrawingObject<T extends DrawingObjectData = DrawingObjectData> {
    id: string
    type: string
    data: T
    selected: boolean
    userId: string | null
    zIndex: number

    constructor(id: string | null, type: string, data: T, zIndex: number) {
        this.id = id ?? this.generateId()
        this.type = type
        this.data = data
        this.selected = false
        this.userId = null
        this.zIndex = zIndex
    }

    generateId(): string {
        return crypto.randomUUID()
    }

    getBounds(): Bounds {
        // Override in subclasses
        return { x: 0, y: 0, width: 0, height: 0 }
    }

    containsPoint(point: Point): boolean {
        const bounds = this.getBounds()
        return (
            point.x >= bounds.x &&
            point.x <= bounds.x + bounds.width &&
            point.y >= bounds.y &&
            point.y <= bounds.y + bounds.height
        )
    }

    move(_dx: number, _dy: number): void {
        // Override in subclasses
    }

    applyBounds(_newBounds: Bounds, _handleIndex: number): void {
        // Override in subclasses
    }

    render(_ctx: CanvasRenderingContext2D): void {
        // Override in subclasses
    }

    renderSelection(ctx: CanvasRenderingContext2D): void {
        const bounds = this.getBounds()
        ctx.strokeStyle = SELECTION_COLOR
        ctx.lineWidth = 2 / ctx.getTransform().a
        ctx.setLineDash([5, 5])
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
        ctx.setLineDash([])

        // Render resize handles
        const handleSize = 12 / ctx.getTransform().a
        const handles = this.getResizeHandles()
        ctx.fillStyle = SELECTION_HANDLE_BG
        ctx.strokeStyle = SELECTION_COLOR
        ctx.lineWidth = 2 / ctx.getTransform().a
        handles.forEach(handle => {
            ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            )
            ctx.strokeRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            )
        })
    }

    getResizeHandles(): ResizeHandle[] {
        const bounds = this.getBounds()
        return [
            { x: bounds.x, y: bounds.y, cursor: 'nw-resize' },
            { x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'n-resize' },
            { x: bounds.x + bounds.width, y: bounds.y, cursor: 'ne-resize' },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'e-resize' },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'se-resize' },
            { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 's-resize' },
            { x: bounds.x, y: bounds.y + bounds.height, cursor: 'sw-resize' },
            { x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'w-resize' },
        ]
    }

    private calculateSideHandleBounds(
        handleIndex: 1 | 3 | 5 | 7,
        newX: number,
        newY: number,
        left: number,
        right: number,
        top: number,
        bottom: number
    ): Bounds {
        const isVertical = handleIndex === 1 || handleIndex === 5

        if (isVertical) {
            // North (1) or South (5)
            const isNorth = handleIndex === 1
            const newEdge = isNorth ? newY : newY
            const fixedEdge = isNorth ? bottom : top

            return {
                x: Math.min(left, right),
                y: Math.min(newEdge, fixedEdge),
                width: Math.abs(right - left),
                height: Math.max(1, Math.abs(fixedEdge - newEdge)),
            }
        } else {
            // East (3) or West (7)
            const isEast = handleIndex === 3
            const newEdge = isEast ? newX : newX
            const fixedEdge = isEast ? left : right

            return {
                x: Math.min(newEdge, fixedEdge),
                y: Math.min(top, bottom),
                width: Math.max(1, Math.abs(newEdge - fixedEdge)),
                height: Math.abs(bottom - top),
            }
        }
    }

    calculateResizedBounds(
        handleIndex: number,
        newX: number,
        newY: number,
        fixedPoint: Point,
        initialBounds: Bounds
    ): Bounds {
        const isSideHandle = [1, 3, 5, 7].includes(handleIndex)

        if (isSideHandle) {
            const left = initialBounds.x
            const right = initialBounds.x + initialBounds.width
            const top = initialBounds.y
            const bottom = initialBounds.y + initialBounds.height

            return this.calculateSideHandleBounds(
                handleIndex as 1 | 3 | 5 | 7,
                newX,
                newY,
                left,
                right,
                top,
                bottom
            )
        }
         
        const rawWidth = newX - fixedPoint.x
        const rawHeight = newY - fixedPoint.y

        return {
            x: fixedPoint.x,
            y: fixedPoint.y,
            width: rawWidth,   
            height: rawHeight  
        }
    }
    resize(
        handleIndex: number,
        newX: number,
        newY: number,
        fixedPoint: Point,
        initialBounds: Bounds
    ): void {
        const newBounds = this.calculateResizedBounds(
            handleIndex,
            newX,
            newY,
            fixedPoint,
            initialBounds
        )
        this.applyBounds(newBounds, handleIndex)
    }

    // Override in subclasses to specify custom behavior
    getResizeConstraints(): ResizeConstraints {
        return createDefaultConstraints()
    }


    // Override in subclasses for element-specific behavior
    applyTransform(transform: Transform): void {
        // Default implementation: apply to bounds
        const bounds = this.getBounds()
        const newBounds = applyTransformToBounds(bounds, transform)
        this.applyBounds(newBounds, 0) // Use corner handle (0) as default
    }

    toJSON(): { id: string; type: string; data: T; zIndex: number } {
        // Create a copy of data excluding metadata fields
        const {
            id: _id,
            type: _type,
            userId: _userId,
            timestamp: _timestamp,
            ...dataFields
        } = this.data

        return {
            id: this.id,
            type: this.type,
            data: {
                ...dataFields,
                timestamp: Date.now(),
            } as T,
            zIndex: this.zIndex,
        }
    }
}
