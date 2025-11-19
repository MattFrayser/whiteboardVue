import { Circle } from '../../objects/types/Circle'
import { BaseShapeTool } from '../base/BaseShapeTool'
import type { Point, CircleData } from '../../../shared/types'
import type { DrawingObject } from '../../objects/DrawingObject'
import { selectors } from '../../../shared/stores/AppState'
import { MIN_SHAPE_SIZE } from '../../../shared/constants'

/**
 * Circle drawing tool
 * Draws circles from center point to edge (radius determined by drag distance)
 * Hold Shift to create filled circles
 */
export class CircleTool extends BaseShapeTool {
    // Expose currentShape as currentCircle for backward compatibility with tests
    get currentCircle(): Circle | null {
        return this.currentShape as Circle | null
    }

    protected getShapeType(): string {
        return 'circle'
    }

    protected createShape(startPos: Point, e: MouseEvent): DrawingObject {
        const baseData = this.createBaseShapeData(startPos)

        // Create typed CircleData
        const shapeData: CircleData = {
            ...baseData,
            type: 'circle',
            fill: e.shiftKey ? selectors.getColor() : undefined
        }

        return new Circle(null, shapeData, 0)
    }

    protected isShapeValid(shape: DrawingObject): boolean {
        // Calculate radius from center to edge (shape should be a Circle)
        const circle = shape as Circle
        const radius = Math.sqrt(
            Math.pow(circle.data.x2 - circle.data.x1, 2) +
                Math.pow(circle.data.y2 - circle.data.y1, 2)
        )
        return radius > MIN_SHAPE_SIZE
    }
}
