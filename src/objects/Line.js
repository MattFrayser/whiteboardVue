import { DrawingObject } from '../core/DrawingObject'

export class Line extends DrawingObject {
    constructor(id, data) {
        super(id, 'line', data)
    }

    getBounds() {}

    containsPoint(point) {}

    pointToLineDistance(point, lineStart, lineEnd) {}

    move(dx, dy) {}

    render(ctx) {}
}
