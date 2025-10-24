/**
 * Quadtree spatial indexing data structure for efficient spatial queries
 * Used for viewport culling and fast collision/selection detection
 */

class QuadtreeNode {
    constructor(bounds, level, maxObjects, maxLevels) {
        this.bounds = bounds // { x, y, width, height }
        this.level = level
        this.maxObjects = maxObjects
        this.maxLevels = maxLevels

        this.objects = [] // Array of { object, bounds }
        this.nodes = [] // Child nodes (4 quadrants: NW, NE, SW, SE)
    }

    /**
     * Split this node into 4 quadrants
     */
    split() {
        const subWidth = this.bounds.width / 2
        const subHeight = this.bounds.height / 2
        const x = this.bounds.x
        const y = this.bounds.y
        const nextLevel = this.level + 1

        // Create 4 child nodes: NW, NE, SW, SE
        this.nodes[0] = new QuadtreeNode(
            { x: x, y: y, width: subWidth, height: subHeight },
            nextLevel, this.maxObjects, this.maxLevels
        )
        this.nodes[1] = new QuadtreeNode(
            { x: x + subWidth, y: y, width: subWidth, height: subHeight },
            nextLevel, this.maxObjects, this.maxLevels
        )
        this.nodes[2] = new QuadtreeNode(
            { x: x, y: y + subHeight, width: subWidth, height: subHeight },
            nextLevel, this.maxObjects, this.maxLevels
        )
        this.nodes[3] = new QuadtreeNode(
            { x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight },
            nextLevel, this.maxObjects, this.maxLevels
        )
    }

    /**
     * Get indices of quadrants that the bounds intersects
     * Returns array of indices: 0=NW, 1=NE, 2=SW, 3=SE
     */
    getQuadrants(bounds) {
        const indices = []
        const verticalMidpoint = this.bounds.x + this.bounds.width / 2
        const horizontalMidpoint = this.bounds.y + this.bounds.height / 2

        const startIsNorth = bounds.y < horizontalMidpoint
        const startIsWest = bounds.x < verticalMidpoint
        const endIsEast = bounds.x + bounds.width > verticalMidpoint
        const endIsSouth = bounds.y + bounds.height > horizontalMidpoint

        // Check each quadrant
        if (startIsNorth && startIsWest) indices.push(0) // NW
        if (startIsNorth && endIsEast) indices.push(1)   // NE
        if (endIsSouth && startIsWest) indices.push(2)   // SW
        if (endIsSouth && endIsEast) indices.push(3)     // SE

        return indices
    }

