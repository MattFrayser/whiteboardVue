import { actions, type NetworkStatus } from '../stores/AppState'
import { API_BASE_URL, WS_BASE_URL, MAX_RECONNECT_ATTEMPTS, AUTH_TIMEOUT, ACK_TIMEOUT } from '../constants'
import { ErrorHandler, ErrorCode } from '../utils/ErrorHandler'
import type { MessageHandler, StatusCallback, PendingAck, CursorData, NetworkMessage } from '../types/network'
import type { DrawingObject } from '../objects/DrawingObject'

export class WebSocketManager {
    socket: WebSocket | null
    roomCode: string | null
    messageHandler: MessageHandler | null
    connectionStatus: string
    statusCallback: StatusCallback | null
    reconnectAttempts: number
    maxReconnectAttempts: number
    reconnectTimeout: ReturnType<typeof setTimeout> | null
    authTimeout: ReturnType<typeof setTimeout> | null
    userColor: string | null
    userId: string | null
    isAuthenticating: boolean
    isReconnecting: boolean
    pendingAcks: Map<string, PendingAck>
    ackTimeout: number

    constructor(messageHandler: MessageHandler | null = null) {
        this.socket = null
        this.roomCode = null
        this.messageHandler = messageHandler // Callback for handling incoming messages

        this.connectionStatus = 'disconnected' //  'connected', 'disconnected', 'error'
        this.statusCallback = null
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS
        this.reconnectTimeout = null
        this.authTimeout = null
        this.userColor = null
        this.userId = null
        this.isAuthenticating = false // Track if we're in password authentication flow
        this.isReconnecting = false // Track if this is a reconnection (not initial connection)

        // Track pending acknowledgments for object operations
        // Map: objectId -> {resolve, reject, timeoutId}
        this.pendingAcks = new Map()
        this.ackTimeout = ACK_TIMEOUT
    }
    
    isConnected(): boolean {
        return this.connectionStatus === 'connected'
    }

    setStatusCallback(callback: StatusCallback): void {
        this.statusCallback = callback
    }

    updateStatus(status: string): void {
        this.connectionStatus = status
        if (this.statusCallback) {
            this.statusCallback(status)
        }

        actions.setNetworkStatus(status as NetworkStatus)
    }

