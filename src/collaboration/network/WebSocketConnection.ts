import { actions, selectors, type NetworkStatus } from '../../shared/stores/AppState'
import { API_BASE_URL, WS_BASE_URL, AUTH_TIMEOUT } from '../../shared/constants'
import { ErrorHandler, ErrorCode } from '../../shared/utils/ErrorHandler'
import type { StatusCallback, NetworkMessage } from '../../shared/types/network'

/**
 * Handles low-level WebSocket connection lifecycle
 * Responsibilities:
 * - Establishing and closing WebSocket connections
 * - HTTP session establishment for cookie-based authentication
 * - Event binding (onopen, onmessage, onerror, onclose)
 * - Message serialization and sending
 * - Status updates and callbacks
 * - Authentication timeout management
 */
export class WebSocketConnection {
    private socket: WebSocket | null = null
    private statusCallback: StatusCallback | null = null
    private authTimeout: ReturnType<typeof setTimeout> | null = null
    private onMessageCallback: ((msg: NetworkMessage) => void) | null = null
    private onDisconnectCallback: (() => void) | null = null

    onMessage(callback: (msg: NetworkMessage) => void): void {
        this.onMessageCallback = callback
    }

    onDisconnect(callback: () => void): void {
        this.onDisconnectCallback = callback
    }

    setStatusCallback(callback: StatusCallback): void {
        this.statusCallback = callback
    }

    updateStatus(status: string): void {
        actions.setNetworkStatus(status as NetworkStatus)
        if (this.statusCallback) {
            this.statusCallback(status)
        }
    }

    isConnected(): boolean {
        return selectors.getNetworkStatus() === 'connected'
    }

    /**
     * Establish HTTP session and open WebSocket connection
     */
    async connect(roomCode: string): Promise<void> {
        // Update state with roomCode
        actions.setRoomCode(roomCode)

        try {
            // Establish session via HTTP first (ensures cookie is set reliably)
            const sessionResponse = await fetch(`${API_BASE_URL}/api/session`, {
                method: 'GET',
                credentials: 'include', // Include cookies in request and store set-cookie response
            })

            if (!sessionResponse.ok) {
                throw new Error(`Session establishment failed: ${sessionResponse.status}`)
            }

            const sessionData = await sessionResponse.json()
            console.log('[WebSocketConnection] Session established:', sessionData.userId)

            // Debug: Check if cookie was set
            console.log('[WebSocketConnection] Cookies:', document.cookie)

            // Now open WebSocket - cookie will be sent automatically
            console.log('[WebSocketConnection] Opening WebSocket connection...')
            this.socket = new WebSocket(`${WS_BASE_URL}/ws?room=${roomCode}`)
            console.log('[WebSocketConnection] WebSocket object created, readyState:', this.socket.readyState)

            this.socket.onopen = () => {
                console.log('[WebSocketConnection] Connection opened successfully!')
                // Send authenticate message - authentication will use HTTP cookie
                const authMsg = {
                    type: 'authenticate',
                }
                this.send(authMsg)

                // Set authentication timeout
                this.authTimeout = setTimeout(() => {
                    ErrorHandler.network(new Error('Authentication timeout'), {
                        context: 'WebSocketConnection',
                        code: ErrorCode.TIMEOUT,
                        userMessage: 'Connection timed out while authenticating. Please try again.'
                    })
                    this.updateStatus('error')
                    if (this.socket) {
                        this.socket.close()
                    }
                }, AUTH_TIMEOUT)
            }

            this.socket.onmessage = (event: MessageEvent) => {
                const msg = JSON.parse(event.data) as NetworkMessage
                if (this.onMessageCallback) {
                    this.onMessageCallback(msg)
                }
            }

            this.socket.onerror = (error: Event) => {
                ErrorHandler.network(new Error('WebSocket connection error'), {
                    context: 'WebSocketConnection',
                    code: ErrorCode.CONNECTION_FAILED,
                    metadata: {
                        type: error.type,
                        readyState: this.socket?.readyState
                    }
                })
                this.updateStatus('error')
            }

            this.socket.onclose = (event: CloseEvent) => {
                console.log('[WebSocketConnection] Connection closed:', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                })

                // Trigger disconnect callback
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback()
                }
            }
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error))
            ErrorHandler.network(err, {
                context: 'WebSocketConnection',
                code: ErrorCode.CONNECTION_FAILED,
                metadata: {
                    name: err.name,
                    message: err.message
                }
            })

            // Trigger disconnect callback on error
            if (this.onDisconnectCallback) {
                this.onDisconnectCallback()
            }
        }
    }

    send(msg: Record<string, unknown>): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(msg))
        } else {
            console.warn(
                '[WebSocketConnection] Cannot send message - socket not open. ReadyState:',
                this.socket?.readyState,
                'Message:',
                msg
            )
        }
    }

    clearAuthTimeout(): void {
        if (this.authTimeout) {
            clearTimeout(this.authTimeout)
            this.authTimeout = null
        }
    }

    disconnect(): void {
        // Clear auth timeout
        this.clearAuthTimeout()

        // Close socket connection
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }

        this.updateStatus('disconnected')
    }

    /**
     * Disconnect for password authentication (prevents auto-reconnect)
     */
    disconnectForAuth(): void {
        // Set flag to prevent auto-reconnect during password authentication
        actions.setIsAuthenticating(true)

        // Clear auth timeout
        this.clearAuthTimeout()

        // Close socket connection if it exists
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }

        this.updateStatus('disconnected')
    }
}
