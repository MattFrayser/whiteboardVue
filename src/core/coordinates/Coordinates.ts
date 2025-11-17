import type { Point } from '../../shared/types'
import { selectors, actions } from '../../shared/stores/AppState'
export class Coordinates {
    isPanning: boolean
    panStart: Point | null
    panOffsetStart: Point | null

    constructor() {
        this.isPanning = false
        this.panStart = null
        this.panOffsetStart = null
    }

    // Query viewport transform from AppState
    get offsetX(): number {
        return selectors.getViewportOffsetX()
    }

    get offsetY(): number {
        return selectors.getViewportOffsetY()
    }

    get scale(): number {
        return selectors.getViewportScale()
    }

    // Update viewport transform in AppState
    set offsetX(value: number) {
        const viewport = selectors.getViewport()
        actions.setViewportTransform(value, viewport.offsetY, viewport.scale)
    }

    set offsetY(value: number) {
        const viewport = selectors.getViewport()
        actions.setViewportTransform(viewport.offsetX, value, viewport.scale)
    }

    set scale(value: number) {
        const viewport = selectors.getViewport()
        actions.setViewportTransform(viewport.offsetX, viewport.offsetY, value)
    }

    worldToViewport(point: Point): Point {
        return {
            x: point.x * this.scale + this.offsetX,
            y: point.y * this.scale + this.offsetY,
        }
    }

    viewportToWorld(point: Point, canvas: HTMLCanvasElement): Point {
        const rect = canvas.getBoundingClientRect()
        return {
            x: (point.x - rect.left - this.offsetX) / this.scale,
            y: (point.y - rect.top - this.offsetY) / this.scale,
        }
    }

    startPan(point: Point): void {
        this.isPanning = true
        this.panStart = point
        this.panOffsetStart = { x: this.offsetX, y: this.offsetY }
    }

    pan(point: Point): void {
        if (this.isPanning && this.panStart && this.panOffsetStart) {
            const newOffsetX = this.panOffsetStart.x + (point.x - this.panStart.x)
            const newOffsetY = this.panOffsetStart.y + (point.y - this.panStart.y)
            actions.setViewportOffset(newOffsetX, newOffsetY)
        }
    }

    endPan(): void {
        this.isPanning = false
        this.panStart = null
        this.panOffsetStart = null
    }

    zoom(delta: number, point: Point, canvas: HTMLCanvasElement): void {
        const scaleFactor = 1.1
        const worldPoint = this.viewportToWorld(point, canvas)

        let newScale = this.scale
        if (delta < 0) {
            newScale *= scaleFactor
        } else {
            newScale /= scaleFactor
        }

        // Clamp scale
        newScale = Math.max(0.1, Math.min(10, newScale))

        // Temporarily set scale to calculate new world point
        const viewport = selectors.getViewport()
        const tempOffsetX = viewport.offsetX
        const tempOffsetY = viewport.offsetY

        // Calculate new offset to zoom towards mouse position
        const rect = canvas.getBoundingClientRect()
        const newWorldPoint = {
            x: (point.x - rect.left - tempOffsetX) / newScale,
            y: (point.y - rect.top - tempOffsetY) / newScale,
        }

        const newOffsetX = tempOffsetX + (newWorldPoint.x - worldPoint.x) * newScale
        const newOffsetY = tempOffsetY + (newWorldPoint.y - worldPoint.y) * newScale

        // Batch update all viewport properties at once
        actions.setViewportTransform(newOffsetX, newOffsetY, newScale)
    }
}
