import { ErrorHandler, ErrorCategory } from '../../../shared/utils/ErrorHandler'
import type { Point } from '../../../shared/types'
import type { DrawingEngine } from '../../../core/engine/DrawingEngine'

export class Tool {
    engine: DrawingEngine
    active: boolean

    constructor(engine: DrawingEngine) {
        this.engine = engine
        this.active = false
    }

    activate(): void {
        this.active = true
    }

    deactivate(): void {
        this.active = false
    }

    /**
     * Wrap event handlers with error handling
     */
    _handleError(error: unknown, eventType: string, worldPos: Point): void {
        ErrorHandler.handle(error instanceof Error ? error : new Error(String(error)), ErrorCategory.SILENT, {
            context: `${this.constructor.name}`,
            metadata: { eventType, worldPos },
            showNotification: false // Don't spam users with tool interaction errors
        })
    }

    /**
     * Safe wrapper for onMouseDown with error handling
     */
    _safeOnMouseDown(worldPos: Point, e: MouseEvent): void {
        try {
            this.onMouseDown(worldPos, e)
        } catch (error) {
            this._handleError(error, 'mousedown', worldPos)
        }
    }

    /**
     * Safe wrapper for onMouseMove with error handling
     */
    _safeOnMouseMove(worldPos: Point, e: MouseEvent): void {
        try {
            this.onMouseMove(worldPos, e)
        } catch (error) {
            this._handleError(error, 'mousemove', worldPos)
        }
    }

    /**
     * Safe wrapper for onMouseUp with error handling
     */
    _safeOnMouseUp(worldPos: Point, e: MouseEvent): void {
        try {
            this.onMouseUp(worldPos, e)
        } catch (error) {
            this._handleError(error, 'mouseup', worldPos)
        }
    }

    onMouseDown(_worldPos: Point, _e: MouseEvent): void {}
    onMouseMove(_worldPos: Point, _e: MouseEvent): void {}
    onMouseUp(_worldPos: Point, _e: MouseEvent): void {}
    renderPreview(_ctx: CanvasRenderingContext2D): void {}
}
