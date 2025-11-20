import type { RemoteCursor, Bounds } from '../../shared/types'
import { DEFAULT_COLOR } from '../../shared/constants'
import { CircleTool } from '../../drawing/tools/shapes/CircleTool'
import { DrawTool } from '../../drawing/tools/drawing/DrawTool'
import { EraserTool } from '../../drawing/tools/drawing/EraserTool'
import { LineTool } from '../../drawing/tools/shapes/LineTool'
import { RectangleTool } from '../../drawing/tools/shapes/RectangleTool'
import { SelectTool } from '../../drawing/tools/select/SelectTool'
import { TextTool } from '../../drawing/tools/text/TextTool'
import type { Tool } from '../../drawing/tools/base/Tool'
import { Coordinates } from '../coordinates/Coordinates'
import { InputHandler } from './InputHandler'
import { ObjectManager } from '../../drawing/managers/ObjectManager'
import { ErrorHandler, ErrorCategory } from '../../shared/utils/ErrorHandler'
import { selectors } from '../../shared/stores/AppState'
import type { WebSocketManager } from '../../collaboration/network/WebSocketManager'
import type { NetworkMessage, MigrationResult } from '../../shared/types/network'

import { sanitizeObjectData } from '../../shared/validation'

import { createLogger } from '../../shared/utils/logger'
const log = createLogger('DrawingEngine')

export class DrawingEngine {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    networkManager: WebSocketManager | null
    objectManager: ObjectManager
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
    currentTool: Tool
    currentColor: string
    currentWidth: number
    remoteCursors: Map<string, RemoteCursor>
    boundResize: () => void
    inputHandler: InputHandler

