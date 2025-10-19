import { Tool } from './Tool'

export class EraserTool extends Tool {

    constructor(engine) {
        super(engine)
        this.isErasing = false
        this.erasedObjects = new Set()
    }

    onMouseDown(worldPos, e) {
        this.isErasing = true
        this.erasedObjects.clear()
        this.eraseAt(worldPos)
    }

    onMouseMove(worldPos, e) {
        if (this.isErasing) {
            this.eraseAt(worldPos)
        }
    }

    onMouseUp(worldPos, e) {
        if (this.erasedObjects.size > 0) {
            this.engine.objectManager.saveState()
        }
        this.isErasing = false
        this.erasedObjects.clear()
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
                    
                    // Remove object
                    const index = this.engine.objectManager.objects.indexOf(obj)
                    if (index > -1) {
                        this.engine.objectManager.objects.splice(index, 1)
                        this.erasedObjects.add(obj)
                        this.engine.render()
                    }
                }
        })
    }

    renderPreview(ctx) {
         if (this.isErasing) {
                ctx.save()
                ctx.globalAlpha = 0.3
                ctx.fillStyle = '#ff0000'
                const mousePos = this.engine.lastMousePos // You'd need to track this
                if (mousePos) {
                    ctx.beginPath()
                    ctx.arc(mousePos.x, mousePos.y, this.engine.currentWidth * 2, 0, Math.PI * 2)
                    ctx.fill()
                }
                ctx.restore()
        }
    }
}

