import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrawingObject } from '../../src/core/DrawingObject';

describe('DrawingObject', () => {
  let object;

  beforeEach(() => {
    object = new DrawingObject('test-id', 'test-type', { value: 42 });
  });

  describe('constructor', () => {
    it('should initialize with provided values', () => {
      expect(object.id).toBe('test-id');
      expect(object.type).toBe('test-type');
      expect(object.data).toEqual({ value: 42 });
      expect(object.selected).toBe(false);
      expect(object.userId).toBeNull();
      expect(object.zIndex).toBe(0);
    });

    it('should generate id if not provided', () => {
      const obj = new DrawingObject(null, 'test', {});
      
      expect(obj.id).toBeDefined();
      expect(typeof obj.id).toBe('string');
      expect(obj.id.length).toBeGreaterThan(0);
    });

    it('should generate unique ids', () => {
      const obj1 = new DrawingObject(null, 'test', {});
      const obj2 = new DrawingObject(null, 'test', {});
      
      expect(obj1.id).not.toBe(obj2.id);
    });
  });

  describe('containsPoint', () => {
    it('should return true for point inside bounds', () => {
      vi.spyOn(object, 'getBounds').mockReturnValue({
        x: 10,
        y: 10,
        width: 100,
        height: 50
      });

      expect(object.containsPoint({ x: 50, y: 30 })).toBe(true);
    });

    it('should return false for point outside bounds', () => {
      vi.spyOn(object, 'getBounds').mockReturnValue({
        x: 10,
        y: 10,
        width: 100,
        height: 50
      });

      expect(object.containsPoint({ x: 150, y: 30 })).toBe(false);
    });

    it('should return true for point on boundary', () => {
      vi.spyOn(object, 'getBounds').mockReturnValue({
        x: 10,
        y: 10,
        width: 100,
        height: 50
      });

      expect(object.containsPoint({ x: 10, y: 10 })).toBe(true);
      expect(object.containsPoint({ x: 110, y: 60 })).toBe(true);
    });
  });

  describe('getResizeHandles', () => {
    beforeEach(() => {
      vi.spyOn(object, 'getBounds').mockReturnValue({
        x: 100,
        y: 200,
        width: 80,
        height: 60
      });
    });

    it('should return 8 handles', () => {
      const handles = object.getResizeHandles();
      expect(handles).toHaveLength(8);
    });

    it('should position corner handles correctly', () => {
      const handles = object.getResizeHandles();

      expect(handles[0]).toEqual({ x: 100, y: 200, cursor: 'nw-resize' }); // NW
      expect(handles[2]).toEqual({ x: 180, y: 200, cursor: 'ne-resize' }); // NE
      expect(handles[4]).toEqual({ x: 180, y: 260, cursor: 'se-resize' }); // SE
      expect(handles[6]).toEqual({ x: 100, y: 260, cursor: 'sw-resize' }); // SW
    });

    it('should position edge handles correctly', () => {
      const handles = object.getResizeHandles();

      expect(handles[1]).toEqual({ x: 140, y: 200, cursor: 'n-resize' });  // N
      expect(handles[3]).toEqual({ x: 180, y: 230, cursor: 'e-resize' });  // E
      expect(handles[5]).toEqual({ x: 140, y: 260, cursor: 's-resize' });  // S
      expect(handles[7]).toEqual({ x: 100, y: 230, cursor: 'w-resize' });  // W
    });
  });

  describe('resize', () => {
    beforeEach(() => {
      vi.spyOn(object, 'getBounds').mockReturnValue({
        x: 100,
        y: 100,
        width: 100,
        height: 100
      });
      vi.spyOn(object, 'applyBounds').mockImplementation(() => {});
    });

    it('should resize from SE corner', () => {
      object.resize(4, 250, 250);

      expect(object.applyBounds).toHaveBeenCalledWith(
        { x: 100, y: 100, width: 150, height: 150 },
        4
      );
    });

    it('should resize from NW corner', () => {
      object.resize(0, 50, 50);

      expect(object.applyBounds).toHaveBeenCalledWith(
        { x: 50, y: 50, width: 150, height: 150 },
        0
      );
    });

    it('should resize from north edge', () => {
      object.resize(1, 150, 80);

      expect(object.applyBounds).toHaveBeenCalledWith(
        { x: 100, y: 80, width: 100, height: 120 },
        1
      );
    });

    it('should resize from east edge', () => {
      object.resize(3, 250, 150);

      expect(object.applyBounds).toHaveBeenCalledWith(
        { x: 100, y: 100, width: 150, height: 100 },
        3
      );
    });

    it('should prevent negative width', () => {
      object.resize(4, 50, 150);

      const call = object.applyBounds.mock.calls[0][0];
      expect(call.width).toBe(5);
    });

    it('should prevent negative height', () => {
      object.resize(4, 150, 50);

      const call = object.applyBounds.mock.calls[0][0];
      expect(call.height).toBe(5);
    });

    it('should adjust position when preventing negative width from left side', () => {
      object.resize(0, 250, 150);

      const call = object.applyBounds.mock.calls[0][0];
      expect(call.width).toBe(5);
      expect(call.x).toBe(195); // 200 - 5
    });

    it('should adjust position when preventing negative height from top side', () => {
      object.resize(0, 150, 250);

      const call = object.applyBounds.mock.calls[0][0];
      expect(call.height).toBe(5);
      expect(call.y).toBe(195); // 200 - 5
    });
  });

  describe('renderSelection', () => {
    let mockCtx;

    beforeEach(() => {
      mockCtx = {
        strokeStyle: '',
        lineWidth: 0,
        fillStyle: '',
        strokeRect: vi.fn(),
        fillRect: vi.fn(),
        setLineDash: vi.fn(),
        getTransform: vi.fn().mockReturnValue({ a: 1 })
      };

      vi.spyOn(object, 'getBounds').mockReturnValue({
        x: 50,
        y: 50,
        width: 100,
        height: 80
      });
    });

    it('should draw selection rectangle', () => {
      object.renderSelection(mockCtx);

      expect(mockCtx.strokeRect).toHaveBeenCalledWith(50, 50, 100, 80);
    });

    it('should use dashed line for selection', () => {
      object.renderSelection(mockCtx);

      expect(mockCtx.setLineDash).toHaveBeenCalledWith([5, 5]);
      expect(mockCtx.setLineDash).toHaveBeenCalledWith([]);
    });

    it('should render 8 resize handles', () => {
      object.renderSelection(mockCtx);

      expect(mockCtx.fillRect).toHaveBeenCalledTimes(8);
      expect(mockCtx.strokeRect).toHaveBeenCalledTimes(9); // 1 selection + 8 handles
    });

    it('should scale handle size based on transform', () => {
      mockCtx.getTransform.mockReturnValue({ a: 2 });
      
      object.renderSelection(mockCtx);

      // Handle size should be 12 / 2 = 6
      const firstCall = mockCtx.fillRect.mock.calls[0];
      expect(firstCall[2]).toBe(6); // width
      expect(firstCall[3]).toBe(6); // height
    });
  });

  describe('toJSON', () => {
    it('should serialize object properties', () => {
      object.userId = 'user-123';
      object.zIndex = 5;

      const json = object.toJSON();

      expect(json).toEqual({
        id: 'test-id',
        type: 'test-type',
        data: { value: 42 },
        userId: 'user-123',
        zIndex: 5
      });
    });

    it('should not include selected state', () => {
      object.selected = true;

      const json = object.toJSON();

      expect(json.selected).toBeUndefined();
    });
  });
});
