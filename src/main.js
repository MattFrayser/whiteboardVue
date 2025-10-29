import './style.css'
import { DrawingEngine } from './engine/DrawingEngine'
import { Toolbar } from './ui/Toolbar'
import { WebSocketManager } from './network/WebSocketManager'
import { InviteManager } from './ui/InviteManager'
import { appState } from './stores/AppState'

// Create network manager with message handler
const networkManager = new WebSocketManager((message) => {
    // Messages will be handled by engine's message handler
})

// Initialize components
const canvas = document.getElementById('canvas')
const engine = new DrawingEngine(canvas, networkManager)
const toolbar = new Toolbar(engine)

// Sync AppState UI changes to engine
appState.subscribe('ui.tool', (tool) => {
    engine.setTool(tool)
})

appState.subscribe('ui.color', (color) => {
    engine.currentColor = color
})

appState.subscribe('ui.brushSize', (size) => {
    engine.currentWidth = size
})

// get or create roomCode
const urlParams = new URLSearchParams(window.location.search)
let roomCode = urlParams.get('room')
if (!roomCode) {
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    window.history.replaceState({}, '', `?room=${roomCode}`)
}

// Invite button
new InviteManager(roomCode)

// Connection status
const statusIndicator = document.getElementById('connection-status')
const statusText = statusIndicator.querySelector('.status-text')

// Subscribe to network status changes from state
appState.subscribe('network.status', (status) => {
    statusIndicator.className = `connection-status status-${status}`

    const statusLabels = {
        connected: 'Connected',
        connecting: 'Connecting...',
        disconnected: 'Connecting...',
        error: 'Failed',
    }
    statusText.textContent = statusLabels[status] || status
})

// Connect to WebSocket
networkManager.connect(roomCode)

// Start engine
engine.start()

// Clean up on exit
window.addEventListener('beforeunload', () => {
    engine.destroy()
    toolbar.destroy()
    appState.clear() // Clean up state subscriptions
})
