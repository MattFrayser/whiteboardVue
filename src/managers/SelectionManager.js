import { appState, actions } from '../stores/AppState'

/**
 * Manages object selection state and operations
 */
export class SelectionManager {
    constructor(objectManager, objectStore, historyManager) {
        this.objectManager = objectManager
        this.objectStore = objectStore
        this.historyManager = historyManager
    }

    get selectedObjects() {
        const selectedIds = appState.get('selection.objectIds')
        return selectedIds.map(id => this.objectStore.getObjectById(id)).filter(obj => obj !== undefined)
    }

    // Multi is used for selecting mutiple objects
    selectObject(object, multi = false) {
        const currentIds = appState.get('selection.objectIds')
        let newIds

        if (multi) {
            // Add to selection if not already selected
            if (!currentIds.includes(object.id)) {
                newIds = [...currentIds, object.id]
            } else {
                newIds = currentIds
            }
        } else {
            // Replace selection
            newIds = [object.id]
        }

        // Clear old selected flags
        this.selectedObjects.forEach(obj => (obj.selected = false))

        // Set new selected flags
        newIds.forEach(id => {
            const obj = this.objectStore.getObjectById(id)
            if (obj) obj.selected = true
        })

        // Update state
        actions.setSelection(newIds)
    }

    clearSelection() {
        this.selectedObjects.forEach(obj => (obj.selected = false))
        actions.clearSelection()
    }

    deleteSelected() {
        const toDelete = [...this.selectedObjects]
        this.clearSelection()

        // Use objectManager.removeObject to trigger broadcasts
        toDelete.forEach(obj => {
            this.objectManager.removeObject(obj)
        })
    }

    selectObjectsInRect(rect, multi = false) {
        const currentIds = multi ? appState.get('selection.objectIds') : []
        const newIds = [...currentIds]

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

            if (intersects && !newIds.includes(obj.id)) {
                newIds.push(obj.id)
            }
        })

        // Clear old selected flags if not multi
        if (!multi) {
            this.selectedObjects.forEach(obj => (obj.selected = false))
        }

        // Set new selected flags
        newIds.forEach(id => {
            const obj = this.objectStore.getObjectById(id)
            if (obj) obj.selected = true
        })

        // Update state
        actions.setSelection(newIds)
    }


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

    get length() {
        return this.selectedObjects.length
    }

    hasSelection() {
        return this.selectedObjects.length > 0
    }
}
