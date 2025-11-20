/**
 * Logic for pasting objects at a target position
 */

import type { DrawingObject } from '../../../drawing/objects/DrawingObject'
import type { DrawingObjectData, Point, Bounds } from '../../../shared/types/common'

export interface PasteContext {
    clipboardData: Array<{ id: string; type: string; data: DrawingObjectData; zIndex: number }>
    targetPosition: Point
    createObject: (data: DrawingObjectData | { id: string; type: string; data: DrawingObjectData; zIndex: number }) => DrawingObject | null
    addObjectWithoutHistory: (obj: DrawingObject) => void
    selectObject: (obj: DrawingObject, addToSelection: boolean) => void
}

export function executePaste(ctx: PasteContext): DrawingObject[] {
    const newObjects: DrawingObject[] = []

    // clone objects with new IDs
    ctx.clipboardData.forEach(obj => {
        const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)
        const clonedObject = {
            id: generateId(),
            type: obj.type,
            data: structuredClone(obj.data), // Deep clone to avoid shared references
            zIndex: obj.zIndex
        }
        const newObject = ctx.createObject(clonedObject)
        if (newObject) {
            ctx.addObjectWithoutHistory(newObject)
            newObjects.push(newObject)
        }
    })

    if (newObjects.length === 0) {
        return []
    }

    // bounding box of all pasted objects
    const bounds = calculateGroupBounds(newObjects)

    // center offset to cursor
    const offset = calculateCenterOffset(bounds, ctx.targetPosition)

    // select obj on move, more of a visual thing than needed 
    newObjects.forEach(obj => {
        obj.move(offset.dx, offset.dy)
        ctx.selectObject(obj, true) // true = add to selection
    })

    return newObjects
}

function calculateGroupBounds(objects: DrawingObject[]): Bounds {
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

function calculateCenterOffset(bounds: Bounds, target: Point): { dx: number; dy: number } {
    const groupCenterX = bounds.x + bounds.width / 2
    const groupCenterY = bounds.y + bounds.height / 2

    return {
        dx: target.x - groupCenterX,
        dy: target.y - groupCenterY,
    }
}
