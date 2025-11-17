/**
 * Quadtree spatial indexing data structure for efficient spatial queries
 * Used for viewport culling and fast collision/selection detection
 *
 * Recursivly divide 2d space, creating a tree structure.
 */

import type { Bounds, Point } from '../../shared/types'
interface QuadtreeObject {
    getBounds(): Bounds
}

interface QuadtreeItem<T> {
    object: T
    bounds: Bounds
}

class QuadtreeNode<T extends QuadtreeObject> {
    bounds: Bounds
    level: number
    maxObjects: number
    maxLevels: number
    objects: QuadtreeItem<T>[]
    nodes: QuadtreeNode<T>[]

    constructor(bounds: Bounds, level: number, maxObjects: number, maxLevels: number) {
        this.bounds = bounds // rect region node covers { x, y, width, height }
        this.level = level // Current depth (0 = root)
        this.maxObjects = maxObjects // Capacity before splitting
        this.maxLevels = maxLevels // Maximum tree depth (prevents infinite subdivision)

        this.objects = [] // { object, bounds }
        this.nodes = [] // 4 child nodes (0=NW, 1=NE, 2=SW, 3=SE)
    }

    // Called when node has too many objects,
    // Node is split into 4 quadrants creating child nodes
    split(): void {
        const subWidth = this.bounds.width / 2
        const subHeight = this.bounds.height / 2
        const x = this.bounds.x
        const y = this.bounds.y
        const nextLevel = this.level + 1

        //  0: NW, 1: NE, 2: SW, 3: SE
        this.nodes[0] = new QuadtreeNode(
            { x, y, width: subWidth, height: subHeight },
            nextLevel,
            this.maxObjects,
            this.maxLevels
        )
        this.nodes[1] = new QuadtreeNode(
            { x: x + subWidth, y, width: subWidth, height: subHeight },
            nextLevel,
            this.maxObjects,
            this.maxLevels
        )
        this.nodes[2] = new QuadtreeNode(
            { x, y: y + subHeight, width: subWidth, height: subHeight },
            nextLevel,
            this.maxObjects,
            this.maxLevels
        )
        this.nodes[3] = new QuadtreeNode(
            { x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight },
            nextLevel,
            this.maxObjects,
            this.maxLevels
        )
    }

    /**
     * Get indices of quadrants that the bounds intersects
     * Uses midpoint testing: an object can span multiple quadrants if it
     * crosses the vertical or horizontal midpoint of this node
     */
    getQuadrants(bounds: Bounds): number[] {
        const indices: number[] = []
        const verticalMidpoint = this.bounds.x + this.bounds.width / 2
        const horizontalMidpoint = this.bounds.y + this.bounds.height / 2

        // Test which sides of the midpoints the bounds occupies
        const startIsNorth = bounds.y < horizontalMidpoint
        const startIsWest = bounds.x < verticalMidpoint
        const endIsEast = bounds.x + bounds.width > verticalMidpoint
        const endIsSouth = bounds.y + bounds.height > horizontalMidpoint

        // Check each quadrant
        if (startIsNorth && startIsWest) {
            indices.push(0)
        } // NW
        if (startIsNorth && endIsEast) {
            indices.push(1)
        } // NE
        if (endIsSouth && startIsWest) {
            indices.push(2)
        } // SW
        if (endIsSouth && endIsEast) {
            indices.push(3)
        } // SE

        return indices //0=NW, 1=NE, 2=SW, 3=SE
    }

