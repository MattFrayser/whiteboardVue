import { Tool } from './Tool'
import { Text } from '../objects/Text'

export class TextTool extends Tool {
    constructor(engine) {
        super(engine)
        this.isEditing = false
        this.currentText = null
        this.inputElement = null
    }
    
    onMouseDown(worldPos, e) {
        // If already editing, finish current text
        if (this.isEditing) {
            this.finishEditing()
        }
        
        // Create text input at click position
        this.createTextInput(worldPos)
    }
    
    createTextInput(worldPos) {
        // Create input element
        this.inputElement = document.createElement('input')
        this.inputElement.type = 'text'
        this.inputElement.style.position = 'absolute'
        this.inputElement.style.zIndex = '10000'

        // Position input at click location
        const viewportPos = this.engine.coordinates.worldToViewport(worldPos)
        const canvasRect = this.engine.canvas.getBoundingClientRect()
        this.inputElement.style.left = (canvasRect.left + viewportPos.x) + 'px'
        this.inputElement.style.top = (canvasRect.top + viewportPos.y) + 'px'
        this.inputElement.style.fontSize = this.engine.currentWidth * 3 + 'px'
        this.inputElement.style.color = this.engine.currentColor
        this.inputElement.style.background = 'rgba(255, 255, 255, 0.9)'
        this.inputElement.style.border = '2px solid #0066ff'
        this.inputElement.style.outline = 'none'
        this.inputElement.style.fontFamily = 'Arial, sans-serif'
        this.inputElement.style.minWidth = '100px'
        this.inputElement.style.padding = '4px'
        this.inputElement.style.borderRadius = '3px'

        document.body.appendChild(this.inputElement)

        // Handle input events
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.finishEditing()
            } else if (e.key === 'Escape') {
                this.cancelEditing()
            }
            e.stopPropagation()
        })

        // Delay blur handler to prevent immediate firing from mousedown event
        setTimeout(() => {
            if (this.inputElement) {
                this.inputElement.addEventListener('blur', () => {
                    this.finishEditing()
                })
            }
        }, 200)

        // Focus after a small delay to ensure mouseup has completed
        setTimeout(() => {
            if (this.inputElement) {
                this.inputElement.focus()
            }
        }, 10)
        
        this.isEditing = true
        this.currentTextPosition = worldPos
    }
    
    finishEditing() {
        if (!this.inputElement) return
        
        const text = this.inputElement.value.trim()
        if (text) {
            // Create text object
            const textObj = new Text(null, {
                text: text,
                x: this.currentTextPosition.x,
                y: this.currentTextPosition.y,
                color: this.engine.currentColor,
                fontSize: this.engine.currentWidth * 3,
                fontFamily: 'Arial, sans-serif',
                bold: false,
                italic: false,
                background: null
            })
            
            this.engine.objectManager.addObject(textObj)
            this.engine.render()
        }
        
        this.cleanup()
    }
    
    cancelEditing() {
        this.cleanup()
    }
    
    cleanup() {
        if (this.inputElement) {
            this.inputElement.remove()
            this.inputElement = null
        }
        this.isEditing = false
        this.currentText = null
        this.currentTextPosition = null
    }
    
    deactivate() {
        super.deactivate()
        if (this.isEditing) {
            this.finishEditing()
        }
    }
}
