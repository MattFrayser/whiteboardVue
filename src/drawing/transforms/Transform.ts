/**
 * unified transformation logic for resizing, scaling, and translating objects.
 */

import type { Point, Bounds } from '../../shared/types'

export interface Transform {
    translate: Point
    scale: Point
    rotate: number // TODO: add rotate 
    origin: Point  
}

export function createIdentityTransform(): Transform {
    return {
        translate: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotate: 0,
        origin: { x: 0, y: 0 },
    }
}

// transforms (x, y, width, height)
export function applyTransformToBounds(bounds: Bounds, transform: Transform): Bounds {
    // relative position from origin
    const relX = bounds.x - transform.origin.x
    const relY = bounds.y - transform.origin.y

    // scale
    const scaledX = relX * transform.scale.x
    const scaledY = relY * transform.scale.y
    const scaledWidth = bounds.width * transform.scale.x
    const scaledHeight = bounds.height * transform.scale.y

    return {
        x: transform.origin.x + scaledX + transform.translate.x,
        y: transform.origin.y + scaledY + transform.translate.y,
        width: scaledWidth,
        height: scaledHeight,
    }
}

// transforms (x,y); used for objects w/ descrete points and need to preseve
export function applyTransformToPoint(point: Point, transform: Transform): Point {
    // relative position from origin
    const relX = point.x - transform.origin.x
    const relY = point.y - transform.origin.y

    // scale
    const scaledX = relX * transform.scale.x
    const scaledY = relY * transform.scale.y

    return {
        x: transform.origin.x + scaledX + transform.translate.x,
        y: transform.origin.y + scaledY + transform.translate.y,
    }
}

/**
 * Composes multiple transforms into a single transform
 * Transforms are applied in order (left to right)
 */
export function composeTransforms(transforms: Transform[]): Transform {
    if (transforms.length === 0) {
        return createIdentityTransform()
    }

    if (transforms.length === 1) {
        return transforms[0] || createIdentityTransform()
    }

    // Start with identity
    const result = createIdentityTransform()

    // Compose transforms
    for (const transform of transforms) {
        result.translate.x += transform.translate.x
        result.translate.y += transform.translate.y
        result.scale.x *= transform.scale.x
        result.scale.y *= transform.scale.y
        result.rotate += transform.rotate
    }

    // Use the last transform's origin
    const lastTransform = transforms[transforms.length - 1]
    if (lastTransform) {
        result.origin = lastTransform.origin
    }

    return result
}

// Each obj has 8 handles
export enum HandleType {
    NW = 0,  // Northwest corner
    N = 1,   // North edge
    NE = 2,  // Northeast corner
    E = 3,   // East edge
    SE = 4,  // Southeast corner
    S = 5,   // South edge
    SW = 6,  // Southwest corner
    W = 7,   // West edge
}

export function isCornerHandle(handleType: HandleType): boolean {
    return [HandleType.NW, HandleType.NE, HandleType.SE, HandleType.SW].includes(handleType)
}

export function isEdgeHandle(handleType: HandleType): boolean {
    return [HandleType.N, HandleType.E, HandleType.S, HandleType.W].includes(handleType)
}

/**
 * Calculates the anchor point (fixed point) for a resize operation
 * The anchor is the opposite corner/edge that stays fixed during resize
 * This stops the obj from moving around
 */
export function calculateAnchorPoint(handleType: HandleType, bounds: Bounds): Point {
    switch (handleType) {
        case HandleType.NW: // Northwest -> anchor Southeast
            return { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
        case HandleType.N:  // North -> anchor South edge center
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }
        case HandleType.NE: // Northeast -> anchor Southwest
            return { x: bounds.x, y: bounds.y + bounds.height }
        case HandleType.E:  // East -> anchor West edge center
            return { x: bounds.x, y: bounds.y + bounds.height / 2 }
        case HandleType.SE: // Southeast -> anchor Northwest
            return { x: bounds.x, y: bounds.y }
        case HandleType.S:  // South -> anchor North edge center
            return { x: bounds.x + bounds.width / 2, y: bounds.y }
        case HandleType.SW: // Southwest -> anchor Northeast
            return { x: bounds.x + bounds.width, y: bounds.y }
        case HandleType.W:  // West -> anchor East edge center
            return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
        default:
            return { x: bounds.x, y: bounds.y }
    }
}

/**
 * Calculates a resize transform from handle drag
 */
