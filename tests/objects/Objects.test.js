import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Rectangle } from '../../src/objects/Rectangle';
import { Circle } from '../../src/objects/Circle';
import { Stroke } from '../../src/objects/Stroke';
import { Line } from '../../src/objects/Line';
import { Text } from '../../src/objects/Text';

describe('Rectangle', () => {
  let rectangle;

  beforeEach(() => {
    rectangle = new Rectangle('rect-1', {
      x1: 10,
      y1: 20,
      x2: 110,
      y2: 120,
      color: '#000000',
      width: 2
    });
  });

  describe('getBounds', () => {
    it('should return correct bounds', () => {
      const bounds = rectangle.getBounds();

      expect(bounds).toEqual({
        x: 10,
        y: 20,
        width: 100,
        height: 100
      });
    });

    it('should handle inverted coordinates', () => {
      rectangle.data.x1 = 110;
      rectangle.data.x2 = 10;
      rectangle.data.y1 = 120;
      rectangle.data.y2 = 20;

      const bounds = rectangle.getBounds();

      expect(bounds).toEqual({
        x: 10,
        y: 20,
        width: 100,
        height: 100
      });
    });
  });

  describe('move', () => {
    it('should move all coordinates', () => {
      rectangle.move(50, 30);

      expect(rectangle.data.x1).toBe(60);
      expect(rectangle.data.y1).toBe(50);
      expect(rectangle.data.x2).toBe(160);
      expect(rectangle.data.y2).toBe(150);
    });
  });

  describe('applyBounds', () => {
    it('should update coordinates to new bounds', () => {
      rectangle.applyBounds({
        x: 50,
        y: 60,
        width: 200,
        height: 150
      });

      expect(rectangle.data.x1).toBe(50);
      expect(rectangle.data.y1).toBe(60);
      expect(rectangle.data.x2).toBe(250);
      expect(rectangle.data.y2).toBe(210);
    });
  });

  describe('render', () => {
    let mockCtx;

    beforeEach(() => {
      mockCtx = {
        strokeStyle: '',
        lineWidth: 0,
        fillStyle: '',
        strokeRect: vi.fn(),
        fillRect: vi.fn()
      };
    });

    it('should stroke rectangle outline', () => {
      rectangle.render(mockCtx);

      expect(mockCtx.strokeRect).toHaveBeenCalledWith(10, 20, 100, 100);
    });

    it('should fill rectangle if fill color provided', () => {
      rectangle.data.fill = '#FF0000';

      rectangle.render(mockCtx);

      expect(mockCtx.fillRect).toHaveBeenCalledWith(10, 20, 100, 100);
      expect(mockCtx.fillStyle).toBe('#FF0000');
    });

    it('should render selection if selected', () => {
      rectangle.selected = true;
      vi.spyOn(rectangle, 'renderSelection').mockImplementation(() => {});

      rectangle.render(mockCtx);

      expect(rectangle.renderSelection).toHaveBeenCalledWith(mockCtx);
    });
  });
});

describe('Circle', () => {
  let circle;

  beforeEach(() => {
    circle = new Circle('circle-1', {
      x1: 100,
      y1: 100,
      x2: 150,
      y2: 100,
      color: '#000000',
      width: 2
    });
  });

  describe('getBounds', () => {
    it('should return bounding box of circle', () => {
      const bounds = circle.getBounds();

      expect(bounds).toEqual({
        x: 50,
        y: 50,
        width: 100,
        height: 100
      });
    });

    it('should handle diagonal radius point', () => {
      circle.data.x2 = 130;
      circle.data.y2 = 140;

      const bounds = circle.getBounds();
      const radius = Math.sqrt(30 * 30 + 40 * 40);

      expect(bounds.x).toBeCloseTo(100 - radius);
      expect(bounds.y).toBeCloseTo(100 - radius);
      expect(bounds.width).toBeCloseTo(radius * 2);
      expect(bounds.height).toBeCloseTo(radius * 2);
    });
  });

  describe('containsPoint', () => {
    it('should return true for point inside circle', () => {
      expect(circle.containsPoint({ x: 100, y: 100 })).toBe(true);
      expect(circle.containsPoint({ x: 120, y: 100 })).toBe(true);
    });

    it('should return false for point outside circle', () => {
      expect(circle.containsPoint({ x: 200, y: 100 })).toBe(false);
    });

    it('should return true for point on edge', () => {
      expect(circle.containsPoint({ x: 150, y: 100 })).toBe(true);
    });
  });

  describe('move', () => {
    it('should move center and radius point', () => {
      circle.move(20, 30);

      expect(circle.data.x1).toBe(120);
      expect(circle.data.y1).toBe(130);
      expect(circle.data.x2).toBe(170);
      expect(circle.data.y2).toBe(130);
    });
  });

  describe('applyBounds', () => {
    it('should maintain circular shape with corner handles', () => {
      circle.applyBounds({ x: 0, y: 0, width: 80, height: 120 }, 4);

      const radius = Math.max(80, 120) / 2;
      expect(circle.data.x2 - circle.data.x1).toBeCloseTo(radius);
    });

    it('should use changed dimension for side handles', () => {
      circle.applyBounds({ x: 0, y: 0, width: 80, height: 100 }, 3); // East handle

      const radius = 80 / 2;
      expect(circle.data.x2 - circle.data.x1).toBeCloseTo(radius);
    });

    it('should lock opposite corner when resizing from NW', () => {
      circle.applyBounds({ x: 20, y: 20, width: 60, height: 60 }, 0);

      const radius = 60 / 2;
      expect(circle.data.x1).toBeCloseTo(80 - radius);
      expect(circle.data.y1).toBeCloseTo(80 - radius);
    });
  });

  describe('render', () => {
    let mockCtx;

    beforeEach(() => {
      mockCtx = {
        strokeStyle: '',
        lineWidth: 0,
        fillStyle: '',
        beginPath: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn()
      };
    });

    it('should draw circle arc', () => {
      circle.render(mockCtx);

      expect(mockCtx.arc).toHaveBeenCalledWith(100, 100, 50, 0, Math.PI * 2);
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should fill circle if fill color provided', () => {
      circle.data.fill = '#FF0000';

      circle.render(mockCtx);

      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.fillStyle).toBe('#FF0000');
    });
  });
});

