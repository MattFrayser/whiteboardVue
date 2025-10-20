import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Coordinates } from '../../src/core/Coordinates';

describe('Coordinates', () => {
  let coordinates;
  let mockCanvas;

  beforeEach(() => {
    coordinates = new Coordinates();
    
    // Mock canvas with getBoundingClientRect
    mockCanvas = {
      getBoundingClientRect: vi.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600
      })
    };
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(coordinates.offsetX).toBe(0);
      expect(coordinates.offsetY).toBe(0);
      expect(coordinates.scale).toBe(1);
      expect(coordinates.isPanning).toBe(false);
      expect(coordinates.panStart).toBeNull();
      expect(coordinates.panOffsetStart).toBeNull();
    });
  });

  describe('worldToViewport', () => {
    it('should convert world coordinates to viewport with no transform', () => {
      const result = coordinates.worldToViewport({ x: 100, y: 50 });
      
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('should apply both scale and offset', () => {
      coordinates.scale = 2;
      coordinates.offsetX = 10;
      coordinates.offsetY = 20;
      
      const result = coordinates.worldToViewport({ x: 100, y: 50 });
      
      expect(result).toEqual({ x: 210, y: 120 });
    });
  });

  describe('viewportToWorld', () => {
    it('should convert viewport coordinates to world with no transform', () => {
      const result = coordinates.viewportToWorld({ x: 100, y: 50 }, mockCanvas);
      
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('should account for canvas position', () => {
      mockCanvas.getBoundingClientRect.mockReturnValue({
        left: 50,
        top: 100,
        width: 800,
        height: 600
      });
      
      const result = coordinates.viewportToWorld({ x: 150, y: 200 }, mockCanvas);
      
      expect(result).toEqual({ x: 100, y: 100 });
    });

    it('should apply both inverse scale and offset', () => {
      coordinates.scale = 2;
      coordinates.offsetX = 10;
      coordinates.offsetY = 20;
      
      const result = coordinates.viewportToWorld({ x: 210, y: 120 }, mockCanvas);
      
      expect(result).toEqual({ x: 100, y: 50 });
    });
  });

  describe('startPan', () => {
    it('should set isPanning to true', () => {
      coordinates.startPan({ x: 100, y: 200 });
      
      expect(coordinates.isPanning).toBe(true);
    });

    it('should store pan start point', () => {
      coordinates.startPan({ x: 100, y: 200 });
      
      expect(coordinates.panStart).toEqual({ x: 100, y: 200 });
    });

    it('should store current offset', () => {
      coordinates.offsetX = 50;
      coordinates.offsetY = 75;
      
      coordinates.startPan({ x: 100, y: 200 });
      
      expect(coordinates.panOffsetStart).toEqual({ x: 50, y: 75 });
    });
  });

  describe('pan', () => {
    it('should do nothing if not panning', () => {
      coordinates.pan({ x: 150, y: 250 });
      
      expect(coordinates.offsetX).toBe(0);
      expect(coordinates.offsetY).toBe(0);
    });

    it('should do nothing if panStart is null', () => {
      coordinates.isPanning = true;
      coordinates.pan({ x: 150, y: 250 });
      
      expect(coordinates.offsetX).toBe(0);
      expect(coordinates.offsetY).toBe(0);
    });

    it('should update offset based on pan delta', () => {
      coordinates.startPan({ x: 100, y: 200 });
      coordinates.pan({ x: 150, y: 250 });
      
      expect(coordinates.offsetX).toBe(50);
      expect(coordinates.offsetY).toBe(50);
    });

    it('should calculate offset from initial offset', () => {
      coordinates.offsetX = 20;
      coordinates.offsetY = 30;
      
      coordinates.startPan({ x: 100, y: 200 });
      coordinates.pan({ x: 150, y: 250 });
      
      expect(coordinates.offsetX).toBe(70);
      expect(coordinates.offsetY).toBe(80);
    });
  });

  describe('endPan', () => {
    it('should set isPanning to false', () => {
      coordinates.isPanning = true;
      coordinates.endPan();
      
      expect(coordinates.isPanning).toBe(false);
    });

    it('should clear panStart', () => {
      coordinates.panStart = { x: 100, y: 200 };
      coordinates.endPan();
      
      expect(coordinates.panStart).toBeNull();
    });

    it('should clear panOffsetStart', () => {
      coordinates.panOffsetStart = { x: 50, y: 75 };
      coordinates.endPan();
      
      expect(coordinates.panOffsetStart).toBeNull();
    });
  });

  describe('zoom', () => {
    const point = { x: 400, y: 300 };

    it('should zoom in on negative delta', () => {
      const initialScale = coordinates.scale;
      
      coordinates.zoom(-1, point, mockCanvas);
      
      expect(coordinates.scale).toBeGreaterThan(initialScale);
      expect(coordinates.scale).toBeCloseTo(1.1);
    });

    it('should zoom out on positive delta', () => {
      const initialScale = coordinates.scale;
      
      coordinates.zoom(1, point, mockCanvas);
      
      expect(coordinates.scale).toBeLessThan(initialScale);
      expect(coordinates.scale).toBeCloseTo(0.909, 2);
    });

    it('should clamp scale to minimum 0.1', () => {
      coordinates.scale = 0.15;
      
      coordinates.zoom(1, point, mockCanvas);
      
      expect(coordinates.scale).toBeGreaterThanOrEqual(0.1);
    });

    it('should clamp scale to maximum 10', () => {
      coordinates.scale = 9;
      
      coordinates.zoom(-1, point, mockCanvas);
      
      expect(coordinates.scale).toBeLessThanOrEqual(10);
    });

    it('should maintain zoom center after multiple zoom operations', () => {
      const zoomPoint = { x: 200, y: 150 };
      
      // Get world point before zoom
      const worldBefore = coordinates.viewportToWorld(zoomPoint, mockCanvas);
      
      // Zoom in
      coordinates.zoom(-1, zoomPoint, mockCanvas);
      
      // World point should be approximately the same
      const worldAfter = coordinates.viewportToWorld(zoomPoint, mockCanvas);
      
      expect(worldAfter.x).toBeCloseTo(worldBefore.x, 0);
      expect(worldAfter.y).toBeCloseTo(worldBefore.y, 0);
    });
  });

  describe('round-trip conversions', () => {
    it('should maintain consistency after world->viewport->world', () => {
      const original = { x: 123.456, y: 789.012 };
      
      const viewport = coordinates.worldToViewport(original);
      const result = coordinates.viewportToWorld(viewport, mockCanvas);
      
      expect(result.x).toBeCloseTo(original.x);
      expect(result.y).toBeCloseTo(original.y);
    });

    it('should maintain consistency with transforms applied', () => {
      coordinates.scale = 1.5;
      coordinates.offsetX = 25;
      coordinates.offsetY = 50;
      
      const original = { x: 100, y: 200 };
      
      const viewport = coordinates.worldToViewport(original);
      const result = coordinates.viewportToWorld(viewport, mockCanvas);
      
      expect(result.x).toBeCloseTo(original.x);
      expect(result.y).toBeCloseTo(original.y);
    });
  });
});
