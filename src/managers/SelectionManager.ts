import { appState, actions } from '../stores/AppState'
import { MoveObjectsOperation } from './operations'
import type { DrawingObject } from '../objects/DrawingObject'
import type { Bounds } from '../types'
import type { ObjectManager } from './ObjectManager'
import type { ObjectStore } from './ObjectStore'
import type { HistoryManager } from './HistoryManager'

/**
 * Manages object selection state and operations
 */
export class SelectionManager {
    objectManager: ObjectManager
    objectStore: ObjectStore
    historyManager: HistoryManager

    constructor(objectManager: ObjectManager, objectStore: ObjectStore, historyManager: HistoryManager) {
        this.objectManager = objectManager
        this.objectStore = objectStore
        this.historyManager = historyManager
    }

    get selectedObjects() {
        const selectedIds = appState.get('selection.objectIds') as string[]
        return selectedIds.map((id: string) => this.objectStore.getObjectById(id)).filter((obj: DrawingObject | undefined): obj is DrawingObject => obj !== undefined)
    }

    // Multi is used for selecting mutiple objects
    selectObject(object: DrawingObject, multi = false) {
        const currentIds = appState.get('selection.objectIds') as string[]
        let newIds: string[]

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
        this.selectedObjects.forEach((obj: DrawingObject) => (obj.selected = false))

        // Set new selected flags
        newIds.forEach((id: string) => {
            const obj = this.objectStore.getObjectById(id)
            if (obj) obj.selected = true
        })

        // Update state
        actions.setSelection(newIds)
    }

    clearSelection() {
        this.selectedObjects.forEach((obj: DrawingObject) => (obj.selected = false))
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

    selectObjectsInRect(rect: Bounds, multi = false) {
        const currentIds = multi ? (appState.get('selection.objectIds') as string[]) : []
        const newIds: string[] = [...currentIds]

        const candidates = this.objectStore.queryQuadtree(rect)

        // Check each candidate for intersection with select rectangle
        candidates.forEach((obj: DrawingObject) => {
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
            this.selectedObjects.forEach((obj: DrawingObject) => (obj.selected = false))
        }

        // Set new selected flags
        newIds.forEach((id: string) => {
            const obj = this.objectStore.getObjectById(id)
            if (obj) obj.selected = true
        })

        // Update state
        actions.setSelection(newIds)
    }


    moveSelected(dx: number, dy: number) {
        if (this.selectedObjects.length === 0) {
            return
        }

        // Move all selected objects
        this.selectedObjects.forEach((obj: DrawingObject) => {
            const oldBounds = obj.getBounds()
            this.objectStore.removeFromQuadtree(obj, oldBounds)

            obj.move(dx, dy)

            const newBounds = obj.getBounds()
            this.objectStore.insertIntoQuadtree(obj, newBounds)
        })

        // Record a single operation for all moved objects
        const userId = this.objectManager.userId
        if (userId) {
            const objectIds = this.selectedObjects.map(obj => obj.id)
            const operation = new MoveObjectsOperation(objectIds, dx, dy, userId)
            this.historyManager.recordOperation(operation)
        }
    }

    get length() {
        return this.selectedObjects.length
    }

    hasSelection() {
        return this.selectedObjects.length > 0
    }
}
