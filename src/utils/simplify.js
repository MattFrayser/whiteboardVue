/**
 * Douglas-Peucker line simplification algorithm
 * Reduces the number of points in a polyline while preserving its shape
 *
 * @param {Array<{x: number, y: number}>} points - Array of points to simplify
 * @param {number} epsilon - Maximum distance threshold for point removal
 * @param {number} minPoints - Minimum number of points to preserve (default: 3)
 * @returns {Array<{x: number, y: number}>} Simplified array of points
 */
export function douglasPeucker(points, epsilon, minPoints = 3) {
    if (!points || points.length <= minPoints) {
        return points
    }

    // Find the point with maximum distance from the line segment
    let maxDistance = 0
    let maxIndex = 0
    const start = points[0]
    const end = points[points.length - 1]

    for (let i = 1; i < points.length - 1; i++) {
        const distance = perpendicularDistance(points[i], start, end)
        if (distance > maxDistance) {
            maxDistance = distance
            maxIndex = i
        }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (maxDistance > epsilon) {
        // Recursively simplify both segments
        const leftSegment = douglasPeucker(points.slice(0, maxIndex + 1), epsilon, 0)
        const rightSegment = douglasPeucker(points.slice(maxIndex), epsilon, 0)

        // Concatenate results, removing duplicate middle point
        const result = leftSegment.slice(0, -1).concat(rightSegment)

        // Ensure we meet minimum points requirement
        if (result.length < minPoints) {
            return preserveMinimumPoints(points, minPoints)
        }

        return result
    } else {
        // If all points are within epsilon, just keep endpoints
        // But ensure we meet minimum points requirement
        if (minPoints > 2) {
            return preserveMinimumPoints(points, minPoints)
        }
        return [start, end]
    }
}

/**
 * Calculate perpendicular distance from a point to a line segment
 *
 * @param {Object} point - Point to measure distance from
 * @param {Object} lineStart - Start point of line segment
 * @param {Object} lineEnd - End point of line segment
 * @returns {number} Perpendicular distance
 */
function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y

    // Handle case where line segment is actually a point
    if (dx === 0 && dy === 0) {
        return Math.sqrt(
            Math.pow(point.x - lineStart.x, 2) +
            Math.pow(point.y - lineStart.y, 2)
        )
    }

    // Calculate perpendicular distance using cross product
    const numerator = Math.abs(
        dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
    )
    const denominator = Math.sqrt(dx * dx + dy * dy)

    return numerator / denominator
}

/**
 * Preserve a minimum number of points by sampling evenly
 * Used when simplification would reduce points below minimum
 *
 * @param {Array<{x: number, y: number}>} points - Original points array
 * @param {number} minPoints - Minimum number of points to preserve
 * @returns {Array<{x: number, y: number}>} Points array with at least minPoints
 */
function preserveMinimumPoints(points, minPoints) {
    if (points.length <= minPoints) {
        return points
    }

    const result = [points[0]] // Always include first point

    // Calculate interval for sampling
    const interval = (points.length - 1) / (minPoints - 1)

    // Sample points at regular intervals
    for (let i = 1; i < minPoints - 1; i++) {
        const index = Math.round(i * interval)
        result.push(points[index])
    }

    // Always include last point
    result.push(points[points.length - 1])

    return result
}

/**
 * Simplify a stroke's points based on its width
 * Automatically calculates epsilon based on stroke width
 *
 * @param {Array<{x: number, y: number}>} points - Array of points to simplify
 * @param {number} strokeWidth - Width of the stroke
 * @param {number} minPoints - Minimum number of points to preserve (default: 3)
 * @returns {Array<{x: number, y: number}>} Simplified array of points
 */
export function simplifyStroke(points, strokeWidth, minPoints = 3) {
    // Don't simplify very short strokes
    if (!points || points.length <= minPoints) {
        return points
    }

    // Calculate epsilon based on stroke width
    // Thicker strokes can tolerate more simplification
    const epsilon = strokeWidth * 0.5

    return douglasPeucker(points, epsilon, minPoints)
}
