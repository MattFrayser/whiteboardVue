import { DrawingObject } from '../core/DrawingObject'

export class Circle extends DrawingObject {
    constructor(id, data) {
        super(id, 'circle', data)
    }

    getBounds() {}

    containsPoint(point) {}

    move(dx, dy) {}

    render(ctx) {}
}