export function calculateResizeTransform(
    handleType: HandleType,
    initialBounds: Bounds,
    currentPoint: Point,
    anchorPoint: Point,
    lockAspectRatio: boolean = false // shift
): Transform {
    const transform = createIdentityTransform()
    transform.origin = anchorPoint // scaling is relative to this point

    // New dimensions are based on handle type
    // SIGNED distances to allow smooth transition through zero 
    // Direction matters:
    //      left/top use (anchor - current),
    //      right/bottom use (current - anchor)


    let newWidth: number
    let newHeight: number

    // Helper to determine handle side
    const isLeftHandle = handleType === HandleType.W || handleType === HandleType.NW || handleType === HandleType.SW
    const isTopHandle = handleType === HandleType.N || handleType === HandleType.NW || handleType === HandleType.NE

    if (isEdgeHandle(handleType)) {
        // Edge handles: only resize one dimension
        if (handleType === HandleType.N || handleType === HandleType.S) {
            // Vertical edge: only change height 
            newHeight = isTopHandle 
                ? (anchorPoint.y - currentPoint.y) 
                : (currentPoint.y - anchorPoint.y)
            newWidth = initialBounds.width
        } else {
            // Horizontal edge: only change width 
            newWidth = isLeftHandle 
                ? (anchorPoint.x - currentPoint.x) 
                : (currentPoint.x - anchorPoint.x)
            newHeight = initialBounds.height
        }
    } else {
        // Corner handles: resize both dimensions 
        // width based: left or right
        newWidth = isLeftHandle 
            ? (anchorPoint.x - currentPoint.x) 
            : (currentPoint.x - anchorPoint.x)
        // height based: top or bottom
        newHeight = isTopHandle 
            ? (anchorPoint.y - currentPoint.y) 
            : (currentPoint.y - anchorPoint.y)

        if (lockAspectRatio) {
            // Maintain aspect ratio by using the larger scale factor (by magnitude)
            const scaleX = newWidth / initialBounds.width
            const scaleY = newHeight / initialBounds.height

            // Use larger magnitude; which ever axis changed more
            if (Math.abs(scaleX) > Math.abs(scaleY)) {
                const uniformScale = scaleX
                newWidth = initialBounds.width * uniformScale
                newHeight = initialBounds.height * uniformScale
            } else {
                const uniformScale = scaleY
                newWidth = initialBounds.width * uniformScale
                newHeight = initialBounds.height * uniformScale
            }
        }
    }

    transform.scale.x = newWidth / initialBounds.width
    transform.scale.y = newHeight / initialBounds.height

    // Prevents obj from getting too small 
    const MIN_SCALE = 0.01
    if (Math.abs(transform.scale.x) < MIN_SCALE) {
        transform.scale.x = Math.sign(transform.scale.x) * MIN_SCALE
    }
    if (Math.abs(transform.scale.y) < MIN_SCALE) {
        transform.scale.y = Math.sign(transform.scale.y) * MIN_SCALE
    }

    // force positive scale on non-resizing dimension
    // corner handles naturally support flipping so just need check edges
    if (isEdgeHandle(handleType)) {
        if (handleType === HandleType.N || handleType === HandleType.S) {
            // Vertical edge: only allow vertical flip
            transform.scale.x = Math.abs(transform.scale.x)
        } else {
            // Horizontal edge: only allow horizontal flip
            transform.scale.y = Math.abs(transform.scale.y)
        }
    }

    return transform
}

/**
 * Calculates new bounds for a group resize operation
 * Returns the new group bounding box
 */
export function calculateNewGroupBounds(
    handleType: HandleType,
    initialBounds: Bounds,
    currentPoint: Point,
    anchorPoint: Point
): Bounds {
    let x: number, y: number, width: number, height: number

    if (isEdgeHandle(handleType)) {
        // Edge handles: only resize one dimension
        if (handleType === HandleType.N || handleType === HandleType.S) {
            // Vertical edge
            width = initialBounds.width
            x = initialBounds.x
            y = Math.min(currentPoint.y, anchorPoint.y)
            height = Math.abs(currentPoint.y - anchorPoint.y)
        } else {
            // Horizontal edge
            height = initialBounds.height
            y = initialBounds.y
            x = Math.min(currentPoint.x, anchorPoint.x)
            width = Math.abs(currentPoint.x - anchorPoint.x)
        }
    } else {
        // Corner handles: keep bounds positive, track flip via scale sign
        x = Math.min(currentPoint.x, anchorPoint.x)
        y = Math.min(currentPoint.y, anchorPoint.y)
        width = Math.abs(currentPoint.x - anchorPoint.x)
        height = Math.abs(currentPoint.y - anchorPoint.y)
    }

    // Ensure minimum dimensions
    const MIN_SIZE = 1
    width = Math.max(MIN_SIZE, width)
    height = Math.max(MIN_SIZE, height)

    return { x, y, width, height }
}
