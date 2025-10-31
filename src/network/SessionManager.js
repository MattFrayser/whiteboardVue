/**
 * SessionManager
 *
 * Manages network session lifecycle (create/join/disconnect)
 * Coordinates between network connection, authentication, and object migration
 * Provides event-driven interface for UI updates
 */
import { WebSocketManager } from './WebSocketManager'
import { actions } from '../stores/AppState'

export class SessionManager {
    constructor(engine, notificationManager, dialogManager, inviteManager) {
        this.engine = engine
        this.notificationManager = notificationManager
        this.dialogManager = dialogManager
        this.inviteManager = inviteManager
        this.networkManager = null
        this.localUserId = null
    }

    /**
     * Set the local user ID (used before network connection)
     * @param {string} userId - The local user ID
     */
    setLocalUserId(userId) {
        this.localUserId = userId
    }

    /**
     * Create a new session (room)
     * @param {Object} settings - Session settings
     * @param {string} settings.password - Optional password for the room
     * @returns {Promise<{roomCode: string, userId: string}>} Created session info
     */
    async createSession(settings = {}) {
        try {
            // Generate room code
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
            console.log('[SessionManager] Generated room code:', roomCode)

            // Update state to connecting
            actions.setNetworkState('connecting', roomCode, this.localUserId)

            // Create network manager
            this.networkManager = new WebSocketManager((message) => {
                // Messages will be handled by engine's message handler
            })

            // Wait for authentication and room creation
            const userId = await new Promise((resolve, reject) => {
                const originalHandler = this.networkManager.messageHandler

                this.networkManager.messageHandler = (message) => {
                    console.log('[SessionManager] Received message:', message.type)

                    if (message.type === 'network:authenticated') {
                        console.log('[SessionManager] Authenticated with server userId:', message.userId)

                        // Send createRoom message
                        const createRoomMsg = {
                            type: 'createRoom',
                            password: settings.password || null,
                        }
                        console.log('[SessionManager] Sending createRoom message')
                        this.networkManager.send(createRoomMsg)

                        // Update state with server userId
                        actions.setUserId(message.userId)

                    } else if (message.type === 'network:room_joined') {
                        console.log('[SessionManager] Room created and joined successfully')

                        // Attach network manager to engine and handle migration
                        this.engine.attachNetworkManager(this.networkManager, this.networkManager.userId)
                            .then(result => {
                                // Show migration result notification
                                this.notificationManager.showMigrationResult(
                                    result.succeeded.length,
                                    result.failed.length
                                )
                                if (result.failed.length > 0) {
                                    console.warn(`[SessionManager] ${result.failed.length} objects failed to sync`)
                                } else if (result.succeeded.length > 0) {
                                    console.log(`[SessionManager] All ${result.succeeded.length} objects synced successfully`)
                                }
                            })
                            .catch(err => {
                                console.error('[SessionManager] Migration error:', err)
                            })

                        // Update URL with room code
                        window.history.replaceState({}, '', `?room=${roomCode}`)

                        // Update invite manager
                        if (this.inviteManager) {
                            this.inviteManager.setRoomCode(roomCode)
                        }

                        resolve(this.networkManager.userId)
                    }

                    // Forward all messages to engine
                    if (originalHandler) {
                        originalHandler(message)
                    }
                }

                // Connect to server (inside Promise so it executes immediately)
                this.networkManager.connect(roomCode).catch(reject)
            })

            console.log('[SessionManager] Session created successfully')
            return { roomCode, userId }

        } catch (error) {
            console.error('[SessionManager] Failed to create session:', error)
            actions.setNetworkStatus('error')
            throw error
        }
    }

