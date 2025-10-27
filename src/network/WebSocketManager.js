export class WebSocketManager {
    constructor(eventBus) {
        this.eventBus = eventBus
        this.socket = null
        this.roomCode = null

        this.connectionStatus = 'disconnected' //  'connected', 'disconnected', 'error'
        this.statusCallback = null
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 5
        this.reconnectDelay = 1000
        this.reconnectTimeout = null
        this.authTimeout = null
        this.userColor = null

        this.subscribeToEvents()
    }

    subscribeToEvents() {
        // Listen for cursor movements from engine
        this.eventBus.subscribe('engine:cursorMove', ({ x, y, tool }) => {
            if (this.userId) {
                this.broadcastCursor({ x, y, tool })
            }
        })

        // Listen for object changes from ObjectManager
        this.eventBus.subscribe('objectManager:objectAdded', ({ object }) => {
            this.broadcastObjectAdded(object)
        })

        this.eventBus.subscribe('objectManager:objectUpdated', ({ object }) => {
            this.broadcastObjectUpdated(object)
        })

        this.eventBus.subscribe('objectManager:objectDeleted', ({ object }) => {
            this.broadcastObjectDeleted(object)
        })

        // Listen for engine destroy
        this.eventBus.subscribe('engine:destroy', () => {
            this.disconnect()
        })
    }

    setStatusCallback(callback) {
        this.statusCallback = callback
    }

    updateStatus(status) {
        this.connectionStatus = status
        if (this.statusCallback) {
            this.statusCallback(status)
        }

        this.eventBus.publish('network:statusChanged', { status })
    }

    connect(roomCode) {
        this.roomCode = roomCode

        try {
            this.socket = new WebSocket(`ws://localhost:8080/ws?room=${roomCode}`)

            this.socket.onopen = () => {

                // Send authenticate message with stored token (if exists)
                const token = this.getStoredToken()
                const authMsg = {
                    type: 'authenticate',
                    token: token || ''
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

            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data))
            }

            this.socket.onerror = (error) => {
                console.error("[WebSocket] Connection Error:", error)
                this.updateStatus('error')
            }

            this.socket.onclose = (event) => {
                console.log('[WebSocket] Connection closed. Code:', event.code, 'Reason:', event.reason, 'Clean:', event.wasClean)
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

        // Emit event
        this.eventBus.publish('network:disconnected', {})

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++

            this.reconnectTimeout = setTimeout(() => {
                this.connect(this.roomCode)
            }, this.reconnectDelay)

            // Exponential backoff
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 10000)
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
            console.warn('[WebSocket] Cannot send message - socket not open. ReadyState:', this.socket?.readyState, 'Message:', msg)
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

        console.log('Authenticated as user:', this.userId)

        this.eventBus.publish('network:authenticated', { userId: this.userId })
    }

    handleRoomJoined(msg) {
        // Store user color and update status
        this.userColor = msg.color
        this.updateStatus('connected')
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000

        console.log('Joined room:', msg.room, 'with color:', this.userColor)
    }
    
    handleSync(msg) {
        this.eventBus.publish('network:sync', { objects: msg.objects })
    }

    handleObjectAdded(objectData) {
        // skip if users obj
        if (objectData.userId == this.userId) {
            return
        }

        this.eventBus.publish('network:objectAdded', {
            object: objectData.object,
            userId: objectData.userId
        })
    }

    handleObjectUpdated(objectData) {
        if (objectData.userId == this.userId) return

        this.eventBus.publish('network:objectUpdated', {
            object: objectData.object,
            userId: objectData.userId
        })
    }

    handleObjectDeleted(objectData) {
        if (objectData.userId == this.userId) return

        this.eventBus.publish('network:objectDeleted', {
            objectId: objectData.objectId,
            userId: objectData.userId
        })
    }

    handleCursor(cursor) {
        if (cursor.userId == this.userId) return

        this.eventBus.publish('network:remoteCursorMove', {
            userId: cursor.userId,
            x: cursor.x,
            y: cursor.y,
            color: cursor.color,
            tool: cursor.tool
        })
    }

    handleUserDisconnect(user) {
        this.eventBus.publish('network:userDisconnected', {
            userId: user.userId
        })
    }


    broadcastObjectAdded(object) {
        this.send({
            type: 'objectAdded',
            object: object.toJSON(), 
            userId: this.userId
        })
    }
    broadcastObjectUpdated(object) {
        this.send({
            type: 'objectUpdated',
            object: object.toJSON(), 
            userId: this.userId
        })
    }
    broadcastObjectDeleted(object) {
        this.send({
            type: 'objectDeleted',
            objectId: object.id,
            userId: this.userId
        })
    }
    broadcastCursor(cursor) {
        this.send({
            type: 'cursor',
            x: cursor.x,
            y: cursor.y,
            tool: cursor.tool,
            color: cursor.color
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
