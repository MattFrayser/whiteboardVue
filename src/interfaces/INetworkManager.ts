import type { DrawingObject } from '../objects/DrawingObject'
import type { MessageHandler, CursorData } from '../types/network'

/**
 * INetworkManager - Network communication abstraction
 *
 * Defines the contract for broadcasting drawing operations and cursor movements
 * to connected peers. Implementations handle the underlying network protocol.
 */
export interface INetworkManager {
    /**
     * Check if currently connected to a network session
     */
    isConnected(): boolean

    /**
     * Broadcast that a new object was added to the canvas
     */
    broadcastObjectAdded(object: DrawingObject): void

    /**
     * Broadcast object addition with server confirmation
     * @returns Promise that resolves when server confirms, or rejects on error/timeout
     */
    broadcastObjectAddedWithConfirmation(object: DrawingObject): Promise<{ objectId: string; success: boolean }>

    /**
     * Broadcast that an object was updated
     */
    broadcastObjectUpdated(object: DrawingObject): void

    /**
     * Broadcast that an object was deleted
     */
    broadcastObjectDeleted(object: DrawingObject): void

    /**
     * Broadcast cursor position and state
     */
    broadcastCursor(cursor: CursorData): void

    /**
     * Set the message handler for incoming network events
     */
    messageHandler: MessageHandler | null
}
