import type { Point } from '../types'

export class Coordinates {
    offsetX: number
    offsetY: number
    scale: number
    isPanning: boolean
    panStart: Point | null
    panOffsetStart: Point | null

    constructor() {
        this.offsetX = 0
        this.offsetY = 0
        this.scale = 1
        this.isPanning = false
        this.panStart = null
        this.panOffsetStart = null
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
        if (this.isPanning && this.panStart) {
            this.offsetX = this.panOffsetStart!.x + (point.x - this.panStart.x)
            this.offsetY = this.panOffsetStart!.y + (point.y - this.panStart.y)
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

        if (delta < 0) {
            this.scale *= scaleFactor
        } else {
            this.scale /= scaleFactor
        }

        // Clamp scale
        this.scale = Math.max(0.1, Math.min(10, this.scale))

        // Adjust offset to zoom towards mouse position
        const newWorldPoint = this.viewportToWorld(point, canvas)
        this.offsetX += (newWorldPoint.x - worldPoint.x) * this.scale
        this.offsetY += (newWorldPoint.y - worldPoint.y) * this.scale
    }
}
