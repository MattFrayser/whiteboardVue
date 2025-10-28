export class Toolbar {
    constructor(eventBus) {
        this.eventBus = eventBus
        this.swatchClickTimer = null
        this.activeSwatch = null
        this.activeSwatchForMenu = null
        this.colors = [
            '#000000',
            '#FFFFFF',
            '#FF0000',
            '#00FF00',
            '#0000FF',
            '#FFFF00',
            '#FF00FF',
            '#00FFFF',
            '#800000',
            '#008000',
            '#000080',
            '#808000',
            '#800080',
            '#008080',
            '#C0C0C0',
            '#808080',
            '#FFA500',
            '#A52A2A',
            '#FFC0CB',
            '#FFD700',
            '#4B0082',
            '#9370DB',
            '#90EE90',
            '#FF6347',
        ]

        // Track state locally
        this.currentColor = '#000000'
        this.currentWidth = 5
        this.currentTool = 'draw'

        this.setupEventListeners()
        this.subscribeToEvents()
        this.initColorGrid()
        this.initSwatches()
    }

    subscribeToEvents() {
        // Listen for tool changes from engine
        this.eventBus.subscribe('engine:toolChanged', ({ toolName }) => {
            this.currentTool = toolName
            this.updateToolButtons()
        })

        // Listen for cursor changes
        this.eventBus.subscribe('engine:cursorChanged', () => {
            this.updateToolButtons()
        })

        // Listen for history changes from ObjectManager
        this.eventBus.subscribe('objectManager:historyChanged', ({ canUndo, canRedo }) => {
            const undoBtn = document.getElementById('undoBtn')
            const redoBtn = document.getElementById('redoBtn')
            undoBtn.disabled = !canUndo
            redoBtn.disabled = !canRedo
        })
    }

    setupEventListeners() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool
                this.eventBus.publish('toolbar:toolChanged', { toolName: tool })
            })
        })

        // Color Picker
        const colorPicker = document.getElementById('colorPicker')
        colorPicker.addEventListener('change', e => {
            this.selectColor(e.target.value)
        })

        // Color swatches - single click selects, double click opens menu
        document.querySelectorAll('.swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                clearTimeout(this.swatchClickTimer)
                const swatchColor = swatch.dataset.color
                const swatchSize = parseInt(swatch.dataset.size) || this.currentWidth

                this.swatchClickTimer = setTimeout(() => {
                    this.selectColor(swatchColor)
                    this.selectBrushSize(swatchSize)
                }, 250)
            })

            swatch.addEventListener('dblclick', () => {
                clearTimeout(this.swatchClickTimer)
                this.openMenu(swatch)
            })
        })

        // Color menu
        colorMenu.addEventListener('click', e => {
            e.stopPropagation()
        })

        colorGrid.addEventListener('click', e => {
            if (e.target.classList.contains('color-option')) {
                this.selectColor(e.target.dataset.color)
                this.closeMenu()
            }
        })
        // Close menu when clicking outside
        document.addEventListener('click', e => {
            if (!e.target.closest('.color-picker-container')) {
                this.closeMenu()
            }
        })

        // Brush Size
        const brushSize = document.getElementById('brushSize')
        brushSize.addEventListener('input', e => {
            this.selectBrushSize(parseInt(e.target.value))
        })

        // Undo/Redo
        document.getElementById('undoBtn').addEventListener('click', () => {
            // Emit event instead of calling engine directly
            this.eventBus.publish('toolbar:undoRequested', {})
        })
        document.getElementById('redoBtn').addEventListener('click', () => {
            // Emit event instead of calling engine directly
            this.eventBus.publish('toolbar:redoRequested', {})
        })
    }

    initSwatches() {
        const swatches = document.querySelectorAll('.swatch')
        if (swatches.length > 0) {
            this.activeSwatch = swatches[0]
            this.activeSwatch.classList.add('active')
        }
    }

    initColorGrid() {
        this.colors.forEach(color => {
            const colorOption = document.createElement('div')
            colorOption.classList.add('color-option')
            colorOption.dataset.color = color
            colorOption.style.background = color
            colorGrid.appendChild(colorOption)
        })
    }

    selectBrushSize(size) {
        this.currentWidth = size

        const brushSize = document.getElementById('brushSize')
        if (brushSize) {
            brushSize.value = size
        }

        // Store size on active swatch
        if (this.activeSwatch) {
            this.activeSwatch.dataset.size = size
        }

        // Emit event
        this.eventBus.publish('toolbar:brushSizeChanged', { size })

        this.updateBrushPreview()
    }

    updateBrushPreview() {
        if (this.activeSwatch) {
            const circle = this.activeSwatch.querySelector('.swatch-circle')
            if (circle) {
                const size = Math.min(28, Math.max(8, this.currentWidth * 1.5))
                circle.style.width = `${size}px`
                circle.style.height = `${size}px`
            }
        }
    }
    selectColor(color) {
        this.currentColor = color

        // Remove active from current swatch
        if (this.activeSwatch) {
            this.activeSwatch.classList.remove('active')
        }

        // Find matching swatch
        let matchingSwatch = null
        const swatches = document.querySelectorAll('.swatch')
        for (const swatch of swatches) {
            if (swatch.dataset.color.toUpperCase() === color.toUpperCase()) {
                matchingSwatch = swatch
                break
            }
        }

        // Update swatch or use menu swatch
        if (matchingSwatch) {
            this.activeSwatch = matchingSwatch
        } else if (this.activeSwatchForMenu) {
            const circle = this.activeSwatchForMenu.querySelector('.swatch-circle')
            if (circle) {
                circle.style.backgroundColor = color
            }
            this.activeSwatchForMenu.dataset.color = color
            this.activeSwatch = this.activeSwatchForMenu
        }

        if (this.activeSwatch) {
            this.activeSwatch.classList.add('active')
            this.updateBrushPreview()
        }

        // Update color picker
        const colorPicker = document.getElementById('colorPicker')
        if (colorPicker) {
            colorPicker.value = color
        }

        // Emit event
        this.eventBus.publish('toolbar:colorChanged', { color })
    }
    openMenu(swatch) {
        this.activeSwatchForMenu = swatch

        // Make this swatch active
        if (this.activeSwatch) {
            this.activeSwatch.classList.remove('active')
        }
        this.activeSwatch = swatch
        this.activeSwatch.classList.add('active')

        // Update toolbar state with this swatch's settings
        const swatchColor = swatch.dataset.color
        const swatchSize = parseInt(swatch.dataset.size) || this.currentWidth
        this.currentColor = swatchColor

        colorMenu.classList.remove('hidden')
        const colorPicker = document.getElementById('colorPicker')
        if (colorPicker) {
            colorPicker.value = swatchColor
        }

        this.selectBrushSize(swatchSize)
    }

    closeMenu() {
        colorMenu.classList.add('hidden')
        this.activeSwatchForMenu = null
    }

    updateToolButtons() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active')
            if (btn.dataset.tool === this.currentTool) {
                btn.classList.add('active')
            }
        })

        // Get canvas directly from DOM
        const canvas = document.getElementById('canvas')
        const currentToolName = this.currentTool

        switch (currentToolName) {
            case 'rectangle':
                canvas.style.cursor = 'crosshair'
                break
            case 'circle':
                canvas.style.cursor = 'crosshair'
                break
            case 'line':
                canvas.style.cursor = 'crosshair'
                break
            case 'draw':
                canvas.style.cursor = 'url(/draw-cursor.svg) 2 17, crosshair'
                break
            case 'eraser':
                canvas.style.cursor = 'url(/eraser-cursor.svg) 10 9, pointer'
                break
            case 'select':
                canvas.style.cursor = 'url(/select-cursor.svg) 2 2, default'
                break
            case 'text':
                canvas.style.cursor = 'text'
                break
            default:
                canvas.style.cursor = 'default'
        }
    }
}
