import { appState, actions } from '../stores/AppState'

export class Toolbar {
    constructor(engine) {
        this.engine = engine
        this.activeSwatch = null
        this.activeSwatchForMenu = null
        this.unsubscribers = [] // Track subscriptions for cleanup
        this.colors = [
            '#000000','#FFFFFF','#FF0000','#00FF00','#0000FF','#FFFF00',
            '#FF00FF','#00FFFF','#800000','#008000','#000080','#808000',
            '#800080','#008080','#C0C0C0','#808080','#FFA500','#A52A2A',
            '#FFC0CB','#FFD700','#4B0082','#9370DB','#90EE90','#FF6347',
        ]

        // init
        this.setupEventListeners()
        this.subscribeToState()
        this.initColorGrid()
        this.initSwatches()
    }

    subscribeToState() {
        const unsubTool = appState.subscribe('ui.tool', (tool) => {
            this.updateToolButtons(tool)
        })
        this.unsubscribers.push(unsubTool)

        const unsubCursor = appState.subscribe('ui.cursor', () => {
            const currentTool = appState.get('ui.tool')
            this.updateToolButtons(currentTool)
        })
        this.unsubscribers.push(unsubCursor)

        const unsubColor = appState.subscribe('ui.color', (color) => {
            this.updateColorUI(color)
        })
        this.unsubscribers.push(unsubColor)

        const unsubSize = appState.subscribe('ui.brushSize', (size) => {
            this.updateBrushSizeUI(size)
        })
        this.unsubscribers.push(unsubSize)

        // History state changes
        const unsubHistory = appState.subscribe('history', ({ canUndo, canRedo }) => {
            const undoBtn = document.getElementById('undoBtn')
            const redoBtn = document.getElementById('redoBtn')
            undoBtn.disabled = !canUndo
            redoBtn.disabled = !canRedo
        })
        this.unsubscribers.push(unsubHistory)
    }

    setupEventListeners() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool
                actions.setTool(tool)
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
                const swatchColor = swatch.dataset.color
                const swatchSize = parseInt(swatch.dataset.size) || appState.get('ui.brushSize')
                this.selectColor(swatchColor)
                this.selectBrushSize(swatchSize)
            })

            swatch.addEventListener('dblclick', () => {
                this.openMenu(swatch)
            })
        })

        // Color menu
        colorMenu.addEventListener('click', e => {
            e.stopPropagation()
        })
        // Select color square changes color and closes menu
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

        // Undo/Redo - direct calls to engine
        document.getElementById('undoBtn').addEventListener('click', () => {
            if (this.engine) {
                this.engine.undo()
            }
        })
        document.getElementById('redoBtn').addEventListener('click', () => {
            if (this.engine) {
                this.engine.redo()
            }
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
        // Update state (will trigger UI update via subscription)
        actions.setBrushSize(size)

        // Store size on active swatch
        if (this.activeSwatch) {
            this.activeSwatch.dataset.size = size
        }
    }

    updateBrushSizeUI(size) {
        const brushSize = document.getElementById('brushSize')
        if (brushSize) {
            brushSize.value = size
        }
        this.updateBrushPreview()
    }

    updateBrushPreview() {
        if (this.activeSwatch) {
            const circle = this.activeSwatch.querySelector('.swatch-circle')
            if (circle) {
                const currentWidth = appState.get('ui.brushSize')
                const size = Math.min(28, Math.max(8, currentWidth * 1.5))
                circle.style.width = `${size}px`
                circle.style.height = `${size}px`
            }
        }
    }
    selectColor(color) {
        // Update state (will trigger UI update via subscription)
        actions.setColor(color)
    }

    updateColorUI(color) {
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
        const swatchSize = parseInt(swatch.dataset.size) || appState.get('ui.brushSize')
        actions.setColor(swatchColor)

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

    updateToolButtons(tool) {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active')
            if (btn.dataset.tool === tool) {
                btn.classList.add('active')
            }
        })

        // Get canvas directly from DOM
        const canvas = document.getElementById('canvas')

        switch (tool) {
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

    destroy() {
        // Clean up all subscriptions
        this.unsubscribers.forEach(unsub => unsub())
        this.unsubscribers = []
    }
}
