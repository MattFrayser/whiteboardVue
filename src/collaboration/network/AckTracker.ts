import type { PendingAck } from '../../shared/types/network'
import { ACK_TIMEOUT } from '../../shared/constants'
import { createLogger } from '../../shared/utils/logger'
const log = createLogger('AckTracker')

/**
 * Tracks pending acknowledgments for object operations
 * Ensures objects are sent to server
 */
export class AckTracker {
    private pendingAcks: Map<string, PendingAck>
    private readonly ackTimeout: number

    constructor(ackTimeout: number = ACK_TIMEOUT) {
        this.pendingAcks = new Map()
        this.ackTimeout = ackTimeout
    }

    track(
        objectId: string,
        resolve: (value: { objectId: string; success: boolean }) => void,
        reject: (reason?: unknown) => void
    ): ReturnType<typeof setTimeout> {

        // timeout rejects if no response 
        const timeoutId = setTimeout(() => {
            this.pendingAcks.delete(objectId)
            reject(new Error(`Timeout waiting for server confirmation (${this.ackTimeout}ms)`))
        }, this.ackTimeout)

        // Store promise handlers & timeout
        this.pendingAcks.set(objectId, { resolve, reject, timeoutId })

        return timeoutId
    }

    
    // successful ack from server
    handleAck(objectId: string): boolean {
        const pending = this.pendingAcks.get(objectId)

        if (!pending) {
            return false 
        }

        clearTimeout(pending.timeoutId) // Clear timeout

        // Remove from pending map
        this.pendingAcks.delete(objectId)

        // Resolve the promise
        pending.resolve({ objectId, success: true })

        log.debug('Object confirmed by server', { objectId })
        return true
    }

    
    // ack error from server
    handleError(objectId: string, errorMessage: string): boolean {
        const pending = this.pendingAcks.get(objectId)

        if (!pending) {
            return false
        }

        clearTimeout(pending.timeoutId)  

        // Remove from pending map
        this.pendingAcks.delete(objectId)

        // Reject the promise
        const error = new Error(errorMessage || 'Failed to add object')
        pending.reject(error)

        return true
    }

    /**
     * Clear all pending acks 
     * used for things like disconnect
     */
    clearAll(reason: string = 'Connection closed'): void {
        this.pendingAcks.forEach(pending => {
            clearTimeout(pending.timeoutId)
            pending.reject(new Error(reason))
        })
        this.pendingAcks.clear()
    }

    
    // Check if an object ID has a pending ack
    hasPending(objectId: string): boolean {
        return this.pendingAcks.has(objectId)
    }

    getPendingCount(): number {
        return this.pendingAcks.size
    }

    
    // Get all pending object IDs
    getPendingIds(): string[] {
        return Array.from(this.pendingAcks.keys())
    }

    getAckTimeout(): number {
        return this.ackTimeout
    }
}
