import { ToolRegistry } from './base/ToolRegistry'
import { DrawTool } from './drawing/DrawTool'
import { SelectTool } from './select/SelectTool'
import { EraserTool } from './drawing/EraserTool'
import { CircleTool } from './shapes/CircleTool'
import { RectangleTool } from './shapes/RectangleTool'
import { LineTool } from './shapes/LineTool'
import { TextTool } from './text/TextTool'

// Register all tools
ToolRegistry.register('draw', DrawTool, {
    name: 'draw',
    cursor: 'crosshair',
    keyboardShortcuts: ['d', 'p'], // d for draw, p for pen
})

ToolRegistry.register('select', SelectTool, {
    name: 'select',
    cursor: 'default',
    keyboardShortcuts: ['s', 'v'], // s for select, v for select
})

ToolRegistry.register('eraser', EraserTool, {
    name: 'eraser',
    cursor: 'crosshair',
    keyboardShortcuts: ['e'],
})

ToolRegistry.register('rectangle', RectangleTool, {
    name: 'rectangle',
    cursor: 'crosshair',
    keyboardShortcuts: ['r'],
})

ToolRegistry.register('circle', CircleTool, {
    name: 'circle',
    cursor: 'crosshair',
    keyboardShortcuts: ['c', 'o'], // c for circle, o for oval
})

ToolRegistry.register('line', LineTool, {
    name: 'line',
    cursor: 'crosshair',
    keyboardShortcuts: ['l'],
})

ToolRegistry.register('text', TextTool, {
    name: 'text',
    cursor: 'text',
    keyboardShortcuts: ['t'],
})

// Export ToolRegistry for use in other modules
export { ToolRegistry }

// Export tool classes for testing
export { DrawTool, SelectTool, EraserTool, CircleTool, RectangleTool, LineTool, TextTool }
