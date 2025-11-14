import { Line } from '../objects/Line'
import { BaseShapeTool } from './BaseShapeTool'
import type { Point } from '../types'
import type { DrawingObject } from '../objects/DrawingObject'

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
        return length > 1
    }
}
