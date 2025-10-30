import './style.css'
import { DrawingEngine } from './engine/DrawingEngine'
import { Toolbar } from './ui/Toolbar'
import { WebSocketManager } from './network/WebSocketManager'
import { InviteManager } from './ui/InviteManager'
import { appState, actions } from './stores/AppState'

// Generate temporary local userId for local-first mode
// This will be replaced with server-assigned userId when session is created
const generateLocalUserId = () => {
    return 'local-' + Math.random().toString(36).substring(2, 11)
}

const localUserId = generateLocalUserId()
console.log('[App] Starting in local mode with temporary userId:', localUserId)

// Initialize components in local-first mode (no network manager yet)
const canvas = document.getElementById('canvas')
const engine = new DrawingEngine(canvas, null) // null = local mode
const toolbar = new Toolbar(engine)

// Set temporary local userId
engine.objectManager.setUserId(localUserId)
actions.setUserId(localUserId)

// Network manager will be created when user clicks "Start Session"
let networkManager = null

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

// Check if joining existing room via URL
const urlParams = new URLSearchParams(window.location.search)
const roomCodeFromURL = urlParams.get('room')

// Initialize InviteManager (will handle local vs networked state)
const inviteManager = new InviteManager(roomCodeFromURL)

// If there's a room code in URL, we'll show join prompt after initialization
// Otherwise, stay in local mode

// Connection status
const statusIndicator = document.getElementById('connection-status')
const statusText = statusIndicator.querySelector('.status-text')

// Subscribe to network status changes from state
appState.subscribe('network.status', (status) => {
    statusIndicator.className = `connection-status status-${status}`

    const statusLabels = {
        local: 'Local Mode',
        connected: 'Connected',
        connecting: 'Connecting...',
        disconnected: 'Connecting...',
        error: 'Failed',
    }
    statusText.textContent = statusLabels[status] || status
})

// Note: Network connection will be established when user clicks "Start Session"
// or when joining a room from URL (handled by InviteManager)

// Sync room state when tab becomes visible or gains focus
// Debounce sync requests to prevent spam from rapid events (Excalidraw-inspired approach)
let syncDebounceTimer = null
const SYNC_DEBOUNCE_MS = 1000 // Group rapid events within 1 second

function requestSyncDebounced() {
    clearTimeout(syncDebounceTimer)
    syncDebounceTimer = setTimeout(() => {
        if (networkManager && networkManager.isConnected()) {
            console.log('[Sync] Requesting room sync')
            networkManager.send({ type: 'requestSync' })
        }
    }, SYNC_DEBOUNCE_MS)
}

// Sync when tab becomes visible (handles tab switches, minimization)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestSyncDebounced()
    }
})

// Sync when window gains focus (handles dual-monitor, side-by-side scenarios)
window.addEventListener('focus', () => {
    requestSyncDebounced()
})

/**
 * Create a new session - transitions from local mode to networked mode
 * @param {Object} settings - Session settings (password, permissions, etc.)
 */
async function createSession(settings = {}) {
    console.log('[App] Creating session with settings:', settings)

    try {
        // Generate room code
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        console.log('[App] Generated room code:', roomCode)

        // Update state to connecting
        actions.setNetworkState('connecting', roomCode, localUserId)

        // Create network manager
        networkManager = new WebSocketManager((message) => {
            // Messages will be handled by engine's message handler
        })

        // Wait for authentication before attaching network manager
        const authPromise = new Promise((resolve, reject) => {
            const originalHandler = networkManager.messageHandler

            networkManager.messageHandler = (message) => {
                console.log('[App] Received message in createSession handler:', message.type, message)
                if (message.type === 'network:authenticated') {
                    console.log('[App] Authenticated with server userId:', message.userId)

                    // Send createRoom message with settings IMMEDIATELY after authentication
                    const createRoomMsg = {
                        type: 'createRoom',
                        password: settings.password || null,
                    }
                    console.log('[App] Sending createRoom message:', createRoomMsg)
                    networkManager.send(createRoomMsg)

                    // Update state with server userId (but don't attach network manager yet)
                    actions.setUserId(message.userId)

                    // Don't resolve yet - wait for room_joined
                } else if (message.type === 'network:room_joined') {
                    console.log('[App] Room created and joined successfully')

                    // NOW attach network manager to engine
                    engine.attachNetworkManager(networkManager, networkManager.userId)

                    // Update URL with room code
                    window.history.replaceState({}, '', `?room=${roomCode}`)

                    // Update invite manager
                    inviteManager.setRoomCode(roomCode)

                    resolve(networkManager.userId)
                }

                // Forward all messages to engine
                if (originalHandler) {
                    originalHandler(message)
                }
            }
        })

        // Connect to server
        await networkManager.connect(roomCode)

        console.log('[App] Session created successfully')
    } catch (error) {
        console.error('[App] Failed to create session:', error)
        actions.setNetworkStatus('error')
    }
}

