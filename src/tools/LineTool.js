import { Tool } from './Tool'
import { Line } from '../objects/Line'

export class LineTool extends Tool {
    constructor(engine) {
        super(engine)
        this.isEditing = false
        this.currentText = null
        this.inputElement = null
    }

    onMouseDown(worldPos, e) {}

    createTextInput(worldPos) {}

    finishEditing() {}

    cancelEditing() {}

    cleanup() {}

    deactivate(){}

}