    insert(object: T, bounds: Bounds): void {
        // Insert any child nodes
        if (this.nodes.length > 0) {
            const indices = this.getQuadrants(bounds)
            for (const index of indices) {
                this.nodes[index]!.insert(object, bounds)
            }
            return
        }

        // Add object to node
        this.objects.push({ object, bounds })

        // when max objects are exceeded split node,
        // this condition is kept in check by having a max level
        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            if (this.nodes.length === 0) {
                this.split()
            }

            // Redistribute objects: push down to children when possible,
            // but keep objects at this level if they span multiple quadrants
            // (prevents duplicate storage and allows single-quadrant objects
            // to benefit from deeper spatial partitioning)
            const objectsToDistribute = [...this.objects]
            this.objects = []

            for (const item of objectsToDistribute) {
                const indices = this.getQuadrants(item.bounds)

                // Multi-quadrant objects stay at parent level to avoid duplication
                if (indices.length > 1) {
                    this.objects.push(item)
                } else {
                    for (const index of indices) {
                        this.nodes[index]!.insert(item.object, item.bounds)
                    }
                }
            }
        }
    }

    remove(object: T, bounds: Bounds): void {
        // Remove from child nodes
        if (this.nodes.length > 0) {
            const indices = this.getQuadrants(bounds)
            for (const index of indices) {
                this.nodes[index]!.remove(object, bounds)
            }
        }

        // Remove from this node
        this.objects = this.objects.filter(item => item.object !== object)
    }

    // querys are done by recusivly traversing nodes that intersect with rect
    query(rect: Bounds, results: T[] = []): T[] {
        // Check if this node intersects with query rect
        if (!this.intersects(this.bounds, rect)) {
            return results
        }

        // Check objects at this level
        for (const item of this.objects) {
            if (this.intersects(item.bounds, rect)) {
                // Avoid duplicates: objects spanning multiple quadrants exist at parent
                // level but we may visit the same parent from multiple child branches
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

    // Similar to query but only for single point
    // Used for click detection
    queryPoint(point: Point, results: T[] = []): T[] {
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

    // Uses negation: easier to check if they DON'T overlap
    intersects(rect1: Bounds, rect2: Bounds): boolean {
        return !(
            rect1.x + rect1.width < rect2.x || // rect1 is completely left of rect2
            rect1.x > rect2.x + rect2.width || // rect1 is completely right of rect2
            rect1.y + rect1.height < rect2.y || // rect1 is completely above rect2
            rect1.y > rect2.y + rect2.height // rect1 is completely below rect2
        )
    }

    containsPoint(rect: Bounds, point: Point): boolean {
        return (
            point.x >= rect.x &&
            point.x <= rect.x + rect.width &&
            point.y >= rect.y &&
            point.y <= rect.y + rect.height
        )
    }

    clear(): void {
        this.objects = []
        for (const node of this.nodes) {
            node.clear()
        }
        this.nodes = []
    }

    // used for debugging
    count(): number {
        let total = this.objects.length
        for (const node of this.nodes) {
            total += node.count()
        }
        return total
    }
}

export class Quadtree<T extends QuadtreeObject = QuadtreeObject> {
    bounds: Bounds
    maxObjects: number
    maxLevels: number
    root: QuadtreeNode<T>

    constructor(bounds: Bounds, maxObjects = 10, maxLevels = 8) {
        // maxObjects: higher = fewer nodes but slower queries per node
        // maxLevels: higher = deeper tree, more precise culling but more overhead
        // defaults tuned for typical whiteboard object density
        this.bounds = bounds
        this.maxObjects = maxObjects
        this.maxLevels = maxLevels
        this.root = new QuadtreeNode(bounds, 0, maxObjects, maxLevels)
    }

    insert(object: T, bounds: Bounds): void {
        if (!bounds || bounds.width === 0 || bounds.height === 0) {
            // Zero-size bounds break getQuadrants() logic and provide no
            // useful spatial information for queries
            console.warn('[Quadtree] Invalid bounds for insert:', bounds)
            return
        }
        this.root.insert(object, bounds)
    }

    remove(object: T, bounds: Bounds): void {
        if (!bounds) {
            console.warn('[Quadtree] Invalid bounds for remove:', bounds)
            return
        }
        this.root.remove(object, bounds)
    }

    query(rect: Bounds): T[] {
        return this.root.query(rect, [])
    }

    queryPoint(point: Point): T[] {
        return this.root.queryPoint(point, [])
    }

    clear(): void {
        this.root.clear()
        this.root = new QuadtreeNode(this.bounds, 0, this.maxObjects, this.maxLevels)
    }

    rebuild(objects: T[]): void {
        this.clear()
        for (const obj of objects) {
            const bounds = obj.getBounds()
            this.insert(obj, bounds)
        }
    }

    /**
     * Update bounds for the quadtree (ex: canvas resizes)
     * WARNING: This triggers a full rebuild (O(n log n)) - use sparingly
     */
    updateBounds(bounds: Bounds): void {
        // Must rebuild since all spatial partitions are now invalid
        this.bounds = bounds
        const allObjects = this.getAllObjects()
        this.clear()
        this.root = new QuadtreeNode(bounds, 0, this.maxObjects, this.maxLevels)
        for (const obj of allObjects) {
            this.insert(obj, obj.getBounds())
        }
    }

    // used when rebuilding
    getAllObjects(): T[] {
        const results: T[] = []
        this.collectObjects(this.root, results)
        return results
    }

    collectObjects(node: QuadtreeNode<T>, results: T[]): void {
        for (const item of node.objects) {
            if (!results.includes(item.object)) {
                results.push(item.object)
            }
        }
        for (const childNode of node.nodes) {
            this.collectObjects(childNode, results)
        }
    }

    // debugging
    count(): number {
        return this.root.count()
    }
}
