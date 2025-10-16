import { Tool } from './Tool'
import { Stroke } from '../objects/Stroke'

export class DrawTool extends Tool {
    constructor(engine) {
        super(engine)
        this.currentStroke = null
        this.isDrawing = false
    }
    
    onMouseDown(worldPos, e) {
        this.isDrawing = true
        this.currentStroke = new Stroke(null, {
            points: [worldPos],
            color: this.engine.currentColor,
            width: this.engine.currentWidth
        })
    }
    
    onMouseMove(worldPos, e) {
        if (this.isDrawing && this.currentStroke) {
            this.currentStroke.data.points.push(worldPos)
            this.engine.render()
        }
    }
    
    onMouseUp(worldPos, e) {
        if (this.currentStroke && this.currentStroke.data.points.length > 1) {
            this.engine.objectManager.addObject(this.currentStroke)
            if (this.engine.toolbar) {
                this.engine.toolbar.updateUndoRedoButtons()
            }
        }
        this.currentStroke = null
        this.isDrawing = false
        this.engine.render()
    }
    
    renderPreview(ctx) {
        if (this.currentStroke) {
            this.currentStroke.render(ctx)
        }
    }
}
