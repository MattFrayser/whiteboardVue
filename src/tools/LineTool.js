import { Tool } from './Tool'
import { Line } from '../objects/Line'

export class LineTool extends Tool {
    constructor(engine) {
        super(engine)
    }

    onMouseDown(worldPos, e) {
        this.startPoint = worldPos
        this.currentLine = new Line(null, {
            x1: worldPos.x,
            y1: worldPos.y,
            x2: worldPos.x,
            y2: worldPos.y,
            color: this.engine.currentColor,
            width: this.engine.currentWidth,
        })
    }

    onMouseMove(worldPos, e) {
        if (this.currentLine) {
            
            this.currentLine.data.x2 = worldPos.x
            this.currentLine.data.y2 = worldPos.y
        }
        this.engine.render()
    }
    
    onMouseUp(worldPos, e) {
        if (this.currentLine) {
            const length = Math.sqrt(
                Math.pow(this.currentLine.data.x2 - this.currentLine.data.x1, 2) +
                Math.pow(this.currentLine.data.y2 - this.currentLine.data.y1, 2)
            )
            if (length > 1) {
                this.engine.objectManager.addObject(this.currentLine)
          }
            this.currentLine = null
            this.startPoint = null
            this.engine.render()
        }
    }
    
    renderPreview(ctx) {
        if (this.currentLine) {
            this.currentLine.render(ctx)
        }
    }
}
