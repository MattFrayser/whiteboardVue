import { Quadtree } from '../../core/spatial/Quadtree'
import { Circle } from '../../drawing/objects/types/Circle'
import { Line } from '../../drawing/objects/types/Line'
import { Rectangle } from '../../drawing/objects/types/Rectangle'
import { Stroke } from '../../drawing/objects/types/Stroke'
import { Text } from '../../drawing/objects/types/Text'
import { DrawingObject } from '../../drawing/objects/DrawingObject'
import type { DrawingObjectData, Point, Bounds } from '../../shared/types/common'
import { QUADTREE_MIN_SIZE } from '../../shared/constants'
import { isValidObject } from '../../shared/validation'
import { SELECTION_COLOR, SELECTION_HANDLE_BG } from '../../shared/constants'

import { createLogger } from '../../shared/utils/logger'
const log = createLogger('ObjectStore')

// Type definitions for object data formats
export type NestedObjectData = { id: string; type: string; data: DrawingObjectData; zIndex: number }
export type FlatObjectData = DrawingObjectData

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

// Manages object storage, spatial indexing, and CRUD operations
export class ObjectStore {
    objects: DrawingObject[]
    quadtree: Quadtree

    constructor() {
        this.objects = []

        // Initialize quadtree with large bounds (will expand as needed)
        this.quadtree = new Quadtree(
            { x: -10000, y: -10000, width: 50000, height: 50000 },
            10, // max objects per node
            8 // max levels
        )
    }

    private rebuildScheduled: boolean = false
    private rebuildTimeout: ReturnType<typeof setTimeout> | null = null
    // Storage Operations

    addLocal(object: DrawingObject): DrawingObject {
        this.objects.push(object)

        // Add to quadtree
        const bounds = object.getBounds()
        this.quadtree.insert(object, bounds)

        return object
    }

