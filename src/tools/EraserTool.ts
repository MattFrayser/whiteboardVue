import { Tool } from './Tool'
import type { Point } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'
import type { DrawingObject } from '../objects/DrawingObject'
import { ERASER_FADE_STEP, ERASER_SIZE, ERASER_TRAIL_WIDTH, ERASER_TRAIL_COLOR, ERASER_TRAIL_OPACITY } from '../constants'

export class EraserTool extends Tool {
    isErasing: boolean
    erasedObjects: Set<DrawingObject>
    currentWorldPos: Point | null
    eraserTrail: Point[]
    isFading: boolean
    fadeOpacity: number
    fadeAnimationId: number | null

    constructor(engine: DrawingEngine) {
        super(engine)
        this.isErasing = false
        this.erasedObjects = new Set()
        this.currentWorldPos = null
        this.eraserTrail = []
        this.isFading = false
        this.fadeOpacity = 1.0
        this.fadeAnimationId = null
    }

    override onMouseDown(worldPos: Point, _e: MouseEvent): void {
        // Cancel any ongoing fade animation
        if (this.fadeAnimationId) {
            cancelAnimationFrame(this.fadeAnimationId)
            this.fadeAnimationId = null
        }

        this.isErasing = true
        this.isFading = false
        this.fadeOpacity = 1.0
        this.erasedObjects.clear()
        this.eraserTrail = [worldPos]
        this.currentWorldPos = worldPos
        this.eraseAt(worldPos)
        this.engine.renderDirty()
    }

    override onMouseMove(worldPos: Point, _e: MouseEvent): void {
        this.currentWorldPos = worldPos
        if (this.isErasing) {
            this.eraserTrail.push(worldPos)
            this.eraseAt(worldPos)
        }
        this.engine.renderDirty()
    }

    override onMouseUp(_worldPos: Point, _e: MouseEvent): void {
        this.isErasing = false

        // Note: History is automatically saved by removeObject() for each erased object
        // No need for manual saveState() call

        this.erasedObjects.clear()

        // Start fade animation instead of immediately clearing trail
        if (this.eraserTrail.length > 0) {
            this.isFading = true
            this.fadeOpacity = 1.0
            this.startFadeAnimation()
        } else {
            this.eraserTrail = []
            this.engine.renderDirty()
        }
    }

    startFadeAnimation(): void {
        const fadeStep = () => {
            this.fadeOpacity -= ERASER_FADE_STEP // Fade speed

            if (this.fadeOpacity <= 0) {
                // Animation complete
                this.fadeOpacity = 0
                this.isFading = false
                this.eraserTrail = []
                this.fadeAnimationId = null
            } else {
                // Continue animation
                this.fadeAnimationId = requestAnimationFrame(fadeStep)
            }

            this.engine.renderDirty()
        }

        this.fadeAnimationId = requestAnimationFrame(fadeStep)
    }

    eraseAt(point: Point): void {
        const objects = [...this.engine.objectManager.getAllObjects()]
        const eraserSize = ERASER_SIZE

        objects.forEach(obj => {
            if (this.erasedObjects.has(obj)) {
                return
            }
            const bounds = obj.getBounds()
            if (
                point.x + eraserSize > bounds.x &&
                point.x - eraserSize < bounds.x + bounds.width &&
                point.y + eraserSize > bounds.y &&
                point.y - eraserSize < bounds.y + bounds.height
            ) {
                // Remove using ObjectManager to trigger broadcast and record history
                this.engine.objectManager.removeObject(obj, true)
                this.erasedObjects.add(obj)
            }
        })
    }

    override renderPreview(ctx: CanvasRenderingContext2D): void {
        ctx.save()

        // Eraser Trail (show during erasing or fading)
        if ((this.isErasing || this.isFading) && this.eraserTrail.length > 0) {
            ctx.strokeStyle = ERASER_TRAIL_COLOR
            ctx.lineWidth = ERASER_TRAIL_WIDTH
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'

            // Apply fade opacity when fading, otherwise use base opacity
            ctx.globalAlpha = this.isFading ? this.fadeOpacity * ERASER_TRAIL_OPACITY : ERASER_TRAIL_OPACITY

            // Draw smooth curves using quadratic curves
            if (this.eraserTrail.length < 3) {
                // Not enough points for curves, draw simple line
                const firstPoint = this.eraserTrail[0]
                if (!firstPoint) return

                ctx.beginPath()
                ctx.moveTo(firstPoint.x, firstPoint.y)
                for (let i = 1; i < this.eraserTrail.length; i++) {
                    const point = this.eraserTrail[i]
                    if (point) {
                        ctx.lineTo(point.x, point.y)
                    }
                }
                ctx.stroke()
            } else {
                // Draw smooth curves
                const firstPoint = this.eraserTrail[0]
                if (!firstPoint) return

                ctx.beginPath()
                ctx.moveTo(firstPoint.x, firstPoint.y)

                for (let i = 1; i < this.eraserTrail.length - 1; i++) {
                    const currentPoint = this.eraserTrail[i]
                    const nextPoint = this.eraserTrail[i + 1]

                    if (!currentPoint || !nextPoint) continue

                    // Calculate midpoint for smooth curve
                    const midPoint = {
                        x: (currentPoint.x + nextPoint.x) / 2,
                        y: (currentPoint.y + nextPoint.y) / 2
                    }

                    // Draw quadratic curve to midpoint using current point as control
                    ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, midPoint.x, midPoint.y)
                }

                // Draw final segment to last point
                const lastPoint = this.eraserTrail[this.eraserTrail.length - 1]
                const secondLastPoint = this.eraserTrail[this.eraserTrail.length - 2]
                if (lastPoint && secondLastPoint) {
                    ctx.quadraticCurveTo(secondLastPoint.x, secondLastPoint.y, lastPoint.x, lastPoint.y)
                }

                ctx.stroke()
            }
        }

        ctx.restore()
    }
}
