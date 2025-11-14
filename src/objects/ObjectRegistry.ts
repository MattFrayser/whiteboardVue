import type { DrawingObject } from './DrawingObject'
import type { DrawingObjectData } from '../types'

/**
 * Object constructor signature
 */
export type ObjectConstructor = new (
    id: string | null,
    data: DrawingObjectData,
    zIndex: number
) => DrawingObject

/**
 * Object Registry - Plugin-style drawing object management
 *
 * Provides a centralized system for registering and creating drawing objects.
 * New object types can be added without modifying the ObjectStore code.
 *
 * Benefits:
 * - Open/Closed Principle: Add new object types without modifying existing code
 * - Single source of truth for available object types
 * - Type-safe object creation
 * - Eliminates switch statement anti-pattern
 *
 * Usage:
 * ```typescript
 * // Register an object type
 * ObjectRegistry.register('circle', Circle)
 *
 * // Create an object
 * const obj = ObjectRegistry.create('circle', 'obj-123', data, 0)
 *
 * // Get all registered types
 * const types = ObjectRegistry.getObjectTypes() // ['stroke', 'circle', ...]
 * ```
 */
export class ObjectRegistry {
    private static objects: Map<string, ObjectConstructor> = new Map()

    /**
     * Register an object type with the registry
     * @param type Object type (e.g., 'stroke', 'circle', 'rectangle')
     * @param ObjectClass Object constructor
     */
    static register(type: string, ObjectClass: ObjectConstructor): void {
        this.objects.set(type, ObjectClass)
    }

    /**
     * Create an object instance by type
     * @param type Object type
     * @param id Object ID (or null to generate)
     * @param data Object data
     * @param zIndex Z-index for rendering order
     * @returns DrawingObject instance or null if type not found
     */
    static create(
        type: string,
        id: string | null,
        data: DrawingObjectData,
        zIndex: number
    ): DrawingObject | null {
        const ObjectClass = this.objects.get(type)
        if (!ObjectClass) {
            console.warn(`[ObjectRegistry] Unknown object type: ${type}`)
            return null
        }
        return new ObjectClass(id, data, zIndex)
    }

    /**
     * Get a specific object constructor
     * @param type Object type
     * @returns Object constructor or undefined
     */
    static get(type: string): ObjectConstructor | undefined {
        return this.objects.get(type)
    }

    /**
     * Get all registered object types
     * @returns Array of object type names
     */
    static getObjectTypes(): string[] {
        return Array.from(this.objects.keys())
    }

    /**
     * Check if an object type is registered
     * @param type Object type
     * @returns True if type is registered
     */
    static has(type: string): boolean {
        return this.objects.has(type)
    }

    /**
     * Get count of registered object types
     * @returns Number of registered types
     */
    static count(): number {
        return this.objects.size
    }

    /**
     * Clear all registered object types (useful for testing)
     */
    static clear(): void {
        this.objects.clear()
    }
}
