import './style.css'
import { DrawingEngine } from './core/engine/DrawingEngine'
import { Toolbar } from './ui/toolbar/Toolbar'
import { InviteManager } from './ui/invite/InviteManager'
import { NotificationManager } from './ui/notifications/NotificationManager'
import { DialogManager } from './ui/dialogs/DialogManager'
import { ConnectionStatusIndicator } from './ui/status/ConnectionStatusIndicator'
import { SessionManager } from './collaboration/session/SessionManager'
import { appState, actions } from './shared/stores/AppState'
import { ErrorHandler } from './shared/utils/ErrorHandler'
import { API_BASE_URL, WS_BASE_URL } from './shared/constants'

function validateSecureConnection(): void {
    const isDevelopment = import.meta.env.DEV
    const wsUrl = WS_BASE_URL 
    const apiUrl = API_BASE_URL

    if (!isDevelopment) {
        if (!wsUrl.startsWith('wss://')) {
            throw new Error("Production must use WSS")
        }
        if (!apiUrl.startsWith('https://')) {
            throw new Error("Production must use HTTPS")
        }
    } else {
        console.warn("Development: using insecure protocols")
    }
}

// Generate temporary local userId for local-first mode
// This will be replaced with server-assigned userId when session is created
const generateLocalUserId = () => {
    return 'local-' + Math.random().toString(36).substring(2, 11)
}

validateSecureConnection()
const localUserId = generateLocalUserId()
console.log('[App] Starting in local mode with temporary userId:', localUserId)

// Initialize components in local-first mode (no network manager yet)
const canvas = document.getElementById('canvas') as HTMLCanvasElement
if (!canvas) throw new Error('Canvas element not found')

const engine = new DrawingEngine(canvas, null) // null = local mode
const toolbar = new Toolbar(engine)

// Initialize UI components
const notificationManager = new NotificationManager()
const dialogManager = new DialogManager()
const connectionStatus = new ConnectionStatusIndicator()

// Initialize ErrorHandler with UI managers
ErrorHandler.init(notificationManager, dialogManager)

// Set temporary local userId
engine.objectManager.setUserId(localUserId)
actions.setUserId(localUserId)

// Initialize InviteManager first (without SessionManager)
const urlParams = new URLSearchParams(window.location.search)
const roomCodeFromURL = urlParams.get('room')
const inviteManager = new InviteManager(roomCodeFromURL, notificationManager)

// Initialize SessionManager (manages network connections)
const sessionManager = new SessionManager(engine, notificationManager, dialogManager, inviteManager)
sessionManager.setLocalUserId(localUserId)

// Now connect SessionManager to InviteManager (circular dependency resolved)
inviteManager.setSessionManager(sessionManager)

// Sync AppState UI changes to engine
appState.subscribe('ui.tool', (tool) => {
    engine.setTool(tool as 'draw' | 'rectangle' | 'circle' | 'select' | 'eraser' | 'line' | 'text')
})

appState.subscribe('ui.color', (color) => {
    engine.currentColor = color as string
})

appState.subscribe('ui.brushSize', (size) => {
    engine.currentWidth = size as number
})

// Start engine
engine.start()

// Show join room prompt if URL contains room code
if (roomCodeFromURL) {
    dialogManager.showJoinRoomDialog(roomCodeFromURL, async () => {
        try {
            await sessionManager.joinSession(roomCodeFromURL)
        } catch (error) {
            // SessionManager already handles error display, just log here
            ErrorHandler.silent(error as Error, {
                context: 'App',
                metadata: { roomCode: roomCodeFromURL }
            })
        }
    }, () => {
        console.log('[App] User chose to stay in local mode')
    })
}

// Clean up on exit
window.addEventListener('beforeunload', () => {
    engine.destroy()
    toolbar.destroy()
    notificationManager.destroy()
    dialogManager.destroy()
    connectionStatus.destroy()
    sessionManager.destroy()
    appState.clear() // Clean up state subscriptions
})
