import { Circle } from '../../objects/types/Circle'
import { BaseShapeTool } from '../base/BaseShapeTool'
import type { Point } from '../../../shared/types'
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
        const shapeData = this.createBaseShapeData(startPos)

        // Add fill if Shift key is held
        if (e.shiftKey) {
            (shapeData as { fill?: string }).fill = selectors.getColor()
        }

        return new Circle(null, shapeData, 0)
    }

    protected isShapeValid(shape: DrawingObject): boolean {
        // Calculate radius from center to edge
        const radius = Math.sqrt(
            Math.pow(shape.data.x2! - shape.data.x1!, 2) +
                Math.pow(shape.data.y2! - shape.data.y1!, 2)
        )
        return radius > MIN_SHAPE_SIZE
    }
}
