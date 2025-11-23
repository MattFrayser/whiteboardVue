import { Circle } from '../../objects/types/Circle'
import { BaseShapeTool } from '../base/BaseShapeTool'
import type { Point, CircleData } from '../../../shared/types'
import type { DrawingObject } from '../../objects/DrawingObject'
import { selectors } from '../../../shared/stores/AppState'
import { MIN_SHAPE_SIZE } from '../../../shared/constants'

export class CircleTool extends BaseShapeTool {
    // Expose currentShape as currentCircle for backward compatibility with tests
    // will fix tests
    get currentCircle(): Circle | null {
        return this.currentShape as Circle | null
    }

    protected getShapeType(): string {
        return 'circle'
    }

    protected createShape(startPos: Point, e: MouseEvent): DrawingObject {
        const baseData = this.createBaseShapeData(startPos)

        const shapeData: CircleData = {
            ...baseData,
            type: 'circle',
            fill: e.shiftKey ? selectors.getColor() : undefined,
        }

        return new Circle(null, shapeData, 0)
    }
    override onMouseMove(worldPos: Point, _e: MouseEvent): void {

        if (this.currentShape && this.startPoint) {
            // Calculate bounding box from start corner to current corner
            const minX = Math.min(this.startPoint.x, worldPos.x)
            const minY = Math.min(this.startPoint.y, worldPos.y)
            const maxX = Math.max(this.startPoint.x, worldPos.x)
            const maxY = Math.max(this.startPoint.y, worldPos.y)

            const width = maxX - minX
            const height = maxY - minY

            // Calculate center of bounding box
            const centerX = minX + width / 2
            const centerY = minY + height / 2

            // Use the larger dimension to make a perfect circle
            const size = Math.max(width, height)
            const radius = size / 2

            // Update circle data: (x1, y1) = center, (x2, y2) = edge point
            this.currentShape.data.x1 = centerX
            this.currentShape.data.y1 = centerY
            this.currentShape.data.x2 = centerX + radius
            this.currentShape.data.y2 = centerY

            const newBounds = this.currentShape.getBounds()

            this.lastBounds = newBounds
            this.engine.renderDirty()
        }
    }

    protected isShapeValid(shape: DrawingObject): boolean {
        const circle = shape as Circle
        const radius = Math.sqrt(
            Math.pow(circle.data.x2 - circle.data.x1, 2) +
                Math.pow(circle.data.y2 - circle.data.y1, 2)
        )
        return radius > MIN_SHAPE_SIZE
    }
}
