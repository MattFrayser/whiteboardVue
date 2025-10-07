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
    
    onMouseDown(worldPos, e) {}
    onMouseMove(worldPos, e) {}
    onMouseUp(worldPos, e) {}
    renderPreview(ctx) {}
}