    /**
     * Join an existing room
     * @param {string} roomCode - The room code to join
     * @param {string} password - Optional password for protected rooms
     * @returns {Promise<{userId: string}>} Joined session info
     */
    async joinSession(roomCode, password = null) {
        console.log('[SessionManager] Joining room:', roomCode, password ? '(with password)' : '')

        try {
            // Update state to connecting
            actions.setNetworkState('connecting', roomCode, this.localUserId)

            // Create network manager
            this.networkManager = new WebSocketManager((message) => {
                // Messages will be handled by engine's message handler
            })

            // Track password retry attempts
            let passwordAttempts = 0
            const maxPasswordAttempts = 3

            // Wait for authentication and room join
            const userId = await new Promise(async (resolve, reject) => {
                const originalHandler = this.networkManager.messageHandler

                this.networkManager.messageHandler = async (message) => {
                    console.log('[SessionManager] Received message:', message.type)

                    if (message.type === 'network:authenticated') {
                        console.log('[SessionManager] Authenticated with server userId:', message.userId)

                        // Send joinRoom message
                        const joinRoomMsg = {
                            type: 'joinRoom',
                            password: password || null,
                        }
                        console.log('[SessionManager] Sending joinRoom message')
                        this.networkManager.send(joinRoomMsg)

                        // Update state with server userId
                        actions.setUserId(message.userId)

                    } else if (message.type === 'network:room_joined') {
                        console.log('[SessionManager] Successfully joined room')

                        // Clear authentication flag if it was set
                        if (this.networkManager.isAuthenticating) {
                            this.networkManager.isAuthenticating = false
                        }

                        // Attach network manager to engine and handle migration
                        this.engine.attachNetworkManager(this.networkManager, this.networkManager.userId)
                            .then(result => {
                                // Show migration result notification
                                this.notificationManager.showMigrationResult(
                                    result.succeeded.length,
                                    result.failed.length
                                )
                                if (result.failed.length > 0) {
                                    console.warn(`[SessionManager] ${result.failed.length} objects failed to sync`)
                                } else if (result.succeeded.length > 0) {
                                    console.log(`[SessionManager] All ${result.succeeded.length} objects synced successfully`)
                                }
                            })
                            .catch(err => {
                                console.error('[SessionManager] Migration error:', err)
                            })

                        // Update invite manager
                        if (this.inviteManager) {
                            this.inviteManager.setRoomCode(roomCode)
                        }

                        resolve(this.networkManager.userId)

                    } else if (message.type === 'network:error') {
                        // Handle specific error types
                        console.error('[SessionManager] Error from backend:', message)

                        if (message.code === 'PASSWORD_REQUIRED') {
                            console.log('[SessionManager] Password required for room')
                            this.networkManager.isAuthenticating = true
                            const enteredPassword = await this.dialogManager.showPasswordDialog(roomCode)

                            if (enteredPassword) {
                                // Send joinRoom message again with password
                                const joinRoomMsg = {
                                    type: 'joinRoom',
                                    password: enteredPassword,
                                }
                                console.log('[SessionManager] Sending joinRoom message with password')
                                this.networkManager.send(joinRoomMsg)
                                passwordAttempts = 1 // First attempt with password
                                return // Don't resolve/reject - wait for response
                            } else {
                                // User cancelled
                                this.networkManager.isAuthenticating = false
                                reject(new Error('Password required'))
                                return
                            }

                        } else if (message.code === 'INVALID_PASSWORD') {
                            passwordAttempts++
                            const attemptsRemaining = maxPasswordAttempts - passwordAttempts

                            if (passwordAttempts < maxPasswordAttempts) {
                                // Show error and prompt again
                                console.log(`[SessionManager] Invalid password. Attempts remaining: ${attemptsRemaining}`)
                                const errorMessage = `Incorrect password. Please try again (${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining)`
                                this.notificationManager.showError(errorMessage)

                                // Wait a moment for user to see the error
                                await new Promise(resolve => setTimeout(resolve, 500))

                                // Prompt for password again
                                const retryPassword = await this.dialogManager.showPasswordDialog(roomCode, errorMessage)

                                if (retryPassword) {
                                    // Send joinRoom message again with new password
                                    const joinRoomMsg = {
                                        type: 'joinRoom',
                                        password: retryPassword,
                                    }
                                    console.log('[SessionManager] Sending joinRoom message with retry password')
                                    this.networkManager.send(joinRoomMsg)
                                    return // Don't resolve/reject - wait for response
                                } else {
                                    // User cancelled retry
                                    this.networkManager.isAuthenticating = false
                                    reject(new Error('Password authentication cancelled'))
                                    return
                                }
                            } else {
                                // Max attempts exceeded
                                this.networkManager.isAuthenticating = false
                                this.notificationManager.showError('Maximum password attempts exceeded')
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

                // Connect to server (inside Promise so it executes immediately)
                this.networkManager.connect(roomCode).catch(reject)
            })

            console.log('[SessionManager] Joined room successfully')
            return { userId }

        } catch (error) {
            console.error('[SessionManager] Failed to join room:', error)
            actions.setNetworkStatus('error')

            // Clean up network manager if connection failed
            if (this.networkManager) {
                this.networkManager.disconnect()
                this.networkManager = null
            }

            // Show user-friendly error notification if not already shown
            if (error.message !== 'Password required' &&
                error.message !== 'Password authentication cancelled' &&
                error.message !== 'Maximum password attempts exceeded') {
                this.notificationManager.showError(error.message || 'Failed to join room. Please check the room code.')
            }

            throw error
        }
    }

    /**
     * Disconnect from current session
     */
    disconnect() {
        if (this.networkManager) {
            this.networkManager.disconnect()
            this.networkManager = null
        }
        actions.setNetworkStatus('disconnected')
    }

    /**
     * Check if currently connected to a session
     * @returns {boolean} True if connected
     */
    isConnected() {
        return this.networkManager && this.networkManager.isConnected()
    }

    /**
     * Get the current network manager
     * @returns {WebSocketManager|null} The network manager instance
     */
    getNetworkManager() {
        return this.networkManager
    }

    /**
     * Cleanup method for component destruction
     */
    destroy() {
        this.disconnect()
    }
}
