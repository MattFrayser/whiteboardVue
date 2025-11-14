import type { DrawingObject } from '../objects/DrawingObject'
import type { CursorData } from '../types/network'
import type { WebSocketConnection } from './WebSocketConnection'
import type { AckTracker } from './AckTracker'

/**
 * Handles broadcasting outgoing WebSocket messages
 *
 * Responsibilities:
 * - Broadcast object operations (add, update, delete)
 * - Broadcast cursor position
 * - Handle confirmed broadcasts with acknowledgment tracking
 * - Provide consistent message formatting
 *
 * Benefits:
 * - Single Responsibility: Dedicated to outgoing message broadcasting
 * - Testable: Can test broadcast logic independently
 * - Centralized: All outgoing message formatting in one place
 */
export class BroadcastService {
    private connection: WebSocketConnection
    private ackTracker: AckTracker | null

    /**
     * @param connection The WebSocket connection to send messages through
     * @param ackTracker Optional acknowledgment tracker for confirmed broadcasts
     */
    constructor(connection: WebSocketConnection, ackTracker: AckTracker | null = null) {
        this.connection = connection
        this.ackTracker = ackTracker
    }

    /**
     * Broadcast that an object was added
     * @param object The object that was added
     */
    broadcastObjectAdded(object: DrawingObject): void {
        this.connection.send({
            type: 'objectAdded',
            object: object.toJSON(),
        })
    }

    /**
     * Broadcast object added with server confirmation
     * Returns a Promise that resolves when server confirms, or rejects on error/timeout
     * @param object The object that was added
     * @returns Promise that resolves with confirmation or rejects on error
     */
    broadcastObjectAddedWithConfirmation(
        object: DrawingObject
    ): Promise<{ objectId: string; success: boolean }> {
        return new Promise((resolve, reject) => {
            // Check if ackTracker is available
            if (!this.ackTracker) {
                reject(new Error('AckTracker not configured for confirmed broadcasts'))
                return
            }

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

    /**
     * Broadcast that an object was updated
     * @param object The object that was updated
     */
    broadcastObjectUpdated(object: DrawingObject): void {
        this.connection.send({
            type: 'objectUpdated',
            object: object.toJSON(),
        })
    }

    /**
     * Broadcast that an object was deleted
     * @param object The object that was deleted
     */
    broadcastObjectDeleted(object: DrawingObject): void {
        this.connection.send({
            type: 'objectDeleted',
            objectId: object.id,
        })
    }

    /**
     * Broadcast cursor position
     * @param cursor The cursor data (position, tool, color)
     */
    broadcastCursor(cursor: CursorData): void {
        this.connection.send({
            type: 'cursor',
            x: cursor.x,
            y: cursor.y,
            tool: cursor.tool,
            color: cursor.color,
        })
    }
}
