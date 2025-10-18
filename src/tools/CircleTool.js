import { Tool } from './Tool'
import { Circle } from '../objects/Circle'

export class CircleTool extends Tool {
    constructor(engine) {
        super(engine)
        this.startPoint = null
        this.currentCircle = null
    }

    onMouseDown(worldPos, e) {
        this.startPoint = worldPos
        this.currentCircle = new Circle()
    }

    onMouseMove(worldPos, e) {}

    onMouseUp(worldPos, e) {}

    renderPreview(ctx) {}
}
