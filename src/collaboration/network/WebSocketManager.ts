import { actions, selectors } from '../../shared/stores/AppState'
import { MAX_RECONNECT_ATTEMPTS, ACK_TIMEOUT } from '../../shared/constants'
import { ErrorHandler } from '../../shared/utils/ErrorHandler'
import type { MessageHandler, StatusCallback, CursorData, NetworkMessage } from '../../shared/types/network'
import type { DrawingObject } from '../../drawing/objects/DrawingObject'
import { WebSocketConnection } from './WebSocketConnection'
import { ReconnectionManager } from './ReconnectionManager'
import { AckTracker } from './AckTracker'
import { isValidMessageStructure } from '../../shared/validation'
import { createLogger } from '../../shared/utils/logger'
const log = createLogger('WebSocketManager')

export class WebSocketManager {
    private connection: WebSocketConnection
    private reconnectionManager: ReconnectionManager
    private ackTracker: AckTracker
    private handlers: Map<string, (msg: NetworkMessage) => void>
    messageHandler: MessageHandler | null

    constructor(messageHandler: MessageHandler | null = null) {
        this.connection = new WebSocketConnection()
        this.reconnectionManager = new ReconnectionManager(MAX_RECONNECT_ATTEMPTS)
        this.ackTracker = new AckTracker(ACK_TIMEOUT)
        this.handlers = new Map()
        this.messageHandler = messageHandler // Callback for handling incoming messages

        // Register message handlers
        this.handlers.set('authenticated', (msg) => this.handleAuthenticated(msg))
        this.handlers.set('room_joined', (msg) => this.handleRoomJoined(msg))
        this.handlers.set('sync', (msg) => this.handleSync(msg))
        this.handlers.set('objectAdded', (msg) => this.handleObjectAdded(msg))
        this.handlers.set('objectUpdated', (msg) => this.handleObjectUpdated(msg))
        this.handlers.set('objectDeleted', (msg) => this.handleObjectDeleted(msg))
        this.handlers.set('cursor', (msg) => this.handleCursor(msg))
        this.handlers.set('userDisconnected', (msg) => this.handleUserDisconnect(msg))
        this.handlers.set('objectAdded_ack', (msg) => this.handleObjectAddedAck(msg))
        this.handlers.set('objectAdded_error', (msg) => this.handleObjectAddedError(msg))
        this.handlers.set('error', (msg) => this.handleError(msg))

        // Wire up connection callbacks
        this.connection.onMessage((msg) => this.handleMessage(msg))
        this.connection.onDisconnect(() => this.handleDisconnect())

        // Wire up reconnection callback
        this.reconnectionManager.setReconnectCallback((roomCode) => this.connect(roomCode))
    }

    // Expose properties for backward compatibility with tests
    get maxReconnectAttempts(): number {
        return MAX_RECONNECT_ATTEMPTS
    }

    get reconnectTimeout(): ReturnType<typeof setTimeout> | null {
        return this.reconnectionManager.getReconnectTimeout()
    }

    get isReconnecting(): boolean {
        return this.reconnectionManager.reconnecting
    }

    set isReconnecting(value: boolean) {
        this.reconnectionManager.reconnecting = value
    }

    get ackTimeout(): number {
        return this.ackTracker.getAckTimeout()
    }

    // Expose ackTracker for tests (allows spying and verification)
    getAckTracker(): AckTracker {
        return this.ackTracker
    }
    
    isConnected(): boolean {
        return this.connection.isConnected()
    }

    setStatusCallback(callback: StatusCallback): void {
        this.connection.setStatusCallback(callback)
    }

    updateStatus(status: string): void {
        this.connection.updateStatus(status)
    }

    async connect(roomCode: string): Promise<void> {
        await this.connection.connect(roomCode)
    }

    handleDisconnect(): void {
        // Clear auth timeout through connection
        this.connection.clearAuthTimeout()

        this.updateStatus('disconnected')

        // Notify message handler
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:disconnected' })
        }

        // Delegate reconnection logic to ReconnectionManager
        const reconnected = this.reconnectionManager.handleDisconnect()

