import { Line } from '../../objects/types/Line'
import { BaseShapeTool } from '../base/BaseShapeTool'
import type { Point, LineData } from '../../../shared/types'
import type { DrawingObject } from '../../objects/DrawingObject'
import { MIN_SHAPE_SIZE } from '../../../shared/constants'

export class LineTool extends BaseShapeTool {
    get currentLine(): Line | null {
        return this.currentShape as Line | null
    }

    protected getShapeType(): string {
        return 'line'
    }

    protected createShape(startPos: Point, _e: MouseEvent): DrawingObject {
        const baseData = this.createBaseShapeData(startPos)
        const shapeData: LineData = { ...baseData, type: 'line' }
        return new Line(null, shapeData, 0)
    }

    protected isShapeValid(shape: DrawingObject): boolean {
        // Calculate line length
        const line = shape as Line
        const length = Math.sqrt(
            Math.pow(line.data.x2 - line.data.x1, 2) + Math.pow(line.data.y2 - line.data.y1, 2)
        )
        return length > MIN_SHAPE_SIZE
    }
}
