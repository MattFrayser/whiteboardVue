import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ObjectManager } from '../../src/drawing/managers/ObjectManager'
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

describe('ObjectManager', () => {
    let manager: ObjectManager

    beforeEach(() => {
        manager = new ObjectManager(null)
    })

    it('should add object', () => {
        const rect = new Rectangle(null, createRectangleData(), 0)
        manager.addObject(rect)

        const allObjects = manager.getAllObjects()
        expect(allObjects).toContain(rect)
    })

    it('should remove object', () => {
        const rect = new Rectangle(null, createRectangleData(), 0)
        manager.addObject(rect)
        manager.removeObject(rect)

        const allObjects = manager.getAllObjects()
        expect(allObjects).not.toContain(rect)
    })

    it('should retrieve object by id', () => {
        const rect = new Rectangle(null, createRectangleData(), 0)
        manager.addObject(rect)

        const retrieved = manager.getObjectById(rect.id)
        expect(retrieved).toBe(rect)
    })

    it('should return null for non-existent object', () => {
        const retrieved = manager.getObjectById('non-existent-id')
        expect(retrieved).toBeUndefined()
    })

    it('should handle multiple objects', () => {
        const rect1 = new Rectangle(null, createRectangleData(), 0)
        const rect2 = new Rectangle(null, createRectangleData({ x: 100 }), 1)

        manager.addObject(rect1)
        manager.addObject(rect2)

        const allObjects = manager.getAllObjects()
        expect(allObjects.length).toBe(2)
    })
})
