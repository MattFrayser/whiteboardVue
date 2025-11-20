import { Rectangle } from '../../objects/types/Rectangle'
import { BaseShapeTool } from '../base/BaseShapeTool'
import type { Point, RectangleData } from '../../../shared/types'
import type { DrawingObject } from '../../objects/DrawingObject'
import { selectors } from '../../../shared/stores/AppState'
import { MIN_SHAPE_SIZE } from '../../../shared/constants'

export class RectangleTool extends BaseShapeTool {
    get currentRect(): Rectangle | null {
        return this.currentShape as Rectangle | null
    }

    protected getShapeType(): string {
        return 'rectangle'
    }

    protected createShape(startPos: Point, e: MouseEvent): DrawingObject {
        const baseData = this.createBaseShapeData(startPos)

        // Create typed RectangleData
        const shapeData: RectangleData = {
            ...baseData,
            type: 'rectangle',
            fill: e.shiftKey ? selectors.getColor() : undefined,
        }

        return new Rectangle(null, shapeData, 0)
    }

    protected isShapeValid(shape: DrawingObject): boolean {
        const bounds = shape.getBounds()
        return bounds.width > MIN_SHAPE_SIZE && bounds.height > MIN_SHAPE_SIZE
    }
}
