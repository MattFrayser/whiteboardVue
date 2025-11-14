import { appState, actions } from '../stores/AppState'
import { COLOR_PALETTE } from '../constants'
import type { Tool } from '../stores/AppState'
import type { DrawingEngine } from '../engine/DrawingEngine'
import { getCursorForTool } from '../utils/getCursorForTool'
import { clampBrushSize, validateColor } from '../utils/validation'

export class Toolbar {
    engine: DrawingEngine
    activeSwatch: HTMLElement | null
    activeSwatchForMenu: HTMLElement | null
    unsubscribers: (() => void)[]
    colors: string[]

    // Store bound event handlers for cleanup
    boundToolButtonHandlers: Map<Element, () => void>
    boundColorPickerHandler: ((e: Event) => void) | null
    boundSwatchHandlers: Map<Element, { click: () => void; dblclick: () => void }>
    boundColorMenuHandler: ((e: Event) => void) | null
    boundColorGridHandler: ((e: Event) => void) | null
    boundDocumentClickHandler: ((e: Event) => void) | null
    boundBrushSizeHandler: ((e: Event) => void) | null
    boundUndoHandler: (() => void) | null
    boundRedoHandler: (() => void) | null

    constructor(engine: DrawingEngine) {
        this.engine = engine
        this.activeSwatch = null
        this.activeSwatchForMenu = null
        this.unsubscribers = [] // subscriptions for cleanup
        this.colors = COLOR_PALETTE

        // Initialize handler storage
        this.boundToolButtonHandlers = new Map()
        this.boundColorPickerHandler = null
        this.boundSwatchHandlers = new Map()
        this.boundColorMenuHandler = null
        this.boundColorGridHandler = null
        this.boundDocumentClickHandler = null
        this.boundBrushSizeHandler = null
        this.boundUndoHandler = null
        this.boundRedoHandler = null

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
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            const handler = () => {
                const tool = ((btn as HTMLElement).dataset).tool
                if (tool) actions.setTool(tool as Tool)
            }
            btn.addEventListener('click', handler)
            this.boundToolButtonHandlers.set(btn, handler)
        })

        // Color Picker
        const colorPicker = document.getElementById('colorPicker')
        if (colorPicker) {
            this.boundColorPickerHandler = (e: Event) => {
                this.selectColor((e.target as HTMLInputElement).value)
            }
            colorPicker.addEventListener('change', this.boundColorPickerHandler)
        }

        // Color swatches - single click selects, double click opens menu
        document.querySelectorAll('.swatch').forEach(swatch => {
            const clickHandler = () => {
                const swatchColor = ((swatch as HTMLElement).dataset).color
                const swatchSizeStr = ((swatch as HTMLElement).dataset).size
                const swatchSize = swatchSizeStr ? parseInt(swatchSizeStr) : (appState.get('ui.brushSize') as number)
                if (swatchColor) this.selectColor(swatchColor)
                this.selectBrushSize(swatchSize)
            }

            const dblclickHandler = () => {
                this.openMenu(swatch as HTMLElement)
            }

            swatch.addEventListener('click', clickHandler)
            swatch.addEventListener('dblclick', dblclickHandler)
            this.boundSwatchHandlers.set(swatch, { click: clickHandler, dblclick: dblclickHandler })
        })

        // Color menu
        const colorMenu = document.getElementById('colorMenu')
        const colorGrid = document.getElementById('colorGrid')
        if (colorMenu) {
            this.boundColorMenuHandler = (e: Event) => {
                e.stopPropagation()
            }
            colorMenu.addEventListener('click', this.boundColorMenuHandler)
        }

        // Select color square changes color and closes menu
        if (colorGrid) {
            this.boundColorGridHandler = (e: Event) => {
                if ((e.target as Element).classList.contains('color-option')) {
                    const color = ((e.target as HTMLElement).dataset).color
                    if (color) this.selectColor(color)
                    this.closeMenu()
                }
            }
            colorGrid.addEventListener('click', this.boundColorGridHandler)
        }

        // Close menu when clicking outside
        this.boundDocumentClickHandler = (e: Event) => {
            if (!(e.target as Element).closest('.color-picker-container')) {
                this.closeMenu()
            }
        }
        document.addEventListener('click', this.boundDocumentClickHandler)

        // Brush Size
        const brushSize = document.getElementById('brushSize')
        if (brushSize) {
            this.boundBrushSizeHandler = (e: Event) => {
                this.selectBrushSize(parseInt((e.target as HTMLInputElement).value))
            }
            brushSize.addEventListener('input', this.boundBrushSizeHandler)
        }

        // Undo/Redo - direct calls to engine
        const undoBtn = document.getElementById('undoBtn')
        if (undoBtn) {
            this.boundUndoHandler = () => {
                if (this.engine) {
                    this.engine.undo()
                }
            }
            undoBtn.addEventListener('click', this.boundUndoHandler)
        }

        const redoBtn = document.getElementById('redoBtn')
        if (redoBtn) {
            this.boundRedoHandler = () => {
                if (this.engine) {
                    this.engine.redo()
                }
            }
            redoBtn.addEventListener('click', this.boundRedoHandler)
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
        // Validate and clamp to prevent crashes from NaN/Infinity
        const validSize = clampBrushSize(size)

        // Update state (will trigger UI update via subscription)
        actions.setBrushSize(validSize)

        // Store size on active swatch
        if (this.activeSwatch) {
            (this.activeSwatch as HTMLElement).dataset.size = String(validSize)
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
        // Validate color format to prevent rendering issues
        const validColor = validateColor(color)

        // Update state (will trigger UI update via subscription)
        actions.setColor(validColor)
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

        actions.setCursor(getCursorForTool(tool as Tool))
    }

    destroy(): void {

        this.unsubscribers.forEach(unsub => unsub())
        this.unsubscribers = []

        // tool button listeners
        this.boundToolButtonHandlers.forEach((handler, btn) => {
            btn.removeEventListener('click', handler)
        })
        this.boundToolButtonHandlers.clear()

        //  color picker listener
        if (this.boundColorPickerHandler) {
            const colorPicker = document.getElementById('colorPicker')
            if (colorPicker) {
                colorPicker.removeEventListener('change', this.boundColorPickerHandler)
            }
            this.boundColorPickerHandler = null
        }

        // swatch listeners
        this.boundSwatchHandlers.forEach((handlers, swatch) => {
            swatch.removeEventListener('click', handlers.click)
            swatch.removeEventListener('dblclick', handlers.dblclick)
        })
        this.boundSwatchHandlers.clear()

        // color menu listener
        if (this.boundColorMenuHandler) {
            const colorMenu = document.getElementById('colorMenu')
            if (colorMenu) {
                colorMenu.removeEventListener('click', this.boundColorMenuHandler)
            }
            this.boundColorMenuHandler = null
        }

        // color grid listener
        if (this.boundColorGridHandler) {
            const colorGrid = document.getElementById('colorGrid')
            if (colorGrid) {
                colorGrid.removeEventListener('click', this.boundColorGridHandler)
            }
            this.boundColorGridHandler = null
        }

        // document click listener
        if (this.boundDocumentClickHandler) {
            document.removeEventListener('click', this.boundDocumentClickHandler)
            this.boundDocumentClickHandler = null
        }

        // brush size listener
        if (this.boundBrushSizeHandler) {
            const brushSize = document.getElementById('brushSize')
            if (brushSize) {
                brushSize.removeEventListener('input', this.boundBrushSizeHandler)
            }
            this.boundBrushSizeHandler = null
        }

        // undo button listener
        if (this.boundUndoHandler) {
            const undoBtn = document.getElementById('undoBtn')
            if (undoBtn) {
                undoBtn.removeEventListener('click', this.boundUndoHandler)
            }
            this.boundUndoHandler = null
        }

        // redo button listener
        if (this.boundRedoHandler) {
            const redoBtn = document.getElementById('redoBtn')
            if (redoBtn) {
                redoBtn.removeEventListener('click', this.boundRedoHandler)
            }
            this.boundRedoHandler = null
        }
    }
}
