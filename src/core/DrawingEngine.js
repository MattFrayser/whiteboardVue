import { ObjectManager } from './ObjectManager'
import { Coordinates } from './Coordinates'
import { DrawTool } from '../tools/DrawTool'

export class DrawingEngine {
    constructor(canvas) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.objectManager = new ObjectManager()
        this.coordinates = new Coordinates()

        this.tools = {
            draw: new DrawTool(this),
        }

        this.currentTool = this.tools.draw
        this.currentColor = '#000000'
        this.currentWidth = 5

        this.setupEventListeners()
        this.resize()
    }

    setupEventListeners() {            
        this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e))
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e))
        this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e))
        this.canvas.addEventListener('wheel', e => this.handleMouseWheel(e))
        
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
        }
    } 

    handleMouseMove(e) {
        const worldPos = this.coordinates.viewportToWorld(
                {x: e.clientX, y: e.clientY},
                this.canvas
        )

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
        }   
    }

    handleMouseWheel(e) {
        e.preventDefault()
        const zoomPoint = { x: e.clientX, y: e.clientY }
        this.coordinates.zoom(e.deltaY, zoomPoint, this.canvas)
        this.render()
    }

    updateCursor() {
            canvas.style.cursor = rightMouseDown ? 'grabbing' : 'crosshair';
    }

    handleKeyDown(e) {
        const shortcuts = {
            'v': 'select',
            'p': 'draw',
            'r': 'rectangle',
            'c': 'circle',
            'l': 'line',
            't': 'text',
            'e': 'eraser'
        }
        
        if (shortcuts[e.key]) {
            this.setTool(shortcuts[e.key])
        }
        
        // Undo/Redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault()
            if (e.shiftKey) {
                this.objectManager.redo()
            } else {
                this.objectManager.undo()
            }
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
        this.currentTool = this.tools[toolName]
        this.currentTool.activate()
    }
    
    resize() {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight - 60
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
        
        this.ctx.restore()
    }
    
    start() {
        this.render()
    }
}
