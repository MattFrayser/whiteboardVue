/**
 * Resize Handle Management
 * resize handle positioning, hit detection, and visual representation.
 */

import type { Point, Bounds } from '../../shared/types'
import { HandleType } from './Transform'
import { RESIZE_HANDLE_CLICK_SIZE, SELECTION_COLOR, SELECTION_HANDLE_BG } from '../../shared/constants'


export interface ResizeHandle {
    type: HandleType
    position: Point       // Visual center of handle
    cursor: string        // CSS cursor style
    hitZone: Bounds       // Expanded clickable area
}

// ui
export function getCursorForHandle(handleType: HandleType): string {
    switch (handleType) {
        case HandleType.NW:
            return 'nw-resize'
        case HandleType.N:
            return 'n-resize'
        case HandleType.NE:
            return 'ne-resize'
        case HandleType.E:
            return 'e-resize'
        case HandleType.SE:
            return 'se-resize'
        case HandleType.S:
            return 's-resize'
        case HandleType.SW:
            return 'sw-resize'
        case HandleType.W:
            return 'w-resize'
        default:
            return 'default'
    }
}


export class HandleManager {

    getHandlesForBounds(bounds: Bounds, scale: number): ResizeHandle[] {
        const handles: ResizeHandle[] = []

        // Calculate hit zone size in world coordinates
        const hitSize = RESIZE_HANDLE_CLICK_SIZE / scale

        // Helper to create a handle with edge-wide hit zone
        const createHandle = (
            type: HandleType,
            x: number,
            y: number,
            expandHorizontal: boolean,
            expandVertical: boolean
        ): ResizeHandle => {
            // Create hit zone
            let hitZone: Bounds

            // coners hit box is square, edges are entire ede
            if (expandHorizontal && expandVertical) {
                hitZone = {
                    x: x - hitSize / 2,
                    y: y - hitSize / 2,
                    width: hitSize,
                    height: hitSize,
                }
            } else if (expandHorizontal) {
                hitZone = {
                    x: bounds.x,
                    y: y - hitSize / 2,
                    width: bounds.width,
                    height: hitSize,
                }
            } else if (expandVertical) {
                hitZone = {
                    x: x - hitSize / 2,
                    y: bounds.y,
                    width: hitSize,
                    height: bounds.height,
                }
            } else {
                // Default: square
                hitZone = {
                    x: x - hitSize / 2,
                    y: y - hitSize / 2,
                    width: hitSize,
                    height: hitSize,
                }
            }

            return {
                type,
                position: { x, y },
                cursor: getCursorForHandle(type),
                hitZone,
            }
        }

        handles.push(
            // Corners (square)
            createHandle(HandleType.NW, bounds.x, bounds.y, false, false),
            createHandle(HandleType.NE, bounds.x + bounds.width, bounds.y, false, false),
            createHandle(HandleType.SE, bounds.x + bounds.width, bounds.y + bounds.height, false, false),
            createHandle(HandleType.SW, bounds.x, bounds.y + bounds.height, false, false),

            // Edges (edge-wide)
            createHandle(HandleType.N, bounds.x + bounds.width / 2, bounds.y, true, false),
            createHandle(HandleType.E, bounds.x + bounds.width, bounds.y + bounds.height / 2, false, true),
            createHandle(HandleType.S, bounds.x + bounds.width / 2, bounds.y + bounds.height, true, false),
            createHandle(HandleType.W, bounds.x, bounds.y + bounds.height / 2, false, true)
        )

        return handles
    }

    
    // Find handle at given point using edge-wide hit zones
    getHandleAt(point: Point, handles: ResizeHandle[]): ResizeHandle | null {
        // Check corners first 
        // There is an overlap with the edges and handles
        // checking first will override that 
        for (const handle of handles) {
            if (
                handle.type === HandleType.NW ||
                handle.type === HandleType.NE ||
                handle.type === HandleType.SE ||
                handle.type === HandleType.SW
            ) {
                if (this.pointInHitZone(point, handle.hitZone)) {
                    return handle
                }
            }
        }

        for (const handle of handles) {
            if (
                handle.type === HandleType.N ||
                handle.type === HandleType.E ||
                handle.type === HandleType.S ||
                handle.type === HandleType.W
            ) {
                if (this.pointInHitZone(point, handle.hitZone)) {
                    return handle
                }
            }
        }

        return null
    }

    private pointInHitZone(point: Point, hitZone: Bounds): boolean {
        return (
            point.x >= hitZone.x &&
            point.x <= hitZone.x + hitZone.width &&
            point.y >= hitZone.y &&
            point.y <= hitZone.y + hitZone.height
        )
    }

    // Hide handles when object is too small 
    shouldShowHandles(bounds: Bounds, scale: number): boolean {
        // viewport pixel size
        const widthPx = bounds.width * scale
        const heightPx = bounds.height * scale

        // Hide if smaller than 2 handle sizes
        const minSize = (RESIZE_HANDLE_CLICK_SIZE * 2)

        return widthPx >= minSize && heightPx >= minSize
    }

    renderHandles(ctx: CanvasRenderingContext2D, bounds: Bounds, scale: number): void {
        if (!this.shouldShowHandles(bounds, scale)) {
            return
        }

        const handles = this.getHandlesForBounds(bounds, scale)

        const handleSize = 12 / scale

        ctx.fillStyle = SELECTION_HANDLE_BG
        ctx.strokeStyle = SELECTION_COLOR
        ctx.lineWidth = 2 / scale

        // Draw handles (visual, not hit zones)
        handles.forEach(handle => {
            ctx.fillRect(
                handle.position.x - handleSize / 2,
                handle.position.y - handleSize / 2,
                handleSize,
                handleSize
            )
            ctx.strokeRect(
                handle.position.x - handleSize / 2,
                handle.position.y - handleSize / 2,
                handleSize,
                handleSize
            )
        })
    }

    renderSelection(ctx: CanvasRenderingContext2D, bounds: Bounds, scale: number): void {
        // Draw selection rectangle
        ctx.strokeStyle = SELECTION_COLOR
        ctx.lineWidth = 2 / scale
        ctx.setLineDash([5, 5])
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
        ctx.setLineDash([])

        // Draw handles
        this.renderHandles(ctx, bounds, scale)
    }
}
