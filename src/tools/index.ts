/**
 * Tool Registration
 *
 * This file registers all available tools with the ToolRegistry.
 * To add a new tool:
 * 1. Create your tool class extending Tool
 * 2. Import it here
 * 3. Call ToolRegistry.register() with metadata
 *
 * That's it! No need to modify DrawingEngine or other core files.
 */

import { ToolRegistry } from './ToolRegistry'
import { DrawTool } from './DrawTool'
import { SelectTool } from './SelectTool'
import { EraserTool } from './EraserTool'
import { CircleTool } from './CircleTool'
import { RectangleTool } from './RectangleTool'
import { LineTool } from './LineTool'
import { TextTool } from './TextTool'

// Register all tools
ToolRegistry.register('draw', DrawTool, {
    name: 'draw',
    cursor: 'crosshair',
    keyboardShortcuts: ['d', 'p'], // d for draw, p for pen
})

ToolRegistry.register('select', SelectTool, {
    name: 'select',
    cursor: 'default',
    keyboardShortcuts: ['s', 'v'], // s for select, v for select (common in design tools)
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
