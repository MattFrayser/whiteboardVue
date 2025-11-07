import './style.css'
import { DrawingEngine } from './engine/DrawingEngine'
import { ObjectManager } from './managers/ObjectManager'
import { Toolbar } from './ui/Toolbar'
import { InviteManager } from './ui/InviteManager'
import { NotificationManager } from './ui/NotificationManager'
import { DialogManager } from './ui/DialogManager'
import { ConnectionStatusIndicator } from './ui/ConnectionStatusIndicator'
import { SessionManager } from './network/SessionManager'
import { VisibilitySync } from './sync/VisibilitySync'
import { appState, actions } from './stores/AppState'
import { ErrorHandler } from './utils/ErrorHandler'

// Generate temporary local userId for local-first mode
// This will be replaced with server-assigned userId when session is created
const generateLocalUserId = () => {
    return 'local-' + Math.random().toString(36).substring(2, 11)
}

const localUserId = generateLocalUserId()
console.log('[App] Starting in local mode with temporary userId:', localUserId)

// Initialize components in local-first mode (no network manager yet)
const canvas = document.getElementById('canvas') as HTMLCanvasElement
if (!canvas) throw new Error('Canvas element not found')

// Create ObjectManager first (with no network manager for local mode)
const objectManager = new ObjectManager(null)

// Create DrawingEngine with injected ObjectManager (null = local mode for network)
const engine = new DrawingEngine(canvas, objectManager, null)
const toolbar = new Toolbar(engine)

// Initialize UI components
const notificationManager = new NotificationManager()
const dialogManager = new DialogManager()
const connectionStatus = new ConnectionStatusIndicator()

// Initialize ErrorHandler with UI managers
ErrorHandler.init(notificationManager as any, dialogManager as any)

// Set temporary local userId
objectManager.setUserId(localUserId)
actions.setUserId(localUserId)

// Initialize InviteManager first (without SessionManager)
const urlParams = new URLSearchParams(window.location.search)
const roomCodeFromURL = urlParams.get('room')
const inviteManager = new InviteManager(roomCodeFromURL, notificationManager as any)

// Initialize SessionManager (manages network connections)
const sessionManager = new SessionManager(engine, notificationManager as any, dialogManager as any, inviteManager)
sessionManager.setLocalUserId(localUserId)

// Now connect SessionManager to InviteManager (circular dependency resolved)
inviteManager.setSessionManager(sessionManager)

// Initialize VisibilitySync (auto-sync when user returns to tab)
const visibilitySync = new VisibilitySync(sessionManager)

// Subscribe to tool changes to activate/deactivate tools
// (Color and brushSize are queried on-demand, no sync needed)
const unsubscribeToolChange = appState.subscribe('ui.tool', (tool) => {
    engine.setTool(tool as 'draw' | 'rectangle' | 'circle' | 'select' | 'eraser' | 'line' | 'text')
})

// Start engine
engine.start()

// Show join room prompt if URL contains room code
if (roomCodeFromURL) {
    (dialogManager as any).showJoinRoomDialog(roomCodeFromURL, async () => {
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
    // Unsubscribe from state changes
    unsubscribeToolChange()

    // Destroy all components
    engine.destroy()
    toolbar.destroy()
    notificationManager.destroy()
    dialogManager.destroy()
    connectionStatus.destroy()
    sessionManager.destroy()
    visibilitySync.destroy()
    inviteManager.destroy()

    // Clean up remaining state subscriptions
    appState.clear()
})
