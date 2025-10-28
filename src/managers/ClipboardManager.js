/**
 * Manages copy/paste/cut operations for objects
 */
export class ClipboardManager {
    constructor() {
        this.clipboard = []
    }


    copy(objects) {
        if (objects.length === 0) {
            return
        }
        this.clipboard = objects.map(obj => obj.toJSON())
    }


    getClipboard() {
        return this.clipboard
    }


    hasContent() {
        return this.clipboard.length > 0
    }


    clear() {
        this.clipboard = []
    }
}
