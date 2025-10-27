/**
 * Handles mouse and keyboard input for the drawing engine
 */
export class InputHandler {
    constructor(engine, canvas) {
        this.engine = engine
        this.canvas = canvas
        this.rightMouseDown = false
        this.lastMousePos = { x: 0, y: 0 }
        this.lastCursorBroadcast = 0

        this.setupEventListeners()
    }

    setupEventListeners() {
        // Store bound methods for cleanup
        this.boundHandleMouseDown = e => this.handleMouseDown(e)
        this.boundHandleMouseMove = e => this.handleMouseMove(e)
        this.boundHandleMouseUp = e => this.handleMouseUp(e)
        this.boundHandleMouseWheel = e => this.handleMouseWheel(e)
        this.boundPreventContext = e => e.preventDefault()
        this.boundHandleKeyDown = e => this.handleKeyDown(e)

        this.canvas.addEventListener('mousedown', this.boundHandleMouseDown)
        this.canvas.addEventListener('mousemove', this.boundHandleMouseMove)
        this.canvas.addEventListener('mouseup', this.boundHandleMouseUp)
        this.canvas.addEventListener('wheel', this.boundHandleMouseWheel)
        this.canvas.addEventListener('contextmenu', this.boundPreventContext)

        document.addEventListener('keydown', this.boundHandleKeyDown)
    }

    handleMouseDown(e) {
        const worldPos = this.engine.coordinates.viewportToWorld(
            { x: e.clientX, y: e.clientY },
            this.canvas
        )

        if (e.button === 0) {
            this.engine.currentTool.onMouseDown(worldPos, e)
        } else if (e.button === 2) {
            this.engine.coordinates.startPan({ x: e.clientX, y: e.clientY })
            this.rightMouseDown = true
            this.updateCursor()
        }
    }

    handleMouseMove(e) {
        this.lastMousePos = { x: e.clientX, y: e.clientY }

        const worldPos = this.engine.coordinates.viewportToWorld(
            { x: e.clientX, y: e.clientY },
            this.canvas
        )

        // Broadcast cursor position with throttling
        const now = Date.now()
        if (now - this.lastCursorBroadcast >= 50) {
            this.lastCursorBroadcast = now
            const toolName = Object.keys(this.engine.tools).find(
                key => this.engine.tools[key] === this.engine.currentTool
            )
            this.engine.eventBus.publish('engine:cursorMove', {
                x: worldPos.x,
                y: worldPos.y,
                tool: toolName,
            })
        }

        // left click
        if (e.buttons === 1) {
            this.engine.currentTool.onMouseMove(worldPos, e)
            // right click
        } else if (e.buttons === 2) {
            e.preventDefault()
            this.engine.coordinates.pan({ x: e.clientX, y: e.clientY })
            this.engine.renderOptimizer.forceFullRedraw = true
            this.engine.render()
        }
    }

    handleMouseUp(e) {
        const worldPos = this.engine.coordinates.viewportToWorld(
            { x: e.clientX, y: e.clientY },
            this.canvas
        )

        if (e.button === 0) {
            this.engine.currentTool.onMouseUp(worldPos, e)
        } else if (e.button === 2) {
            this.engine.coordinates.endPan()
            this.rightMouseDown = false
            this.updateCursor(worldPos)
        }
    }

    handleMouseWheel(e) {
        e.preventDefault()
        const zoomPoint = { x: e.clientX, y: e.clientY }
        this.engine.coordinates.zoom(e.deltaY, zoomPoint, this.canvas)
        this.engine.renderOptimizer.forceFullRedraw = true
        this.engine.render()
    }

    updateCursor(worldPos = null) {
        if (this.rightMouseDown) {
            this.canvas.style.cursor = 'grabbing'
        } else {
            // Restore tool-specific cursor
            if (this.engine.currentTool === this.engine.tools.select && worldPos) {
                // SelectTool has dynamic cursor based on hover position
                this.engine.currentTool.updateCursor(worldPos)
            } else {
                this.engine.eventBus.emit('engine:cursorChanged', {})
            }
        }
    }

    handleKeyDown(e) {
        const shortcuts = {
            S: 'select',
            D: 'draw',
            R: 'rectangle',
            C: 'circle',
            L: 'line',
            T: 'text',
            E: 'eraser',
        }

        if (shortcuts[e.key]) {
            this.engine.setTool(shortcuts[e.key])
            this.updateCursor()
        }

        // Copy (ctrl-c)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault()
            this.engine.objectManager.copySelected()
        }

        // Cut (ctrl-x)
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
            e.preventDefault()
            this.engine.objectManager.cutSelected()
            this.engine.render()
        }

        // paste (ctrl-v)
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault()
            const worldPos = this.engine.coordinates.viewportToWorld(this.lastMousePos, this.canvas)
            this.engine.objectManager.paste(worldPos.x, worldPos.y)
            this.engine.render()
        }

        // Undo (ctrl-z) / redo (ctrl-shift-z)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault()
            this.engine.objectManager.redo()
            this.engine.render()
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault()
            this.engine.objectManager.undo()
            this.engine.render()
        }

        // Delete
        if (e.key === 'Delete') {
            this.engine.objectManager.deleteSelected()
            this.engine.render()
        }
    }

    destroy() {
        if (this.boundHandleMouseDown) {
            this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown)
            this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove)
            this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp)
            this.canvas.removeEventListener('wheel', this.boundHandleMouseWheel)
            this.canvas.removeEventListener('contextmenu', this.boundPreventContext)

            document.removeEventListener('keydown', this.boundHandleKeyDown)
        }
    }
}
