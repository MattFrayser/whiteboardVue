import { Line } from '../../objects/types/Line'
import { BaseShapeTool } from '../base/BaseShapeTool'
import type { Point } from '../../../shared/types'
import type { DrawingObject } from '../../objects/DrawingObject'
import { MIN_SHAPE_SIZE } from '../../../shared/constants'
/**
 * Line drawing tool
 * Draws straight lines from point to point
 */
export class LineTool extends BaseShapeTool {
    // Expose currentShape as currentLine for backward compatibility with tests
    get currentLine(): Line | null {
        return this.currentShape as Line | null
    }

    protected getShapeType(): string {
        return 'line'
    }

    protected createShape(startPos: Point, _e: MouseEvent): DrawingObject {
        const shapeData = this.createBaseShapeData(startPos)
        return new Line(null, shapeData, 0)
    }

    protected isShapeValid(shape: DrawingObject): boolean {
        // Calculate line length
        const length = Math.sqrt(
            Math.pow(shape.data.x2! - shape.data.x1!, 2) +
                Math.pow(shape.data.y2! - shape.data.y1!, 2)
        )
        return length > MIN_SHAPE_SIZE
    }
}
