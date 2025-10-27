/**
 * Douglas-Peucker line simplification algorithm
 * Recursively divides polyline, keeping points that deviate from straight
 * lines by more than epsilon (perpendicular distance threshold)
 */
export function douglasPeucker(points, epsilon, minPoints = 3) {
    if (!points || points.length <= minPoints) {
        return points
    }

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

    if (maxDistance > epsilon) {
        // Set minPoints=0 for recursion to allow maximum simplification;
        // we'll enforce the minimum on the final combined result
        const leftSegment = douglasPeucker(points.slice(0, maxIndex + 1), epsilon, 0)
        const rightSegment = douglasPeucker(points.slice(maxIndex), epsilon, 0)

        // Concatenate, removing duplicate point at maxIndex
        const result = leftSegment.slice(0, -1).concat(rightSegment)

        if (result.length < minPoints) {
            return preserveMinimumPoints(points, minPoints)
        }

        return result
    } else {
        if (minPoints > 2) {
            return preserveMinimumPoints(points, minPoints)
        }
        return [start, end]
    }
}

// Uses cross product formula: |area of parallelogram| / base length
function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y

    // Handle case where line segment is actually a point
    if (dx === 0 && dy === 0) {
        // Fall back to simple Euclidean distance
        return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2))
    }

    // Cross product gives twice the area of triangle formed by the three points
    // Formula: |(x2-x1)(y1-y0) - (x1-x0)(y2-y1)| / sqrt((x2-x1)² + (y2-y1)²)
    const numerator = Math.abs(
        dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
    )
    const denominator = Math.sqrt(dx * dx + dy * dy)

    return numerator / denominator
}

// Fallback when simplification would reduce points below minimum
// Uses uniform sampling to maintain stroke shape distribution
function preserveMinimumPoints(points, minPoints) {
    if (points.length <= minPoints) {
        return points
    }

    const result = [points[0]]

    // Calculate interval for uniform sampling
    // Example: 10 points, minPoints=3 → interval=4.5 → samples at indices [0, 4.5≈5, 9]
    const interval = (points.length - 1) / (minPoints - 1)

    for (let i = 1; i < minPoints - 1; i++) {
        const index = Math.round(i * interval)
        result.push(points[index])
    }

    result.push(points[points.length - 1])

    return result
}

export function simplifyStroke(points, strokeWidth, minPoints = 3) {
    if (!points || points.length <= minPoints) {
        return points
    }

    // Scale tolerance with stroke width: thicker strokes hide more deviation
    // 0.5x multiplier means we allow simplification up to half the stroke width
    const epsilon = strokeWidth * 0.5

    return douglasPeucker(points, epsilon, minPoints)
}