describe('Stroke', () => {
  let stroke;

  beforeEach(() => {
    stroke = new Stroke('stroke-1', {
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 20 },
        { x: 90, y: 30 }
      ],
      color: '#000000',
      width: 5
    });
  });

  describe('getBounds', () => {
    it('should return bounding box of all points', () => {
      const bounds = stroke.getBounds();

      expect(bounds.x).toBeCloseTo(7.5);
      expect(bounds.y).toBeCloseTo(7.5);
      expect(bounds.width).toBeCloseTo(85);
      expect(bounds.height).toBeCloseTo(25);
    });

    it('should return zero bounds for empty stroke', () => {
      stroke.data.points = [];

      const bounds = stroke.getBounds();

      expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('should include width padding', () => {
      stroke.data.width = 10;

      const bounds = stroke.getBounds();

      expect(bounds.x).toBe(5);
      expect(bounds.y).toBe(5);
    });
  });

  describe('move', () => {
    it('should move all points', () => {
      stroke.move(20, 30);

      expect(stroke.data.points[0]).toEqual({ x: 30, y: 40 });
      expect(stroke.data.points[1]).toEqual({ x: 70, y: 50 });
      expect(stroke.data.points[2]).toEqual({ x: 110, y: 60 });
    });
  });

  describe('applyBounds', () => {
    it('should scale points to new bounds', () => {
      const oldBounds = stroke.getBounds();
      
      stroke.applyBounds({
        x: 0,
        y: 0,
        width: oldBounds.width * 2,
        height: oldBounds.height * 2
      });

      expect(stroke.data.points[0].x).toBeCloseTo(5);
      expect(stroke.data.points[0].y).toBeCloseTo(5);
    });
  });

  describe('render', () => {
    let mockCtx;

    beforeEach(() => {
      mockCtx = {
        strokeStyle: '',
        lineWidth: 0,
        lineCap: '',
        lineJoin: '',
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn()
      };
    });

    it('should not render if no points', () => {
      stroke.data.points = [];

      stroke.render(mockCtx);

      expect(mockCtx.moveTo).not.toHaveBeenCalled();
    });

    it('should use quadratic curves for smooth lines', () => {
      stroke.render(mockCtx);

      expect(mockCtx.quadraticCurveTo).toHaveBeenCalled();
    });

    it('should move to first point', () => {
      stroke.render(mockCtx);

      expect(mockCtx.moveTo).toHaveBeenCalledWith(10, 10);
    });
  });
});

