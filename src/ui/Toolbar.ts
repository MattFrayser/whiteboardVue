import { appState, actions } from '../stores/AppState'
import type { Tool } from '../stores/AppState'
import type { DrawingEngine } from '../engine/DrawingEngine'

export class Toolbar {
    engine: DrawingEngine
    activeSwatch: HTMLElement | null
    activeSwatchForMenu: HTMLElement | null
    unsubscribers: (() => void)[]
    colors: string[]

    constructor(engine: DrawingEngine) {
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

    subscribeToState(): void {
        const unsubTool = appState.subscribe('ui.tool', (tool) => {
            this.updateToolButtons(tool as string)
        })
        this.unsubscribers.push(unsubTool)

        const unsubCursor = appState.subscribe('ui.cursor', () => {
            const currentTool = appState.get('ui.tool') as string
            this.updateToolButtons(currentTool)
        })
        this.unsubscribers.push(unsubCursor)

        const unsubColor = appState.subscribe('ui.color', (color) => {
            this.updateColorUI(color as string)
        })
        this.unsubscribers.push(unsubColor)

        const unsubSize = appState.subscribe('ui.brushSize', (size) => {
            this.updateBrushSizeUI(size as number)
        })
        this.unsubscribers.push(unsubSize)

        // History state changes
        const unsubHistory = appState.subscribe('history', (historyState) => {
            const { canUndo, canRedo } = historyState as { canUndo: boolean; canRedo: boolean }
            const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement
            const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement
            if (undoBtn) undoBtn.disabled = !canUndo
            if (redoBtn) redoBtn.disabled = !canRedo
        })
        this.unsubscribers.push(unsubHistory)
    }

    setupEventListeners(): void {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = ((btn as HTMLElement).dataset).tool
                if (tool) actions.setTool(tool as Tool)
            })
        })

        // Color Picker
        const colorPicker = document.getElementById('colorPicker')
        if (colorPicker) {
            colorPicker.addEventListener('change', e => {
                this.selectColor((e.target as HTMLInputElement).value)
            })
        }

        // Color swatches - single click selects, double click opens menu
        document.querySelectorAll('.swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const swatchColor = ((swatch as HTMLElement).dataset).color
                const swatchSizeStr = ((swatch as HTMLElement).dataset).size
                const swatchSize = swatchSizeStr ? parseInt(swatchSizeStr) : (appState.get('ui.brushSize') as number)
                if (swatchColor) this.selectColor(swatchColor)
                this.selectBrushSize(swatchSize)
            })

            swatch.addEventListener('dblclick', () => {
                this.openMenu(swatch as HTMLElement)
            })
        })

        // Color menu
        const colorMenu = document.getElementById('colorMenu')
        const colorGrid = document.getElementById('colorGrid')
        if (colorMenu) {
            colorMenu.addEventListener('click', e => {
                e.stopPropagation()
            })
        }
        // Select color square changes color and closes menu
        if (colorGrid) {
            colorGrid.addEventListener('click', e => {
                if ((e.target as Element).classList.contains('color-option')) {
                    const color = ((e.target as HTMLElement).dataset).color
                    if (color) this.selectColor(color)
                    this.closeMenu()
                }
            })
        }
        // Close menu when clicking outside
        document.addEventListener('click', e => {
            if (!(e.target as Element).closest('.color-picker-container')) {
                this.closeMenu()
            }
        })

        // Brush Size
        const brushSize = document.getElementById('brushSize')
        if (brushSize) {
            brushSize.addEventListener('input', e => {
                this.selectBrushSize(parseInt((e.target as HTMLInputElement).value))
            })
        }

        // Undo/Redo - direct calls to engine
        const undoBtn = document.getElementById('undoBtn')
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (this.engine) {
                    this.engine.undo()
                }
            })
        }
        const redoBtn = document.getElementById('redoBtn')
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                if (this.engine) {
                    this.engine.redo()
                }
            })
        }
    }

    initSwatches(): void {
        const swatches = document.querySelectorAll('.swatch')
        if (swatches.length > 0) {
            this.activeSwatch = swatches[0] as HTMLElement
            this.activeSwatch.classList.add('active')
        }
    }

    initColorGrid(): void {
        const colorGrid = document.getElementById('colorGrid') as HTMLElement
        if (!colorGrid) return
        this.colors.forEach((color: string) => {
            const colorOption = document.createElement('div')
            colorOption.classList.add('color-option')
            colorOption.setAttribute('data-color', color)
            colorOption.style.background = color
            colorGrid.appendChild(colorOption)
        })
    }

    selectBrushSize(size: number): void {
        // Update state (will trigger UI update via subscription)
        actions.setBrushSize(size)

        // Store size on active swatch
        if (this.activeSwatch) {
            (this.activeSwatch as HTMLElement).dataset.size = String(size)
        }
    }

    updateBrushSizeUI(size: number): void {
        const brushSize = document.getElementById('brushSize') as HTMLInputElement
        if (brushSize) {
            brushSize.value = String(size)
        }
        this.updateBrushPreview()
    }

    updateBrushPreview(): void {
        if (this.activeSwatch) {
            const circle = this.activeSwatch.querySelector('.swatch-circle')
            if (circle) {
                const currentWidth = appState.get('ui.brushSize') as number
                const size = Math.min(28, Math.max(8, currentWidth * 1.5))
                ;(circle as HTMLElement).style.width = `${size}px`
                ;(circle as HTMLElement).style.height = `${size}px`
            }
        }
    }
    selectColor(color: string): void {
        // Update state (will trigger UI update via subscription)
        actions.setColor(color)
    }

    updateColorUI(color: string): void {
        // Remove active from current swatch
        if (this.activeSwatch) {
            this.activeSwatch.classList.remove('active')
        }

        // Find matching swatch
        let matchingSwatch: HTMLElement | null = null
        const swatches = document.querySelectorAll('.swatch')
        for (const swatch of swatches) {
            const swatchColor = ((swatch as HTMLElement).dataset).color
            if (swatchColor && swatchColor.toUpperCase() === color.toUpperCase()) {
                matchingSwatch = swatch as HTMLElement
                break
            }
        }

        // Update swatch or use menu swatch
        if (matchingSwatch) {
            this.activeSwatch = matchingSwatch
        } else if (this.activeSwatchForMenu) {
            const circle = this.activeSwatchForMenu.querySelector('.swatch-circle')
            if (circle) {
                (circle as HTMLElement).style.backgroundColor = color
            }
            (this.activeSwatchForMenu as HTMLElement).dataset.color = color
            this.activeSwatch = this.activeSwatchForMenu
        }

        if (this.activeSwatch) {
            this.activeSwatch.classList.add('active')
            this.updateBrushPreview()
        }

        // Update color picker
        const colorPicker = document.getElementById('colorPicker') as HTMLInputElement
        if (colorPicker) {
            colorPicker.value = color
        }
    }
    openMenu(swatch: HTMLElement): void {
        const colorMenu = document.getElementById('colorMenu')
        const colorPicker = document.getElementById('colorPicker') as HTMLInputElement

        this.activeSwatchForMenu = swatch

        // Make this swatch active
        if (this.activeSwatch) {
            this.activeSwatch.classList.remove('active')
        }
        this.activeSwatch = swatch
        this.activeSwatch.classList.add('active')

        // Update toolbar state with this swatch's settings
        const swatchColor = ((swatch as HTMLElement).dataset).color
        const swatchSizeStr = ((swatch as HTMLElement).dataset).size
        const swatchSize = swatchSizeStr ? parseInt(swatchSizeStr) : (appState.get('ui.brushSize') as number)
        if (swatchColor) actions.setColor(swatchColor)

        if (colorMenu) {
            colorMenu.classList.remove('hidden')
        }
        if (colorPicker && swatchColor) {
            colorPicker.value = swatchColor
        }

        this.selectBrushSize(swatchSize)
    }

    closeMenu(): void {
        const colorMenu = document.getElementById('colorMenu')
        if (colorMenu) {
            colorMenu.classList.add('hidden')
        }
        this.activeSwatchForMenu = null
    }

    updateToolButtons(tool: string): void {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active')
            if (((btn as HTMLElement).dataset).tool === tool) {
                btn.classList.add('active')
            }
        })

        // Get canvas directly from DOM
        const canvas = document.getElementById('canvas') as HTMLCanvasElement

        if (!canvas) return

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

    destroy(): void {
        // Clean up all subscriptions
        this.unsubscribers.forEach(unsub => unsub())
        this.unsubscribers = []
    }
}
