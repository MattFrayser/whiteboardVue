import type { Tool } from './Tool'
import type { DrawingEngine } from '../../../core/engine/DrawingEngine'

export interface ToolMetadata {
    name: string
    cursor: string
    keyboardShortcuts?: string[]
}

export type ToolConstructor = new (engine: DrawingEngine) => Tool

/**
 * centralized system for registering and managing tools.
 */
export class ToolRegistry {
    private static tools: Map<string, ToolConstructor> = new Map()
    private static metadata: Map<string, ToolMetadata> = new Map()

    static register(
        name: string,
        ToolClass: ToolConstructor,
        metadata: ToolMetadata
    ): void {
        this.tools.set(name, ToolClass)
        this.metadata.set(name, metadata)
    }

    static createAll(engine: DrawingEngine): Record<string, Tool> {
        const instances: Record<string, Tool> = {}

        this.tools.forEach((ToolClass, name) => {
            instances[name] = new ToolClass(engine)
        })

        return instances
    }

    
    // Get a specific tool constructor
    static get(name: string): ToolConstructor | undefined {
        return this.tools.get(name)
    }

    static getMetadata(name: string): ToolMetadata | undefined {
        return this.metadata.get(name)
    }

    
    // Get all registered tool names
    static getToolNames(): string[] {
        return Array.from(this.tools.keys())
    }

    
    // Check if a tool is registered
    static has(name: string): boolean {
        return this.tools.has(name)
    }

    
    // Get count of registered tools
    static count(): number {
        return this.tools.size
    }

    
    //Clear all registered tools (useful for testing)
    static clear(): void {
        this.tools.clear()
        this.metadata.clear()
    }

    
    // Get all metadata
    static getAllMetadata(): Map<string, ToolMetadata> {
        return new Map(this.metadata)
    }
}
