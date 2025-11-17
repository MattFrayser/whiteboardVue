import { Rectangle } from '../../objects/types/Rectangle'
import { BaseShapeTool } from '../base/BaseShapeTool'
import type { Point } from '../../../shared/types'
import type { DrawingObject } from '../../objects/DrawingObject'
import { selectors } from '../../../shared/stores/AppState'
import { MIN_SHAPE_SIZE } from '../../../shared/constants'
/**
 * Rectangle drawing tool
 * Draws rectangles from corner to corner
 * Hold Shift to create filled rectangles
 */
export class RectangleTool extends BaseShapeTool {
    // Expose currentShape as currentRect for backward compatibility with tests
    get currentRect(): Rectangle | null {
        return this.currentShape as Rectangle | null
    }

    protected getShapeType(): string {
        return 'rectangle'
    }

    protected createShape(startPos: Point, e: MouseEvent): DrawingObject {
        const shapeData = this.createBaseShapeData(startPos)

        // Add fill if Shift key is held
        if (e.shiftKey) {
            (shapeData as { fill?: string }).fill = selectors.getColor()
        }

        return new Rectangle(null, shapeData, 0)
    }

    protected isShapeValid(shape: DrawingObject): boolean {
        const bounds = shape.getBounds()
        return bounds.width > MIN_SHAPE_SIZE && bounds.height > MIN_SHAPE_SIZE
    }
}
