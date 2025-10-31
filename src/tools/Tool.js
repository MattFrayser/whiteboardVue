import { ErrorHandler, ErrorCategory } from '../utils/ErrorHandler'

export class Tool {
    constructor(engine) {
        this.engine = engine
        this.active = false
    }

    activate() {
        this.active = true
    }

    deactivate() {
        this.active = false
    }

    /**
     * Wrap event handlers with error handling
     * @private
     */
    _handleError(error, eventType, worldPos) {
        ErrorHandler.handle(error, ErrorCategory.SILENT, {
            context: `${this.constructor.name}`,
            metadata: { eventType, worldPos },
            showNotification: false // Don't spam users with tool interaction errors
        })
    }

    /**
     * Safe wrapper for onMouseDown with error handling
     */
    _safeOnMouseDown(worldPos, e) {
        try {
            this.onMouseDown(worldPos, e)
        } catch (error) {
            this._handleError(error, 'mousedown', worldPos)
        }
    }

    /**
     * Safe wrapper for onMouseMove with error handling
     */
    _safeOnMouseMove(worldPos, e) {
        try {
            this.onMouseMove(worldPos, e)
        } catch (error) {
            this._handleError(error, 'mousemove', worldPos)
        }
    }

    /**
     * Safe wrapper for onMouseUp with error handling
     */
    _safeOnMouseUp(worldPos, e) {
        try {
            this.onMouseUp(worldPos, e)
        } catch (error) {
            this._handleError(error, 'mouseup', worldPos)
        }
    }

    onMouseDown(_worldPos, _e) {}
    onMouseMove(_worldPos, _e) {}
    onMouseUp(_worldPos, _e) {}
    renderPreview(_ctx) {}
}
