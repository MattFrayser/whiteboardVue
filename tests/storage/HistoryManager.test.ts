import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HistoryManager } from '../../src/storage/history/HistoryManager'
import { AddObjectOperation } from '../../src/storage/history/operations/AddObjectOperation'
import { DeleteObjectOperation } from '../../src/storage/history/operations/DeleteObjectOperation'
import { Rectangle } from '../../src/drawing/objects/types/Rectangle'
import type { DrawingObjectData } from '../../src/shared/types/common'

// Mock AppState
vi.mock('../../src/shared/stores/AppState', () => ({
    appState: {
        get: vi.fn(),
        set: vi.fn(),
        subscribe: vi.fn(() => () => {}),
    },
    actions: {
        setCanUndo: vi.fn(),
        setCanRedo: vi.fn(),
        setHistoryState: vi.fn(), // ✅ Added missing mock
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

describe('HistoryManager', () => {
    let historyManager: HistoryManager
    const mockGetUserId = () => 'test-user-id'

    beforeEach(() => {
        historyManager = new HistoryManager(mockGetUserId)
    })

    it('should record operations', () => {
        const rect = new Rectangle(null, createRectangleData(), 0)
        const operation = new AddObjectOperation(rect, 'test-user-id')

        historyManager.recordOperation(operation)

        expect(historyManager.canUndo()).toBe(true)
    })

    it('should support undo', () => {
        const rect = new Rectangle(null, createRectangleData(), 0)
        const operation = new AddObjectOperation(rect, 'test-user-id')

        historyManager.recordOperation(operation)
        historyManager.undo()

        expect(historyManager.canRedo()).toBe(true)
    })

    it('should support redo', () => {
        const rect = new Rectangle(null, createRectangleData(), 0)
        const operation = new AddObjectOperation(rect, 'test-user-id')

        historyManager.recordOperation(operation)
        historyManager.undo()
        historyManager.redo()

        expect(historyManager.canUndo()).toBe(true)
    })

    it('should clear redo stack when new operation recorded', () => {
        const rect1 = new Rectangle(null, createRectangleData(), 0)
        const rect2 = new Rectangle(null, createRectangleData({ x: 100 }), 1)

        historyManager.recordOperation(new AddObjectOperation(rect1, 'test-user-id')) // ✅ Pass userId
        historyManager.undo()

        // Record new operation should clear redo stack
        historyManager.recordOperation(new AddObjectOperation(rect2, 'test-user-id')) // ✅ Pass userId

        expect(historyManager.canRedo()).toBe(false)
    })

    it('should handle delete operations', () => {
        const rect = new Rectangle(null, createRectangleData(), 0)
        const operation = new DeleteObjectOperation(rect, 'test-user-id')

        historyManager.recordOperation(operation)

        expect(historyManager.canUndo()).toBe(true)
    })
})
