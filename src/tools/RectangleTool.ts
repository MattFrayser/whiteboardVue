import { Rectangle } from '../objects/Rectangle'
import { BaseShapeTool } from './BaseShapeTool'
import type { Point } from '../types'
import type { DrawingObject } from '../objects/DrawingObject'
import { selectors } from '../stores/AppState'

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
        return bounds.width > 1 && bounds.height > 1
    }
}
