import { Stroke } from '../objects/Stroke'
import { Rectangle } from '../objects/Rectangle'
import { Circle } from '../objects/Circle'
import { Line } from '../objects/Line'
import { Text } from '../objects/Text'

export class WebSocketManager {
    constructor(engine) {
        this.engine = engine
        this.socket = null
        this.roomCode = null
        this.remoteCursors = new Map()
    }

    connect(roomCode) {
        this.roomCode = roomCode

        try {
            this.socket = new WebSocket(`ws://localhost:8080/ws?room=${roomCode}`) 

            this.socket.onopen = () => {
                console.log("connected to room: ", roomCode)
                this.send({ type: 'getUserId' })
            }

            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data))
            }

            this.socket.onerror = (error) => {
                console.log("Websocket error: ", error)
            }

            this.socket.onclose = () => {
                console.log("Websocket disconnect")
            }

        } catch (error) {
            console.log("failed to connect to room: ", roomCode)
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
            const obj = this.createObjectFromData(objData)
            if (obj) {
                this.engine.objectManager.objects.push(obj)
            }
        })

        this.engine.render()
    }

    handleObjectAdded(objectData) {
        // skip if users obj
        if (objectData.userId == this.userId) return

        const obj = this.createObjectFromData(objectData.object)
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

    createObjectFromData(data) {
        switch (data.type) {
            case 'stroke':
                return new Stroke(data.id, data.data)
            case 'rectangle':
                return new Rectangle(data.id, data.data)
            case 'circle':
                return new Circle(data.id, data.data)
            case 'line':
                return new Line(data.id, data.data)
            case 'text':
                return new Text(data.id, data.data)

        }
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
