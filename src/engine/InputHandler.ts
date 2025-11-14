import { ErrorHandler } from '../utils/ErrorHandler'
import { CURSOR_THROTTLE_MS } from '../constants'
import type { Point } from '../types'
import type { DrawingEngine } from './DrawingEngine'
import { selectors, actions } from '../stores/AppState'
import { getCursorForTool } from '../utils/getCursorForTool'

/**
 * Handles mouse and keyboard input for the drawing engine
 */
export class InputHandler {
    private engine: DrawingEngine
    private canvas: HTMLCanvasElement
    private rightMouseDown: boolean
    private lastMousePos: Point
    private lastCursorBroadcast: number
    private cursorThrottle: number
    private boundHandleMouseDown: (e: MouseEvent) => void
    private boundHandleMouseMove: (e: MouseEvent) => void
    private boundHandleMouseUp: (e: MouseEvent) => void
    private boundHandleMouseWheel: (e: WheelEvent) => void
    private boundPreventContext: (e: MouseEvent) => void
    private boundHandleKeyDown: (e: KeyboardEvent) => void

    constructor(engine: DrawingEngine, canvas: HTMLCanvasElement) {
        this.engine = engine
        this.canvas = canvas
        this.rightMouseDown = false
        this.lastMousePos = { x: 0, y: 0 }
        this.lastCursorBroadcast = 0
        this.cursorThrottle = CURSOR_THROTTLE_MS

        this.boundHandleMouseDown = (e: MouseEvent) => this.handleMouseDown(e)
        this.boundHandleMouseMove = (e: MouseEvent) => this.handleMouseMove(e)
        this.boundHandleMouseUp = (e: MouseEvent) => this.handleMouseUp(e)
        this.boundHandleMouseWheel = (e: WheelEvent) => this.handleMouseWheel(e)
        this.boundPreventContext = (e: MouseEvent) => e.preventDefault()
        this.boundHandleKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e)

