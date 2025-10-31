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
import { ErrorHandler, ErrorCategory } from '../utils/ErrorHandler'

export class DrawingEngine {
    constructor(canvas, networkManager) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.networkManager = networkManager

        this.objectManager = new ObjectManager(networkManager)
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

        // Set up network message handler
        if (networkManager) {
            this.setupNetworkHandler()
        }

        this.resize()
    }

    setupNetworkHandler() {
        // Wire up message handler
        if (this.networkManager) {
            this.networkManager.messageHandler = (message) => {
                this.handleNetworkMessage(message)
            }
        }
    }

    /**
     * Attach network manager after initialization (for local-first mode)
     * Transitions from local mode to networked mode
     * @param {WebSocketManager} networkManager - The network manager to attach
     * @param {string} newUserId - The server-assigned userId to replace local userId
     * @returns {Promise} Promise that resolves with migration results {succeeded, failed}
     */
    attachNetworkManager(networkManager, newUserId) {
        console.log('[DrawingEngine] Attaching network manager, transitioning to networked mode')

        this.networkManager = networkManager
        this.setupNetworkHandler()

        console.log('[DrawingEngine] Network manager attached successfully')

        // Attach network to object manager and migrate local objects
        // Return the migration promise so caller can handle results
        if (this.objectManager) {
            return this.objectManager.attachNetworkManager(networkManager, newUserId)
        }

        // No object manager, return empty result
        return Promise.resolve({ succeeded: [], failed: [] })
    }

    handleNetworkMessage(message) {
        try {
            switch(message.type) {
                case 'network:authenticated':
                    this.objectManager.setUserId(message.userId)
                    break
                case 'network:objectAdded': {
                    const addedObj = this.objectManager.addRemoteObject(message.object)
                    if (addedObj) {
                        const bounds = addedObj.getBounds()
                        this.markDirty(bounds)
                        this.render()
                    }
                    break
                }
                case 'network:objectUpdated': {
                    const updatedObj = this.objectManager.getObjectById(message.object.id)
                    if (updatedObj) {
                        const oldBounds = updatedObj.getBounds()
                        this.markDirty(oldBounds)
                        this.objectManager.updateRemoteObject(message.object.id, message.object.data)
                        const newBounds = updatedObj.getBounds()
                        this.markDirty(newBounds)
                        this.render()
                    }
                    break
                }
                case 'network:objectDeleted': {
                    const deletedObj = this.objectManager.getObjectById(message.objectId)
                    if (deletedObj) {
                        this.markDirty(deletedObj.getBounds())
                        this.objectManager.removeRemoteObject(message.objectId)
                        this.render()
                    }
                    break
                }
                case 'network:sync':
                    this.objectManager.loadRemoteObjects(message.objects)
                    this.markDirty()
                    this.render()
                    break
                case 'network:userDisconnected':
                    this.remoteCursors.delete(message.userId)
                    this.markDirty()
                    this.render()
                    break
                case 'network:remoteCursorMove':
                    this.handleRemoteCursor(message)
                    break
            }
        } catch (error) {
            ErrorHandler.handle(error, ErrorCategory.NETWORK, {
                context: 'DrawingEngine',
                userMessage: 'Failed to process network update. Your local changes are safe.',
                metadata: { messageType: message?.type }
            })
        }
    }

    handleRemoteCursor({ userId, x, y, color, tool }) {
        const oldCursor = this.remoteCursors.get(userId)
        if (oldCursor) {
            this.markDirty({ x: oldCursor.x - 10, y: oldCursor.y - 10, width: 20, height: 20 }, 5)
        }
        this.remoteCursors.set(userId, { x, y, color, tool })
        this.markDirty({ x: x - 10, y: y - 10, width: 20, height: 20 }, 5)
        this.render()
    }

    // Public methods for Toolbar and InputHandler
    undo() {
        this.objectManager.undo()
        this.markDirty()
        this.render()
    }

    redo() {
        this.objectManager.redo()
        this.markDirty()
        this.render()
    }

    broadcastCursor(cursor) {
        if (this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.broadcastCursor(cursor)
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
     * Force render - bypasses needsRedraw check for critical updates
     * Use for network events where rendering must happen immediately
     */
    renderForce() {
        this.needsRedraw = true
        this.renderFull()
        this.needsRedraw = false
    }

    /**
     * Full canvas redraw with viewport culling
     */
    renderFull() {
        try {
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
        } catch (error) {
            // Restore context state even on error
            try {
                this.ctx.restore()
            } catch (restoreError) {
                // Ignore restore errors
            }

            ErrorHandler.handle(error, ErrorCategory.CRITICAL, {
                context: 'DrawingEngine',
                userMessage: 'Rendering error occurred. Please refresh if the canvas appears blank.',
                code: 'RENDER_FAILED'
            })
        }
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
