/**
 * Manages object selection state and operations
 */
export class SelectionManager {
    constructor(objectManager, objectStore, historyManager) {
        this.objectManager = objectManager
        this.objectStore = objectStore
        this.historyManager = historyManager
        this.selectedObjects = []
    }

    /**
     * Select an object
     * @param {Object} object - The object to select
     * @param {boolean} multi - If true, add to selection. If false, clear existing selection first
     */
    selectObject(object, multi = false) {
        if (!multi) {
            this.clearSelection()
        }
        object.selected = true
        this.selectedObjects.push(object)
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        this.selectedObjects.forEach(obj => (obj.selected = false))
        this.selectedObjects = []
    }

    /**
     * Delete all selected objects
     */
    deleteSelected() {
        const toDelete = [...this.selectedObjects]
        this.clearSelection()

        // Use objectManager.removeObject to trigger broadcasts
        toDelete.forEach(obj => {
            this.objectManager.removeObject(obj)
        })
    }

    /**
     * Select all objects within a rectangle
     * @param {Object} rect - Rectangle with x, y, width, height
     * @param {boolean} multi - If true, add to selection. If false, clear existing selection first
     */
    selectObjectsInRect(rect, multi = false) {
        if (!multi) {
            this.clearSelection()
        }

        const candidates = this.objectStore.queryQuadtree(rect)

        // Check each candidate for intersection with select rectangle
        candidates.forEach(obj => {
            const bounds = obj.getBounds()

            const intersects = !(
                bounds.x + bounds.width < rect.x ||
                bounds.x > rect.x + rect.width ||
                bounds.y + bounds.height < rect.y ||
                bounds.y > rect.y + rect.height
            )

            if (intersects && !obj.selected) {
                obj.selected = true
                this.selectedObjects.push(obj)
            }
        })
    }

    /**
     * Move all selected objects by a delta
     * @param {number} dx - X delta
     * @param {number} dy - Y delta
     */
    moveSelected(dx, dy) {
        this.selectedObjects.forEach(obj => {
            const oldBounds = obj.getBounds()
            this.objectStore.removeFromQuadtree(obj, oldBounds)

            obj.move(dx, dy)

            const newBounds = obj.getBounds()
            this.objectStore.insertIntoQuadtree(obj, newBounds)
        })
        this.historyManager.saveState(this.objectStore.getAllObjects())
    }

    /**
     * Get the number of selected objects
     */
    get length() {
        return this.selectedObjects.length
    }

    /**
     * Check if there are any selected objects
     */
    hasSelection() {
        return this.selectedObjects.length > 0
    }
}
