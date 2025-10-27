/**
 * Manages dirty rectangle rendering optimization
 */
export class RenderOptimizer {
    constructor() {
        this.dirtyRegions = []
        this.dirtyThreshold = 0.3 // % canvas area before switching to full redraw
        this.forceFullRedraw = false
    }

    /**
     * Mark a region as dirty (needs redrawing)
     * Bounds should be in world coordinates
     */
    markDirty(bounds, padding = 10) {
        if (!bounds || bounds.width === 0 || bounds.height === 0) {
            return
        }

        // Expand bounds for stroke width/anti-aliasing
        const expanded = {
            x: bounds.x - padding,
            y: bounds.y - padding,
            width: bounds.width + padding * 2,
            height: bounds.height + padding * 2,
        }

        this.dirtyRegions.push(expanded)
    }

    /**
     * Clear all dirty regions
     */
    clearDirtyRegions() {
        this.dirtyRegions = []
        this.forceFullRedraw = false
    }

    /**
     * Merge overlapping dirty regions into a single bounding box
     */
    mergeDirtyRegions() {
        if (this.dirtyRegions.length === 0) {
            return []
        }
        if (this.dirtyRegions.length === 1) {
            return this.dirtyRegions
        }

        // Simple approach: compute single bounding box
        let minX = Infinity,
            minY = Infinity
        let maxX = -Infinity,
            maxY = -Infinity

        for (const region of this.dirtyRegions) {
            minX = Math.min(minX, region.x)
            minY = Math.min(minY, region.y)
            maxX = Math.max(maxX, region.x + region.width)
            maxY = Math.max(maxY, region.y + region.height)
        }

        return [
            {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
            },
        ]
    }

    /**
     * Check if we should use full redraw instead of dirty rect optimization
     */
    shouldUseFullRedraw(coordinates, canvas) {
        if (this.forceFullRedraw) {
            return true
        }
        if (this.dirtyRegions.length === 0) {
            return false
        }

        const merged = this.mergeDirtyRegions()
        if (merged.length === 0) {
            return false
        }

        // Calculate dirty area in viewport coordinates
        const { scale } = coordinates
        const dirtyViewportArea = merged.reduce((total, region) => {
            const vw = region.width * scale
            const vh = region.height * scale
            return total + vw * vh
        }, 0)

        const canvasArea = canvas.width * canvas.height
        return dirtyViewportArea / canvasArea > this.dirtyThreshold
    }
}
