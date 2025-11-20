import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebSocketManager } from '../../src/collaboration/network/WebSocketManager'
import type { MessageHandler, NetworkMessage } from '../../src/shared/types/network'

// Mock AppState
vi.mock('../../src/shared/stores/AppState', () => ({
    appState: {
        get: vi.fn(),
        set: vi.fn(),
        subscribe: vi.fn(() => () => {}),
    },
    actions: {
        setUserId: vi.fn(),
        setUserColor: vi.fn(),
        incrementReconnectAttempts: vi.fn(),
        resetReconnectAttempts: vi.fn(),
    },
    selectors: {
        getRoomCode: vi.fn(() => 'TEST01'),
        getReconnectAttempts: vi.fn(() => 0),
    },
}))

// Mock WebSocketConnection
vi.mock('../../src/collaboration/network/WebSocketConnection', () => ({
    WebSocketConnection: vi.fn().mockImplementation(() => ({
        connect: vi.fn(),
        send: vi.fn(),
        isConnected: vi.fn(() => true),
        onMessage: vi.fn(),
        onDisconnect: vi.fn(),
        setStatusCallback: vi.fn(),
        updateStatus: vi.fn(),
        clearAuthTimeout: vi.fn(),
    })),
}))

// Mock other dependencies
vi.mock('../../src/collaboration/network/ReconnectionManager', () => ({
    ReconnectionManager: vi.fn().mockImplementation(() => ({
        handleDisconnect: vi.fn(() => false),
        resetReconnectionState: vi.fn(),
        setReconnectCallback: vi.fn(),
        getReconnectTimeout: vi.fn(() => null),
        reconnecting: false,
    })),
}))

vi.mock('../../src/collaboration/network/AckTracker', () => ({
    AckTracker: vi.fn().mockImplementation(() => ({
        getAckTimeout: vi.fn(() => 5000),
    })),
}))

vi.mock('../../src/shared/validation', () => ({
    isValidMessageStructure: vi.fn(() => true),
}))

describe('WebSocketManager', () => {
    let wsManager: WebSocketManager
    let mockHandler: MessageHandler

    beforeEach(() => {
        mockHandler = vi.fn()
        wsManager = new WebSocketManager(mockHandler)
    })

    it('should route authenticated message', () => {
        const msg: NetworkMessage = {
            type: 'authenticated',
            userId: 'user-123',
        }

        wsManager.handleMessage(msg)

        // MessageHandler should be called with network: prefix
        expect(mockHandler).toHaveBeenCalledWith({
            type: 'network:authenticated',
            userId: 'user-123',
        })
    })

    it('should route room_joined message', () => {
        const msg = {
            type: 'room_joined',
            color: '#FF0000',
        } as NetworkMessage

        wsManager.handleMessage(msg)

        expect(mockHandler).toHaveBeenCalledWith({
            type: 'network:room_joined',
            color: '#FF0000',
        })
    })

    it('should route objectAdded message', () => {
        const msg: NetworkMessage = {
            type: 'objectAdded',
            object: { id: 'obj-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 50 },
            userId: 'user-123',
        }

        wsManager.handleMessage(msg)

        expect(mockHandler).toHaveBeenCalledWith({
            type: 'network:objectAdded',
            object: msg.object,
            userId: 'user-123',
        })
    })

    it('should handle unknown message types gracefully', () => {
        const msg: NetworkMessage = {
            type: 'unknown_type',
        }

        // Should not throw
        expect(() => wsManager.handleMessage(msg)).not.toThrow()
    })

    it('should expose ackTracker for verification', () => {
        const ackTracker = wsManager.getAckTracker()
        expect(ackTracker).toBeDefined()
    })
})
