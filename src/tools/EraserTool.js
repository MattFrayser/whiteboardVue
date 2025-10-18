import { Tool } from './Tool'
import { Eraser } from '../objects/Eraser'

export class Eraser extends Tool {

    constructor(engine) {
        super(engine)
        this.isErasing = false
        this.erasedObjects = new Set()
    }

    onMouseDown(worldPos, e) {
    }

    onMouseMove(worldPos, e) {}

    onMouseUp(worldPos, e) {}

    eraseAt(point) {}

    renderPreview(ctx) {}
}

