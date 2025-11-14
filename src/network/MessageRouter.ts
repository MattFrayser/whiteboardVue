import type { NetworkMessage } from '../types/network'

/**
 * Routes incoming WebSocket messages to registered handlers
 *
 * Responsibilities:
 * - Maintain a registry of message type -> handler mappings
 * - Route incoming messages to appropriate handlers
 * - Handle unknown message types with warnings
 * - Support dynamic handler registration (Open/Closed Principle)
 *
 * Benefits over switch statement:
 * - Open/Closed: Can add new message types without modifying router
 * - Testable: Easy to test routing logic in isolation
 * - Flexible: Handlers can be registered/unregistered dynamically
 */
export class MessageRouter {
    private handlers: Map<string, (msg: NetworkMessage) => void>

    constructor() {
        this.handlers = new Map()
    }

    /**
     * Register a handler for a specific message type
     * @param messageType The message type to handle (e.g., 'authenticated', 'sync')
     * @param handler Function to call when this message type is received
     */
    registerHandler(messageType: string, handler: (msg: NetworkMessage) => void): void {
        this.handlers.set(messageType, handler)
    }

    /**
     * Register multiple handlers at once
     * @param handlers Map of message type -> handler function
     */
    registerHandlers(handlers: Map<string, (msg: NetworkMessage) => void>): void {
        handlers.forEach((handler, messageType) => {
            this.registerHandler(messageType, handler)
        })
    }

    /**
     * Unregister a handler for a specific message type
     * @param messageType The message type to unregister
     */
    unregisterHandler(messageType: string): void {
        this.handlers.delete(messageType)
    }

    /**
     * Clear all registered handlers
     */
    clearHandlers(): void {
        this.handlers.clear()
    }

    /**
     * Route an incoming message to the appropriate handler
     * If no handler is registered, logs a warning
     * @param msg The incoming network message
     */
    routeMessage(msg: NetworkMessage): void {
        const handler = this.handlers.get(msg.type)

        if (handler) {
            handler(msg)
        } else {
            console.warn('[WebSocket] Unknown message type:', msg.type, msg)
        }
    }

    /**
     * Check if a handler is registered for a message type
     * @param messageType The message type to check
     */
    hasHandler(messageType: string): boolean {
        return this.handlers.has(messageType)
    }

    /**
     * Get the number of registered handlers
     */
    getHandlerCount(): number {
        return this.handlers.size
    }

    /**
     * Get all registered message types
     */
    getRegisteredTypes(): string[] {
        return Array.from(this.handlers.keys())
    }
}