        // If max attempts exceeded, update status to error
        if (!reconnected && selectors.getReconnectAttempts() >= MAX_RECONNECT_ATTEMPTS) {
            this.updateStatus('error')
        }
    }


    send(msg: Record<string, unknown>): void {
        this.connection.send(msg)
    }

    handleMessage(msg: NetworkMessage): void {
        // Double check of msg
        if (!isValidMessageStructure(msg)) {
            ErrorHandler.silent(new Error('Invalid message structure'), {
                context: 'WebSocketManager',
                metadata: { msg }
            })
            return
        }

        const handler = this.handlers.get(msg.type)

        if (handler) {
            handler(msg)
        } else {
            log.warn('Unknown message type', { type: msg.type, message: msg })
        }
    }
    

    //----------
    // Message Handlers
    //----------

    handleAuthenticated(msg: NetworkMessage): void {
        // Clear auth timeout - authentication succeeded
        this.connection.clearAuthTimeout()

        // Update state with userId
        const userId = msg.userId ?? null
        actions.setUserId(userId)

        // If this is a reconnection, automatically send joinRoom message
        // Backend will check if room is already verified for this session
        const roomCode = selectors.getRoomCode()
        if (this.isReconnecting && roomCode) {
            this.send({
                type: 'joinRoom',
                password: null, // No password on reconnect - backend will check session verification
            })
            this.isReconnecting = false
        }

        // Notify message handler
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:authenticated', userId: userId ?? undefined })
        }
    }

    handleRoomJoined(msg: NetworkMessage): void {
        const userColor = (msg as unknown as { color?: string }).color ?? null
        actions.setUserColor(userColor)
        this.updateStatus('connected')

        // Reset reconnection state through ReconnectionManager
        this.reconnectionManager.resetReconnectionState()

        // Notify message handler that room was joined successfully
        if (this.messageHandler) {
            this.messageHandler({ type: 'network:room_joined', color: userColor ?? undefined })
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
        const userId = selectors.getUserId()
        if (cursor.userId === userId) {
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

        this.ackTracker.handleAck(objectId)
    }

    handleObjectAddedError(msg: NetworkMessage): void {
        const objectId = typeof msg === 'object' && msg !== null && 'objectId' in msg
            ? String((msg as { objectId: unknown }).objectId)
            : ''
        const error = typeof msg === 'object' && msg !== null && 'error' in msg
            ? String((msg as { error: unknown }).error)
            : 'Unknown error'

        const handled = this.ackTracker.handleError(objectId, error)

        if (handled) {
            // Silent error - object-level failures shouldn't spam users
            ErrorHandler.silent(new Error(error || 'Failed to add object'), {
                context: 'WebSocketManager',
                metadata: { objectId, serverError: error }
            })
        }
    }

    broadcastObjectAdded(object: DrawingObject): void {
        this.connection.send({
            type: 'objectAdded',
            object: object.toJSON(),
        })
    }

    broadcastObjectAddedWithConfirmation(
        object: DrawingObject
    ): Promise<{ objectId: string; success: boolean }> {
        return new Promise((resolve, reject) => {
            // Check if connected
            if (!this.connection.isConnected()) {
                reject(new Error('Not connected to server'))
                return
            }

            const objectId = object.id

            // Track the acknowledgment with timeout
            this.ackTracker.track(objectId, resolve, reject)

            // Send the message
            this.connection.send({
                type: 'objectAdded',
                object: object.toJSON(),
            })
        })
    }

    broadcastObjectUpdated(object: DrawingObject): void {
        this.connection.send({
            type: 'objectUpdated',
            object: object.toJSON(),
        })
    }

    broadcastObjectDeleted(object: DrawingObject): void {
        this.connection.send({
            type: 'objectDeleted',
            objectId: object.id,
        })
    }

    broadcastCursor(cursor: CursorData): void {
        this.connection.send({
            type: 'cursor',
            x: cursor.x,
            y: cursor.y,
            tool: cursor.tool,
            color: cursor.color,
        })
    }

    disconnect(): void {
        // Cancel reconnection
        this.reconnectionManager.cancelReconnection()

        // Reject all pending acknowledgments
        this.ackTracker.clearAll('Connection closed')

        // Disconnect through connection (clears auth timeout and closes socket)
        this.connection.disconnect()
    }

    disconnectForAuth(): void {
        // Cancel reconnection
        this.reconnectionManager.cancelReconnection()

        // Disconnect for auth through connection (sets auth flag, clears timers, closes socket)
        this.connection.disconnectForAuth()
    }
}
