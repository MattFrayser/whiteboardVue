import type { Point, Bounds, DrawingObjectData } from '../types'
import { SELECTION_COLOR, SELECTION_HANDLE_BG } from '../constants'

interface ResizeHandle extends Point {
    cursor: string
}

export class DrawingObject {
    id: string
    type: string
    data: DrawingObjectData
    selected: boolean
    userId: string | null
    zIndex: number

    constructor(id: string | null, type: string, data: DrawingObjectData, zIndex: number) {
        this.id = id || this.generateId()
        this.type = type
        this.data = data
        this.selected = false
        this.userId = null
        this.zIndex = zIndex
    }

    generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2)
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

    /**
     * Calculate new bounds based on resize handle drag
     * Returns bounds without applying them (for subclass customization)
     */
    calculateResizedBounds(handleIndex: number, newX: number, newY: number, fixedPoint: Point, initialBounds: Bounds): Bounds {
        const isSideHandle = [1, 3, 5, 7].includes(handleIndex)

        if (isSideHandle) {
            // For side handles, keep the perpendicular dimension fixed
            const left = initialBounds.x
            const right = initialBounds.x + initialBounds.width
            const top = initialBounds.y
            const bottom = initialBounds.y + initialBounds.height

            switch (handleIndex) {
                case 1: // North
                    return {
                        x: Math.min(left, right),
                        y: Math.min(newY, bottom),
                        width: Math.abs(right - left),
                        height: Math.max(1, Math.abs(bottom - newY))
                    }
                case 3: // East
                    return {
                        x: Math.min(left, newX),
                        y: Math.min(top, bottom),
                        width: Math.max(1, Math.abs(newX - left)),
                        height: Math.abs(bottom - top)
                    }
                case 5: // South
                    return {
                        x: Math.min(left, right),
                        y: Math.min(top, newY),
                        width: Math.abs(right - left),
                        height: Math.max(1, Math.abs(newY - top))
                    }
                case 7: // West
                    return {
                        x: Math.min(newX, right),
                        y: Math.min(top, bottom),
                        width: Math.max(1, Math.abs(right - newX)),
                        height: Math.abs(bottom - top)
                    }
            }
        }

        // Corner handles - use fixed point approach
        return {
            x: Math.min(fixedPoint.x, newX),
            y: Math.min(fixedPoint.y, newY),
            width: Math.max(1, Math.abs(newX - fixedPoint.x)),
            height: Math.max(1, Math.abs(newY - fixedPoint.y))
        }
    }

    resize(handleIndex: number, newX: number, newY: number, fixedPoint: Point, initialBounds: Bounds): void {
        const newBounds = this.calculateResizedBounds(handleIndex, newX, newY, fixedPoint, initialBounds)
        this.applyBounds(newBounds, handleIndex)
    }

    toJSON(): { id: string; type: string; data: DrawingObjectData; zIndex: number } {
        // Create a copy of data excluding metadata fields
        const { id: _id, type: _type, userId: _userId, timestamp: _timestamp, ...dataFields } = this.data

        return {
            id: this.id,
            type: this.type,
            data: {
                ...dataFields,
                timestamp: Date.now(),
            } as DrawingObjectData,
            zIndex: this.zIndex,
        }
    }
}
