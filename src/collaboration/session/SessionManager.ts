/**
 * network session lifecycle (create/join/disconnect)
 * Coordinates between network connection, authentication, and object migration
 */
import { WebSocketManager } from '../network/WebSocketManager'
import { PasswordAuthenticator } from './PasswordAuthenticator'
import { actions, selectors } from '../../shared/stores/AppState'
import { ErrorHandler } from '../../shared/utils/ErrorHandler'
import { generateSecureRoomCode } from '../../shared/utils/crypto'
import { createLogger } from '../../shared/utils/logger'
import type { DrawingEngine } from '../../core/engine/DrawingEngine'
import type { NotificationManager, DialogManager, InviteManager } from '../../shared/types/ui'
import type { NetworkMessage } from '../../shared/types/network'
import { API_BASE_URL } from '../../shared/constants/config'
const log = createLogger('SessionManager')

export class SessionManager {
    engine: DrawingEngine
    notificationManager: NotificationManager & {
        showMigrationResult(succeeded: number, failed: number): void
    }
    dialogManager: DialogManager
    inviteManager: InviteManager | null
    networkManager: WebSocketManager | null
    localUserId: string | null
    csrfToken: string | null
    passwordAuth: PasswordAuthenticator

    constructor(
        engine: DrawingEngine,
        notificationManager: NotificationManager & {
            showMigrationResult(succeeded: number, failed: number): void
        },
        dialogManager: DialogManager,
        inviteManager: InviteManager | null
    ) {
        this.engine = engine
        this.notificationManager = notificationManager
        this.dialogManager = dialogManager
        this.inviteManager = inviteManager
        this.networkManager = null
        this.localUserId = null
        this.csrfToken = null
        this.passwordAuth = new PasswordAuthenticator(dialogManager, notificationManager)
    }

    //used before network connection)
    setLocalUserId(userId: string): void {
        this.localUserId = userId
    }

    /**
     * Setup session connection with message handler
     */
    private async setupSessionConnection(
        action: 'create' | 'join',
        roomCode: string,
        password: string | null,
        shouldUpdateUrl: boolean
    ): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            if (!this.networkManager) {
                reject(new Error('Network manager not initialized'))
                return
            }

            const originalHandler = this.networkManager.messageHandler

            // Track password retry attempts (only used for join)
            let passwordAttempts = 0

            this.networkManager.messageHandler = async (message: NetworkMessage) => {
                log.debug('Received message', { messageType: message.type })

                if (message.type === 'network:authenticated') {
                    log.debug('Authenticated with server', { userId: message.userId })

                    // Send room action message (create or join)
                    const roomMessage = {
                        type: action === 'create' ? 'createRoom' : 'joinRoom',
                        password: password || null,
                    }
                    log.debug(`Sending ${roomMessage.type} message`)
                    this.networkManager?.send(roomMessage)

                    // Update state with server userId
                    actions.setUserId(message.userId ?? null)
                } else if (message.type === 'network:room_joined') {
                    log.info(
                        `${action === 'create' ? 'Room created and joined' : 'Successfully joined room'}`
                    )

                    if (!this.networkManager) {
                        reject(new Error('Network manager not available'))
                        return
                    }

                    // Clear authentication flag if it was set (only for join)
                    if (action === 'join' && selectors.getIsAuthenticating()) {
                        actions.setIsAuthenticating(false)
                    }

                    const userId = selectors.getUserId()
                    if (!userId) {
                        reject(new Error('User ID not available'))
                        return
                    }

                    // Attach network manager to engine and handle migration
                    this.engine
                        .attachNetworkManager(this.networkManager, userId)
                        .then(result => {
                            // Show migration result notification
                            this.notificationManager.showMigrationResult(
                                result.succeeded.length,
                                result.failed.length
                            )
                            if (result.failed.length > 0) {
                                log.warn('Objects failed to sync', {
                                    failed: result.failed.length,
                                    succeeded: result.succeeded.length,
                                })
                            } else if (result.succeeded.length > 0) {
                                log.debug('All objects synced successfully', {
                                    count: result.succeeded.length,
                                })
                            }
                        })
                        .catch(err => {
                            ErrorHandler.silent(err, {
                                context: 'SessionManager',
                                metadata: { operation: 'migration' },
                            })
                        })

                    // Update URL with room code (only for create)
                    if (shouldUpdateUrl) {
                        window.history.replaceState({}, '', `?room=${roomCode}`)
                    }

                    // Update invite manager
                    if (this.inviteManager) {
                        this.inviteManager.setRoomCode(roomCode)
                    }

                    resolve(userId)
                } else if (message.type === 'network:error' && action === 'join') {
                    // Handle errors (only for join operation)
                    if (!this.networkManager) {
                        reject(new Error('Network manager not available'))
                        return
                    }

                    // Handle specific error types
                    ErrorHandler.silent(new Error(message.message || 'Unknown error'), {
                        context: 'SessionManager',
                        metadata: { code: message.code, phase: 'joinRoom' },
                    })

                    if (message.code === 'PASSWORD_REQUIRED') {
                        log.debug('Password required for room')
                        actions.setIsAuthenticating(true)

                        const result = await this.passwordAuth.promptForPassword(roomCode)

                        if (result.cancelled) {
                            actions.setIsAuthenticating(false)
                            reject(new Error('Password required'))
                            return
                        }

                        // Send joinRoom message with password
                        this.networkManager?.send({
                            type: 'joinRoom',
                            password: result.password,
                        })
                        passwordAttempts = 1 // First attempt with password
                        return // Don't resolve/reject - wait for response
                    } else if (message.code === 'INVALID_PASSWORD') {
                        passwordAttempts++

                        const result = await this.passwordAuth.handleInvalidPassword(
                            roomCode,
                            passwordAttempts
                        )

                        if (result.cancelled || result.maxAttemptsExceeded) {
                            actions.setIsAuthenticating(false)
                            reject(
                                new Error(
                                    result.maxAttemptsExceeded
                                        ? 'Maximum password attempts exceeded'
                                        : 'Password authentication cancelled'
                                )
                            )
                            return
                        }

                        // Send joinRoom message with retry password
                        this.networkManager?.send({
                            type: 'joinRoom',
                            password: result.password,
                        })
                        return // Don't resolve/reject - wait for response
                    }

                    // Other errors
                    reject(new Error(message.message || 'Connection error'))
                }

                // Forward all messages to engine
                if (originalHandler) {
                    originalHandler(message)
                }
            }

