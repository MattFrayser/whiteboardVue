import type { DrawingObjectData } from '../../shared/types'
import type { DrawingObject } from '../../drawing/objects/DrawingObject'

/**
 *  copy/paste/cut operations for objects
 */
export class ClipboardManager {
    private clipboard: Array<{ id: string; type: string; data: DrawingObjectData; zIndex: number }>

    constructor() {
        this.clipboard = []
    }

    copy(objects: DrawingObject[]): void {
        if (objects.length === 0) {
            return
        }
        this.clipboard = objects.map(obj => obj.toJSON())
    }
 
    getClipboard(): Array<{ id: string; type: string; data: DrawingObjectData; zIndex: number }> {
        return this.clipboard
    }

    hasContent(): boolean {
        return this.clipboard.length > 0
    }

    clear(): void {
        this.clipboard = []
    }
}
