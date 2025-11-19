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

    _handleError(error: unknown, eventType: string, worldPos: Point): void {
        ErrorHandler.handle(error instanceof Error ? error : new Error(String(error)), ErrorCategory.SILENT, {
            context: `${this.constructor.name}`,
            metadata: { eventType, worldPos },
            showNotification: false // Don't spam users with tool interaction errors
        })
    }

     // Safe wrapper for onMouseDown with error handling
    _safeWrap(
        eventType: 'mousedown' | 'mousemove' | 'mouseup',
        handler: (worldPos: Point, e: MouseEvent) => void,
        worldPos: Point,
        e: MouseEvent
    ): void {
        try {
            handler.call(this, worldPos, e)
        } catch (error) {
            this._handleError(error, eventType, worldPos)
        }
    }

    _safeOnMouseDown(worldPos: Point, e: MouseEvent): void {
        this._safeWrap('mousedown', this.onMouseDown, worldPos, e)
    }

    _safeOnMouseMove(worldPos: Point, e: MouseEvent): void {
        this._safeWrap('mousemove', this.onMouseMove, worldPos, e)
    }

    _safeOnMouseUp(worldPos: Point, e: MouseEvent): void {
        this._safeWrap('mouseup', this.onMouseUp, worldPos, e)
    }

    onMouseDown(_worldPos: Point, _e: MouseEvent): void {}
    onMouseMove(_worldPos: Point, _e: MouseEvent): void {}
    onMouseUp(_worldPos: Point, _e: MouseEvent): void {}
    renderPreview(_ctx: CanvasRenderingContext2D): void {}
}
