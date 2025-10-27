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
    constructor(canvas, eventBus) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.eventBus = eventBus

        this.objectManager = new ObjectManager(this, eventBus)
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

        this.rightMouseDown = false
        this.lastMousePos = { x: 0, y: 0 } // mouse position for paste
        this.lastCursorBroadcast = 0

        this.dirtyRegions = []
        this.dirtyThreshold = 0.3 // % canvas area
        this.forceFullRedraw = false

        this.setupEventListeners()
        this.subscribeToEvents()
        this.resize()
    }

    setupEventListeners() {
        // Store bound methods for cleanup
        this.boundHandleMouseDown = e => this.handleMouseDown(e)
        this.boundHandleMouseMove = e => this.handleMouseMove(e)
        this.boundHandleMouseUp = e => this.handleMouseUp(e)
        this.boundHandleMouseWheel = e => this.handleMouseWheel(e)
        this.boundPreventContext = e => e.preventDefault()
        this.boundResize = () => this.resize()
        this.boundHandleKeyDown = e => this.handleKeyDown(e)

        this.canvas.addEventListener('mousedown', this.boundHandleMouseDown)
        this.canvas.addEventListener('mousemove', this.boundHandleMouseMove)
        this.canvas.addEventListener('mouseup', this.boundHandleMouseUp)
        this.canvas.addEventListener('wheel', this.boundHandleMouseWheel)
        this.canvas.addEventListener('contextmenu', this.boundPreventContext)

        window.addEventListener('resize', this.boundResize)
        document.addEventListener('keydown', this.boundHandleKeyDown)
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
        this.eventBus.subscribe('network:objectAdded', ({ object, userId }) => {
            const obj = this.objectManager.createObjectFromData(object)
            if (obj) {
                this.objectManager.objects.push(obj)
                const bounds = obj.getBounds()
                this.objectManager.quadtree.insert(obj, bounds)
                this.markDirty(bounds)
                this.render()
            }
        })

        this.eventBus.subscribe('network:objectUpdated', ({ object, userId }) => {
            const obj = this.objectManager.objects.find(o => o.id === object.id)
            if (obj) {
                const oldBounds = obj.getBounds()
                this.markDirty(oldBounds)
                this.objectManager.quadtree.remove(obj, oldBounds)

                obj.data = object.data

                const newBounds = obj.getBounds()
                this.markDirty(newBounds)
                this.objectManager.quadtree.insert(obj, newBounds)
                this.render()
            }
        })

        this.eventBus.subscribe('network:objectDeleted', ({ objectId, userId }) => {
            const obj = this.objectManager.objects.find(o => o.id === objectId)
            if (obj) {
                const bounds = obj.getBounds()
                this.markDirty(bounds)
                this.objectManager.quadtree.remove(obj, bounds)

                const index = this.objectManager.objects.indexOf(obj)
                if (index > -1) {
                    this.objectManager.objects.splice(index, 1)
                    this.render()
                }
            }
        })

        this.eventBus.subscribe('network:sync', ({ objects }) => {
            this.objectManager.objects = []
            objects.forEach(objData => {
                const obj = this.objectManager.createObjectFromData(objData)
                if (obj) {
                    this.objectManager.objects.push(obj)
                }
            })
            this.render()
        })

        // Remote cursor updates
        this.eventBus.subscribe('network:remoteCursorMove', ({ userId, x, y, color, tool }) => {
            // Store remote cursors locally for rendering
            if (!this.remoteCursors) {
                this.remoteCursors = new Map()
            }

            const oldCursor = this.remoteCursors.get(userId)
            if (oldCursor) {
                const cursorRadius = 10
                this.markDirty({
                    x: oldCursor.x - cursorRadius,
                    y: oldCursor.y - cursorRadius,
                    width: cursorRadius * 2,
                    height: cursorRadius * 2
                }, 5)
            }

            this.remoteCursors.set(userId, { x, y, color, tool })

            const cursorRadius = 10
            this.markDirty({
                x: x - cursorRadius,
                y: y - cursorRadius,
                width: cursorRadius * 2,
                height: cursorRadius * 2
            }, 5)

            this.render()
        })

        this.eventBus.subscribe('network:userDisconnected', ({ userId }) => {
            if (this.remoteCursors) {
                this.remoteCursors.delete(userId)
                this.render()
            }
        })
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
        this.lastMousePos = { x: e.clientX, y: e.clientY } 

        const worldPos = this.coordinates.viewportToWorld(
            {x: e.clientX, y: e.clientY},
            this.canvas
        )

        // Broadcast cursor position with throttling 
        const now = Date.now()
        if (now - this.lastCursorBroadcast >= 50) {
            this.lastCursorBroadcast = now
            const toolName = Object.keys(this.tools).find(
                key => this.tools[key] === this.currentTool
            )
            // 
            this.eventBus.publish('engine:cursorMove', {
                x: worldPos.x,
                y: worldPos.y,
                tool: toolName
            })
        }

        // left click 
        if (e.buttons === 1) {
            this.currentTool.onMouseMove(worldPos, e)
        // right click
        } else if (e.buttons === 2) {
            e.preventDefault()
            this.coordinates.pan({ x: e.clientX, y: e.clientY })
            this.forceFullRedraw = true // Panning affects entire viewport
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
        this.forceFullRedraw = true // Zoom affects entire viewport
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
            } else {
                this.eventBus.emit('engine:cursorChanged', {})
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
        }


        // Undo (ctrl-z) / redo (ctrl-shift-z)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault()
            this.objectManager.redo()
            this.render()
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault()
            this.objectManager.undo()
            this.render()
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

        this.eventBus.publish('engine:toolChanged', { toolName })
        this.render()
    }
    
    resize() {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
        this.forceFullRedraw = true
        this.render()
    }

    /**
     * Mark a region as dirty (needs redrawing)
     * Bounds should be in world coordinates
     */
    markDirty(bounds, padding = 10) {
        if (!bounds || bounds.width === 0 || bounds.height === 0) {
            return
        }

        // Expand bounds for stroke width/anti-aliasing
        const expanded = {
            x: bounds.x - padding,
            y: bounds.y - padding,
            width: bounds.width + padding * 2,
            height: bounds.height + padding * 2
        }

        this.dirtyRegions.push(expanded)
    }

    /**
     * Clear all dirty regions
     */
    clearDirtyRegions() {
        this.dirtyRegions = []
        this.forceFullRedraw = false
    }

    /**
     * Merge overlapping dirty regions into a single bounding box
     */
    mergeDirtyRegions() {
        if (this.dirtyRegions.length === 0) return []
        if (this.dirtyRegions.length === 1) return this.dirtyRegions

        // Simple approach: compute single bounding box
        let minX = Infinity, minY = Infinity
        let maxX = -Infinity, maxY = -Infinity

        for (const region of this.dirtyRegions) {
            minX = Math.min(minX, region.x)
            minY = Math.min(minY, region.y)
            maxX = Math.max(maxX, region.x + region.width)
            maxY = Math.max(maxY, region.y + region.height)
        }

        return [{
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        }]
    }

    /**
     * Check if we should use full redraw instead of dirty rect optimization
     */
    shouldUseFullRedraw() {
        if (this.forceFullRedraw) return true
        if (this.dirtyRegions.length === 0) return false

        const merged = this.mergeDirtyRegions()
        if (merged.length === 0) return false

        // Calculate dirty area in viewport coordinates
        const { scale, offsetX, offsetY } = this.coordinates
        const dirtyViewportArea = merged.reduce((total, region) => {
            const vw = region.width * scale
            const vh = region.height * scale
            return total + (vw * vh)
        }, 0)

        const canvasArea = this.canvas.width * this.canvas.height
        return (dirtyViewportArea / canvasArea) > this.dirtyThreshold
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
            height: this.canvas.height / scale
        }
    }
    
    render() {
        // Check if we should use dirty rectangle optimization
        if (this.dirtyRegions.length > 0 && !this.shouldUseFullRedraw()) {
            this.renderDirty()
        } else {
            this.renderFull()
        }

        this.clearDirtyRegions()
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
            this.remoteCursors.forEach((cursor, userId) => {
                this.renderRemoteCursor(this.ctx, cursor)
            })
        }

        this.ctx.restore()
    }

    /**
     * Render only dirty regions
     */
    renderDirty() {
        const mergedRegions = this.mergeDirtyRegions()
        const { offsetX, offsetY, scale } = this.coordinates

        for (const region of mergedRegions) {
            this.ctx.save()

            // Transform to viewport coordinates
            const viewportX = region.x * scale + offsetX
            const viewportY = region.y * scale + offsetY
            const viewportWidth = region.width * scale
            const viewportHeight = region.height * scale

            // Set clipping region in viewport coordinates
            this.ctx.beginPath()
            this.ctx.rect(viewportX, viewportY, viewportWidth, viewportHeight)
            this.ctx.clip()

            // Clear the dirty region
            this.ctx.clearRect(viewportX, viewportY, viewportWidth, viewportHeight)

            // Apply world transformations
            this.ctx.translate(offsetX, offsetY)
            this.ctx.scale(scale, scale)

            // Query objects in dirty region using quadtree
            const objectsToRender = this.objectManager.quadtree.query(region)
            objectsToRender.forEach(obj => obj.render(this.ctx))

            // Render current tool preview if it intersects dirty region
            if (this.currentTool && this.currentTool.renderPreview) {
                this.currentTool.renderPreview(this.ctx)
            }

            // Render remote cursors in dirty region
            if (this.remoteCursors) {
                this.remoteCursors.forEach((cursor, userId) => {
                    // Check if cursor is in dirty region
                    if (cursor.x >= region.x && cursor.x <= region.x + region.width &&
                        cursor.y >= region.y && cursor.y <= region.y + region.height) {
                        this.renderRemoteCursor(this.ctx, cursor)
                    }
                })
            }

            this.ctx.restore()
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
        // Remove all event listeners
        if (this.boundHandleMouseDown) {
            this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown)
            this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove)
            this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp)
            this.canvas.removeEventListener('wheel', this.boundHandleMouseWheel)
            this.canvas.removeEventListener('contextmenu', this.boundPreventContext)

            window.removeEventListener('resize', this.boundResize)
            document.removeEventListener('keydown', this.boundHandleKeyDown)
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
    }
}
