/**
 * Collaboration Module
 * 
 * Handles all real-time multiplayer features:
 * - WebSocket connections and reconnection
 * - Session lifecycle (create/join/authenticate)
 * - Password-protected rooms
 * 
 * Usage:
 *   import { SessionManager, WebSocketManager } from './collaboration'
 */

// Session Management (public APIs)
export { SessionManager } from './session/SessionManager'
export { PasswordAuthenticator } from './session/PasswordAuthenticator'

// Network Management (public APIs)
export { WebSocketManager } from './network/WebSocketManager'

// Internal utilities (not exported - implementation details)
// - WebSocketConnection
// - AckTracker
// - ReconnectionManager

// Types (if you want them accessible)
export type { NetworkMessage, MigrationResult } from '../shared/types/network'
