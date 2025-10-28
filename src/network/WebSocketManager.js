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

    connect(roomCode) {
        this.roomCode = roomCode

        // Update state with roomCode
        actions.setRoomCode(roomCode)

        try {
            this.socket = new WebSocket(`ws://localhost:8080/ws?room=${roomCode}`)

            this.socket.onopen = () => {
                // Send authenticate message with stored token (if exists)
                const token = this.getStoredToken()
                const authMsg = {
                    type: 'authenticate',
                    token: token || '',
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
                this.updateStatus('error')
            }

            this.socket.onclose = event => {
                this.handleDisconnect()
            }
        } catch (error) {
            console.error('Failed to connect:', error)
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

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++

            // Retry with 2-second delay
            this.reconnectTimeout = setTimeout(() => {
                this.connect(this.roomCode)
            }, 2000)
        } else {
            this.updateStatus('error')
        }
    }

    getStoredToken() {
        try {
            return localStorage.getItem('whiteboard_session_token')
        } catch (e) {
            console.warn('Could not access localStorage:', e)
            return null
        }
    }

    storeToken(token) {
        try {
            localStorage.setItem('whiteboard_session_token', token)
        } catch (e) {
            console.warn('Could not save token to localStorage:', e)
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

        // Store user ID and session token
        this.userId = msg.userId
        if (msg.token) {
            this.storeToken(msg.token)
        }

        // Update state with userId
        actions.setUserId(this.userId)

        // Notify message handler
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:authenticated', userId: this.userId })
        }
    }

    handleRoomJoined(msg) {
        this.userColor = msg.color
        this.updateStatus('connected')
        this.reconnectAttempts = 0
    }

    handleSync(msg) {
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:sync', objects: msg.objects })
        }
    }

    // When handling objects if the userId matches 
    // object belongs to user and should be skipped
    handleObjectAdded(objectData) {
        if (objectData.userId == this.userId) {
            return
        }

        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:objectAdded',
                object: objectData.object,
                userId: objectData.userId,
            })
        }
    }

    handleObjectUpdated(objectData) {
        if (objectData.userId == this.userId) {
            return
        }

        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:objectUpdated',
                object: objectData.object,
                userId: objectData.userId,
            })
        }
    }

    handleObjectDeleted(objectData) {
        if (objectData.userId == this.userId) {
            return
        }

        if (this.messageHandler) {
            this.messageHandler({
                type: 'network:objectDeleted',
                objectId: objectData.objectId,
                userId: objectData.userId,
            })
        }
    }

    handleCursor(cursor) {
        if (cursor.userId == this.userId) {
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

    broadcastObjectAdded(object) {
        this.send({
            type: 'objectAdded',
            object: object.toJSON(),
            userId: this.userId,
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

        // Close socket connection
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }

        // Clear data
        this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnect
        this.updateStatus('disconnected')
    }
}
