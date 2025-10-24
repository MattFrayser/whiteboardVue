import { Tool } from './Tool'

export class EraserTool extends Tool {

    constructor(engine) {
        super(engine)
        this.isErasing = false
        this.erasedObjects = new Set()
        this.currentWorldPos = null
        this.eraserTrail = []
    }

    onMouseDown(worldPos, e) {
        this.isErasing = true
        this.erasedObjects.clear()
        this.eraserTrail = [worldPos]
        this.currentWorldPos = worldPos
        this.eraseAt(worldPos)
    }

    onMouseMove(worldPos, e) {
        this.currentWorldPos = worldPos
        if (this.isErasing) {
            this.eraserTrail.push(worldPos)
            this.eraseAt(worldPos)
        }
        this.engine.render()
    }

    onMouseUp(worldPos, e) {
        this.isErasing = false
        this.erasedObjects.clear()
        this.eraserTrail = []
        this.engine.render()
    }

    eraseAt(point) {
        const objects = [...this.engine.objectManager.objects]
        const eraserSize = 1

        objects.forEach(obj => {
            if (this.erasedObjects.has(obj)) return
            const bounds = obj.getBounds()
            if (point.x + eraserSize > bounds.x &&
                point.x - eraserSize < bounds.x + bounds.width &&
                point.y + eraserSize > bounds.y &&
                point.y - eraserSize < bounds.y + bounds.height) {

                // Mark erased object bounds as dirty
                this.engine.markDirty(bounds)

                // Remove using ObjectManager to trigger broadcast
                this.engine.objectManager.removeObject(obj)
                this.erasedObjects.add(obj)
                this.engine.render()
            }
        })
    }

    renderPreview(ctx) {
        ctx.save()

        // Eraser Trail 
        if (this.isErasing && this.eraserTrail.length > 0) {
            ctx.strokeStyle = '#888888'
            ctx.lineWidth = 10
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.globalAlpha = 0.5

            ctx.beginPath()
            const firstPoint = this.eraserTrail[0]
            ctx.moveTo(firstPoint.x, firstPoint.y)

            for (let i = 1; i < this.eraserTrail.length; i++) {
                const point = this.eraserTrail[i]
                ctx.lineTo(point.x, point.y)
            }
            ctx.stroke()
        }

        ctx.restore()
    }
}

