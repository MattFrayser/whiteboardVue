import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectManager } from '../../src/core/ObjectManager';
import { Rectangle } from '../../src/objects/Rectangle';
import { Circle } from '../../src/objects/Circle';
import { Stroke } from '../../src/objects/Stroke';
import { Line } from '../../src/objects/Line';
import { Text } from '../../src/objects/Text';

describe('ObjectManager', () => {
  let manager;
  let mockEngine;

  beforeEach(() => {
    // Mock canvas context for Text measurements
    const mockContext = {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      textBaseline: '',
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      setLineDash: vi.fn(),
      getTransform: vi.fn(() => ({ a: 1 })),
      measureText: vi.fn(function(text) {
        const fontSizeMatch = this.font.match(/(\d+)px/);
        const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) : 16;
        return {
          width: text.length * (fontSize / 2),
        };
      }),
    };

    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') {
        return {
          getContext: vi.fn(() => mockContext),
        };
      }
      return document.createElement(tag);
    });

    mockEngine = {
      wsManager: {
        broadcastObjectAdded: vi.fn(),
        broadcastObjectDeleted: vi.fn()
      }
    };
    manager = new ObjectManager(mockEngine);
  });

  describe('constructor', () => {
    it('should initialize with empty state', () => {
      expect(manager.objects).toEqual([]);
      expect(manager.selectedObjects).toEqual([]);
      expect(manager.clipboard).toEqual([]);
      expect(manager.history).toEqual(['[]']);
      expect(manager.historyIndex).toBe(0);
    });
  });

  describe('addObject', () => {
    it('should add object to objects array', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      
      manager.addObject(obj);

      expect(manager.objects).toContain(obj);
      expect(manager.objects).toHaveLength(1);
    });

    it('should save state after adding', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      
      manager.addObject(obj);

      expect(manager.historyIndex).toBe(1);
      expect(manager.history).toHaveLength(2);
    });

    it('should broadcast to websocket if engine has wsManager', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      
      manager.addObject(obj);

      expect(mockEngine.wsManager.broadcastObjectAdded).toHaveBeenCalledWith(obj);
    });

    it('should not throw if engine has no wsManager', () => {
      const managerNoWS = new ObjectManager(null);
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });

      expect(() => managerNoWS.addObject(obj)).not.toThrow();
    });
  });

  describe('removeObject', () => {
    it('should remove object from array', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      manager.objects.push(obj);

      manager.removeObject(obj);

      expect(manager.objects).not.toContain(obj);
      expect(manager.objects).toHaveLength(0);
    });

    it('should save state after removing', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      manager.objects.push(obj);

      manager.removeObject(obj);

      expect(manager.historyIndex).toBe(1);
    });

    it('should broadcast to websocket', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      manager.objects.push(obj);

      manager.removeObject(obj);

      expect(mockEngine.wsManager.broadcastObjectDeleted).toHaveBeenCalledWith(obj);
    });

    it('should do nothing if object not in array', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });

      expect(() => manager.removeObject(obj)).not.toThrow();
      expect(manager.historyIndex).toBe(0);
    });
  });

  describe('selectObject', () => {
    it('should mark object as selected', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      
      manager.selectObject(obj);

      expect(obj.selected).toBe(true);
      expect(manager.selectedObjects).toContain(obj);
    });

    it('should clear previous selection by default', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      const obj2 = new Rectangle('id-2', { x1: 0, y1: 0, x2: 100, y2: 100 });
      
      manager.selectObject(obj1);
      manager.selectObject(obj2);

      expect(obj1.selected).toBe(false);
      expect(manager.selectedObjects).not.toContain(obj1);
      expect(manager.selectedObjects).toContain(obj2);
      expect(manager.selectedObjects).toHaveLength(1);
    });

    it('should preserve selection with multi flag', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      const obj2 = new Rectangle('id-2', { x1: 0, y1: 0, x2: 100, y2: 100 });
      
      manager.selectObject(obj1);
      manager.selectObject(obj2, true);

      expect(obj1.selected).toBe(true);
      expect(obj2.selected).toBe(true);
      expect(manager.selectedObjects).toHaveLength(2);
    });
  });

  describe('clearSelection', () => {
    it('should deselect all objects', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      const obj2 = new Rectangle('id-2', { x1: 0, y1: 0, x2: 100, y2: 100 });
      manager.selectObject(obj1);
      manager.selectObject(obj2, true);

      manager.clearSelection();

      expect(obj1.selected).toBe(false);
      expect(obj2.selected).toBe(false);
      expect(manager.selectedObjects).toHaveLength(0);
    });
  });

  describe('deleteSelected', () => {
    it('should remove all selected objects', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100 });
      const obj2 = new Rectangle('id-2', { x1: 0, y1: 0, x2: 100, y2: 100 });
      manager.objects.push(obj1, obj2);
      manager.selectObject(obj1);
      manager.selectObject(obj2, true);

      manager.deleteSelected();

      expect(manager.objects).toHaveLength(0);
      expect(manager.selectedObjects).toHaveLength(0);
    });
  });

  describe('getObjectAt', () => {
    it('should return topmost object at point', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      const obj2 = new Rectangle('id-2', { x1: 50, y1: 50, x2: 150, y2: 150, color: '#000', width: 2 });
      manager.objects.push(obj1, obj2);

      const result = manager.getObjectAt({ x: 75, y: 75 });

      expect(result).toBe(obj2);
    });

    it('should return null if no object at point', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.objects.push(obj);

      const result = manager.getObjectAt({ x: 200, y: 200 });

      expect(result).toBeNull();
    });
  });

  describe('selectObjectsInRect', () => {
    it('should select objects that intersect selection rect', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 50, y2: 50, color: '#000', width: 2 });
      const obj2 = new Rectangle('id-2', { x1: 100, y1: 100, x2: 150, y2: 150, color: '#000', width: 2 });
      manager.objects.push(obj1, obj2);

      manager.selectObjectsInRect({ x: 0, y: 0, width: 75, height: 75 });

      expect(obj1.selected).toBe(true);
      expect(obj2.selected).toBe(false);
      expect(manager.selectedObjects).toContain(obj1);
    });

    it('should clear previous selection by default', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 50, y2: 50, color: '#000', width: 2 });
      const obj2 = new Rectangle('id-2', { x1: 100, y1: 100, x2: 150, y2: 150, color: '#000', width: 2 });
      manager.objects.push(obj1, obj2);
      manager.selectObject(obj1);

      manager.selectObjectsInRect({ x: 100, y: 100, width: 100, height: 100 });

      expect(obj1.selected).toBe(false);
      expect(obj2.selected).toBe(true);
      expect(manager.selectedObjects).toHaveLength(1);
    });

    it('should preserve selection with multi flag', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 50, y2: 50, color: '#000', width: 2 });
      const obj2 = new Rectangle('id-2', { x1: 100, y1: 100, x2: 150, y2: 150, color: '#000', width: 2 });
      manager.objects.push(obj1, obj2);
      manager.selectObject(obj1);

      manager.selectObjectsInRect({ x: 100, y: 100, width: 100, height: 100 }, true);

      expect(obj1.selected).toBe(true);
      expect(obj2.selected).toBe(true);
      expect(manager.selectedObjects).toHaveLength(2);
    });
  });

  describe('moveSelected', () => {
    it('should move all selected objects', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      const obj2 = new Rectangle('id-2', { x1: 50, y1: 50, x2: 150, y2: 150, color: '#000', width: 2 });
      manager.objects.push(obj1, obj2);
      manager.selectObject(obj1);
      manager.selectObject(obj2, true);

      manager.moveSelected(10, 20);

      expect(obj1.data.x1).toBe(10);
      expect(obj1.data.y1).toBe(20);
      expect(obj2.data.x1).toBe(60);
      expect(obj2.data.y1).toBe(70);
    });

    it('should save state after moving', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.objects.push(obj);
      manager.selectObject(obj);

      manager.moveSelected(10, 20);

      expect(manager.historyIndex).toBe(1);
    });
  });

  describe('bringToFront', () => {
    it('should move selected objects to end of array', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      const obj2 = new Rectangle('id-2', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      const obj3 = new Rectangle('id-3', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.objects.push(obj1, obj2, obj3);
      manager.selectObject(obj1);

      manager.bringToFront();

      expect(manager.objects.indexOf(obj1)).toBe(2);
      expect(manager.objects[2]).toBe(obj1);
    });
  });

  describe('sendToBack', () => {
    it('should move selected objects to start of array', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      const obj2 = new Rectangle('id-2', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      const obj3 = new Rectangle('id-3', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.objects.push(obj1, obj2, obj3);
      manager.selectObject(obj3);

      manager.sendToBack();

      expect(manager.objects.indexOf(obj3)).toBe(0);
      expect(manager.objects[0]).toBe(obj3);
    });
  });

  describe('history', () => {
    it('should save state with object data', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.addObject(obj);

      expect(manager.history).toHaveLength(2);
      const savedState = JSON.parse(manager.history[1]);
      expect(savedState).toHaveLength(1);
      expect(savedState[0].id).toBe('id-1');
    });

    it('should truncate future history on new action', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      const obj2 = new Rectangle('id-2', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.addObject(obj1);
      manager.addObject(obj2);
      manager.undo();

      const obj3 = new Rectangle('id-3', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.addObject(obj3);

      expect(manager.history).toHaveLength(3);
      expect(manager.historyIndex).toBe(2);
    });

    it('should limit history to 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        const obj = new Rectangle(`id-${i}`, { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
        manager.addObject(obj);
      }

      expect(manager.history.length).toBeLessThanOrEqual(51); // Initial + 50
    });
  });

  describe('undo', () => {
    it('should restore previous state', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.addObject(obj);

      manager.undo();

      expect(manager.objects).toHaveLength(0);
      expect(manager.historyIndex).toBe(0);
    });

    it('should not undo beyond initial state', () => {
      manager.undo();
      manager.undo();

      expect(manager.historyIndex).toBe(0);
    });

    it('should clear selection on undo', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.addObject(obj);
      manager.selectObject(obj);

      manager.undo();

      expect(manager.selectedObjects).toHaveLength(0);
    });
  });

  describe('redo', () => {
    it('should restore next state', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.addObject(obj);
      manager.undo();

      manager.redo();

      expect(manager.objects).toHaveLength(1);
      expect(manager.historyIndex).toBe(1);
    });

    it('should not redo beyond latest state', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.addObject(obj);

      manager.redo();
      manager.redo();

      expect(manager.historyIndex).toBe(1);
    });
  });

  describe('clipboard', () => {
    it('should copy selected objects', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.objects.push(obj);
      manager.selectObject(obj);

      manager.copySelected();

      expect(manager.clipboard).toHaveLength(1);
      expect(manager.clipboard[0].id).toBe('id-1');
    });

    it('should not copy if nothing selected', () => {
      manager.copySelected();

      expect(manager.clipboard).toHaveLength(0);
    });

    it('should cut selected objects', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.objects.push(obj);
      manager.selectObject(obj);

      manager.cutSelected();

      expect(manager.clipboard).toHaveLength(1);
      expect(manager.objects).toHaveLength(0);
    });

    it('should paste at specified position', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.objects.push(obj);
      manager.selectObject(obj);
      manager.copySelected();
      manager.clearSelection();

      manager.paste(200, 200);

      expect(manager.objects).toHaveLength(2);
      expect(manager.selectedObjects).toHaveLength(1);
      const pasted = manager.selectedObjects[0];
      expect(pasted.id).not.toBe('id-1'); // New ID
    });

    it('should center pasted objects at cursor', () => {
      const obj = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.objects.push(obj);
      manager.selectObject(obj);
      manager.copySelected();

      manager.paste(300, 300);

      const pasted = manager.selectedObjects[0];
      const bounds = pasted.getBounds();
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      
      expect(centerX).toBeCloseTo(300, 0);
      expect(centerY).toBeCloseTo(300, 0);
    });

    it('should not paste if clipboard empty', () => {
      manager.paste(100, 100);

      expect(manager.objects).toHaveLength(0);
    });
  });

  describe('createObjectFromData', () => {
    it('should create Rectangle from data', () => {
      const data = { id: 'id-1', type: 'rectangle', data: { x1: 0, y1: 0, x2: 100, y2: 100 } };
      
      const obj = manager.createObjectFromData(data);

      expect(obj).toBeInstanceOf(Rectangle);
      expect(obj.id).toBe('id-1');
    });

    it('should create Circle from data', () => {
      const data = { id: 'id-1', type: 'circle', data: { x1: 50, y1: 50, x2: 100, y2: 50 } };
      
      const obj = manager.createObjectFromData(data);

      expect(obj).toBeInstanceOf(Circle);
    });

    it('should create Stroke from data', () => {
      const data = { id: 'id-1', type: 'stroke', data: { points: [], color: '#000', width: 2 } };
      
      const obj = manager.createObjectFromData(data);

      expect(obj).toBeInstanceOf(Stroke);
    });

    it('should create Line from data', () => {
      const data = { id: 'id-1', type: 'line', data: { x1: 0, y1: 0, x2: 100, y2: 100 } };
      
      const obj = manager.createObjectFromData(data);

      expect(obj).toBeInstanceOf(Line);
    });

    it('should create Text from data', () => {
      const data = { id: 'id-1', type: 'text', data: { text: 'Hello', x: 0, y: 0, fontSize: 16 } };
      
      const obj = manager.createObjectFromData(data);

      expect(obj).toBeInstanceOf(Text);
    });
  });

  describe('render', () => {
    it('should call render on all objects', () => {
      const obj1 = new Rectangle('id-1', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      const obj2 = new Rectangle('id-2', { x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 });
      manager.objects.push(obj1, obj2);

      vi.spyOn(obj1, 'render');
      vi.spyOn(obj2, 'render');

      const mockCtx = {
        strokeStyle: '',
        lineWidth: 0,
        fillStyle: '',
        strokeRect: vi.fn(),
        fillRect: vi.fn(),
        setLineDash: vi.fn(),
        getTransform: vi.fn(() => ({ a: 1 })),
      };
      manager.render(mockCtx);

      expect(obj1.render).toHaveBeenCalledWith(mockCtx);
      expect(obj2.render).toHaveBeenCalledWith(mockCtx);
    });
  });
});
