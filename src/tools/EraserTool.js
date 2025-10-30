import { Tool } from './Tool'

export class EraserTool extends Tool {
    constructor(engine) {
        super(engine)
        this.isErasing = false
        this.erasedObjects = new Set()
        this.currentWorldPos = null
        this.eraserTrail = []
        this.isFading = false
        this.fadeOpacity = 1.0
        this.fadeAnimationId = null
    }

    onMouseDown(worldPos, e) {
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
        this.engine.markDirty()
        this.engine.render()
    }

    onMouseMove(worldPos, e) {
        this.currentWorldPos = worldPos
        if (this.isErasing) {
            this.eraserTrail.push(worldPos)
            this.eraseAt(worldPos)
            this.engine.markDirty()
        }
        this.engine.render()
    }

    onMouseUp(worldPos, e) {
        this.isErasing = false
        this.erasedObjects.clear()

        // Start fade animation instead of immediately clearing trail
        if (this.eraserTrail.length > 0) {
            this.isFading = true
            this.fadeOpacity = 1.0
            this.startFadeAnimation()
        } else {
            this.eraserTrail = []
            this.engine.markDirty()
            this.engine.render()
        }
    }

    startFadeAnimation() {
        const fadeStep = () => {
            this.fadeOpacity -= 0.08 // Fade speed

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

            this.engine.markDirty()
            this.engine.render()
        }

        this.fadeAnimationId = requestAnimationFrame(fadeStep)
    }

    eraseAt(point) {
        const objects = [...this.engine.objectManager.getAllObjects()]
        const eraserSize = 1

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
                // Mark erased object bounds as dirty
                this.engine.markDirty(bounds)

                // Remove using ObjectManager to trigger broadcast
                this.engine.objectManager.removeObject(obj)
                this.erasedObjects.add(obj)
            }
        })
    }

    renderPreview(ctx) {
        ctx.save()

        // Eraser Trail (show during erasing or fading)
        if ((this.isErasing || this.isFading) && this.eraserTrail.length > 0) {
            ctx.strokeStyle = '#888888'
            ctx.lineWidth = 10
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'

            // Apply fade opacity when fading, otherwise use base opacity
            ctx.globalAlpha = this.isFading ? this.fadeOpacity * 0.5 : 0.5

            // Draw smooth curves using quadratic curves
            if (this.eraserTrail.length < 3) {
                // Not enough points for curves, draw simple line
                ctx.beginPath()
                ctx.moveTo(this.eraserTrail[0].x, this.eraserTrail[0].y)
                for (let i = 1; i < this.eraserTrail.length; i++) {
                    ctx.lineTo(this.eraserTrail[i].x, this.eraserTrail[i].y)
                }
                ctx.stroke()
            } else {
                // Draw smooth curves
                ctx.beginPath()
                ctx.moveTo(this.eraserTrail[0].x, this.eraserTrail[0].y)

                for (let i = 1; i < this.eraserTrail.length - 1; i++) {
                    const currentPoint = this.eraserTrail[i]
                    const nextPoint = this.eraserTrail[i + 1]

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
                ctx.quadraticCurveTo(secondLastPoint.x, secondLastPoint.y, lastPoint.x, lastPoint.y)

                ctx.stroke()
            }
        }

        ctx.restore()
    }
}
