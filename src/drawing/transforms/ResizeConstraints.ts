/**
 * Defines how elements behave during resize operations.
 */

import type { Transform } from './Transform'
import { HandleType, isEdgeHandle } from './Transform'

export interface KeyModifiers {
    shift: boolean  // Constrain proportions
    // built with future features in mind. just have to think of them...
}

export interface ResizeConstraints {
    lockAspectRatio: boolean
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    maintainCircular?: boolean
    resizeFont?: boolean
    shiftBehavior?: 'constrain' // maybe different behaviors in future
}

export function createDefaultConstraints(): ResizeConstraints {
    return {
        lockAspectRatio: false,
        minWidth: 1,
        minHeight: 1,
        shiftBehavior: 'constrain', // Shift to constrain (Excalidraw style)
    }
}

export function createCircleConstraints(): ResizeConstraints {
    return {
        lockAspectRatio: true,  // Always maintain aspect ratio
        maintainCircular: true,
        minWidth: 1,
        minHeight: 1,
        shiftBehavior: 'constrain',
    }
}

export function shouldLockAspectRatio(
    constraints: ResizeConstraints,
    modifiers: KeyModifiers,
    handleType: HandleType
): boolean {
    // Only do 1D, no need to to lock
    if (isEdgeHandle(handleType)) {
        return false
    }

    // circles always 
    if (constraints.maintainCircular) {
        return true
    }

    return modifiers.shift || constraints.lockAspectRatio
}

// enforces min/max dimensions and aspect ratio rules
export function applyConstraints(
    transform: Transform,
    constraints: ResizeConstraints,
    originalWidth: number,
    originalHeight: number
): Transform {
    const constrained = { ...transform }

    let newWidth = originalWidth * Math.abs(constrained.scale.x)
    let newHeight = originalHeight * Math.abs(constrained.scale.y)

    if (constraints.minWidth !== undefined) {
        newWidth = Math.max(constraints.minWidth, newWidth)
    }
    if (constraints.minHeight !== undefined) {
        newHeight = Math.max(constraints.minHeight, newHeight)
    }
    if (constraints.maxWidth !== undefined) {
        newWidth = Math.min(constraints.maxWidth, newWidth)
    }
    if (constraints.maxHeight !== undefined) {
        newHeight = Math.min(constraints.maxHeight, newHeight)
    }

    constrained.scale.x = (newWidth / originalWidth) * Math.sign(constrained.scale.x)
    constrained.scale.y = (newHeight / originalHeight) * Math.sign(constrained.scale.y)

    return constrained
}


// locking aspect ratio && enforcing min/max sizes
export class ConstraintSolver {

    solve(
        transform: Transform,
        constraints: ResizeConstraints,
        modifiers: KeyModifiers,
        handleType: HandleType,
        originalWidth: number,
        originalHeight: number
    ): Transform {

        const lockAspect = shouldLockAspectRatio(constraints, modifiers, handleType)

        let result = { ...transform }

        // Locks aspect ratio 
        // done by making x and y = to the larger number
        if (lockAspect && !isEdgeHandle(handleType)) {
            // Use the larger scale factor to maintain aspect ratio
            const scaleX = Math.abs(result.scale.x)
            const scaleY = Math.abs(result.scale.y)
            const uniformScale = Math.max(scaleX, scaleY)

            // Preserve sign for flipping
            result.scale.x = uniformScale * Math.sign(result.scale.x)
            result.scale.y = uniformScale * Math.sign(result.scale.y)
        }

        result = applyConstraints(result, constraints, originalWidth, originalHeight)

        return result
    }
}
