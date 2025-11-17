import type { DrawingObject } from '../DrawingObject'
import type { DrawingObjectData } from '../../../shared/types'
import { createLogger } from '../../shared/utils/logger'
const log = createLogger('ObjectRegistry')
/**
 * Object constructor signature
 */
export type ObjectConstructor = new (
    id: string | null,
    data: DrawingObjectData,
    zIndex: number
) => DrawingObject

/**
 * Provides a centralized system for registering and creating drawing objects.
*/
export class ObjectRegistry {
    private static objects: Map<string, ObjectConstructor> = new Map()

    static register(type: string, ObjectClass: ObjectConstructor): void {
        this.objects.set(type, ObjectClass)
    }

    static create(
        type: string,
        id: string | null,
        data: DrawingObjectData,
        zIndex: number
    ): DrawingObject | null {
        const ObjectClass = this.objects.get(type)
        if (!ObjectClass) {
            log.warn('Unknown object type', { type })
            return null
        }
        return new ObjectClass(id, data, zIndex)
    }

    static get(type: string): ObjectConstructor | undefined {
        return this.objects.get(type)
    }

    /**
     * Get all registered object types
     */
    static getObjectTypes(): string[] {
        return Array.from(this.objects.keys())
    }

    /**
     * Check if an object type is registered
     */
    static has(type: string): boolean {
        return this.objects.has(type)
    }

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
