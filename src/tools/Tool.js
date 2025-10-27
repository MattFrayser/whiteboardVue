export class Tool {
    constructor(engine) {
        this.engine = engine
        this.active = false
    }

    activate() {
        this.active = true
    }

    deactivate() {
        this.active = false
    }

    onMouseDown(_worldPos, _e) {}
    onMouseMove(_worldPos, _e) {}
    onMouseUp(_worldPos, _e) {}
    renderPreview(_ctx) {}
}