    constructor(canvas: HTMLCanvasElement, networkManager: WebSocketManager | null = null) {
        this.canvas = canvas
        const ctx = canvas.getContext('2d') // 2d drawing api 
        if (!ctx) {
            throw new Error('Failed to get 2d context from canvas')
        }
        this.ctx = ctx

        this.networkManager = networkManager // null in local 
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
        this.currentColor = DEFAULT_COLOR
        this.currentWidth = 5

        this.remoteCursors = new Map()
        setInterval(() => this.cleanupStaleCursors(), 30000)

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

    /**
     * Attach network manager after initialization (for local-first mode)
     * Transitions from local mode to networked mode
     */
    attachNetworkManager(
        networkManager: WebSocketManager,
        newUserId: string
    ): Promise<MigrationResult> {
        log.debug('Attaching network manager, transitioning to networked mode')

        this.networkManager = networkManager
        this.setupNetworkHandler()

        log.debug('Network manager attached successfully')

        // Attach network to object manager and migrate local objects
        // Return the migration promise so caller can handle results
        if (this.objectManager) {
            return this.objectManager.attachNetworkManager(networkManager, newUserId)
        }

        // No object manager, return empty result
        return Promise.resolve({ succeeded: [], failed: [] })
    }

    //--------------------
    // Network 
    //--------------------

    setupNetworkHandler(): void {
        // Wire up message handler
        if (this.networkManager) {
            this.networkManager.messageHandler = (message: NetworkMessage) => {
                this.handleNetworkMessage(message)
            }
        }
    }

    handleNetworkMessage(message: NetworkMessage): void {
        try {
            switch (message.type) {
                case 'network:authenticated':
                    if (message.userId && typeof message.userId === 'string') {
                        this.objectManager.setUserId(message.userId)
                    }
                    break

                case 'network:objectAdded': {
                    if (!message.object) {
                        log.error('Invalid objectAdded message: missing object')
                        break
                    }

                    const sanitized = sanitizeObjectData(message.object)
                    const addedObj = this.objectManager.addRemoteObject(sanitized)
                    if (addedObj) {
                        this.renderDirty()
                    }
                    break
                }

                case 'network:objectUpdated': {
                    if (!message.object) {
                        log.error('Invalid objectUpdated message: missing object')
                        break
                    }

                    const obj = this.objectManager.getObjectById(message.object.id)
                    if (obj) {
                        const sanitized = sanitizeObjectData(message.object)
                        this.objectManager.updateRemoteObject(sanitized.id, sanitized)
                        this.renderDirty()
                    }
                    break
                }
                case 'network:objectDeleted': {
                    if (!message.objectId) {
                        log.error('Invalid objectDeleted message: missing objectId')
                        break
                    }

                    const deletedObj = this.objectManager.getObjectById(message.objectId)
                    if (deletedObj) {
                        this.objectManager.removeRemoteObject(message.objectId)
                        this.renderDirty()
                    }
                    break
                }
                case 'network:sync':
                    if (!message.objects || !Array.isArray(message.objects)) {
                        log.error('Invalid sync message: missing objects array')
                        break
                    }

                    const sanitized = message.objects.map(sanitizeObjectData)
                    this.objectManager.loadRemoteObjects(sanitized)
                    this.renderDirty()
                    break

                case 'network:userDisconnected':
                    if (!message.userId) {
                        log.error('Invalid userDisconnected message: missing userId')
                        break
                    }

                    this.remoteCursors.delete(message.userId)
                    this.renderDirty()
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

        // clamp size
        const MAX_CURSOR_COORD = 100000
        const x = Math.max(-MAX_CURSOR_COORD, Math.min(MAX_CURSOR_COORD, message.x))
        const y = Math.max(-MAX_CURSOR_COORD, Math.min(MAX_CURSOR_COORD, message.y))

        this.remoteCursors.set(message.userId, {
            userId: message.userId,
            x,
            y,
            color: message.color,
            tool: message.tool,
            lastUpdate: Date.now(),
        })
        this.renderDirty()
    }

    // Public methods for Toolbar and InputHandler
    undo(): void {
        this.objectManager.undo()
        this.renderDirty()
    }

    redo(): void {
        this.objectManager.redo()
        this.renderDirty()
    }

    broadcastCursor(cursor: { x: number; y: number; color: string; tool: string }): void {
        if (this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.broadcastCursor(cursor)
        }
    }

    cleanupStaleCursors() {
        const now = Date.now()
        const CURSOR_TTL = 10000 // 10 seconds

        for (const [userId, cursor] of this.remoteCursors) {
            if (now - cursor.lastUpdate > CURSOR_TTL) {
                this.remoteCursors.delete(userId)
            }
        }
    }
    
    //-------------
    // Tools
    //-------------

    setTool(toolName: keyof typeof this.tools): void {
        if (this.currentTool) {
            this.currentTool.deactivate()
        }

        // Clear selection if was using select
        if (this.currentTool === this.tools.select) {
            this.objectManager.clearSelection()
        }

        this.currentTool = this.tools[toolName]
        this.currentTool.activate()

        this.render()
    }

    getCurrentTool(): Tool | null {
        const toolName = selectors.getTool()
        return this.tools[toolName as keyof typeof this.tools] ?? null
    }

    resize(): void {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
        this.needsRedraw = true
        this.render()
    }



    //------------------
    // Render
    //-------------------
    render(): void {
        if (!this.needsRedraw) {
            return // skip if no changes
        }

        this.renderFull()
        this.needsRedraw = false
    }

    
    // Mark canvas as needing redraw
    markDirty(): void {
        this.needsRedraw = true
    }
    
    // Convenience method that marks dirty and renders in one call
    renderDirty(): void {
        this.markDirty()
        this.render()
    }

    
    // bypasses needsRedraw 
    // Used for network events 
    renderForce(): void {
        this.needsRedraw = true
        this.renderFull()
        this.needsRedraw = false
    }

    
    // Full canvas redraw with viewport culling
    renderFull(): void {
        try {
            // clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

            this.ctx.save()

            // Apply viewport transform
            const { offsetX, offsetY, scale } = this.coordinates
            this.ctx.translate(offsetX, offsetY)
            this.ctx.scale(scale, scale)

            // viewport bounds for culling
            const viewport = this.getViewportBounds()

            // -- Render -- 

            // objects
            this.objectManager.render(this.ctx, viewport)

            // current tool
            if (this.currentTool && this.currentTool.renderPreview) {
                try {
                    this.currentTool.renderPreview(this.ctx)
                } catch (error) {
                    log.error('Failed to render tool preview', error)
                }
            }

            // remote cursors 
            if (this.remoteCursors) {
                this.remoteCursors.forEach(cursor => {
                    try {
                        this.renderRemoteCursor(this.ctx, cursor)
                    } catch (error) {
                        log.error('Failed to render cursor', { userId: cursor.userId, error })
                    }
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
                userMessage:
                    'Rendering error occurred. Please refresh if the canvas appears blank.',
            })
        }
    }

    getViewportBounds(): Bounds {
        const { scale, offsetX, offsetY } = this.coordinates
        return {
            x: -offsetX / scale,
            y: -offsetY / scale,
            width: this.canvas.width / scale,
            height: this.canvas.height / scale,
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
    }
}
