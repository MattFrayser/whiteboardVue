import { appState, actions } from '../../shared/stores/AppState'
import type { Tool } from '../../shared/stores/AppState'
import type { DrawingEngine } from '../../core/engine/DrawingEngine'
import { getCursorForTool } from '../../shared/utils/getCursorForTool'
import { clampBrushSize } from '../../shared/validation'

export class ToolControls {
    engine: DrawingEngine

    // Store bound event handlers for cleanup
    boundToolButtonHandlers: Map<Element, () => void>
    boundBrushSizeHandler: ((e: Event) => void) | null
    boundUndoHandler: (() => void) | null
    boundRedoHandler: (() => void) | null

    // Unsubscribers for state
    unsubscribeTool: (() => void) | null
    unsubscribeBrushSize: (() => void) | null
    unsubscribeHistory: (() => void) | null

    // Callback to notify ColorPicker of brush size changes
    onBrushSizeChange: ((size: number) => void) | null

    constructor(engine: DrawingEngine) {
        this.engine = engine

        // Initialize handler storage
        this.boundToolButtonHandlers = new Map()
        this.boundBrushSizeHandler = null
        this.boundUndoHandler = null
        this.boundRedoHandler = null

        // Initialize unsubscribers
        this.unsubscribeTool = null
        this.unsubscribeBrushSize = null
        this.unsubscribeHistory = null

        this.onBrushSizeChange = null

        // Initialize
        this.setupEventListeners()
        this.subscribeToState()
    }

    subscribeToState(): void {
        this.unsubscribeTool = appState.subscribe('ui.tool', tool => {
            this.updateToolButtons(tool as string)
        })

        this.unsubscribeBrushSize = appState.subscribe('ui.brushSize', size => {
            this.updateBrushSizeUI(size as number)
        })

        // History state changes
        this.unsubscribeHistory = appState.subscribe('history', historyState => {
            const { canUndo, canRedo } = historyState as { canUndo: boolean; canRedo: boolean }
            const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement
            const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement
            if (undoBtn) undoBtn.disabled = !canUndo
            if (redoBtn) redoBtn.disabled = !canRedo
        })
    }

    setupEventListeners(): void {
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            const handler = () => {
                const tool = (btn as HTMLElement).dataset.tool
                if (tool) actions.setTool(tool as Tool)
            }
            btn.addEventListener('click', handler)
            this.boundToolButtonHandlers.set(btn, handler)
        })

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

    selectBrushSize(size: number): void {
        // Validate and clamp to prevent crashes from NaN/Infinity
        const validSize = clampBrushSize(size)

        // Update state (will trigger UI update via subscription)
        actions.setBrushSize(validSize)
    }

    updateBrushSizeUI(size: number): void {
        const brushSize = document.getElementById('brushSize') as HTMLInputElement
        if (brushSize) {
            brushSize.value = String(size)
        }

        // Notify ColorPicker to update brush preview
        if (this.onBrushSizeChange) {
            this.onBrushSizeChange(size)
        }
    }

    updateToolButtons(tool: string): void {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active')
            if ((btn as HTMLElement).dataset.tool === tool) {
                btn.classList.add('active')
            }
        })

        actions.setCursor(getCursorForTool(tool as Tool))
    }

    destroy(): void {
        // Unsubscribe from state
        if (this.unsubscribeTool) {
            this.unsubscribeTool()
            this.unsubscribeTool = null
        }

        if (this.unsubscribeBrushSize) {
            this.unsubscribeBrushSize()
            this.unsubscribeBrushSize = null
        }

        if (this.unsubscribeHistory) {
            this.unsubscribeHistory()
            this.unsubscribeHistory = null
        }

        // Remove tool button listeners
        this.boundToolButtonHandlers.forEach((handler, btn) => {
            btn.removeEventListener('click', handler)
        })
        this.boundToolButtonHandlers.clear()

        // Remove brush size listener
        if (this.boundBrushSizeHandler) {
            const brushSize = document.getElementById('brushSize')
            if (brushSize) {
                brushSize.removeEventListener('input', this.boundBrushSizeHandler)
            }
            this.boundBrushSizeHandler = null
        }

        // Remove undo button listener
        if (this.boundUndoHandler) {
            const undoBtn = document.getElementById('undoBtn')
            if (undoBtn) {
                undoBtn.removeEventListener('click', this.boundUndoHandler)
            }
            this.boundUndoHandler = null
        }

        // Remove redo button listener
        if (this.boundRedoHandler) {
            const redoBtn = document.getElementById('redoBtn')
            if (redoBtn) {
                redoBtn.removeEventListener('click', this.boundRedoHandler)
            }
            this.boundRedoHandler = null
        }
    }
}
