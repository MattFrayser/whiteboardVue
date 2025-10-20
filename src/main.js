import './style.css'
import { DrawingEngine } from './core/DrawingEngine'
import { Toolbar } from './ui/Toolbar'
import { WebSocketManager } from './network/WebSocketManager'

// init
const canvas = document.getElementById('canvas')
const engine = new DrawingEngine(canvas)
const toolbar = new Toolbar(engine)
engine.wsManager = new WebSocketManager(engine)

engine.setToolbar(toolbar)
toolbar.updateUndoRedoButtons()

// get or create roomCode
const urlParams = new URLSearchParams(window.location.search)
let roomCode = urlParams.get('room')
if (!roomCode) {
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    window.history.replaceState({}, '', `?room=${roomCode}`)
}

engine.wsManager.connect(roomCode)

engine.start()

