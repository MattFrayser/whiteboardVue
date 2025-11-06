import { Text } from '../objects/Text'
import { Tool } from './Tool'
import type { Point } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'

export class TextTool extends Tool {
    isEditing: boolean
    inputElement: HTMLInputElement | null
    Position: Point | null
    keydownHandler: ((e: KeyboardEvent) => void) | null
    blurHandler: (() => void) | null

    constructor(engine: DrawingEngine) {
        super(engine)
        this.isEditing = false
        this.inputElement = null
        this.Position = null
        this.keydownHandler = null
        this.blurHandler = null
    }

    override onMouseDown(worldPos: Point, _e: MouseEvent): void {
        // If already editing, finish current text
        if (this.isEditing) {
            this.finishEditing()
        }

        // Create text input at click position
        this.createTextInput(worldPos)
    }

    createTextInput(worldPos: Point): void {
        // Create input element
        this.inputElement = document.createElement('input')
        this.inputElement.type = 'text'
        this.inputElement.style.position = 'absolute'
        this.inputElement.style.zIndex = '10000'

        // Position input at click location
        const viewportPos = this.engine.coordinates.worldToViewport(worldPos)
        const canvasRect = this.engine.canvas.getBoundingClientRect()
        this.inputElement.style.left = `${canvasRect.left + viewportPos.x}px`
        this.inputElement.style.top = `${canvasRect.top + viewportPos.y}px`
        this.inputElement.style.fontSize = `${this.engine.currentWidth * 3}px`
        this.inputElement.style.color = this.engine.currentColor
        this.inputElement.style.background = 'rgba(255, 255, 255, 0.9)'
        this.inputElement.style.border = '2px solid #0066ff'
        this.inputElement.style.outline = 'none'
        this.inputElement.style.fontFamily = 'Arial, sans-serif'
        this.inputElement.style.minWidth = '100px'
        this.inputElement.style.padding = '4px'
        this.inputElement.style.borderRadius = '3px'

        document.body.appendChild(this.inputElement)

        // Store bound event handlers for cleanup
        this.keydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                this.finishEditing()
            } else if (e.key === 'Escape') {
                this.cancelEditing()
            }
            e.stopPropagation()
        }

        this.blurHandler = () => {
            this.finishEditing()
        }

        // Handle input events
        this.inputElement.addEventListener('keydown', this.keydownHandler)

        // Delay blur handler to prevent immediate firing from mousedown event
        setTimeout(() => {
            if (this.inputElement && this.blurHandler) {
                this.inputElement.addEventListener('blur', this.blurHandler)
            }
        }, 200)

        // Focus after a small delay to ensure mouseup has completed
        setTimeout(() => {
            if (this.inputElement) {
                this.inputElement.focus()
            }
        }, 10)

        this.isEditing = true
        this.Position = worldPos
    }

    finishEditing(): void {
        if (!this.inputElement || !this.Position) {
            return
        }

        const text = this.inputElement.value.trim()
        if (text) {
            // Create text object
            const textObj = new Text(null, {
                id: '',
                type: 'text',
                x: this.Position.x,
                y: this.Position.y,
                text,
                color: this.engine.currentColor,
                fontSize: this.engine.currentWidth * 3,
            }, 0)

            this.engine.objectManager.addObject(textObj)
            this.engine.markDirty()
            this.engine.render()
        }

        this.cleanup()
    }

    cancelEditing(): void {
        this.cleanup()
    }

    cleanup(): void {
        if (this.inputElement) {
            // Remove event listeners before removing element
            if (this.keydownHandler) {
                this.inputElement.removeEventListener('keydown', this.keydownHandler)
            }
            if (this.blurHandler) {
                this.inputElement.removeEventListener('blur', this.blurHandler)
            }

            this.inputElement.remove()
            this.inputElement = null
        }

        // Clear handler references
        this.keydownHandler = null
        this.blurHandler = null
        this.isEditing = false
        this.Position = null
    }

    override deactivate(): void {
        super.deactivate()
        if (this.isEditing) {
            this.finishEditing()
        }
    }
}
