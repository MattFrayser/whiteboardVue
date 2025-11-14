import type { DrawingObjectData } from '../types'
import type { DrawingObject } from '../objects/DrawingObject'

/**
 * Manages copy/paste/cut operations for objects
 */
export class ClipboardManager {
    private clipboard: DrawingObjectData[]

    constructor() {
        this.clipboard = []
    }

    copy(objects: any[]): void {
        if (objects.length === 0) {
            return
        }
        this.clipboard = objects.map(obj => obj.toJSON())
    }  

    copySelected(selectedObjects: DrawingObject[]): void {
        this.copy(selectedObjects)
    }

    cutSelected(selectedObjects: DrawingObject[], deleteCallback: () => void): void {
        if (selectedObjects.length === 0) {
            return
        }

        this.copySelected(selectedObjects)
        deleteCallback()
    }

    /**
     * Paste objects at specified position
     * Creates new objects, calculates positions, and returns them
     *
     * @param x - X coordinate to paste at (cursor position)
     * @param y - Y coordinate to paste at (cursor position)
     * @param createObjectCallback - Function to create object from data
     * @returns Array of newly created objects with calculated positions
     */
    paste(
        x: number,
        y: number,
        createObjectCallback: (data: any) => DrawingObject | null
    ): DrawingObject[] {
        if (!this.hasContent()) {
            return []
        }

        const clipboard = this.getClipboard()
        const newObjects: DrawingObject[] = []

        // Create objects from clipboard data
        clipboard.forEach(data => {
            // Deep clone
            const clonedData = JSON.parse(JSON.stringify(data))
            clonedData.id = null // setting null will trigger new ID
            const newObject = createObjectCallback(clonedData)
            if (newObject) {
                newObjects.push(newObject)
            }
        })

        if (newObjects.length === 0) {
            return []
        }

        //  bounding box of all objects
        let minX = Infinity, minY = Infinity
        let maxX = -Infinity, maxY = -Infinity

        newObjects.forEach(obj => {
            const bounds = obj.getBounds()
            minX = Math.min(minX, bounds.x)
            minY = Math.min(minY, bounds.y)
            maxX = Math.max(maxX, bounds.x + bounds.width)
            maxY = Math.max(maxY, bounds.y + bounds.height)
        })

        // group center
        const groupCenterX = (minX + maxX) / 2
        const groupCenterY = (minY + maxY) / 2

        // offset to move group center to cursor position
        const dx = x - groupCenterX
        const dy = y - groupCenterY

        // Move all objects by the offset
        newObjects.forEach(obj => {
            obj.move(dx, dy)
        })

        return newObjects
    }

    getClipboard(): DrawingObjectData[] {
        return this.clipboard
    }

    hasContent(): boolean {
        return this.clipboard.length > 0
    }

    clear(): void {
        this.clipboard = []
    }
}
