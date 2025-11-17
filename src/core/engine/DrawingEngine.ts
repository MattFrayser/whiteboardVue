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
import { 
    isObjectAddedMessage, 
    isObjectUpdatedMessage, 
    isObjectDeletedMessage,
    isSyncMessage,
    isCursorMessage,
    isUserDisconnectedMessage,
    sanitizeObjectData
} from '../../shared/validation'

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
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Failed to get 2d context from canvas')
        }
        this.ctx = ctx
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
        this.currentColor = DEFAULT_COLOR
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
        networkManager: WebSocketManager,
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
                    if (message.userId && typeof message.userId === 'string') {
                        this.objectManager.setUserId(message.userId)
                    }
                    break

                case 'network:objectAdded': {
                    if (!isObjectAddedMessage(message)) {
                        console.error('[DrawingEngine] Invalid objectAdded message')
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
                    if (!isObjectUpdatedMessage(message)) {
                        console.error('[DrawingEngine] Invalid objectUpdated message')
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
                    if (!isObjectDeletedMessage(message)) {
                        console.error('[DrawingEngine] Invalid objectDeleted message')
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
                    if (!isSyncMessage(message)) {
                        console.error('[DrawingEngine] Invalid sync message')
                        break
                    }
                    
                    const sanitized = message.objects.map(sanitizeObjectData)
                    this.objectManager.loadRemoteObjects(sanitized)
                    this.renderDirty()
                    break

                case 'network:userDisconnected':
                    if (!isUserDisconnectedMessage(message)) {
                        console.error('[DrawingEngine] Invalid userDisconnected message')
                        break
                    }
                    
                    this.remoteCursors.delete(message.userId)
                    this.renderDirty()
                    break

                case 'network:remoteCursorMove':
                    if (!isCursorMessage(message)) {
                        console.error('[DrawingEngine] Invalid cursor message')
                        break
                    }
                    
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

    setTool(toolName: keyof typeof this.tools): void {
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

    /**
     * Get the currently active tool instance based on AppState
     * @returns The current tool instance, or null if tool name is invalid
     */
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
     * Convenience method that marks dirty and renders in one call
     * Use this instead of calling markDirty() + render() separately
     */
    renderDirty(): void {
        this.markDirty()
        this.render()
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

            // Render current tool preview with error isolation
            if (this.currentTool && this.currentTool.renderPreview) {
                try {
                    this.currentTool.renderPreview(this.ctx)
                } catch (error) {
                    console.error('[DrawingEngine] Failed to render tool preview:', error)
                }
            }

            // Render remote cursors with per-cursor error isolation
            if (this.remoteCursors) {
                this.remoteCursors.forEach(cursor => {
                    try {
                        this.renderRemoteCursor(this.ctx, cursor)
                    } catch (error) {
                        console.error(`[DrawingEngine] Failed to render cursor for user ${cursor.userId}:`, error)
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

        // References will be garbage collected when the instance is destroyed
        // No need for manual null assignments
    }
}