describe('Line', () => {
  let line;

  beforeEach(() => {
    line = new Line('line-1', {
      x1: 10,
      y1: 20,
      x2: 110,
      y2: 120,
      color: '#000000',
      width: 5
    });
  });

  describe('getBounds', () => {
    it('should return bounding box with padding', () => {
      const bounds = line.getBounds();

      expect(bounds.x).toBe(7.5);
      expect(bounds.y).toBe(17.5);
      expect(bounds.width).toBe(105);
      expect(bounds.height).toBe(105);
    });

    it('should handle reversed coordinates', () => {
      line.data.x1 = 110;
      line.data.x2 = 10;

      const bounds = line.getBounds();

      expect(bounds.x).toBe(7.5);
      expect(bounds.width).toBe(105);
    });
  });

  describe('containsPoint', () => {
    it('should return true for point on line', () => {
      expect(line.containsPoint({ x: 60, y: 70 })).toBe(true);
    });

    it('should return false for point far from line', () => {
      expect(line.containsPoint({ x: 200, y: 200 })).toBe(false);
    });

    it('should account for line width', () => {
      line.data.width = 20;

      expect(line.containsPoint({ x: 60, y: 85 })).toBe(true);
    });
  });

  describe('move', () => {
    it('should move both endpoints', () => {
      line.move(30, 40);

      expect(line.data.x1).toBe(40);
      expect(line.data.y1).toBe(60);
      expect(line.data.x2).toBe(140);
      expect(line.data.y2).toBe(160);
    });
  });

  describe('applyBounds', () => {
    it('should scale line to new bounds', () => {
      line.applyBounds({ x: 0, y: 0, width: 200, height: 200 });

      expect(line.data.x1).toBeCloseTo(0);
      expect(line.data.y1).toBeCloseTo(0);
      expect(line.data.x2).toBeCloseTo(200);
      expect(line.data.y2).toBeCloseTo(200);
    });
  });

  describe('render', () => {
    let mockCtx;

    beforeEach(() => {
      mockCtx = {
        strokeStyle: '',
        lineWidth: 0,
        lineCap: '',
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        setLineDash: vi.fn()
      };
    });

    it('should draw line from start to end', () => {
      line.render(mockCtx);

      expect(mockCtx.moveTo).toHaveBeenCalledWith(10, 20);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(110, 120);
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should use dashed line if specified', () => {
      line.data.dashed = true;

      line.render(mockCtx);

      expect(mockCtx.setLineDash).toHaveBeenCalledWith([10, 5]);
    });

    it('should reset dash after rendering', () => {
      line.data.dashed = true;

      line.render(mockCtx);

      expect(mockCtx.setLineDash).toHaveBeenCalledWith([]);
    });
  });
});

describe('Text', () => {
  let text;

  beforeEach(() => {
    // Mock canvas context for Text measurements
    const mockContext = {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      textBaseline: '',
      fillText: vi.fn(),
      measureText: vi.fn(function(text) {
        // Extract font size from the font string (e.g., "24px Arial")
        const fontSizeMatch = this.font.match(/(\d+)px/);
        const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) : 16;
        return {
          width: text.length * (fontSize / 2), // Width scales with font size
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

    text = new Text('text-1', {
      text: 'Hello',
      x: 100,
      y: 100,
      color: '#000000',
      fontSize: 24,
      fontFamily: 'Arial'
    });
  });

  describe('measureBounds', () => {
    it('should measure text dimensions', () => {
      expect(text.textWidth).toBeGreaterThan(0);
      expect(text.textHeight).toBe(24);
    });
  });

  describe('getBounds', () => {
    it('should return text bounding box', () => {
      const bounds = text.getBounds();

      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(76); // y - fontSize
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeCloseTo(28.8); // fontSize * 1.2
    });
  });

  describe('move', () => {
    it('should move text position', () => {
      text.move(50, 30);

      expect(text.data.x).toBe(150);
      expect(text.data.y).toBe(130);
    });
  });

  describe('applyBounds', () => {
    it('should scale font size proportionally', () => {
      const oldBounds = text.getBounds();
      
      text.applyBounds({
        x: 100,
        y: 100,
        width: oldBounds.width,
        height: oldBounds.height * 2
      });

      expect(text.data.fontSize).toBe(48);
    });

    it('should not allow font size below 8', () => {
      text.applyBounds({
        x: 100,
        y: 100,
        width: 10,
        height: 1
      });

      expect(text.data.fontSize).toBeGreaterThanOrEqual(8);
    });

    it('should remeasure after scaling', () => {
      const oldWidth = text.textWidth;
      
      text.applyBounds({
        x: 100,
        y: 100,
        width: 200,
        height: 50
      });

      expect(text.textWidth).not.toBe(oldWidth);
    });
  });

  describe('setText', () => {
    it('should update text and remeasure', () => {
      const oldWidth = text.textWidth;
      
      text.setText('Hello World');

      expect(text.data.text).toBe('Hello World');
      expect(text.textWidth).toBeGreaterThan(oldWidth);
    });
  });

  describe('getResizeHandles', () => {
    it('should return only 4 corner handles', () => {
      const handles = text.getResizeHandles();

      expect(handles).toHaveLength(4);
      expect(handles[0].cursor).toBe('nw-resize');
      expect(handles[1].cursor).toBe('ne-resize');
      expect(handles[2].cursor).toBe('se-resize');
      expect(handles[3].cursor).toBe('sw-resize');
    });
  });

  describe('render', () => {
    let mockCtx;

    beforeEach(() => {
      mockCtx = {
        font: '',
        fillStyle: '',
        textBaseline: '',
        fillText: vi.fn()
      };
    });

    it('should render text at position', () => {
      text.render(mockCtx);

      expect(mockCtx.fillText).toHaveBeenCalledWith('Hello', 100, 100);
    });

    it('should apply font settings', () => {
      text.render(mockCtx);

      expect(mockCtx.font).toContain('24px');
      expect(mockCtx.font).toContain('Arial');
      expect(mockCtx.fillStyle).toBe('#000000');
    });

    it('should apply bold style if specified', () => {
      text.data.bold = true;

      text.render(mockCtx);

      expect(mockCtx.font).toContain('bold');
    });

    it('should apply italic style if specified', () => {
      text.data.italic = true;

      text.render(mockCtx);

      expect(mockCtx.font).toContain('italic');
    });
  });
});
