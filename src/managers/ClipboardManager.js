/**
 * Manages copy/paste/cut operations for objects
 */
export class ClipboardManager {
    constructor() {
        this.clipboard = []
    }

    /**
     * Copy objects to clipboard
     */
    copy(objects) {
        if (objects.length === 0) {
            return
        }
        this.clipboard = objects.map(obj => obj.toJSON())
    }

    /**
     * Get clipboard contents
     */
    getClipboard() {
        return this.clipboard
    }

    /**
     * Check if clipboard has content
     */
    hasContent() {
        return this.clipboard.length > 0
    }

    /**
     * Clear clipboard
     */
    clear() {
        this.clipboard = []
    }
}
