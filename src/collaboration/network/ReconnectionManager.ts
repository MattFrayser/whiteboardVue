/**
 * Manages WebSocket reconnection w/ exponential backoff
 */
import { actions, selectors } from '../../shared/stores/AppState'
import { ErrorHandler, ErrorCode } from '../../shared/utils/ErrorHandler'
import { createLogger } from '../../shared/utils/logger'
const log = createLogger('ReconnectionManager')

export class ReconnectionManager {
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    private maxReconnectAttempts: number
    private isReconnecting: boolean = false
    private onReconnect: ((roomCode: string) => void) | null = null

    // Backoff configuration
    private readonly BASE_DELAY_MS = 2000 // Start at 2 seconds
    private readonly MAX_DELAY_MS = 30000 // Cap at 30 seconds

    constructor(maxReconnectAttempts: number) {
        this.maxReconnectAttempts = maxReconnectAttempts
    }

    setReconnectCallback(callback: (roomCode: string) => void): void {
        this.onReconnect = callback
    }

    get reconnecting(): boolean {
        return this.isReconnecting
    }

    set reconnecting(value: boolean) {
        this.isReconnecting = value
    }

    /**
     * Formula: min(BASE_DELAY * 2^attempt, MAX_DELAY)
     */
    private calculateBackoffDelay(attempt: number): number {
        const delay = this.BASE_DELAY_MS * Math.pow(2, attempt)
        return Math.min(delay, this.MAX_DELAY_MS)
    }

    
    // Handle disconnection and schedule reconnection if needed
    handleDisconnect(): boolean {
        // Clear any existing reconnect timeout
        this.clearReconnectTimeout()

        // Don't auto-reconnect if in middle of password authentication
        if (selectors.getIsAuthenticating()) {
            log.debug('Skipping auto-reconnect - password authentication in progress')
            return false
        }

        const reconnectAttempts = selectors.getReconnectAttempts()

        // exceeded max attempts?
        if (reconnectAttempts >= this.maxReconnectAttempts) {
            ErrorHandler.network(new Error('Max reconnection attempts exceeded'), {
                context: 'ReconnectionManager',
                code: ErrorCode.CONNECTION_FAILED,
                userMessage:
                    'Unable to reconnect to the session after multiple attempts. Please refresh the page.',
                metadata: { attempts: this.maxReconnectAttempts },
            })
            return false
        }

        // Increment reconnect attempts
        actions.incrementReconnectAttempts()

        // Set reconnecting flag so we can auto-rejoin the room after authentication
        this.isReconnecting = true

        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(reconnectAttempts)
        const currentAttempts = reconnectAttempts + 1

        // Schedule reconnection
        this.reconnectTimeout = setTimeout(() => {
            const roomCode = selectors.getRoomCode()
            if (roomCode && this.onReconnect) {
                log.info('Attempting reconnection', { attempt: currentAttempts })
                this.onReconnect(roomCode)
            }
        }, delay)

        return true
    }

     clearReconnectTimeout(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }
    }

    // called on successful connect
    resetReconnectionState(): void {
        this.clearReconnectTimeout()
        this.isReconnecting = false
        actions.resetReconnectAttempts()
    }

    
    // Cancel reconnection and prevent future attempts
    cancelReconnection(): void {
        this.clearReconnectTimeout()
        this.isReconnecting = false
        actions.setReconnectAttempts(this.maxReconnectAttempts)
    }

    /**
     * Get current reconnect timeout (for testing)
     */
    getReconnectTimeout(): ReturnType<typeof setTimeout> | null {
        return this.reconnectTimeout
    }
}
