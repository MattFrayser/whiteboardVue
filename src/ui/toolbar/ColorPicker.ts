import { appState, actions } from '../../stores/AppState'
import { COLOR_PALETTE } from '../../constants'
import { validateColor } from '../../utils/validation'
 
export class ColorPicker {
    activeSwatch: HTMLElement | null
    activeSwatchForMenu: HTMLElement | null
    colors: string[]
 
    // Store bound event handlers for cleanup
    boundColorPickerHandler: ((e: Event) => void) | null
    boundSwatchHandlers: Map<Element, { click: () => void; dblclick: () => void }>
    boundColorMenuHandler: ((e: Event) => void) | null
    boundColorGridHandler: ((e: Event) => void) | null
    boundDocumentClickHandler: ((e: Event) => void) | null
    unsubscribeColor: (() => void) | null
 
    constructor() {
        this.activeSwatch = null
        this.activeSwatchForMenu = null
        this.colors = COLOR_PALETTE
 
        // Initialize handler storage
        this.boundColorPickerHandler = null
        this.boundSwatchHandlers = new Map()
        this.boundColorMenuHandler = null
        this.boundColorGridHandler = null
        this.boundDocumentClickHandler = null
        this.unsubscribeColor = null
 
        // Initialize
        this.initColorGrid()
        this.initSwatches()
        this.setupEventListeners()
        this.subscribeToState()
    }
 
    subscribeToState(): void {
        this.unsubscribeColor = appState.subscribe('ui.color', (color) => {
            this.updateColorUI(color as string)
        })
    }
 
    setupEventListeners(): void {
        const colorPicker = document.getElementById('colorPicker')
        if (colorPicker) {
            this.boundColorPickerHandler = (e: Event) => {
                this.selectColor((e.target as HTMLInputElement).value)
            }
            colorPicker.addEventListener('change', this.boundColorPickerHandler)
        }
 
        // single click selects, double click opens menu
        document.querySelectorAll('.swatch').forEach(swatch => {
            const clickHandler = () => {
                const swatchColor = ((swatch as HTMLElement).dataset).color
                const swatchSizeStr = ((swatch as HTMLElement).dataset).size
                const swatchSize = swatchSizeStr ? parseInt(swatchSizeStr) : (appState.get('ui.brushSize') as number)
                if (swatchColor) this.selectColor(swatchColor)
                actions.setBrushSize(swatchSize)
            }
 
            const dblclickHandler = () => {
                this.openMenu(swatch as HTMLElement)
            }
 
            swatch.addEventListener('click', clickHandler)
            swatch.addEventListener('dblclick', dblclickHandler)
            this.boundSwatchHandlers.set(swatch, { click: clickHandler, dblclick: dblclickHandler })
        })
 
        // Color menu - prevent click propagation
        const colorMenu = document.getElementById('colorMenu')
        if (colorMenu) {
            this.boundColorMenuHandler = (e: Event) => {
                e.stopPropagation()
            }
            colorMenu.addEventListener('click', this.boundColorMenuHandler)
        }
 
        //  select color and close menu
        const colorGrid = document.getElementById('colorGrid')
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
 
        actions.setBrushSize(swatchSize)
    }
 
    closeMenu(): void {
        const colorMenu = document.getElementById('colorMenu')
        if (colorMenu) {
            colorMenu.classList.add('hidden')
        }
        this.activeSwatchForMenu = null
    }
 
    // Public method to update brush preview when size changes
    onBrushSizeChange(size: number): void {
        // Store size on active swatch
        if (this.activeSwatch) {
            (this.activeSwatch as HTMLElement).dataset.size = String(size)
        }
        this.updateBrushPreview()
    }
 
    destroy(): void {
        if (this.unsubscribeColor) {
            this.unsubscribeColor()
            this.unsubscribeColor = null
        }
 
        if (this.boundColorPickerHandler) {
            const colorPicker = document.getElementById('colorPicker')
            if (colorPicker) {
                colorPicker.removeEventListener('change', this.boundColorPickerHandler)
            }
            this.boundColorPickerHandler = null
        }
 
        this.boundSwatchHandlers.forEach((handlers, swatch) => {
            swatch.removeEventListener('click', handlers.click)
            swatch.removeEventListener('dblclick', handlers.dblclick)
        })
        this.boundSwatchHandlers.clear()
 
        if (this.boundColorMenuHandler) {
            const colorMenu = document.getElementById('colorMenu')
            if (colorMenu) {
                colorMenu.removeEventListener('click', this.boundColorMenuHandler)
            }
            this.boundColorMenuHandler = null
        }
 
        if (this.boundColorGridHandler) {
            const colorGrid = document.getElementById('colorGrid')
            if (colorGrid) {
                colorGrid.removeEventListener('click', this.boundColorGridHandler)
            }
            this.boundColorGridHandler = null
        }
 
        if (this.boundDocumentClickHandler) {
            document.removeEventListener('click', this.boundDocumentClickHandler)
            this.boundDocumentClickHandler = null
        }
    }
}
