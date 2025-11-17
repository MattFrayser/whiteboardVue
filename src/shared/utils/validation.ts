/**
 * Minimal frontend validation utilities
 * Focused on crash prevention and offline mode, not security (backend handles that)
 */

// UI constraints (stricter than backend for UX)
const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = 25;

// Backend limits (for offline/localStorage mode)
const MIN_COORDINATE = -1000000;
const MAX_COORDINATE = 1000000;

const DEFAULT_COLOR = '#000000';
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Clamps brush size to valid range, handling NaN/Infinity
 */
export function clampBrushSize(size: number): number {
  if (!isFinite(size) || isNaN(size)) {
    return MIN_BRUSH_SIZE;
  }
  return Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, Math.floor(size)));
}

/**
 * Clamps coordinate to valid range, handling NaN/Infinity
 */
export function clampCoordinate(coord: number): number {
  if (!isFinite(coord) || isNaN(coord)) {
    return 0;
  }
  return Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, coord));
}

/**
 * Validates hex color format, returns default on invalid
 */
export function validateColor(color: string): string {
  if (typeof color !== 'string' || !HEX_COLOR_REGEX.test(color)) {
    return DEFAULT_COLOR;
  }
  return color;
}

/**
 * Sanitizes room code to prevent XSS injection
 * Room codes should only contain alphanumeric characters
 * Matches backend generation pattern: 6-10 uppercase alphanumeric
 */
export function sanitizeRoomCode(code: string): string {
  if (typeof code !== 'string') {
    return 'INVALID';
  }

  // Strip all non-alphanumeric characters and limit length
  const sanitized = code.replace(/[^A-Z0-9]/gi, '').substring(0, 10).toUpperCase();

  // Return sanitized code or fallback if empty
  return sanitized || 'INVALID';
}
