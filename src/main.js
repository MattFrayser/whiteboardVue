import './style.css'
import { DrawingEngine } from './core/DrawingEngine'
import { Toolbar } from './ui/Toolbar'
import { WebSocketManager } from './network/WebSocketManager'
import { InviteManager } from './ui/InviteManager'
// init
const canvas = document.getElementById('canvas')
const engine = new DrawingEngine(canvas)
const toolbar = new Toolbar(engine)
engine.wsManager = new WebSocketManager(engine)

// get or create roomCode
const urlParams = new URLSearchParams(window.location.search)
let roomCode = urlParams.get('room')
if (!roomCode) {
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    window.history.replaceState({}, '', `?room=${roomCode}`)
}

// Toolbar
engine.setToolbar(toolbar)
toolbar.updateUndoRedoButtons()

// Invite button
new InviteManager(roomCode)

// Connection status
const statusIndicator = document.getElementById('connection-status')
const statusText = statusIndicator.querySelector('.status-text')

engine.wsManager.setStatusCallback((status) => {
    statusIndicator.className = `connection-status status-${status}`

    const statusLabels = {
        'connected': 'Connected',
        'connecting': 'Connecting...',
        'disconnected': 'Connecting...',
        'error': 'Failed'
    }
    statusText.textContent = statusLabels[status] || status
})

engine.wsManager.connect(roomCode)

engine.start()

