import './style.css'
import { EventBus } from './utils/EventBus'
import { DrawingEngine } from './engine/DrawingEngine'
import { Toolbar } from './ui/Toolbar'
import { WebSocketManager } from './network/WebSocketManager'
import { InviteManager } from './ui/InviteManager'

// Create shared event bus
const eventBus = new EventBus()

// Initialize components with event bus
const canvas = document.getElementById('canvas')
const engine = new DrawingEngine(canvas, eventBus)
const toolbar = new Toolbar(eventBus)
const wsManager = new WebSocketManager(eventBus)

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

// Listen to network status events
eventBus.subscribe('network:statusChanged', ({ status }) => {
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
wsManager.connect(roomCode)

// Start engine
engine.start()

// Clean up on exit
window.addEventListener('beforeunload', () => {
    engine.destroy()
    eventBus.clear() // Clean up all listeners
})
