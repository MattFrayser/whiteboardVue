import { Quadtree } from '../utils/Quadtree'
import { Circle } from '../objects/Circle'
import { Line } from '../objects/Line'
import { Rectangle } from '../objects/Rectangle'
import { Stroke } from '../objects/Stroke'
import { Text } from '../objects/Text'

/**
 * Manages object storage, spatial indexing, and CRUD operations
 */
export class ObjectStore {
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

    addLocal(object) {
        this.objects.push(object)

        // Add to quadtree
        const bounds = object.getBounds()
        this.quadtree.insert(object, bounds)

        return object
    }

    addRemote(objectData) {
        const obj = this.createObjectFromData(objectData)
        if (obj) {
            this.objects.push(obj)
            const bounds = obj.getBounds()
            this.quadtree.insert(obj, bounds)
            return obj
        }
        return null
    }

    removeLocal(object) {
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

    removeRemote(objectId) {
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

    removeById(id) {
        const obj = this.getObjectById(id)
        if (obj) {
            return this.remove(obj)
        }
        return null
    }

    getObjectById(id) {
        return this.objects.find(obj => obj.id === id)
    }

    // by point for hit testing
    getObjectAt(point) {
        const candidates = this.quadtree.queryPoint(point)

        // Search from top to bottom (reverse order for z-index)
        for (let i = candidates.length - 1; i >= 0; i--) {
            if (candidates[i].containsPoint(point)) {
                return candidates[i]
            }
        }
        return null
    }
    
    updateRemoteObject(objectId, objectData) {
        const obj = this.getObjectById(objectId)
        if (obj) {
            const oldBounds = obj.getBounds()
            this.quadtree.remove(obj, oldBounds)

            obj.data = objectData

            const newBounds = obj.getBounds()
            this.quadtree.insert(obj, newBounds)
            return obj
        }
        return null
    }

    loadRemoteObjects(objectDataArray) {
        this.objects = []
        this.quadtree = new Quadtree(
            { x: -10000, y: -10000, width: 20000, height: 20000 },
            10,
            8
        )
        objectDataArray.forEach(objData => {
            const obj = this.createObjectFromData(objData)
            if (obj) {
                this.objects.push(obj)
                const bounds = obj.getBounds()
                this.quadtree.insert(obj, bounds)
            }
        })
    }

    /**
     * (for undo/redo)
     * Replaces only the specified user's objects
     */
    loadUserState(userId, stateData) {
        // Capture old objects BEFORE filtering (for incremental quadtree update)
        const oldObjects = this.objects.filter(obj => obj.userId === userId)

        // Remove only THIS user's objects
        this.objects = this.objects.filter(obj => obj.userId !== userId)

        // Restore THIS user's objects from history
        const myRestoredObjects = stateData.map(data => this.createObjectFromData(data))
        this.objects.push(...myRestoredObjects)

        // Update quadtree - only update changed objects, much faster than entire rebuild
        oldObjects.forEach(obj => {
            this.quadtree.remove(obj, obj.getBounds())
        })
        myRestoredObjects.forEach(obj => {
            this.quadtree.insert(obj, obj.getBounds())
        })
    }

    createObjectFromData(data) {
        let obj = null
        const zIndex = data.zIndex

        switch (data.type) {
            case 'stroke':
                obj = new Stroke(data.id, data.data, zIndex)
                break
            case 'rectangle':
                obj = new Rectangle(data.id, data.data, zIndex)
                break
            case 'circle':
                obj = new Circle(data.id, data.data, zIndex)
                break
            case 'line':
                obj = new Line(data.id, data.data, zIndex)
                break
            case 'text':
                obj = new Text(data.id, data.data, zIndex)
                break
        }

        // Preserve userId from remote data
        if (obj) {
            obj.userId = data.userId
        }

        return obj
    }

    /**
    * Quadtree Operations
    */
    queryQuadtree(rect) {
        return this.quadtree.query(rect)
    }

    removeFromQuadtree(object, bounds) {
        this.quadtree.remove(object, bounds)
    }

    insertIntoQuadtree(object, bounds) {
        this.quadtree.insert(object, bounds)
    }

    getAllObjects() {
        return this.objects
    }

    updateObjectInQuadtree(object, oldBounds, newBounds = null) {
        if (!newBounds) {
            newBounds = object.getBounds()
        }

        this.quadtree.remove(object, oldBounds)
        this.quadtree.insert(object, newBounds)

        // Check if new bounds exceed quadtree bounds
        const qtBounds = this.quadtree.bounds
        if (
            newBounds.x < qtBounds.x ||
            newBounds.y < qtBounds.y ||
            newBounds.x + newBounds.width > qtBounds.x + qtBounds.width ||
            newBounds.y + newBounds.height > qtBounds.y + qtBounds.height
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

            // Add 20% padding and ensure minimum size
            const width = Math.max(20000, (maxX - minX) * 1.2)
            const height = Math.max(20000, (maxY - minY) * 1.2)
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
    render(ctx, viewport = null, selectedObjects = []) {
        // If viewport is provided, use quadtree for culling
        if (viewport) {
            const visibleObjects = this.quadtree.query(viewport)

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