        this.setupEventListeners()
    }

    private setupEventListeners(): void {
        this.canvas.addEventListener('mousedown', this.boundHandleMouseDown)
        this.canvas.addEventListener('mousemove', this.boundHandleMouseMove)
        document.addEventListener('mouseup', this.boundHandleMouseUp)
        this.canvas.addEventListener('wheel', this.boundHandleMouseWheel)
        this.canvas.addEventListener('contextmenu', this.boundPreventContext)

        document.addEventListener('keydown', this.boundHandleKeyDown)
    }

    private handleMouseDown(e: MouseEvent): void {
        try {
            const worldPos = this.engine.coordinates.viewportToWorld(
                { x: e.clientX, y: e.clientY },
                this.canvas
            )

            if (e.button === 0) {
                // Get current tool from AppState
                const toolName = selectors.getTool()
                const currentTool = this.engine.tools[toolName as keyof typeof this.engine.tools]
                if (currentTool) {
                    currentTool._safeOnMouseDown(worldPos, e)
                }
            } else if (e.button === 2) {
                this.engine.coordinates.startPan({ x: e.clientX, y: e.clientY })
                this.rightMouseDown = true
                this.updateCursor()
            }
        } catch (error) {
            ErrorHandler.silent(error as Error, {
                context: 'InputHandler',
                metadata: { event: 'mousedown' }
            })
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        try {
            this.lastMousePos = { x: e.clientX, y: e.clientY }

            const worldPos = this.engine.coordinates.viewportToWorld(
                { x: e.clientX, y: e.clientY },
                this.canvas
            )

            // Broadcast cursor position with throttling
            const now = Date.now()
            if (now - this.lastCursorBroadcast >= this.cursorThrottle) {
                this.lastCursorBroadcast = now
                const toolName = selectors.getTool()
                const color = selectors.getColor()

                // Direct call to engine's broadcast method
                this.engine.broadcastCursor({
                    x: worldPos.x,
                    y: worldPos.y,
                    tool: toolName,
                    color: color
                })
            }

            // left click
            if (e.buttons === 1) {
                const toolName = selectors.getTool()
                const currentTool = this.engine.tools[toolName as keyof typeof this.engine.tools]
                if (currentTool) {
                    currentTool._safeOnMouseMove(worldPos, e)
                }
            // right click
            } else if (e.buttons === 2) {
                e.preventDefault()
                this.engine.coordinates.pan({ x: e.clientX, y: e.clientY })
                this.engine.needsRedraw = true
                this.engine.render()
            }
        } catch (error) {
            ErrorHandler.silent(error as Error, {
                context: 'InputHandler',
                metadata: { event: 'mousemove' }
            })
        }
    }

    private handleMouseUp(e: MouseEvent): void {
        try {
            const worldPos = this.engine.coordinates.viewportToWorld(
                { x: e.clientX, y: e.clientY },
                this.canvas
            )

            if (e.button === 0) {
                const toolName = selectors.getTool()
                const currentTool = this.engine.tools[toolName as keyof typeof this.engine.tools]
                if (currentTool) {
                    currentTool._safeOnMouseUp(worldPos, e)
                }
            } else if (e.button === 2) {
                this.engine.coordinates.endPan()
                this.rightMouseDown = false
                this.updateCursor(worldPos)
            }
        } catch (error) {
            ErrorHandler.silent(error as Error, {
                context: 'InputHandler',
                metadata: { event: 'mouseup' }
            })
        }
    }

    /**
    * Zooming in and out
    */
    private handleMouseWheel(e: WheelEvent): void {
        e.preventDefault()
        const zoomPoint = { x: e.clientX, y: e.clientY }
        this.engine.coordinates.zoom(e.deltaY, zoomPoint, this.canvas)
        this.engine.needsRedraw = true
        this.engine.render()
    }

    private updateCursor(worldPos: Point | null = null): void {
        if (this.rightMouseDown) {
            // Panning mode - show grabbing cursor
            actions.setCursor('grabbing')
        } else {
            // Get current tool from AppState
            const toolName = selectors.getTool()
            const currentTool = this.engine.tools[toolName as keyof typeof this.engine.tools]

            // SelectTool has dynamic cursor based on hover position
            if (currentTool && toolName === 'select' && worldPos) {
                if ('updateCursor' in currentTool) {
                    // Let SelectTool handle its own cursor (via actions.setCursor)
                    (currentTool as any).updateCursor(worldPos)
                }
            } else {
                // Set cursor based on current tool via state
                actions.setCursor(getCursorForTool(toolName))
            }
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
        try {
            // Tool Shortcuts
            const shortcuts: Record<string, string> = {
                S: 'select',
                D: 'draw',
                R: 'rectangle',
                C: 'circle',
                L: 'line',
                T: 'text',
                E: 'eraser',
            }

            if (shortcuts[e.key]) {
                this.engine.setTool(shortcuts[e.key] as any)
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
                this.engine.markDirty()
                this.engine.render()
            }

            // paste (ctrl-v)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault()
                const worldPos = this.engine.coordinates.viewportToWorld(this.lastMousePos, this.canvas)
                this.engine.objectManager.paste(worldPos.x, worldPos.y)
                this.engine.markDirty()
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
                this.engine.markDirty()
                this.engine.render()
            }
        } catch (error) {
            ErrorHandler.silent(error as Error, {
                context: 'InputHandler',
                metadata: { event: 'keydown', key: e.key }
            })
        }
    }

    destroy(): void {
        if (this.boundHandleMouseDown) {
            this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown)
            this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove)
            document.removeEventListener('mouseup', this.boundHandleMouseUp)
            this.canvas.removeEventListener('wheel', this.boundHandleMouseWheel)
            this.canvas.removeEventListener('contextmenu', this.boundPreventContext)

            document.removeEventListener('keydown', this.boundHandleKeyDown)
        }
    }
}
