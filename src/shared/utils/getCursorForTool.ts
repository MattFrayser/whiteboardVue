import { CURSORS } from '../constants'
import type { Tool } from '../stores/AppState'

export function getCursorForTool(tool: Tool): string {
    switch (tool) {
        case 'rectangle':
        case 'circle':
        case 'line':
            return 'crosshair'
        case 'draw':
            return CURSORS.DRAW
        case 'eraser':
            return CURSORS.ERASER
        case 'select':
            return CURSORS.SELECT
        case 'text':
            return 'text'
        default:
            return 'default'
    }
}
