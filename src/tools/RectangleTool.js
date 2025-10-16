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
        this.currentRect = new Rectangle(null, {})
    }
    
    onMouseMove(worldPos, e) {
        if (this.currentRect) {
            this.currentRect.data.x2 = worldPos.x
            this.currentRect.data.y2 = worldPos.y
            this.engine.render()
        }
    }

    onMouseUp(worldPos, e) {
        if (this.currentRect) {
            const bounds = this.currentRect.getBounds()
    }

    renderPreview(ctx) {}
}