/**
 * Join an existing room - transitions from local mode to networked mode
 * @param {string} roomCode - The room code to join
 * @param {string} password - Optional password for protected rooms
 */
async function joinRoom(roomCode, password = null) {
    console.log('[App] Joining room:', roomCode, password ? '(with password)' : '')

    try {
        // Update state to connecting
        actions.setNetworkState('connecting', roomCode, localUserId)

        // Create network manager
        networkManager = new WebSocketManager((message) => {
            // Messages will be handled by engine's message handler
        })

        // Track password retry attempts
        let passwordAttempts = 0
        const maxPasswordAttempts = 3

        // Wait for authentication
        const authPromise = new Promise(async (resolve, reject) => {
            const originalHandler = networkManager.messageHandler

            networkManager.messageHandler = async (message) => {
                console.log('[App] Received message in joinRoom handler:', message.type, message)
                if (message.type === 'network:authenticated') {
                    console.log('[App] Authenticated with server userId:', message.userId)

                    // Send joinRoom message to declare intent (with password if provided)
                    const joinRoomMsg = {
                        type: 'joinRoom',
                        password: password || null,
                    }
                    console.log('[App] Sending joinRoom message')
                    networkManager.send(joinRoomMsg)

                    // Update state with server userId (but don't attach network manager yet)
                    actions.setUserId(message.userId)

                    // Don't resolve yet - wait for room_joined or error
                } else if (message.type === 'network:room_joined') {
                    console.log('[App] Successfully joined room')

                    // Clear authentication flag if it was set
                    if (networkManager.isAuthenticating) {
                        networkManager.isAuthenticating = false
                    }

                    // NOW attach network manager to engine
                    engine.attachNetworkManager(networkManager, networkManager.userId)

                    // Update invite manager
                    inviteManager.setRoomCode(roomCode)

                    resolve(networkManager.userId)
                } else if (message.type === 'network:error') {
                    // Handle specific error types
                    console.error('[App] Error from backend:', message)

                    if (message.code === 'PASSWORD_REQUIRED') {
                        console.log('[App] Password required for room')
                        networkManager.isAuthenticating = true
                        const enteredPassword = await showPasswordPrompt(roomCode)
                        if (enteredPassword) {
                            // Send joinRoom message again with password (no disconnect needed)
                            const joinRoomMsg = {
                                type: 'joinRoom',
                                password: enteredPassword,
                            }
                            console.log('[App] Sending joinRoom message with password')
                            networkManager.send(joinRoomMsg)
                            passwordAttempts = 1 // First attempt with password
                            // Don't resolve/reject - wait for response
                            return
                        } else {
                            // User cancelled
                            networkManager.isAuthenticating = false
                            reject(new Error('Password required'))
                            return
                        }
                    } else if (message.code === 'INVALID_PASSWORD') {
                        passwordAttempts++
                        const attemptsRemaining = maxPasswordAttempts - passwordAttempts

                        if (passwordAttempts < maxPasswordAttempts) {
                            // Show error and prompt again
                            console.log(`[App] Invalid password. Attempts remaining: ${attemptsRemaining}`)
                            const errorMessage = `Incorrect password. Please try again (${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining)`
                            showErrorNotification(errorMessage)

                            // Wait a moment for user to see the error
                            await new Promise(resolve => setTimeout(resolve, 500))

                            // Prompt for password again
                            const retryPassword = await showPasswordPrompt(roomCode, errorMessage)
                            if (retryPassword) {
                                // Send joinRoom message again with new password
                                const joinRoomMsg = {
                                    type: 'joinRoom',
                                    password: retryPassword,
                                }
                                console.log('[App] Sending joinRoom message with retry password')
                                networkManager.send(joinRoomMsg)
                                // Don't resolve/reject - wait for response
                                return
                            } else {
                                // User cancelled retry
                                networkManager.isAuthenticating = false
                                reject(new Error('Password authentication cancelled'))
                                return
                            }
                        } else {
                            // Max attempts exceeded
                            networkManager.isAuthenticating = false
                            showErrorNotification('Maximum password attempts exceeded')
                            reject(new Error('Maximum password attempts exceeded'))
                            return
                        }
                    }

                    // Other errors
                    reject(new Error(message.message || 'Connection error'))
                }

                // Forward all messages to engine
                if (originalHandler) {
                    originalHandler(message)
                }
            }
        })

        // Connect to server
        await networkManager.connect(roomCode)

        console.log('[App] Joined room successfully')
    } catch (error) {
        console.error('[App] Failed to join room:', error)
        actions.setNetworkStatus('error')

        // Clean up network manager if connection failed
        if (networkManager) {
            networkManager.disconnect()
            networkManager = null
        }

        // Show user-friendly error notification if not already shown
        if (error.message !== 'Password required' &&
            error.message !== 'Password authentication cancelled' &&
            error.message !== 'Maximum password attempts exceeded') {
            showErrorNotification(error.message || 'Failed to join room. Please check the room code.')
        }
    }
}