            // Connect to server
            this.networkManager?.connect(roomCode, this.csrfToken ?? undefined).catch(reject)
        })
    }

    /**
     * Create a new session (room)
     */
    async createSession(
        settings: { password?: string } = {}
    ): Promise<{ roomCode: string; userId: string }> {
        try {
            // Generate cryptographically secure room code
            const roomCode = generateSecureRoomCode(6)
            log.debug('Generated room code', { roomCode })

            // Establish HTTP session and get CSRF token
            const sessionData = await this.establishHttpSession()
            this.csrfToken = sessionData.csrfToken
            this.localUserId = sessionData.userId

            // Update state to connecting
            actions.setNetworkState('connecting', roomCode, this.localUserId ?? undefined)

            // Create network manager
            this.networkManager = new WebSocketManager(() => {
                // Messages will be handled by engine's message handler
            })

            // Wait for authentication and room creation
            const userId = await this.setupSessionConnection(
                'create',
                roomCode,
                settings.password ?? null,
                true // Update URL with room code
            )

            log.debug('Session created successfully')
            return { roomCode, userId }
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error))
            ErrorHandler.network(err, {
                context: 'SessionManager',
                userMessage: 'Failed to create session. Please try again.',
                metadata: { operation: 'createSession' },
            })
            actions.setNetworkStatus('error')
            throw err
        }
    }

    /**
     * Join an existing room
     */
    async joinSession(
        roomCode: string,
        password: string | null = null
    ): Promise<{ userId: string }> {
        log.debug('Joining room', { roomCode, hasPassword: !!password })

        try {
            const sessionData = await this.establishHttpSession()
            this.csrfToken = sessionData.csrfToken
            this.localUserId = sessionData.userId
            actions.setNetworkState('connecting', roomCode, this.localUserId ?? undefined)

            this.networkManager = new WebSocketManager(() => {
                // Messages will be handled by engine's message handler
            })

            // Wait for authentication and room join
            const userId = await this.setupSessionConnection(
                'join',
                roomCode,
                password,
                false // Don't update URL (already has room code)
            )

            log.debug('Joined room successfully')
            return { userId }
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error))
            ErrorHandler.silent(err, {
                context: 'SessionManager',
                metadata: { operation: 'joinSession', roomCode },
            })
            actions.setNetworkStatus('error')

            // Clean up network manager if connection failed
            if (this.networkManager) {
                this.networkManager.disconnect()
                this.networkManager = null
            }

            // Show user-friendly error notification if not already shown
            // Password-related errors are handled by the password dialog flow above
            if (
                err.message !== 'Password required' &&
                err.message !== 'Password authentication cancelled' &&
                err.message !== 'Maximum password attempts exceeded'
            ) {
                this.notificationManager.showError(
                    err.message || 'Failed to join room. Please check the room code.'
                )
            }

            throw err
        }
    }

    private async establishHttpSession(): Promise<{ userId: string; csrfToken: string }> {
        const response = await fetch(`${API_BASE_URL}/api/session`, {
            method: 'GET',
            credentials: 'include'
        })

        if (!response.ok) {
            throw new Error(`Session establishment failed: ${response.status}`)
        }

        const data = await response.json()
        return {
            userId: data.userId,
            csrfToken: data.csrfToken
        }
    }

    disconnect(): void {
        if (this.networkManager) {
            this.networkManager.disconnect()
            this.networkManager = null
        }
        actions.setNetworkStatus('disconnected')
    }

    isConnected(): boolean {
        return this.networkManager !== null && this.networkManager.isConnected()
    }

    getNetworkManager(): WebSocketManager | null {
        return this.networkManager
    }

    destroy(): void {
        this.disconnect()
    }
}
