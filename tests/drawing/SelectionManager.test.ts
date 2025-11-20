import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SelectionManager } from '../../src/drawing/managers/SelectionManager'
import { ObjectManager } from '../../src/drawing/managers/ObjectManager'
import { HistoryManager } from '../../src/storage/history/HistoryManager'
import { ObjectStore } from '../../src/core/spatial/ObjectStore'
import { Rectangle } from '../../src/drawing/objects/types/Rectangle'
import type { DrawingObjectData } from '../../src/shared/types/common'
import { actions } from '../../src/shared/stores/AppState'

// Mock AppState
vi.mock('../../src/shared/stores/AppState', () => ({
    appState: {
        get: vi.fn((key: string) => {
            if (key === 'selection.objectIds') return []
            return undefined
        }),
        set: vi.fn(),
        subscribe: vi.fn(() => () => {}),
    },
    actions: {
        setSelection: vi.fn(),
        clearSelection: vi.fn(),
        setHistoryState: vi.fn(),
    },
}))

function createRectangleData(overrides: Partial<DrawingObjectData> = {}): DrawingObjectData {
    return {
        id: '',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: '#000000',
        strokeWidth: 2,
        ...overrides,
    }
}

describe('SelectionManager', () => {
    let objectManager: ObjectManager
    let objectStore: ObjectStore
    let historyManager: HistoryManager
    let selectionManager: SelectionManager
    const mockGetUserId = () => 'test-user-id'

    beforeEach(() => {
        vi.clearAllMocks()
        historyManager = new HistoryManager(mockGetUserId)
        objectStore = new ObjectStore()
        objectManager = new ObjectManager(null)
        selectionManager = new SelectionManager(objectManager, objectStore, historyManager)
    })

    it('should select an object', () => {
        const rect = new Rectangle(null, createRectangleData(), 0)
        objectStore.addLocal(rect) // FIXED: Changed from add() to addLocal()

        selectionManager.selectObject(rect, false)

        // Selection is stored in AppState
        expect(actions.setSelection).toHaveBeenCalled()
    })

    it('should support multi-select', () => {
        const rect1 = new Rectangle(null, createRectangleData(), 0)
        const rect2 = new Rectangle(null, createRectangleData({ x: 100 }), 1)

        objectStore.addLocal(rect1) // FIXED
        objectStore.addLocal(rect2) // FIXED

        selectionManager.selectObject(rect1, false)
        selectionManager.selectObject(rect2, true) // Multi-select

        expect(actions.setSelection).toHaveBeenCalledTimes(2)
    })

    it('should clear selection', () => {
        const rect = new Rectangle(null, createRectangleData(), 0)
        objectStore.addLocal(rect) // FIXED

        selectionManager.selectObject(rect, false)
        selectionManager.clearSelection()

        expect(actions.clearSelection).toHaveBeenCalled()
    })

    it('should handle empty selection', () => {
        selectionManager.clearSelection()
        expect(actions.clearSelection).toHaveBeenCalled()
    })
})
