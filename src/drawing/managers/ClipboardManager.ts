import type { DrawingObjectData } from '../../shared/types'
import type { DrawingObject } from '../../drawing/objects/DrawingObject'

/**
 * Manages copy/paste/cut operations for objects
 */
export class ClipboardManager {
    private clipboard: DrawingObjectData[]

    constructor() {
        this.clipboard = []
    }

    copy(objects: DrawingObject[]): void {
        if (objects.length === 0) {
            return
        }
        this.clipboard = objects.map(obj => obj.toJSON().data)
    }  

    getClipboard(): DrawingObjectData[] {
        return this.clipboard
    }

    hasContent(): boolean {
        return this.clipboard.length > 0
    }

    clear(): void {
        this.clipboard = []
    }
}
