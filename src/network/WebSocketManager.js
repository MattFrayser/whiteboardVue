export class WebSocketManager {
    constructor(engine) {
        this.engine = engine
        this.socket = null
        this.roomCode = null
        this.remoteCursors = new Map()

        this.connectionStatus = 'disconnected' //  'connected', 'disconnected', 'error'
        this.statusCallback = null
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 5
        this.reconnectDelay = 1000
        this.reconnectTimeout = null
    }

    setStatusCallback(callback) {
        this.statusCallback = callback
    }

    updateStatus(status) {
        this.connectionStatus = status
        if (this.statusCallback) {
            this.statusCallback(status)
        }
    }

    connect(roomCode) {
        this.roomCode = roomCode

        try {
            this.socket = new WebSocket(`ws://localhost:8080/ws?room=${roomCode}`)

            this.socket.onopen = () => {
                this.updateStatus('connected')
                this.reconnectAttempts = 0
                this.reconnectDelay = 1000
                this.send({ type: 'getUserId' })
            }

            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data))
            }

            this.socket.onerror = (error) => {
                console.error("Connection Error", error)
                this.updateStatus('error')
            }

            this.socket.onclose = () => {
                this.handleDisconnect()
            }

        } catch (error) {
            console.error('Failed to connect:', error)
            this.handleDisconnect()
        }
    }

    handleDisconnect() {
        this.remoteCursors.clear()
        this.socket = null
        this.updateStatus('disconnected')
        this.engine.render()

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

    send(msg) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(msg))
        }
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'userId':
                this.userId = msg.userId
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
        }

    }
    
    handleSync(msg) {
        this.engine.objectManager.objects = []
        msg.objects.forEach( objData => {
            const obj = this.engine.objectManager.createObjectFromData(objData)
            if (obj) {
                this.engine.objectManager.objects.push(obj)
            }
        })

        this.engine.render()
    }

    handleObjectAdded(objectData) {
        // skip if users obj
        if (objectData.userId == this.userId) return

        const obj = this.engine.objectManager.createObjectFromData(objectData.object)
        if (obj) {
            this.engine.objectManager.objects.push(obj)
            this.engine.render()
        }
    }
    handleObjectUpdated(objectData) {
        if (objectData.userId == this.userId) return

        const obj = this.engine.objectManager.objects.find(o => o.id === objectData.object.id)
        if (obj) {
            obj.data = objectData.object.data
            this.engine.render()
        }
    }
    handleObjectDeleted(objectData) {
        if (objectData.userId == this.userId) return

        const obj = this.engine.objectManager.objects.find(o => o.id === objectData.objectId)
        if (obj) {
            const index = this.engine.objectManager.objects.indexOf(obj)
            if (index > -1) {
                this.engine.objectManager.objects.splice(index, 1)
                this.engine.render()
            }
        }
    }

    handleCursor(cursor) {
        if (cursor.userId == this.userId) return

        this.remoteCursors.set(cursor.userId, {
            x: cursor.x,
            y: cursor.y,
            color: cursor.color,
            tool: cursor.tool
        })

        this.engine.render()
    }

    handleUserDisconnect(user) {
        this.remoteCursors.delete(user.userId)
        this.engine.render()
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
}
