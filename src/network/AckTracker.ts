import type { PendingAck } from '../types/network'
import { ACK_TIMEOUT } from '../constants'

/**
 * Tracks pending acknowledgments for object operations
 *
 * Responsibilities:
 * - Track pending promises waiting for server acknowledgment
 * - Manage timeouts for pending acknowledgments
 * - Handle successful acknowledgments
 * - Handle acknowledgment errors
 * - Clean up pending acknowledgments on disconnect
 *
 * Benefits:
 * - Single Responsibility: Dedicated to acknowledgment tracking
 * - Memory Safety: Ensures proper cleanup of timeouts and promises
 * - Testable: Can test acknowledgment logic in isolation
 */
export class AckTracker {
    private pendingAcks: Map<string, PendingAck>
    private readonly ackTimeout: number

    constructor(ackTimeout: number = ACK_TIMEOUT) {
        this.pendingAcks = new Map()
        this.ackTimeout = ackTimeout
    }

    /**
     * Track a pending acknowledgment with timeout
     * @param objectId The object ID to track
     * @param resolve Promise resolve function
     * @param reject Promise reject function
     * @returns The timeout ID for the acknowledgment
     */
    track(
        objectId: string,
        resolve: (value: { objectId: string; success: boolean }) => void,
        reject: (error: Error) => void
    ): ReturnType<typeof setTimeout> {
        // Create timeout to reject if no response within ackTimeout
        const timeoutId = setTimeout(() => {
            this.pendingAcks.delete(objectId)
            reject(new Error(`Timeout waiting for server confirmation (${this.ackTimeout}ms)`))
        }, this.ackTimeout)

        // Store promise handlers
        this.pendingAcks.set(objectId, { resolve, reject, timeoutId })

        return timeoutId
    }

    /**
     * Handle successful acknowledgment from server
     * @param objectId The object ID that was acknowledged
     * @returns true if acknowledgment was handled, false if no pending ack found
     */
    handleAck(objectId: string): boolean {
        const pending = this.pendingAcks.get(objectId)

        if (!pending) {
            return false
        }

        // Clear timeout
        clearTimeout(pending.timeoutId)

        // Remove from pending map
        this.pendingAcks.delete(objectId)

        // Resolve the promise
        pending.resolve({ objectId, success: true })

        console.log(`[AckTracker] Object ${objectId} confirmed by server`)
        return true
    }

    /**
     * Handle acknowledgment error from server
     * @param objectId The object ID that failed
     * @param errorMessage The error message from server
     * @returns true if error was handled, false if no pending ack found
     */
    handleError(objectId: string, errorMessage: string): boolean {
        const pending = this.pendingAcks.get(objectId)

        if (!pending) {
            return false
        }

        // Clear timeout
        clearTimeout(pending.timeoutId)

        // Remove from pending map
        this.pendingAcks.delete(objectId)

        // Reject the promise
        const error = new Error(errorMessage || 'Failed to add object')
        pending.reject(error)

        return true
    }

    /**
     * Clear all pending acknowledgments (e.g., on disconnect)
     * @param reason The reason for clearing (used in rejection message)
     */
    clearAll(reason: string = 'Connection closed'): void {
        this.pendingAcks.forEach((pending) => {
            clearTimeout(pending.timeoutId)
            pending.reject(new Error(reason))
        })
        this.pendingAcks.clear()
    }

    /**
     * Check if an object ID has a pending acknowledgment
     * @param objectId The object ID to check
     */
    hasPending(objectId: string): boolean {
        return this.pendingAcks.has(objectId)
    }

    /**
     * Get the number of pending acknowledgments
     */
    getPendingCount(): number {
        return this.pendingAcks.size
    }

    /**
     * Get all pending object IDs
     */
    getPendingIds(): string[] {
        return Array.from(this.pendingAcks.keys())
    }

    /**
     * Get the acknowledgment timeout value
     */
    getAckTimeout(): number {
        return this.ackTimeout
    }
}
