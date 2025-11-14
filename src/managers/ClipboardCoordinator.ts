import type { DrawingObject } from '../objects/DrawingObject'
import type { ClipboardManager } from './ClipboardManager'

/**
 * Coordinates clipboard operations with position calculations
 * Handles copy/cut/paste logic including object positioning
 */
export class ClipboardCoordinator {
    private clipboardManager: ClipboardManager

    constructor(clipboardManager: ClipboardManager) {
        this.clipboardManager = clipboardManager
    }

    /**
     * Copy selected objects to clipboard
     */
    copySelected(selectedObjects: DrawingObject[]): void {
        this.clipboardManager.copy(selectedObjects)
    }

    /**
     * Cut selected objects (copy + delete)
     */
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
        if (!this.clipboardManager.hasContent()) {
            return []
        }

        const clipboard = this.clipboardManager.getClipboard()
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

        // Calculate bounding box of all objects
        let minX = Infinity,
            minY = Infinity
        let maxX = -Infinity,
            maxY = -Infinity

        newObjects.forEach(obj => {
            const bounds = obj.getBounds()
            minX = Math.min(minX, bounds.x)
            minY = Math.min(minY, bounds.y)
            maxX = Math.max(maxX, bounds.x + bounds.width)
            maxY = Math.max(maxY, bounds.y + bounds.height)
        })

        // Calculate group center
        const groupCenterX = (minX + maxX) / 2
        const groupCenterY = (minY + maxY) / 2

        // Calculate offset to move group center to cursor position
        const dx = x - groupCenterX
        const dy = y - groupCenterY

        // Move all objects by the offset
        newObjects.forEach(obj => {
            obj.move(dx, dy)
        })

        return newObjects
    }

    /**
     * Check if clipboard has content
     */
    hasContent(): boolean {
        return this.clipboardManager.hasContent()
    }
}
