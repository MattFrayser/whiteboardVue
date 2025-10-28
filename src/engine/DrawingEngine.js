import { CircleTool } from '../tools/CircleTool'
import { DrawTool } from '../tools/DrawTool'
import { EraserTool } from '../tools/EraserTool'
import { LineTool } from '../tools/LineTool'
import { RectangleTool } from '../tools/RectangleTool'
import { SelectTool } from '../tools/SelectTool'
import { TextTool } from '../tools/TextTool'
import { Coordinates } from './Coordinates'
import { InputHandler } from './InputHandler'
import { ObjectManager } from '../managers/ObjectManager'

export class DrawingEngine {
    constructor(canvas, eventBus) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.eventBus = eventBus

        this.objectManager = new ObjectManager(this, eventBus)
        this.coordinates = new Coordinates()
        this.needsRedraw = true

        this.tools = {
            draw: new DrawTool(this),
            rectangle: new RectangleTool(this),
            circle: new CircleTool(this),
            select: new SelectTool(this),
            eraser: new EraserTool(this),
            line: new LineTool(this),
            text: new TextTool(this),
        }

        this.currentTool = this.tools.draw
        this.currentColor = '#000000'
        this.currentWidth = 5

        this.remoteCursors = new Map()

        // Window resize handler
        this.boundResize = () => this.resize()
        window.addEventListener('resize', this.boundResize)

        // manages mouse/keyboard events
        this.inputHandler = new InputHandler(this, canvas)

        this.subscribeToEvents()
        this.resize()
    }

    subscribeToEvents() {

        // Toolbar events

        this.eventBus.subscribe('toolbar:toolChanged', ({ toolName }) => {
            this.setTool(toolName)
        })

        this.eventBus.subscribe('toolbar:colorChanged', ({ color }) => {
            this.currentColor = color
        })

        this.eventBus.subscribe('toolbar:brushSizeChanged', ({ size }) => {
            this.currentWidth = size
        })

        this.eventBus.subscribe('toolbar:undoRequested', () => {
            this.objectManager.undo()
            this.render()
        })

        this.eventBus.subscribe('toolbar:redoRequested', () => {
            this.objectManager.redo()
            this.render()
        })

        // Network events (remote changes)

        this.eventBus.subscribe('network:objectAdded', ({ object }) => {
            const obj = this.objectManager.addRemoteObject(object)
            if (obj) {
                const bounds = obj.getBounds()
                this.markDirty(bounds)
                this.render()
            }
        })

        this.eventBus.subscribe('network:objectUpdated', ({ object }) => {
            const obj = this.objectManager.getObjectById(object.id)
            if (obj) {
                const oldBounds = obj.getBounds()
                this.markDirty(oldBounds)

                this.objectManager.updateRemoteObject(object.id, object.data)

                const newBounds = obj.getBounds()
                this.markDirty(newBounds)
                this.render()
            }
        })

        this.eventBus.subscribe('network:objectDeleted', ({ objectId }) => {
            const obj = this.objectManager.getObjectById(objectId)
            if (obj) {
                const bounds = obj.getBounds()
                this.markDirty(bounds)

                this.objectManager.removeRemoteObject(objectId)
                this.render()
            }
        })

        this.eventBus.subscribe('network:sync', ({ objects }) => {
            this.objectManager.loadRemoteObjects(objects)
            this.render()
        })

        this.eventBus.subscribe('network:userDisconnected', ({ userId }) => {
            if (this.remoteCursors) {
                this.remoteCursors.delete(userId)
                this.render()
            }
        })

        // Remote cursor updates
        this.eventBus.subscribe('network:remoteCursorMove', ({ userId, x, y, color, tool }) => {
            const oldCursor = this.remoteCursors.get(userId)
            if (oldCursor) {
                const cursorRadius = 10
                this.markDirty(
                    {
                        x: oldCursor.x - cursorRadius,
                        y: oldCursor.y - cursorRadius,
                        width: cursorRadius * 2,
                        height: cursorRadius * 2,
                    },
                    5
                )
            }

            this.remoteCursors.set(userId, { x, y, color, tool })

            const cursorRadius = 10
            this.markDirty(
                {
                    x: x - cursorRadius,
                    y: y - cursorRadius,
                    width: cursorRadius * 2,
                    height: cursorRadius * 2,
                },
                5
            )

            this.render()
        })

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

        this.eventBus.publish('engine:toolChanged', { toolName })
        this.render()
    }

    resize() {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
        this.needsRedraw = true
        this.render()
    }

    /**
     * Mark canvas as needing redraw
     */
    markDirty() {
        this.needsRedraw = true
    }

    /**
     * Get the viewport bounds in world coordinates
     */
    getViewportBounds() {
        const { scale, offsetX, offsetY } = this.coordinates
        return {
            x: -offsetX / scale,
            y: -offsetY / scale,
            width: this.canvas.width / scale,
            height: this.canvas.height / scale,
        }
    }

    render() {
        if (!this.needsRedraw) {
            return
        }

        this.renderFull()
        this.needsRedraw = false
    }

    /**
     * Full canvas redraw with viewport culling
     */
    renderFull() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

        // Apply transformations
        this.ctx.save()
        const { offsetX, offsetY, scale } = this.coordinates
        this.ctx.translate(offsetX, offsetY)
        this.ctx.scale(scale, scale)

        // Get viewport bounds for culling
        const viewport = this.getViewportBounds()

        // Render objects (with viewport culling via quadtree)
        this.objectManager.render(this.ctx, viewport)

        // Render current tool preview
        if (this.currentTool && this.currentTool.renderPreview) {
            this.currentTool.renderPreview(this.ctx)
        }

        // Render remote cursors
        if (this.remoteCursors) {
            this.remoteCursors.forEach(cursor => {
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

    destroy() {
        // Cleanup input handler
        if (this.inputHandler) {
            this.inputHandler.destroy()
        }

        // Remove resize listener
        if (this.boundResize) {
            window.removeEventListener('resize', this.boundResize)
        }

        this.eventBus.publish('engine:destroy', {})

        // Cleanup tools
        if (this.tools) {
            Object.values(this.tools).forEach(tool => {
                if (tool.deactivate) {
                    tool.deactivate()
                }
            })
        }

        // Clear references
        this.objectManager = null
        this.coordinates = null
        this.tools = null
        this.currentTool = null
        this.inputHandler = null
    }
}
