import { Tool } from "./Tool";

export class SelectTool extends Tool {
    constructor(engine) {
        super(engine)
        this.dragStart = null
        this.isDragging = null
        this.dragOffset = null
    }

    onMouseDown(worldPos, e) {
        const object = this.engine.objectManager.getObjectAt(worldPos)

        if (object) {
            if (!object.selected) {
                this.engine.objectManager.selectObject(object, e.shiftKey)
            }
            this.dragStart = worldPos
            this.isDragging = true
        } else {
            this.engine.objectManager.clearSelection()
        }

        this.engine.render()
}

    onMouseMove(worldPos, e) {
        if (this.isDragging && this.dragStart) {
            const dx = worldPos.x - this.dragStart.x
            const dy = worldPos.y - this.dragStart.y

            this.engine.objectManager.selectedObjects.forEach(obj => {
                obj.move(dx, dy)
            })

            this.dragStart = worldPos
            this.engine.render()
        }
    }

    onMouseUp(worldPos, e) {
        if (this.isDragging) {
            this.engine.objectManager.saveState()
        }
        this.isDragging = false
        this.dragStart = null
    }

}
