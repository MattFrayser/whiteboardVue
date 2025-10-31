import { actions } from '../stores/AppState'

export class WebSocketManager {
    constructor(messageHandler) {
        this.socket = null
        this.roomCode = null
        this.messageHandler = messageHandler // Callback for handling incoming messages

        this.connectionStatus = 'disconnected' //  'connected', 'disconnected', 'error'
        this.statusCallback = null
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 3
        this.reconnectTimeout = null
        this.authTimeout = null
        this.userColor = null
        this.userId = null
        this.isAuthenticating = false // Track if we're in password authentication flow
        this.isReconnecting = false // Track if this is a reconnection (not initial connection)

        // Track pending acknowledgments for object operations
        // Map: objectId -> {resolve, reject, timeoutId}
        this.pendingAcks = new Map()
        this.ackTimeout = 5000 // 5 seconds timeout for acknowledgments
    }
    
    isConnected() {
        return this.connectionStatus === 'connected'
    }

    setStatusCallback(callback) {
        this.statusCallback = callback
    }

    updateStatus(status) {
        this.connectionStatus = status
        if (this.statusCallback) {
            this.statusCallback(status)
        }

        actions.setNetworkStatus(status)
    }

    async connect(roomCode) {
        this.roomCode = roomCode

        // Update state with roomCode
        actions.setRoomCode(roomCode)

        try {
            // Establish session via HTTP first (ensures cookie is set reliably)
            const sessionResponse = await fetch('http://localhost:8080/api/session', {
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
            this.socket = new WebSocket(`ws://localhost:8080/ws?room=${roomCode}`)
            console.log('[WebSocket] WebSocket object created, readyState:', this.socket.readyState)

            this.socket.onopen = () => {
                console.log('[WebSocket] Connection opened successfully!')
                // Send authenticate message - authentication will use HTTP cookie
                const authMsg = {
                    type: 'authenticate',
                }
                this.send(authMsg)

                // Set authentication timeout (6 seconds - slightly longer than backend's 5s)
                this.authTimeout = setTimeout(() => {
                    console.error('[WebSocket] Authentication timeout - no response from server')
                    this.updateStatus('error')
                    if (this.socket) {
                        this.socket.close()
                    }
                }, 6000)
            }

            this.socket.onmessage = event => {
                this.handleMessage(JSON.parse(event.data))
            }

            this.socket.onerror = error => {
                console.error('[WebSocket] Connection Error:', error)
                console.error('[WebSocket] Error event details:', {
                    type: error.type,
                    target: error.target,
                    readyState: this.socket?.readyState
                })
                this.updateStatus('error')
            }

            this.socket.onclose = event => {
                console.log('[WebSocket] Connection closed:', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                })
                this.handleDisconnect()
            }
        } catch (error) {
            console.error('[WebSocket] Failed to connect:', error)
            console.error('[WebSocket] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            })
            this.handleDisconnect()
        }
    }

    handleDisconnect() {
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
                this.connect(this.roomCode)
            }, 2000)
        } else {
            this.updateStatus('error')
        }
    }


    send(msg) {
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

    handleMessage(msg) {
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

    handleAuthenticated(msg) {
        // Clear auth timeout - authentication succeeded
        if (this.authTimeout) {
            clearTimeout(this.authTimeout)
            this.authTimeout = null
        }

        // Store user ID (session handled via HTTP cookie)
        this.userId = msg.userId

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
            this.messageHandler({ type: 'network:authenticated', userId: this.userId })
        }
    }

    handleRoomJoined(msg) {
        this.userColor = msg.color
        this.updateStatus('connected')
        this.reconnectAttempts = 0

        // Notify message handler that room was joined successfully
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:room_joined', color: msg.color })
        }
    }

    handleSync(msg) {
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:sync', objects: msg.objects })
        }
    }

    // Backend already prevents echo via WebSocket connection filtering
    // Multiple tabs from same user need to see each other's updates
    handleObjectAdded(objectData) {
        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:objectAdded',
                object: objectData.object,
                userId: objectData.userId,
            })
        }
    }

    handleObjectUpdated(objectData) {
        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:objectUpdated',
                object: objectData.object,
                userId: objectData.userId,
            })
        }
    }

    handleObjectDeleted(objectData) {
        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:objectDeleted',
                objectId: objectData.objectId,
                userId: objectData.userId,
            })
        }
    }

    handleCursor(cursor) {
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

    handleUserDisconnect(user) {
        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:userDisconnected',
                userId: user.userId,
            })
        }
    }

    handleError(error) {
        console.error('[WebSocket] Error from server:', error)

        // Notify message handler about the error
        console.log('[WebSocket] this.messageHandler exists?', !!this.messageHandler)
        if (this.messageHandler) {
            console.log('[WebSocket] Calling messageHandler with network:error')
            this.messageHandler({
                type: 'network:error',
                code: error.code,
                message: error.message,
            })
        } else {
            console.error('[WebSocket] messageHandler is not set!')
        }

        // Update connection status to error
        this.updateStatus('error')
    }

    handleObjectAddedAck(msg) {
        const { objectId, success } = msg
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

    handleObjectAddedError(msg) {
        const { objectId, error } = msg
        const pending = this.pendingAcks.get(objectId)

        if (pending) {
            // Clear timeout
            clearTimeout(pending.timeoutId)

            // Remove from pending map
            this.pendingAcks.delete(objectId)

            // Reject the promise
            pending.reject(new Error(error || 'Failed to add object'))

            console.error(`[WebSocket] Object ${objectId} failed: ${error}`)
        }
    }

    broadcastObjectAdded(object) {
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
    broadcastObjectAddedWithConfirmation(object) {
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

    broadcastObjectUpdated(object) {
        this.send({
            type: 'objectUpdated',
            object: object.toJSON(),
            userId: this.userId,
        })
    }
    broadcastObjectDeleted(object) {
        this.send({
            type: 'objectDeleted',
            objectId: object.id,
            userId: this.userId,
        })
    }
    broadcastCursor(cursor) {
        this.send({
            type: 'cursor',
            x: cursor.x,
            y: cursor.y,
            tool: cursor.tool,
            color: cursor.color,
        })
    }

    disconnect() {
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
        this.pendingAcks.forEach((pending, objectId) => {
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

    disconnectForAuth() {
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