// Expose functions globally for InviteManager to call
window.whiteboardApp = {
    createSession,
    joinRoom,
    engine,
    networkManager: () => networkManager,
}

// Start engine
engine.start()

// Show join room prompt if URL contains room code
if (roomCodeFromURL) {
    showJoinRoomDialog(roomCodeFromURL)
}

/**
 * Show error notification to user
 * @param {string} message - Error message to display
 */
function showErrorNotification(message) {
    const notification = document.querySelector('.invite-notification')
    if (notification) {
        notification.textContent = message
        notification.className = 'invite-notification error show'

        // Fade out after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show')
        }, 5000)
    }
}

/**
 * Show password prompt dialog
 * @param {string} roomCode - The room code requiring a password
 * @param {string} errorMessage - Optional error message to display (e.g., for retry attempts)
 * @returns {Promise<string|null>} - The entered password or null if cancelled
 */
function showPasswordPrompt(roomCode, errorMessage = null) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div')
        dialog.className = 'join-room-dialog-overlay'
        dialog.innerHTML = `
            <div class="join-room-dialog">
                <h2>Password Required</h2>
                <p>Room <strong>${roomCode}</strong> is password-protected.</p>
                ${errorMessage ? `<p class="error-message" style="color: #ff6b6b; font-weight: 500;">${errorMessage}</p>` : ''}
                <input type="password" id="room-password" placeholder="Enter password" autocomplete="off" />
                <div class="join-room-actions">
                    <button class="join-room-btn join-btn">Enter</button>
                    <button class="join-room-btn stay-local-btn">Cancel</button>
                </div>
            </div>
        `

        document.body.appendChild(dialog)

        const passwordInput = dialog.querySelector('#room-password')
        const enterBtn = dialog.querySelector('.join-btn')
        const cancelBtn = dialog.querySelector('.stay-local-btn')

        enterBtn.addEventListener('click', () => {
            const password = passwordInput.value
            dialog.remove()
            resolve(password || null)
        })

        cancelBtn.addEventListener('click', () => {
            dialog.remove()
            resolve(null)
        })

        // Handle Enter key
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                enterBtn.click()
            }
        })

        // Close on overlay click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                cancelBtn.click()
            }
        })

        // Focus the input
        passwordInput.focus()
    })
}

/**
 * Show dialog prompting user to join a room
 * @param {string} roomCode - The room code from URL
 */
function showJoinRoomDialog(roomCode) {
    // Create dialog element
    const dialog = document.createElement('div')
    dialog.className = 'join-room-dialog-overlay'
    dialog.innerHTML = `
        <div class="join-room-dialog">
            <h2>Join Room?</h2>
            <p>You've been invited to join room <strong>${roomCode}</strong></p>
            <p>Would you like to join this collaborative session?</p>
            <div class="join-room-actions">
                <button class="join-room-btn join-btn">Join Room</button>
                <button class="join-room-btn stay-local-btn">Stay Local</button>
            </div>
        </div>
    `

    // Add to page
    document.body.appendChild(dialog)

    // Get buttons
    const joinBtn = dialog.querySelector('.join-btn')
    const stayLocalBtn = dialog.querySelector('.stay-local-btn')

    // Handle Join button
    joinBtn.addEventListener('click', async () => {
        dialog.remove()
        await joinRoom(roomCode)
    })

    // Handle Stay Local button
    stayLocalBtn.addEventListener('click', () => {
        dialog.remove()
        // Remove room code from URL
        window.history.replaceState({}, '', window.location.pathname)
        console.log('[App] User chose to stay in local mode')
    })

    // Close on overlay click
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            stayLocalBtn.click()
        }
    })
}

// Clean up on exit
window.addEventListener('beforeunload', () => {
    engine.destroy()
    toolbar.destroy()
    appState.clear() // Clean up state subscriptions
})
