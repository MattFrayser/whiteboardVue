import { Quadtree } from '../utils/Quadtree'
import { Circle } from '../objects/Circle'
import { Line } from '../objects/Line'
import { Rectangle } from '../objects/Rectangle'
import { Stroke } from '../objects/Stroke'
import { Text } from '../objects/Text'
import { DrawingObject } from '../objects/DrawingObject'
import type { DrawingObjectData, Point, Bounds } from '../types/common'
import { QUADTREE_MIN_SIZE, QUADTREE_PADDING_MULTIPLIER } from '../constants'

// Type definitions for object data formats
export type NestedObjectData = { id: string; type: string; data: DrawingObjectData; zIndex: number }
export type FlatObjectData = DrawingObjectData

/**
 * Type guard to distinguish between nested (backend) and flat (legacy) object formats
 */
function isNestedFormat(data: NestedObjectData | FlatObjectData): data is NestedObjectData {
    return (
        typeof data === 'object' &&
        data !== null &&
        'data' in data &&
        typeof (data as Record<string, unknown>).data === 'object' &&
        'zIndex' in data &&
        typeof (data as Record<string, unknown>).zIndex === 'number'
    )
}

/**
 * Manages object storage, spatial indexing, and CRUD operations
 */
export class ObjectStore {
    objects: DrawingObject[]
    quadtree: Quadtree

    constructor() {
        this.objects = []

        // Initialize quadtree with large bounds (will expand as needed)
        this.quadtree = new Quadtree(
            { x: -10000, y: -10000, width: 20000, height: 20000 },
            10, // max objects per node
            8 // max levels
        )
    }

    // Storage Operations

    addLocal(object: DrawingObject): DrawingObject {
        this.objects.push(object)

        // Add to quadtree
        const bounds = object.getBounds()
        this.quadtree.insert(object, bounds)

        return object
    }

    addRemote(objectData: NestedObjectData | FlatObjectData): DrawingObject | null {
        const obj = this.createObjectFromData(objectData)
        if (obj) {
            this.objects.push(obj)
            const bounds = obj.getBounds()
            this.quadtree.insert(obj, bounds)
            return obj
        }
        return null
    }

    removeLocal(object: DrawingObject): DrawingObject | null {
        const index = this.objects.indexOf(object)
        if (index > -1) {
            // Remove from quadtree
            const bounds = object.getBounds()
            this.quadtree.remove(object, bounds)

            this.objects.splice(index, 1)

            return object
        }
        return null
    }

    removeRemote(objectId: string): DrawingObject | null {
        const obj = this.getObjectById(objectId)
        if (obj) {
            const bounds = obj.getBounds()
            this.quadtree.remove(obj, bounds)

            const index = this.objects.indexOf(obj)
            if (index > -1) {
                this.objects.splice(index, 1)
                return obj
            }
        }
        return null
    }

    removeById(id: string): DrawingObject | null {
        const obj = this.getObjectById(id)
        if (obj) {
            return this.removeLocal(obj)
        }
        return null
    }

    getObjectById(id: string): DrawingObject | undefined {
        return this.objects.find(obj => obj.id === id)
    }

    // by point for hit testing
    getObjectAt(point: Point): DrawingObject | null {
        const candidates = this.quadtree.queryPoint(point) as DrawingObject[]

        // Search from top to bottom (reverse order for z-index)
        for (let i = candidates.length - 1; i >= 0; i--) {
            const candidate = candidates[i]
            if (candidate && candidate.containsPoint(point)) {
                return candidate
            }
        }
        return null
    }

    updateRemoteObject(objectId: string, objectData: NestedObjectData | FlatObjectData): DrawingObject | null {
        const obj = this.getObjectById(objectId)
        if (obj) {
            const oldBounds = obj.getBounds()
            this.quadtree.remove(obj, oldBounds)

            // Handle nested structure from backend (new format)
            if (isNestedFormat(objectData)) {
                obj.data = {
                    ...objectData.data,
                    id: objectData.id,
                    type: objectData.type,
                } as DrawingObjectData
                obj.zIndex = objectData.zIndex
            } else {
                obj.data = objectData
            }

            const newBounds = obj.getBounds()
            this.quadtree.insert(obj, newBounds)
            return obj
        }
        return null
    }

    loadRemoteObjects(objectDataArray: DrawingObjectData[]): void {
        // Merge remote objects instead of replacing to preserve local objects
        // This prevents race condition where local objects are destroyed during sync
        objectDataArray.forEach((objData: DrawingObjectData) => {
            // Skip if object already exists (avoid duplicates)
            if (!this.getObjectById(objData.id)) {
                const obj = this.createObjectFromData(objData)
                if (obj) {
                    this.objects.push(obj)
                    const bounds = obj.getBounds()
                    this.quadtree.insert(obj, bounds)
                }
            }
        })
    }

    /**
     * (for undo/redo)
     * Replaces only the specified user's objects
     */
    loadUserState(userId: string, stateData: DrawingObjectData[]): void {
        // Capture old objects BEFORE filtering (for incremental quadtree update)
        const oldObjects = this.objects.filter(obj => obj.userId === userId)

        // Remove only THIS user's objects
        this.objects = this.objects.filter(obj => obj.userId !== userId)

        // Restore THIS user's objects from history
        const myRestoredObjects = stateData.map((data: DrawingObjectData) => this.createObjectFromData(data)).filter((obj): obj is DrawingObject => obj !== null)
        this.objects.push(...myRestoredObjects)

        // Update quadtree - only update changed objects, much faster than entire rebuild
        oldObjects.forEach((obj: DrawingObject) => {
            this.quadtree.remove(obj, obj.getBounds())
        })
        myRestoredObjects.forEach(obj => {
            this.quadtree.insert(obj, obj.getBounds())
        })
    }

