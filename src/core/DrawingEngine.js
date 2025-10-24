import { ObjectManager } from './ObjectManager'
import { Coordinates } from './Coordinates'
import { DrawTool } from '../tools/DrawTool'
import { RectangleTool } from '../tools/RectangleTool'
import { CircleTool } from '../tools/CircleTool'
import { SelectTool } from '../tools/SelectTool'
import { EraserTool } from '../tools/EraserTool'
import { LineTool } from '../tools/LineTool'
import { TextTool } from '../tools/TextTool'

export class DrawingEngine {
    constructor(canvas) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.objectManager = new ObjectManager(this)
        this.coordinates = new Coordinates()

        this.tools = {
            draw: new DrawTool(this),
            rectangle: new RectangleTool(this),
            circle: new CircleTool(this),
            select: new SelectTool(this),
            eraser: new EraserTool(this),
            line: new LineTool(this),
            text: new TextTool(this)
        }

        this.currentTool = this.tools.draw
        this.currentColor = '#000000'
        this.currentWidth = 5
        this.toolbar = null

        this.rightMouseDown = false
        this.lastMousePos = { x: 0, y: 0 } // Track mouse position for paste
        this.lastCursorBroadcast = 0 // Timestamp of last cursor broadcast for throttling

        this.setupEventListeners()
        this.resize()
    }

    setToolbar(toolbar) {
        this.toolbar = toolbar
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e))
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e))
        this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e))
        this.canvas.addEventListener('wheel', e => this.handleMouseWheel(e))
        this.canvas.addEventListener('contextmenu', e => e.preventDefault())

        window.addEventListener('resize', () => this.resize())
        document.addEventListener('keydown', e => this.handleKeyDown(e))
    }

    handleMouseDown(e) {
        const worldPos = this.coordinates.viewportToWorld(
                {x: e.clientX, y: e.clientY},
                this.canvas
        )

        if (e.button === 0) {
            this.currentTool.onMouseDown(worldPos, e)
        } else if (e.button === 2) {
            this.coordinates.startPan({ x: e.clientX, y:e.clientY })
            this.rightMouseDown = true
            this.updateCursor()
        }
    } 

    handleMouseMove(e) {
        this.lastMousePos = { x: e.clientX, y: e.clientY } // Track mouse position

        const worldPos = this.coordinates.viewportToWorld(
                {x: e.clientX, y: e.clientY},
                this.canvas
        )

        // Broadcast cursor position with throttling (max 20/sec = every 50ms)
        if (this.wsManager && this.wsManager.userId) {
            const now = Date.now()
            if (now - this.lastCursorBroadcast >= 50) {
                this.lastCursorBroadcast = now
                // Get current tool name
                const toolName = Object.keys(this.tools).find(
                    key => this.tools[key] === this.currentTool
                )
                this.wsManager.broadcastCursor({
                    x: worldPos.x,
                    y: worldPos.y,
                    tool: toolName
                })
            }
        }

        if (e.buttons === 1) {
            this.currentTool.onMouseMove(worldPos, e)
        } else if (e.buttons === 2) {
            e.preventDefault()
            this.coordinates.pan({ x: e.clientX, y: e.clientY })
            this.render()
        }
    }

    handleMouseUp(e) {
        const worldPos = this.coordinates.viewportToWorld(
            { x: e.clientX, y: e.clientY },
            this.canvas
        )

        if (e.button === 0) {
            this.currentTool.onMouseUp(worldPos, e)
        } else if (e.button === 2) {
            this.coordinates.endPan()
            this.rightMouseDown = false
            this.updateCursor(worldPos)
        }
    }

    handleMouseWheel(e) {
        e.preventDefault()
        const zoomPoint = { x: e.clientX, y: e.clientY }
        this.coordinates.zoom(e.deltaY, zoomPoint, this.canvas)
        this.render()
    }

    updateCursor(worldPos = null) {
        if (this.rightMouseDown) {
            this.canvas.style.cursor = 'grabbing'
        } else {
            // Restore tool-specific cursor
            if (this.currentTool === this.tools.select && worldPos) {
                // SelectTool has dynamic cursor based on hover position
                this.currentTool.updateCursor(worldPos)
            } else if (this.toolbar) {
                this.toolbar.updateToolButtons()
            }
        }
    }

    handleKeyDown(e) {
        const shortcuts = {
            'S': 'select',
            'D': 'draw',
            'R': 'rectangle',
            'C': 'circle',
            'L': 'line',
            'T': 'text',
            'E': 'eraser'
        }

        if (shortcuts[e.key]) {
            this.setTool(shortcuts[e.key])
            this.updateCursor()
        }

        // Copy (ctrl-c)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault()
            this.objectManager.copySelected()
        }

        // Cut (ctrl-x)
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
            e.preventDefault()
            this.objectManager.cutSelected()

            this.render()
          if (this.toolbar) {
                this.toolbar.updateUndoRedoButtons()
            }
        }

        // paste (ctrl-v)
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault()
            const worldPos = this.coordinates.viewportToWorld(
                this.lastMousePos,
                this.canvas
            )
            this.objectManager.paste(worldPos.x, worldPos.y)

            this.render()
            if (this.toolbar) {
                this.toolbar.updateUndoRedoButtons()
            }
        }


        // Undo (ctrl-z) / redo (ctrl-shift-z)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault()
            this.objectManager.redo()
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault()
            this.objectManager.undo()
        }
        this.render()
        if (this.toolbar) {
            this.toolbar.updateUndoRedoButtons()
        }
        
        // Delete
        if (e.key === 'Delete') {
            this.objectManager.deleteSelected()
            this.render()
        }
    }
    setTool(toolName) {
        if (this.currentTool) {
            this.currentTool.deactivate()
        }

        // Clear selection when switching away from select tool
        if (this.currentTool === this.tools.select) {
            this.objectManager.clearSelection()
        }

        this.currentTool = this.tools[toolName]
        this.currentTool.activate()
        this.render()
    }
    
    resize() {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
        this.render()
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

        // Apply transformations
        this.ctx.save()
        const { offsetX, offsetY, scale } = this.coordinates
        this.ctx.translate(offsetX, offsetY)
        this.ctx.scale(scale, scale)

        // Render all objects
        this.objectManager.render(this.ctx)

        // Render current tool preview
        if (this.currentTool && this.currentTool.renderPreview) {
            this.currentTool.renderPreview(this.ctx)
        }

        // Render remote cursors
        if (this.wsManager && this.wsManager.remoteCursors) {
            this.wsManager.remoteCursors.forEach((cursor, userId) => {
                this.renderRemoteCursor(this.ctx, cursor)
            })
        }

        this.ctx.restore()
    }

    renderRemoteCursor(ctx, cursor) {
        ctx.save()

        ctx.fillStyle = cursor.color || '#444444'
        ctx.beginPath()
        ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
    }

    start() {
        this.render()
    }
}
