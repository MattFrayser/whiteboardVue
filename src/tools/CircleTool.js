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
        this.currentCircle = new Circle(null, {
            x1: worldPos.x,
            y1: worldPos.y,
            x2: worldPos.x,
            y2: worldPos.y,
            color: this.engine.currentColor,
            width:this.engine.currentWidth,
            fill: null
        })
    }

    onMouseMove(worldPos, e) {
        if (this.currentCircle) {

            this.currentCircle.data.x2 = worldPos.x
            this.currentCircle.data.y2 = worldPos.y
        }

        this.engine.render()

    }

    onMouseUp(worldPos, e) {
        if (this.currentCircle) {
            const radius = Math.sqrt(
                Math.pow(this.currentCircle.data.x2 - this.currentCircle.data.x1, 2) +
                Math.pow(this.currentCircle.data.y2 - this.currentCircle.data.y1, 2)
            )

            this.currentCircle = null
            this.startPoint = null
            this.engine.render()
        }
    }

    renderPreview(ctx) {
        if (this.currentCircle) {
            this.currentCircle.render(ctx)
        }
    }
}
