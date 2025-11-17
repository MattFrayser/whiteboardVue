import { Tool } from './Tool'
import type { Point, Bounds } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'
import type { DrawingObject } from '../objects/DrawingObject'
import { selectors } from '../stores/AppState'

/**
 * Base class for shape-drawing tools (Rectangle, Circle, Line)
 *
 * Consolidates common logic for two-point shape creation:
 * - Mouse down: Set start point
 * - Mouse move: Update end point (x2, y2)
 * - Mouse up: Validate and add shape to canvas
 *
 * Subclasses only need to implement:
 * - createShape(): Create the specific shape type
 * - isShapeValid(): Validate shape meets minimum size requirements
 */
export abstract class BaseShapeTool extends Tool {
    protected startPoint: Point | null
    protected currentShape: DrawingObject | null
    protected lastBounds: Bounds | null

    constructor(engine: DrawingEngine) {
        super(engine)
        this.startPoint = null
        this.currentShape = null
        this.lastBounds = null
    }

    /**
     * Create the specific shape object
     * @param startPos Starting position
     * @param e Mouse event (for modifiers like Shift)
     * @returns The created shape object
     */
    protected abstract createShape(startPos: Point, e: MouseEvent): DrawingObject

    /**
     * Validate if the shape meets minimum size requirements
     * @param shape The shape to validate
     * @returns True if shape is valid and should be added
     */
    protected abstract isShapeValid(shape: DrawingObject): boolean

    /**
     * Get the shape type name for the data object
     * @returns Type name (e.g., 'circle', 'rectangle', 'line')
     */
    protected abstract getShapeType(): string

    override onMouseDown(worldPos: Point, e: MouseEvent): void {
        this.startPoint = worldPos
        this.currentShape = this.createShape(worldPos, e)
        this.lastBounds = null
    }

    override onMouseMove(worldPos: Point, _e: MouseEvent): void {
        if (this.currentShape) {
            // Update shape end point
            this.currentShape.data.x2 = worldPos.x
            this.currentShape.data.y2 = worldPos.y

            const newBounds = this.currentShape.getBounds()
            this.lastBounds = newBounds

            this.engine.renderDirty()
        }
    }

    override onMouseUp(_worldPos: Point, _e: MouseEvent): void {
        if (this.currentShape) {
            // Validate and add shape
            if (this.isShapeValid(this.currentShape)) {
                this.engine.objectManager.addObject(this.currentShape)
            }

            // Reset state
            this.currentShape = null
            this.startPoint = null
            this.lastBounds = null
            this.engine.renderDirty()
        }
    }

    override renderPreview(ctx: CanvasRenderingContext2D): void {
        if (this.currentShape) {
            this.currentShape.render(ctx)
        }
    }

    /**
     * Helper to create base shape data common to all shapes
     * @param pos Starting position
     * @returns Base shape data object
     */
    protected createBaseShapeData(pos: Point) {
        return {
            id: '',
            type: this.getShapeType(),
            x: pos.x,
            y: pos.y,
            x1: pos.x,
            y1: pos.y,
            x2: pos.x,
            y2: pos.y,
            color: selectors.getColor(),
            width: selectors.getBrushSize(),
        }
    }
}
