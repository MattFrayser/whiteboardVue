import type { DrawingEngine } from '../../engine/DrawingEngine'
import { ColorPicker } from './ColorPicker'
import { ToolControls } from './ToolControls'

/**
 * Main Toolbar coordinator that delegates to specialized modules:
 * - ColorPicker: Handles all color-related UI and logic
 * - ToolControls: Handles tool buttons, brush size, and undo/redo
 */
export class Toolbar {
    engine: DrawingEngine
    colorPicker: ColorPicker
    toolControls: ToolControls

    constructor(engine: DrawingEngine) {
        this.engine = engine

        // Initialize sub-modules
        this.colorPicker = new ColorPicker()
        this.toolControls = new ToolControls(engine)

        // Connect the modules - ToolControls notifies ColorPicker of brush size changes
        this.toolControls.onBrushSizeChange = (size: number) => {
            this.colorPicker.onBrushSizeChange(size)
        }
    }

    destroy(): void {
        this.colorPicker.destroy()
        this.toolControls.destroy()
    }
}

