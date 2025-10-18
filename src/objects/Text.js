import { DrawingObject } from '../core/DrawingObject'

export class Text extends DrawingObject {
    constructor(id, data) {
        super(id, 'text', data)
    }

    measureBounds() {}

    getBounds() {}

    move(dx, dy) {}

    render(ctx) {}

    setText(text) {}
}