    async connect(roomCode: string): Promise<void> {
        this.roomCode = roomCode

        // Update state with roomCode
        actions.setRoomCode(roomCode)

        try {
            // Establish session via HTTP first (ensures cookie is set reliably)
            const sessionResponse = await fetch(`${API_BASE_URL}/api/session`, {
                method: 'GET',
                credentials: 'include', // Include cookies in request and store set-cookie response
            })

            if (!sessionResponse.ok) {
                throw new Error(`Session establishment failed: ${sessionResponse.status}`)
            }

            const sessionData = await sessionResponse.json()
            console.log('[WebSocket] Session established:', sessionData.userId)

            // Debug: Check if cookie was set
            console.log('[WebSocket] Cookies:', document.cookie)

            // Now open WebSocket - cookie will be sent automatically
            console.log('[WebSocket] Opening WebSocket connection...')
            this.socket = new WebSocket(`${WS_BASE_URL}/ws?room=${roomCode}`)
            console.log('[WebSocket] WebSocket object created, readyState:', this.socket.readyState)

            this.socket.onopen = () => {
                console.log('[WebSocket] Connection opened successfully!')
                // Send authenticate message - authentication will use HTTP cookie
                const authMsg = {
                    type: 'authenticate',
                }
                this.send(authMsg)

                // Set authentication timeout
                this.authTimeout = setTimeout(() => {
                    ErrorHandler.network(new Error('Authentication timeout'), {
                        context: 'WebSocketManager',
                        code: ErrorCode.TIMEOUT,
                        userMessage: 'Connection timed out while authenticating. Please try again.'
                    })
                    this.updateStatus('error')
                    if (this.socket) {
                        this.socket.close()
                    }
                }, AUTH_TIMEOUT)
            }

            this.socket.onmessage = (event: MessageEvent) => {
                this.handleMessage(JSON.parse(event.data) as NetworkMessage)
            }

            this.socket.onerror = (error: Event) => {
                ErrorHandler.network(new Error('WebSocket connection error'), {
                    context: 'WebSocketManager',
                    code: ErrorCode.CONNECTION_FAILED,
                    metadata: {
                        type: error.type,
                        readyState: this.socket?.readyState
                    }
                })
                this.updateStatus('error')
            }

            this.socket.onclose = (event: CloseEvent) => {
                console.log('[WebSocket] Connection closed:', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                })
                this.handleDisconnect()
            }
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error))
            ErrorHandler.network(err, {
                context: 'WebSocketManager',
                code: ErrorCode.CONNECTION_FAILED,
                metadata: {
                    name: err.name,
                    message: err.message
                }
            })
            this.handleDisconnect()
        }
    }

    handleDisconnect(): void {
        // Clear auth timeout if active
        if (this.authTimeout) {
            clearTimeout(this.authTimeout)
            this.authTimeout = null
        }

        // Clear reconnect timeout if active
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }

        this.socket = null
        this.updateStatus('disconnected')

        // Notify message handler
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:disconnected' })
        }

        // Don't auto-reconnect if we're in the middle of password authentication
        if (this.isAuthenticating) {
            console.log('[WebSocket] Skipping auto-reconnect - password authentication in progress')
            return
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++

            // Set reconnecting flag so we can auto-rejoin the room after authentication
            this.isReconnecting = true

            // Retry with 2-second delay
            this.reconnectTimeout = setTimeout(() => {
                console.log('[WebSocket] Attempting reconnection (attempt', this.reconnectAttempts, ')')
                if (this.roomCode) {
                    this.connect(this.roomCode)
                }
            }, 2000)
        } else {
            ErrorHandler.network(new Error('Max reconnection attempts exceeded'), {
                context: 'WebSocketManager',
                code: ErrorCode.CONNECTION_FAILED,
                userMessage: 'Unable to reconnect to the session after multiple attempts. Please refresh the page.',
                metadata: { attempts: this.maxReconnectAttempts }
            })
            this.updateStatus('error')
        }
    }


    send(msg: Record<string, unknown>): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(msg))
        } else {
            console.warn(
                '[WebSocket] Cannot send message - socket not open. ReadyState:',
                this.socket?.readyState,
                'Message:',
                msg
            )
        }
    }

    handleMessage(msg: NetworkMessage): void {
        switch (msg.type) {
            case 'authenticated':
                this.handleAuthenticated(msg)
                break
            case 'room_joined':
                this.handleRoomJoined(msg)
                break
            case 'sync':
                this.handleSync(msg)
                break
            case 'objectAdded':
                this.handleObjectAdded(msg)
                break
            case 'objectUpdated':
                this.handleObjectUpdated(msg)
                break
            case 'objectDeleted':
                this.handleObjectDeleted(msg)
                break
            case 'cursor':
                this.handleCursor(msg)
                break
            case 'userDisconnected':
                this.handleUserDisconnect(msg)
                break
            case 'objectAdded_ack':
                this.handleObjectAddedAck(msg)
                break
            case 'objectAdded_error':
                this.handleObjectAddedError(msg)
                break
            case 'error':
                this.handleError(msg)
                break
            default:
                console.warn('[WebSocket] Unknown message type:', msg.type, msg)
        }
    }
    

    //----------
    // Message Handlers
    //----------

    handleAuthenticated(msg: NetworkMessage): void {
        // Clear auth timeout - authentication succeeded
        if (this.authTimeout) {
            clearTimeout(this.authTimeout)
            this.authTimeout = null
        }

        // Store user ID (session handled via HTTP cookie)
        this.userId = msg.userId ?? null

        // Update state with userId
        actions.setUserId(this.userId)

        // If this is a reconnection, automatically send joinRoom message
        // Backend will check if room is already verified for this session
        if (this.isReconnecting && this.roomCode) {
            console.log('[WebSocket] Reconnection authenticated, auto-rejoining room:', this.roomCode)
            this.send({
                type: 'joinRoom',
                password: null, // No password on reconnect - backend will check session verification
            })
            this.isReconnecting = false
        }

        // Notify message handler
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:authenticated', userId: this.userId ?? undefined })
        }
    }

    handleRoomJoined(msg: NetworkMessage): void {
        this.userColor = (msg as unknown as { color?: string }).color ?? null
        this.updateStatus('connected')
        this.reconnectAttempts = 0

        // Notify message handler that room was joined successfully
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:room_joined', color: (msg as unknown as { color?: string }).color })
        }
    }

    handleSync(msg: NetworkMessage): void {
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:sync', objects: msg.objects })
        }
    }

    // Backend already prevents echo via WebSocket connection filtering
    // Multiple tabs from same user need to see each other's updates
    handleObjectAdded(objectData: NetworkMessage): void {
        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:objectAdded',
                object: objectData.object,
                userId: objectData.userId,
            })
        }
    }

    handleObjectUpdated(objectData: NetworkMessage): void {
        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:objectUpdated',
                object: objectData.object,
                userId: objectData.userId,
            })
        }
    }

    handleObjectDeleted(objectData: NetworkMessage): void {
        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:objectDeleted',
                objectId: objectData.objectId,
                userId: objectData.userId,
            })
        }
    }

    handleCursor(cursor: NetworkMessage): void {
        // Filter out cursors from same userId (prevents same-user multi-tab cursors)
        if (cursor.userId === this.userId) {
            return
        }

        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:remoteCursorMove',
                userId: cursor.userId,
                x: cursor.x,
                y: cursor.y,
                color: cursor.color,
                tool: cursor.tool,
            })
        }
    }

    handleUserDisconnect(user: NetworkMessage): void {
        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:userDisconnected',
                userId: user.userId,
            })
        }
    }

    handleError(error: NetworkMessage): void {
        // Silent error - SessionManager handles user notifications for server errors
        const message = typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Unknown error'
        ErrorHandler.silent(new Error(message), {
            context: 'WebSocketManager',
            metadata: error
        })

        // Notify message handler about the error (SessionManager will handle user notification)
        if (this.messageHandler) {
            const { type: _originalType, ...errorData } = error
            this.messageHandler({
                type: 'network:error',
                ...errorData
            })
        }

        // Update connection status to error
        this.updateStatus('error')
    }

    handleObjectAddedAck(msg: NetworkMessage): void {
        const objectId = typeof msg === 'object' && msg !== null && 'objectId' in msg
            ? String((msg as { objectId: unknown }).objectId)
            : ''
        const pending = this.pendingAcks.get(objectId)

        if (pending) {
            // Clear timeout
            clearTimeout(pending.timeoutId)

            // Remove from pending map
            this.pendingAcks.delete(objectId)

            // Resolve the promise
            pending.resolve({ objectId, success: true })

            console.log(`[WebSocket] Object ${objectId} confirmed by server`)
        }
    }

    handleObjectAddedError(msg: NetworkMessage): void {
        const objectId = typeof msg === 'object' && msg !== null && 'objectId' in msg
            ? String((msg as { objectId: unknown }).objectId)
            : ''
        const error = typeof msg === 'object' && msg !== null && 'error' in msg
            ? String((msg as { error: unknown }).error)
            : 'Unknown error'
        const pending = this.pendingAcks.get(objectId)

        if (pending) {
            // Clear timeout
            clearTimeout(pending.timeoutId)

            // Remove from pending map
            this.pendingAcks.delete(objectId)

            // Reject the promise
            const errorObj = new Error(error || 'Failed to add object')
            pending.reject(errorObj)

            // Silent error - object-level failures shouldn't spam users
            ErrorHandler.silent(errorObj, {
                context: 'WebSocketManager',
                metadata: { objectId, serverError: error }
            })
        }
    }

    broadcastObjectAdded(object: DrawingObject): void {
        this.send({
            type: 'objectAdded',
            object: object.toJSON(),
            userId: this.userId,
        })
    }

    /**
     * Broadcast object added with server confirmation
     * Returns a Promise that resolves when server confirms, or rejects on error/timeout
     */
    broadcastObjectAddedWithConfirmation(object: DrawingObject): Promise<{ objectId: string; success: boolean }> {
        return new Promise((resolve, reject) => {
            // Check if connected
            if (!this.isConnected()) {
                reject(new Error('Not connected to server'))
                return
            }

            const objectId = object.id

            // Create timeout to reject if no response within ackTimeout
            const timeoutId = setTimeout(() => {
                this.pendingAcks.delete(objectId)
                reject(new Error(`Timeout waiting for server confirmation (${this.ackTimeout}ms)`))
            }, this.ackTimeout)

            // Store promise handlers
            this.pendingAcks.set(objectId, { resolve, reject, timeoutId })

            // Send the message
            this.send({
                type: 'objectAdded',
                object: object.toJSON(),
                userId: this.userId,
            })
        })
    }

    broadcastObjectUpdated(object: DrawingObject): void {
        this.send({
            type: 'objectUpdated',
            object: object.toJSON(),
            userId: this.userId,
        })
    }
    broadcastObjectDeleted(object: DrawingObject): void {
        this.send({
            type: 'objectDeleted',
            objectId: object.id,
            userId: this.userId,
        })
    }
    broadcastCursor(cursor: CursorData): void {
        this.send({
            type: 'cursor',
            x: cursor.x,
            y: cursor.y,
            tool: cursor.tool,
            color: cursor.color,
        })
    }

    disconnect(): void {
        // Clear all timers
        if (this.authTimeout) {
            clearTimeout(this.authTimeout)
            this.authTimeout = null
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }

        // Reject all pending acknowledgments
        this.pendingAcks.forEach((pending) => {
            clearTimeout(pending.timeoutId)
            pending.reject(new Error('Connection closed'))
        })
        this.pendingAcks.clear()

        // Close socket connection
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }

        // Clear data
        this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnect
        this.updateStatus('disconnected')
    }

    disconnectForAuth(): void {
        // Set flag to prevent auto-reconnect during password authentication
        this.isAuthenticating = true

        // Clear all timers
        if (this.authTimeout) {
            clearTimeout(this.authTimeout)
            this.authTimeout = null
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }

        // Close socket connection if it exists
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }

        this.updateStatus('disconnected')
    }
}