    addRemote(objectData: NestedObjectData | FlatObjectData): DrawingObject | null {
        if (!isValidObject(objectData)) {
            log.error('Invalid object data received:', objectData)
            return null
        }

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

    updateRemoteObject(
        objectId: string,
        objectData: NestedObjectData | FlatObjectData
    ): DrawingObject | null {
        if (!isValidObject(objectData)) {
            log.error('Invalid object data for update:', objectData)
            return null
        }

        const obj = this.getObjectById(objectId)
        if (obj) {
            const oldBounds = obj.getBounds()

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

            this.updateObjectInQuadtree(obj, oldBounds)
            return obj
        }
        return null
    }

    loadRemoteObjects(objectDataArray: DrawingObjectData[]): void {
        // Merge remote objects instead of replacing to preserve local objects
        // This prevents race condition where local objects are destroyed during sync
        objectDataArray.forEach((objData: DrawingObjectData) => {
            if (!isValidObject(objData)) {
                log.error('Skipping invalid object:', objData)
                return // Skip invalid objects
            }

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
        const myRestoredObjects = stateData
            .map((data: DrawingObjectData) => this.createObjectFromData(data))
            .filter((obj): obj is DrawingObject => obj !== null)
        this.objects.push(...myRestoredObjects)

        // Update quadtree - only update changed objects, much faster than entire rebuild
        oldObjects.forEach((obj: DrawingObject) => {
            this._removeFromQuadtree(obj, obj.getBounds())
        })
        myRestoredObjects.forEach(obj => {
            this._insertIntoQuadtree(obj)
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
                obj = new Stroke(objectId, objectData as any, zIndex)
                break
            case 'rectangle':
                obj = new Rectangle(objectId, objectData as any, zIndex)
                break
            case 'circle':
                obj = new Circle(objectId, objectData as any, zIndex)
                break
            case 'line':
                obj = new Line(objectId, objectData as any, zIndex)
                break
            case 'text':
                obj = new Text(objectId, objectData as any, zIndex)
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

    getAllObjects(): DrawingObject[] {
        return this.objects
    }

    /**
     * Update an object's position in the quadtree after modification
     *
     * Call after moving, resizing, or otherwise changing an object's bounds.
     * The quadtree needs the old bounds to find where the object is currently indexed,
     * then re-inserts it at the new position.
     *
     * Automatically expands the quadtree if the object moves outside
     * the current bounds.
     */
    updateObjectInQuadtree(
        object: DrawingObject,
        oldBounds: Bounds,
        newBounds: Bounds | null = null
    ): void {
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
            this.scheduleQuadtreeRebuild()
        }
    }

    // debounced to prevent excessive rebuilds)
    private scheduleQuadtreeRebuild(): void {
        if (this.rebuildScheduled) {
            return
        }

        this.rebuildScheduled = true

        if (this.rebuildTimeout) {
            clearTimeout(this.rebuildTimeout)
        }

        this.rebuildTimeout = setTimeout(() => {
            this.rebuildQuadtree(true)
            this.rebuildScheduled = false
            this.rebuildTimeout = null
        }, 0)
    }

    /**
     * Rebuild the entire quadtree, optionally expanding bounds
     */
    rebuildQuadtree(expandBounds = false) {
        let bounds = this.quadtree.bounds

        if (expandBounds) {
            let minX = Infinity,
                minY = Infinity
            let maxX = -Infinity,
                maxY = -Infinity

            this.objects.forEach(obj => {
                const objBounds = obj.getBounds()
                minX = Math.min(minX, objBounds.x)
                minY = Math.min(minY, objBounds.y)
                maxX = Math.max(maxX, objBounds.x + objBounds.width)
                maxY = Math.max(maxY, objBounds.y + objBounds.height)
            })

            // Increased padding: 2.0x instead of 1.2x
            const EXPANSION_PADDING = 2.0
            const width = Math.max(QUADTREE_MIN_SIZE, (maxX - minX) * EXPANSION_PADDING)
            const height = Math.max(QUADTREE_MIN_SIZE, (maxY - minY) * EXPANSION_PADDING)
            const centerX = (minX + maxX) / 2
            const centerY = (minY + maxY) / 2

            bounds = {
                x: centerX - width / 2,
                y: centerY - height / 2,
                width,
                height,
            }
        }

        this.quadtree = new Quadtree(bounds, 10, 8)

        this.objects.forEach(obj => {
            const objBounds = obj.getBounds()
            this.quadtree.insert(obj, objBounds)
        })
    }
    /**
     * Render all objects with optional viewport culling
     */
    render(
        ctx: CanvasRenderingContext2D,
        viewport: Bounds | null = null,
        selectedObjects: DrawingObject[] = []
    ): void {
        // multi-selection temporarily disables individual selection rendering
        // this prevents seeing every obj bounding boxes
        const isMultiSelection = selectedObjects.length > 1
        const savedSelectedFlags = new Map<string, boolean>()
        
        if (isMultiSelection) {
            // Save and clear selected flags
            selectedObjects.forEach(obj => {
                savedSelectedFlags.set(obj.id, obj.selected)
                obj.selected = false
            })
        }
        
        // use quadtree for culling
        if (viewport) {
            const visibleObjects = this.quadtree.query(viewport) as DrawingObject[]

            // Render quadtree-visible objects with per-object error isolation
            visibleObjects.forEach(obj => {
                try {
                    obj.render(ctx)
                } catch (error) {
                    log.error('Failed to render object', { objectId: obj.id, error })
                }
            })

            // rendering objects outside quadtree bounds
            // ensures objects being dragged remain visible
            selectedObjects.forEach(obj => {
                if (!visibleObjects.includes(obj)) {
                    try {
                        obj.render(ctx)
                    } catch (error) {
                        log.error('Failed to render selected object', { objectId: obj.id, error })
                    }
                }
            })
        } else {
            // Full render (fallback) 
            this.objects.forEach(obj => {
                try {
                    obj.render(ctx)
                } catch (error) {
                    log.error('Failed to render object', { objectId: obj.id, error })
                }
            })
        }
        
        // Restore selected flags
        if (isMultiSelection) {
            selectedObjects.forEach(obj => {
                obj.selected = savedSelectedFlags.get(obj.id) || false
            })
            
            // Render single group selection box for multiple objects
            this.renderGroupSelection(ctx, selectedObjects)
        }
    }

    private renderGroupSelection(ctx: CanvasRenderingContext2D, objects: DrawingObject[]): void {
        // Calculate group bounds
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        
        objects.forEach(obj => {
            const bounds = obj.getBounds()
            minX = Math.min(minX, bounds.x)
            minY = Math.min(minY, bounds.y)
            maxX = Math.max(maxX, bounds.x + bounds.width)
            maxY = Math.max(maxY, bounds.y + bounds.height)
        })
        
        const groupBounds = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        }
        
        // dashed border
        ctx.strokeStyle = SELECTION_COLOR
        ctx.lineWidth = 2 / ctx.getTransform().a
        ctx.setLineDash([5, 5])
        ctx.strokeRect(groupBounds.x, groupBounds.y, groupBounds.width, groupBounds.height)
        ctx.setLineDash([])
        
        // Draw 8 resize handles
        const handleSize = 12 / ctx.getTransform().a
        const handles = [
            { x: groupBounds.x, y: groupBounds.y },                                    // NW
            { x: groupBounds.x + groupBounds.width / 2, y: groupBounds.y },           // N
            { x: groupBounds.x + groupBounds.width, y: groupBounds.y },               // NE
            { x: groupBounds.x + groupBounds.width, y: groupBounds.y + groupBounds.height / 2 }, // E
            { x: groupBounds.x + groupBounds.width, y: groupBounds.y + groupBounds.height },     // SE
            { x: groupBounds.x + groupBounds.width / 2, y: groupBounds.y + groupBounds.height }, // S
            { x: groupBounds.x, y: groupBounds.y + groupBounds.height },              // SW
            { x: groupBounds.x, y: groupBounds.y + groupBounds.height / 2 },          // W
        ]
        
        ctx.fillStyle = SELECTION_HANDLE_BG
        ctx.strokeStyle = SELECTION_COLOR
        handles.forEach(handle => {
            ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            )
            ctx.strokeRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            )
        })
    }

    // Remove object from quadtree at its old location
    private _removeFromQuadtree(object: DrawingObject, bounds: Bounds): void {
        this.quadtree.remove(object, bounds)
    }

    // Insert object into quadtree at its current location
    private _insertIntoQuadtree(object: DrawingObject, bounds?: Bounds): void {
        const objectBounds = bounds || object.getBounds()
        this.quadtree.insert(object, objectBounds)
    }
}
