import type { Tool } from './Tool'
import type { DrawingEngine } from '../engine/DrawingEngine'

/**
 * Tool metadata returned by each tool class
 */
export interface ToolMetadata {
    name: string
    cursor: string
    keyboardShortcuts?: string[]
}

/**
 * Tool constructor signature
 */
export type ToolConstructor = new (engine: DrawingEngine) => Tool

/**
 * Tool Registry - Plugin-style tool management
 *
 * Provides a centralized system for registering and managing tools.
 * New tools can be added without modifying the core engine code.
 *
 * Benefits:
 * - Open/Closed Principle: Add new tools without modifying existing code
 * - Single source of truth for available tools
 * - Type-safe tool access
 * - Automatic metadata extraction
 *
 * Usage:
 * ```typescript
 * // Register a tool
 * ToolRegistry.register('draw', DrawTool)
 *
 * // Get all registered tools
 * const tools = ToolRegistry.createAll(engine)
 *
 * // Get tool names for type definitions
 * const names = ToolRegistry.getToolNames() // ['draw', 'select', ...]
 * ```
 */
export class ToolRegistry {
    private static tools: Map<string, ToolConstructor> = new Map()
    private static metadata: Map<string, ToolMetadata> = new Map()

    /**
     * Register a tool with the registry
     * @param name Tool name (e.g., 'draw', 'select')
     * @param ToolClass Tool constructor
     * @param metadata Tool metadata (cursor, shortcuts, etc.)
     */
    static register(
        name: string,
        ToolClass: ToolConstructor,
        metadata: ToolMetadata
    ): void {
        this.tools.set(name, ToolClass)
        this.metadata.set(name, metadata)
    }

    /**
     * Create instances of all registered tools
     * @param engine The drawing engine instance
     * @returns Record of tool instances by name
     */
    static createAll(engine: DrawingEngine): Record<string, Tool> {
        const instances: Record<string, Tool> = {}

        this.tools.forEach((ToolClass, name) => {
            instances[name] = new ToolClass(engine)
        })

        return instances
    }

    /**
     * Get a specific tool constructor
     * @param name Tool name
     * @returns Tool constructor or undefined
     */
    static get(name: string): ToolConstructor | undefined {
        return this.tools.get(name)
    }

    /**
     * Get metadata for a specific tool
     * @param name Tool name
     * @returns Tool metadata or undefined
     */
    static getMetadata(name: string): ToolMetadata | undefined {
        return this.metadata.get(name)
    }

    /**
     * Get all registered tool names
     * @returns Array of tool names
     */
    static getToolNames(): string[] {
        return Array.from(this.tools.keys())
    }

    /**
     * Check if a tool is registered
     * @param name Tool name
     * @returns True if tool is registered
     */
    static has(name: string): boolean {
        return this.tools.has(name)
    }

    /**
     * Get count of registered tools
     * @returns Number of registered tools
     */
    static count(): number {
        return this.tools.size
    }

    /**
     * Clear all registered tools (useful for testing)
     */
    static clear(): void {
        this.tools.clear()
        this.metadata.clear()
    }

    /**
     * Get all metadata
     * @returns Map of all tool metadata
     */
    static getAllMetadata(): Map<string, ToolMetadata> {
        return new Map(this.metadata)
    }
}
