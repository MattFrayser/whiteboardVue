import { Tool } from './Tool'
import { Rectangle } from '../objects/Rectangle'

export class RectangleTool extends Tool {
    constructor(engine) {
        super(engine)
        this.startPoint = null 
        this.currentRect = null
    }

    onMouseDown(worldPos, e) {
        this.startPoint = worldPos
        this.currentRect = new Rectangle(null, {
            x1: worldPos.x,
            y1: worldPos.y,
            x2: worldPos.x,
            y2: worldPos.y,
            color: this.engine.currentColor,
            width: this.engine.currentWidth,
            fill: e.shiftKey ? this.engine.currentColor : null
        })
    }
    
    onMouseMove(worldPos, e) {
        if (this.currentRect) {
            this.currentRect.data.x2 = worldPos.x
            this.currentRect.data.y2 = worldPos.y
            this.engine.render()
        }
    }

    onMouseUp() {
        if (this.currentRect) {
            const bounds = this.currentRect.getBounds()
            if (bounds.width > 1 && bounds.height > 1) {
                this.engine.objectManager.addObject(this.currentRect)
                if (this.engine.toolbar) {
                    this.engine.toolbar.updateUndoRedoButtons()
                }
            }
            this.currentRect = null
            this.startPoint = null
            this.engine.render()
        }
    }

    renderPreview(ctx) {
        if (this.currentRect) {
            this.currentRect.render(ctx)
        }
    }
}