    createObjectFromData(data: NestedObjectData | FlatObjectData): DrawingObject | null {
        let obj: DrawingObject | null = null

        // Handle nested structure from backend (new format)
        // or flat structure from local storage (legacy format)
        let objectId: string
        let objectType: string
        let objectData: DrawingObjectData
        let zIndex: number

        if (isNestedFormat(data)) {
            // New nested format from backend
            objectId = data.id
            objectType = data.type
            objectData = {
                ...data.data,
                id: data.id,
                type: data.type,
            } as DrawingObjectData
            zIndex = data.zIndex
        } else {
            // Legacy flat format
            objectId = data.id
            objectType = data.type
            objectData = data
            const zIndexValue = data.zIndex
            zIndex = typeof zIndexValue === 'number' ? zIndexValue : 0
        }

        switch (objectType) {
            case 'stroke':
                obj = new Stroke(objectId, objectData, zIndex)
                break
            case 'rectangle':
                obj = new Rectangle(objectId, objectData, zIndex)
                break
            case 'circle':
                obj = new Circle(objectId, objectData, zIndex)
                break
            case 'line':
                obj = new Line(objectId, objectData, zIndex)
                break
            case 'text':
                obj = new Text(objectId, objectData, zIndex)
                break
        }

        // Preserve userId from remote data
        if (obj && objectData.userId) {
            obj.userId = objectData.userId
        }

        return obj
    }

    /**
    * Quadtree Operations
    */
    queryQuadtree(rect: Bounds): DrawingObject[] {
        return this.quadtree.query(rect) as DrawingObject[]
    }

    removeFromQuadtree(object: DrawingObject, bounds: Bounds): void {
        this.quadtree.remove(object, bounds)
    }

    insertIntoQuadtree(object: DrawingObject, bounds: Bounds): void {
        this.quadtree.insert(object, bounds)
    }

    getAllObjects(): DrawingObject[] {
        return this.objects
    }

    updateObjectInQuadtree(object: DrawingObject, oldBounds: Bounds, newBounds: Bounds | null = null): void {
        const bounds = newBounds || object.getBounds()

        this.quadtree.remove(object, oldBounds)
        this.quadtree.insert(object, bounds)

        // Check if new bounds exceed quadtree bounds
        const qtBounds = this.quadtree.bounds
        if (
            bounds.x < qtBounds.x ||
            bounds.y < qtBounds.y ||
            bounds.x + bounds.width > qtBounds.x + qtBounds.width ||
            bounds.y + bounds.height > qtBounds.y + qtBounds.height
        ) {
            this.rebuildQuadtree(true)
        }
    }

    /**
     * Rebuild the entire quadtree, optionally expanding bounds
     */
    rebuildQuadtree(expandBounds = false) {
        let bounds = this.quadtree.bounds

        if (expandBounds) {
            // Calculate bounds that encompass all objects
            let minX = Infinity, minY = Infinity
            let maxX = -Infinity, maxY = -Infinity

            this.objects.forEach(obj => {
                const objBounds = obj.getBounds()
                minX = Math.min(minX, objBounds.x)
                minY = Math.min(minY, objBounds.y)
                maxX = Math.max(maxX, objBounds.x + objBounds.width)
                maxY = Math.max(maxY, objBounds.y + objBounds.height)
            })

            // Add padding and ensure minimum size
            const width = Math.max(QUADTREE_MIN_SIZE, (maxX - minX) * QUADTREE_PADDING_MULTIPLIER)
            const height = Math.max(QUADTREE_MIN_SIZE, (maxY - minY) * QUADTREE_PADDING_MULTIPLIER)
            const centerX = (minX + maxX) / 2
            const centerY = (minY + maxY) / 2

            bounds = {
                x: centerX - width / 2,
                y: centerY - height / 2,
                width,
                height
            }
        }

        // Recreate quadtree with new/same bounds
        this.quadtree = new Quadtree(bounds, 10, 8)

        // Reinsert all objects
        this.objects.forEach(obj => {
            const objBounds = obj.getBounds()
            this.quadtree.insert(obj, objBounds)
        })
    }

    /**
     * Render all objects with optional viewport culling
     */
    render(ctx: CanvasRenderingContext2D, viewport: Bounds | null = null, selectedObjects: DrawingObject[] = []): void {
        // If viewport is provided, use quadtree for culling
        if (viewport) {
            const visibleObjects = this.quadtree.query(viewport) as DrawingObject[]

            // Render quadtree-visible objects
            visibleObjects.forEach(obj => obj.render(ctx))

            // Always render selected objects even if outside quadtree bounds
            // This ensures objects being dragged remain visible
            selectedObjects.forEach(obj => {
                if (!visibleObjects.includes(obj)) {
                    obj.render(ctx)
                }
            })
        } else {
            // Full render (fallback)
            this.objects.forEach(obj => obj.render(ctx))
        }
    }
}
