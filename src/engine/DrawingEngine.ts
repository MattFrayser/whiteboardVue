import type { RemoteCursor, Bounds } from '../types'
import { CircleTool } from '../tools/CircleTool'
import { DrawTool } from '../tools/DrawTool'
import { EraserTool } from '../tools/EraserTool'
import { LineTool } from '../tools/LineTool'
import { RectangleTool } from '../tools/RectangleTool'
import { SelectTool } from '../tools/SelectTool'
import { TextTool } from '../tools/TextTool'
import { Coordinates } from './Coordinates'
import { InputHandler } from './InputHandler'
import type { IObjectManager } from '../interfaces/IObjectManager'
import { ErrorHandler, ErrorCategory } from '../utils/ErrorHandler'
import type { INetworkManager } from '../interfaces/INetworkManager'
import type { NetworkMessage, MigrationResult } from '../types/network'
import { selectors, actions } from '../stores/AppState'

export class DrawingEngine {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    networkManager: INetworkManager | null
    objectManager: IObjectManager
    coordinates: Coordinates
    needsRedraw: boolean
    tools: {
        draw: DrawTool
        rectangle: RectangleTool
        circle: CircleTool
        select: SelectTool
        eraser: EraserTool
        line: LineTool
        text: TextTool
    }
    boundResize: () => void
    inputHandler: InputHandler

    constructor(
        canvas: HTMLCanvasElement,
        objectManager: IObjectManager,
        networkManager: INetworkManager | null = null
    ) {
        this.canvas = canvas
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Failed to get 2d context from canvas')
        }
        this.ctx = ctx
        this.networkManager = networkManager
        this.objectManager = objectManager
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

    setupNetworkHandler(): void {
        // Wire up message handler
        if (this.networkManager) {
            this.networkManager.messageHandler = (message: NetworkMessage) => {
                this.handleNetworkMessage(message)
            }
        }
    }

    /**
     * Attach network manager after initialization (for local-first mode)
     * Transitions from local mode to networked mode
     */
    attachNetworkManager(
        networkManager: INetworkManager,
        newUserId: string
    ): Promise<MigrationResult> {
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

    handleNetworkMessage(message: NetworkMessage): void {
        try {
            switch (message.type) {
                case 'network:authenticated':
                    if (message.userId) {
                        this.objectManager.setUserId(message.userId)
                    }
                    break
                case 'network:objectAdded': {
                    if (message.object) {
                        const addedObj = this.objectManager.addRemoteObject(message.object)
                        if (addedObj) {
                            this.markDirty()
                            this.render()
                        }
                    }
                    break
                }
                case 'network:objectUpdated': {
                    if (message.object) {
                        const updatedObj = this.objectManager.getObjectById(message.object.id)
                        if (updatedObj) {
                            this.markDirty()
                            this.objectManager.updateRemoteObject(
                                message.object.id,
                                message.object
                            )
                            this.markDirty()
                            this.render()
                        }
                    }
                    break
                }
                case 'network:objectDeleted': {
                    if (message.objectId) {
                        const deletedObj = this.objectManager.getObjectById(message.objectId)
                        if (deletedObj) {
                            this.markDirty()
                            this.objectManager.removeRemoteObject(message.objectId)
                            this.render()
                        }
                    }
                    break
                }
                case 'network:sync':
                    if (message.objects) {
                        this.objectManager.loadRemoteObjects(message.objects)
                        this.markDirty()
                        this.render()
                    }
                    break
                case 'network:userDisconnected':
                    if (message.userId) {
                        actions.removeRemoteCursor(message.userId)
                        this.markDirty()
                        this.render()
                    }
                    break
                case 'network:remoteCursorMove':
                    this.handleRemoteCursor(message)
                    break
            }
        } catch (error) {
            ErrorHandler.handle(error as Error, ErrorCategory.NETWORK, {
                context: 'DrawingEngine',
                userMessage: 'Failed to process network update. Your local changes are safe.',
                metadata: { messageType: message?.type },
            })
        }
    }

    handleRemoteCursor(message: NetworkMessage): void {
        if (
            !message.userId ||
            message.x === undefined ||
            message.y === undefined ||
            !message.color ||
            !message.tool
        ) {
            return
        }

        const { userId, x, y, color, tool } = message
        const remoteCursors = selectors.getRemoteCursors()
        const oldCursor = remoteCursors[userId]
        if (oldCursor) {
            this.markDirty()
        }
        actions.addRemoteCursor(userId, {
            userId,
            x,
            y,
            color,
            tool,
            lastUpdate: Date.now(),
        })
        this.markDirty()
        this.render()
    }

    // Public methods for Toolbar and InputHandler
    undo(): void {
        this.objectManager.undo()
        this.markDirty()
        this.render()
    }

    redo(): void {
        this.objectManager.redo()
        this.markDirty()
        this.render()
    }

    broadcastCursor(cursor: { x: number; y: number; color: string; tool: string }): void {
        if (this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.broadcastCursor(cursor)
        }
    }

    setTool(toolName: keyof typeof this.tools): void {
        // Get current tool from AppState
        const currentToolName = selectors.getTool()
        const currentTool = this.tools[currentToolName as keyof typeof this.tools]

        if (currentTool) {
            currentTool.deactivate()
        }

        // Clear selection when switching away from select tool
        if (currentTool === this.tools.select) {
            this.objectManager.clearSelection()
        }

        const newTool = this.tools[toolName]
        newTool.activate()

        this.render()
    }

    resize(): void {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
        this.needsRedraw = true
        this.render()
    }

    /**
     * Mark canvas as needing redraw
     */
    markDirty(): void {
        this.needsRedraw = true
    }

    /**
     * Get the viewport bounds in world coordinates
     */
    getViewportBounds(): Bounds {
        const { scale, offsetX, offsetY } = this.coordinates
        return {
            x: -offsetX / scale,
            y: -offsetY / scale,
            width: this.canvas.width / scale,
            height: this.canvas.height / scale,
        }
    }

    render(): void {
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
    renderForce(): void {
        this.needsRedraw = true
        this.renderFull()
        this.needsRedraw = false
    }

    /**
     * Full canvas redraw with viewport culling
     */
    renderFull(): void {
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

            // Render current tool preview - query from AppState
            const currentToolName = selectors.getTool()
            const currentTool = this.tools[currentToolName as keyof typeof this.tools]
            if (currentTool && currentTool.renderPreview) {
                currentTool.renderPreview(this.ctx)
            }

            // Render remote cursors - query from AppState
            const remoteCursors = selectors.getRemoteCursors()
            if (remoteCursors) {
                Object.values(remoteCursors).forEach(cursor => {
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

            ErrorHandler.handle(error as Error, ErrorCategory.CRITICAL, {
                context: 'DrawingEngine',
                userMessage: 'Rendering error occurred. Please refresh if the canvas appears blank.',
            })
        }
    }

    renderRemoteCursor(ctx: CanvasRenderingContext2D, cursor: RemoteCursor): void {
        ctx.save()

        ctx.fillStyle = cursor.color || '#444444'
        ctx.beginPath()
        ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
    }

    start(): void {
        this.render()
    }

    destroy(): void {
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
        ;(this.objectManager as unknown) = null
        ;(this.coordinates as unknown) = null
        ;(this.tools as unknown) = null
        ;(this.inputHandler as unknown) = null
    }
}
