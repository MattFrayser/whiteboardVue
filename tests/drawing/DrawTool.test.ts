import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DrawTool } from '../../src/drawing/tools/drawing/DrawTool'
import type { DrawingEngine } from '../../src/core/engine/DrawingEngine'
import * as AppState from '../../src/shared/stores/AppState'

// Mock AppState
vi.mock('../../src/shared/stores/AppState', () => ({
    selectors: {
        getColor: vi.fn(() => '#000000'),
        getBrushSize: vi.fn(() => 2),
    },
}))

describe('DrawTool', () => {
    let tool: DrawTool
    let mockEngine: Partial<DrawingEngine>

    beforeEach(() => {
        vi.clearAllMocks()

        mockEngine = {
            objectManager: {
                addObject: vi.fn(),
            } as any,
            renderDirty: vi.fn(),
        }

        tool = new DrawTool(mockEngine as DrawingEngine)
    })

    describe('drawing flow', () => {
        it('should create stroke on mouse down and move', () => {
            tool.onMouseDown({ x: 10, y: 10 }, {} as MouseEvent)
            expect(tool.isDrawing).toBe(true)
            expect(tool.currentStroke).toBeDefined()

            tool.onMouseMove({ x: 20, y: 20 }, {} as MouseEvent)
            tool.onMouseMove({ x: 30, y: 30 }, {} as MouseEvent)

            expect(tool.currentStroke?.data.points).toHaveLength(3)
        })

        it('should add stroke on mouse up', () => {
            tool.onMouseDown({ x: 10, y: 10 }, {} as MouseEvent)
            tool.onMouseMove({ x: 20, y: 20 }, {} as MouseEvent)
            tool.onMouseMove({ x: 30, y: 30 }, {} as MouseEvent)
            tool.onMouseUp({ x: 40, y: 40 }, {} as MouseEvent)

            expect(mockEngine.objectManager?.addObject).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'stroke',
                    data: expect.objectContaining({
                        points: expect.any(Array),
                    }),
                })
            )
            expect(tool.isDrawing).toBe(false)
            expect(tool.currentStroke).toBeNull()
        })

        it('should not create stroke for single click', () => {
            tool.onMouseDown({ x: 10, y: 10 }, {} as MouseEvent)
            tool.onMouseUp({ x: 10, y: 10 }, {} as MouseEvent)

            expect(mockEngine.objectManager?.addObject).not.toHaveBeenCalled()
        })

        it('should use color from AppState', () => {
            vi.mocked(AppState.selectors.getColor).mockReturnValue('#FF0000')

            tool.onMouseDown({ x: 10, y: 10 }, {} as MouseEvent)

            expect(tool.currentStroke?.data.color).toBe('#FF0000')
        })

        it('should use brush size from AppState', () => {
            vi.mocked(AppState.selectors.getBrushSize).mockReturnValue(5)

            tool.onMouseDown({ x: 10, y: 10 }, {} as MouseEvent)

            expect(tool.currentStroke?.data.width).toBe(5)
        })
    })

    describe('stroke simplification', () => {
        it('should simplify strokes with many points', () => {
            tool.onMouseDown({ x: 0, y: 0 }, {} as MouseEvent)

            // Add 10 points
            for (let i = 1; i <= 10; i++) {
                tool.onMouseMove({ x: i * 10, y: i * 10 }, {} as MouseEvent)
            }

            tool.onMouseUp({ x: 100, y: 100 }, {} as MouseEvent)

            expect(mockEngine.objectManager?.addObject).toHaveBeenCalled()
            const addedStroke = (mockEngine.objectManager?.addObject as any).mock.calls[0][0]

            // Should be simplified (fewer points than original 11)
            expect(addedStroke.data.points.length).toBeLessThan(11)
            expect(addedStroke.data.points.length).toBeGreaterThanOrEqual(3)
        })
    })
})
