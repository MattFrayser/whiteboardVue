/**
 * Paste Algorithm
 * Handles the complex logic for pasting objects at a target position
 * - Calculates bounding box of clipboard objects
 * - Centers group at cursor position
 * - Returns created objects for caller to handle history/network
 */

import type { DrawingObject } from '../../../drawing/objects/DrawingObject'
import type { DrawingObjectData, Point, Bounds } from '../../../shared/types/common'
/**
 * Context needed for paste operation
 * This avoids tight coupling to ObjectManager
 */
export interface PasteContext {
    clipboardData: DrawingObjectData[]
    targetPosition: Point
    createObject: (data: DrawingObjectData) => DrawingObject | null
    addObjectWithoutHistory: (obj: DrawingObject) => void
    selectObject: (obj: DrawingObject, addToSelection: boolean) => void
}

/**
 * Execute paste operation
 * @returns Array of newly created objects (for history recording)
 */
export function executePaste(ctx: PasteContext): DrawingObject[] {
    const newObjects: DrawingObject[] = []

    // Step 1: Create cloned objects with new IDs
    ctx.clipboardData.forEach(data => {
        const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)
        const clonedData = { ...data, id: generateId() }
        const newObject = ctx.createObject(clonedData)
        if (newObject) {
            ctx.addObjectWithoutHistory(newObject)
            newObjects.push(newObject)
        }
    })

    if (newObjects.length === 0) {
        return []
    }

    // Step 2: Calculate bounding box of all pasted objects
    const bounds = calculateGroupBounds(newObjects)

    // Step 3: Calculate offset to center group at cursor
    const offset = calculateCenterOffset(bounds, ctx.targetPosition)

    // Step 4: Move all objects and select them
    newObjects.forEach(obj => {
        obj.move(offset.dx, offset.dy)
        ctx.selectObject(obj, true) // true = add to selection
    })

    return newObjects
}

/**
 * Calculate the bounding box that contains all objects
 */
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
        height: maxY - minY
    }
}

/**
 * Calculate offset needed to center group at target position
 */
function calculateCenterOffset(bounds: Bounds, target: Point): { dx: number; dy: number } {
    const groupCenterX = bounds.x + bounds.width / 2
    const groupCenterY = bounds.y + bounds.height / 2
    
    return {
        dx: target.x - groupCenterX,
        dy: target.y - groupCenterY
    }
}