    /**
     * Insert an object with its bounding box
     */
    insert(object, bounds) {
        // If we have child nodes, insert into them
        if (this.nodes.length > 0) {
            const indices = this.getQuadrants(bounds)
            for (const index of indices) {
                this.nodes[index].insert(object, bounds)
            }
            return
        }

        // Add to this node
        this.objects.push({ object, bounds })

        // Check if we need to split
        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            // Split the node
            if (this.nodes.length === 0) {
                this.split()
            }

            // Move objects to child nodes
            const objectsToDistribute = [...this.objects]
            this.objects = []

            for (const item of objectsToDistribute) {
                const indices = this.getQuadrants(item.bounds)

                // If object spans multiple quadrants, keep it at this level
                if (indices.length > 1) {
                    this.objects.push(item)
                } else {
                    // Insert into appropriate child node
                    for (const index of indices) {
                        this.nodes[index].insert(item.object, item.bounds)
                    }
                }
            }
        }
    }

    /**
     * Remove an object with its bounding box
     */
    remove(object, bounds) {
        // Remove from child nodes
        if (this.nodes.length > 0) {
            const indices = this.getQuadrants(bounds)
            for (const index of indices) {
                this.nodes[index].remove(object, bounds)
            }
        }

        // Remove from this node
        this.objects = this.objects.filter(item => item.object !== object)
    }

    /**
     * Query all objects that intersect with the given rectangle
     */
    query(rect, results = []) {
        // Check if this node intersects with query rect
        if (!this.intersects(this.bounds, rect)) {
            return results
        }

        // Check objects at this level
        for (const item of this.objects) {
            if (this.intersects(item.bounds, rect)) {
                // Avoid duplicates
                if (!results.includes(item.object)) {
                    results.push(item.object)
                }
            }
        }

        // Check child nodes
        if (this.nodes.length > 0) {
            for (const node of this.nodes) {
                node.query(rect, results)
            }
        }

        return results
    }

    /**
     * Query all objects that contain a specific point
     */
    queryPoint(point, results = []) {
        // Check if point is in this node's bounds
        if (!this.containsPoint(this.bounds, point)) {
            return results
        }

        // Check objects at this level
        for (const item of this.objects) {
            if (this.containsPoint(item.bounds, point)) {
                // Avoid duplicates
                if (!results.includes(item.object)) {
                    results.push(item.object)
                }
            }
        }

        // Check child nodes
        if (this.nodes.length > 0) {
            for (const node of this.nodes) {
                node.queryPoint(point, results)
            }
        }

        return results
    }

    /**
     * Check if two rectangles intersect
     */
    intersects(rect1, rect2) {
        return !(
            rect1.x + rect1.width < rect2.x ||
            rect1.x > rect2.x + rect2.width ||
            rect1.y + rect1.height < rect2.y ||
            rect1.y > rect2.y + rect2.height
        )
    }

    /**
     * Check if a rectangle contains a point
     */
    containsPoint(rect, point) {
        return (
            point.x >= rect.x &&
            point.x <= rect.x + rect.width &&
            point.y >= rect.y &&
            point.y <= rect.y + rect.height
        )
    }

    /**
     * Clear all objects from this node and children
     */
    clear() {
        this.objects = []
        for (const node of this.nodes) {
            node.clear()
        }
        this.nodes = []
    }

    /**
     * Get total number of objects in tree (for debugging)
     */
    count() {
        let total = this.objects.length
        for (const node of this.nodes) {
            total += node.count()
        }
        return total
    }
}

export class Quadtree {
    constructor(bounds, maxObjects = 10, maxLevels = 8) {
        this.bounds = bounds
        this.maxObjects = maxObjects
        this.maxLevels = maxLevels
        this.root = new QuadtreeNode(bounds, 0, maxObjects, maxLevels)
    }

    /**
     * Insert an object with its bounding box
     */
    insert(object, bounds) {
        if (!bounds || bounds.width === 0 || bounds.height === 0) {
            console.warn('[Quadtree] Invalid bounds for insert:', bounds)
            return
        }
        this.root.insert(object, bounds)
    }

    /**
     * Remove an object with its bounding box
     */
    remove(object, bounds) {
        if (!bounds) {
            console.warn('[Quadtree] Invalid bounds for remove:', bounds)
            return
        }
        this.root.remove(object, bounds)
    }

    /**
     * Query all objects that intersect with the given rectangle
     */
    query(rect) {
        return this.root.query(rect, [])
    }

    /**
     * Query all objects that contain a specific point
     */
    queryPoint(point) {
        return this.root.queryPoint(point, [])
    }

    /**
     * Clear all objects from the quadtree
     */
    clear() {
        this.root.clear()
        this.root = new QuadtreeNode(
            this.bounds,
            0,
            this.maxObjects,
            this.maxLevels
        )
    }

    /**
     * Rebuild the entire quadtree from an array of objects
     */
    rebuild(objects) {
        this.clear()
        for (const obj of objects) {
            const bounds = obj.getBounds()
            this.insert(obj, bounds)
        }
    }

    /**
     * Update bounds for the quadtree (e.g., when canvas resizes)
     */
    updateBounds(bounds) {
        this.bounds = bounds
        // Rebuild with new bounds
        const allObjects = this.getAllObjects()
        this.clear()
        this.root = new QuadtreeNode(
            bounds,
            0,
            this.maxObjects,
            this.maxLevels
        )
        for (const obj of allObjects) {
            this.insert(obj, obj.getBounds())
        }
    }

    /**
     * Get all objects in the quadtree (for rebuilding)
     */
    getAllObjects() {
        const results = []
        this.collectObjects(this.root, results)
        return results
    }

    collectObjects(node, results) {
        for (const item of node.objects) {
            if (!results.includes(item.object)) {
                results.push(item.object)
            }
        }
        for (const childNode of node.nodes) {
            this.collectObjects(childNode, results)
        }
    }

    /**
     * Get total number of objects (for debugging)
     */
    count() {
        return this.root.count()
    }
}
