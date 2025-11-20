/**
 * Single source of truth for application state.
 * All components subscribe to relevant slices of this state.
 */

import { StateStore } from './StateStore'
import { DEFAULT_COLOR } from '../constants'
import { clampBrushSize, validateColor } from '../validation'
import { RemoteCursor } from '../types'

// Type definitions for the application state
export type Tool = string
export type NetworkStatus = 'local' | 'connecting' | 'connected' | 'disconnected' | 'error'

export interface User {
    id: string
    color: string
    cursor?: { x: number; y: number }
}

export interface SelectionBounds {
    x: number
    y: number
    width: number
    height: number
}

export interface Viewport {
    offsetX: number
    offsetY: number
    scale: number
}

interface AppStateShape extends Record<string, unknown> {
    ui: {
        tool: Tool
        color: string
        brushSize: number
        cursor: string
    }
    viewport: Viewport
    selection: {
        objectIds: string[]
        bounds: SelectionBounds | null
    }
    history: {
        canUndo: boolean
        canRedo: boolean
        pointer: number
        size: number
    }
    network: {
        status: NetworkStatus
        roomCode: string | null
        userId: string | null
        userColor: string | null
        users: User[]
        remoteCursors: Record<string, RemoteCursor>
        isAuthenticating: boolean
        reconnectAttempts: number
    }
}

const initialState: AppStateShape = {
    // UI State: Drawing tool settings
    ui: {
        tool: 'draw', 
        color: DEFAULT_COLOR, 
        brushSize: 5, 
        cursor: 'crosshair', 
    },

    // Viewport: Camera transform (pan/zoom)
    viewport: {
        offsetX: 0, 
        offsetY: 0, 
        scale: 1, 
    },

    // Selection: Currently selected objects
    selection: {
        objectIds: [], // IDs of selected objects
        bounds: null, // Bounding box { x, y, width, height }
    },

    // History: Undo/redo state
    history: {
        canUndo: false, 
        canRedo: false, 
        pointer: -1, // Current position in history
        size: 0, 
    },

    // Network: WebSocket connection state
    network: {
        status: 'local', 
        roomCode: null, // null in local mode
        userId: null, 
        userColor: null, // users color in collab mode 
        users: [], // [{ id, color, cursor }]
        remoteCursors: {}, // <userId, RemoteCursor>
        isAuthenticating: false, 
        reconnectAttempts: 0, 
    },
}

export const appState = new StateStore<AppStateShape>(initialState)

/**
 * State selectors and actions
 * easier/cleaner access
 */
export const selectors = {
    // UI selectors
    getTool: () => appState.get('ui.tool') as Tool,
    getColor: () => appState.get('ui.color') as string,
    getBrushSize: () => appState.get('ui.brushSize') as number,
    getCursor: () => appState.get('ui.cursor') as string,

    // Viewport selectors
    getViewport: () => appState.get('viewport') as Viewport,
    getViewportOffsetX: () => appState.get('viewport.offsetX') as number,
    getViewportOffsetY: () => appState.get('viewport.offsetY') as number,
    getViewportScale: () => appState.get('viewport.scale') as number,

    // Selection selectors
    getSelectedObjectIds: () => appState.get('selection.objectIds') as string[],
    getSelectionBounds: () => appState.get('selection.bounds') as SelectionBounds | null,
    isSelected: (objectId: string) => {
        const selected = appState.get('selection.objectIds') as string[]
        return selected.includes(objectId)
    },

    // History selectors
    canUndo: () => appState.get('history.canUndo') as boolean,
    canRedo: () => appState.get('history.canRedo') as boolean,

    // Network selectors
    getNetworkStatus: () => appState.get('network.status') as NetworkStatus,
    getRoomCode: () => appState.get('network.roomCode') as string | null,
    getUserId: () => appState.get('network.userId') as string | null,
    getUserColor: () => appState.get('network.userColor') as string | null,
    getUsers: () => appState.get('network.users') as User[],
    getRemoteCursors: () => appState.get('network.remoteCursors') as Record<string, RemoteCursor>,
    getIsAuthenticating: () => appState.get('network.isAuthenticating') as boolean,
    getReconnectAttempts: () => appState.get('network.reconnectAttempts') as number,
    isConnected: () => appState.get('network.status') === 'connected',
    isLocalMode: () => appState.get('network.status') === 'local',
}

export const actions = {
    // UI actions
    setTool: (tool: Tool) => appState.set('ui.tool', tool),
    setColor: (color: string) => appState.set('ui.color', validateColor(color)),
    setBrushSize: (size: number) => appState.set('ui.brushSize', clampBrushSize(size)),
    setCursor: (cursor: string) => appState.set('ui.cursor', cursor),

    // Viewport actions
    setViewport: (viewport: Viewport) => appState.set('viewport', viewport),
    setViewportTransform: (offsetX: number, offsetY: number, scale: number) => {
        appState.batch({
            'viewport.offsetX': offsetX,
            'viewport.offsetY': offsetY,
            'viewport.scale': scale,
        })
    },
    setViewportOffset: (offsetX: number, offsetY: number) => {
        appState.batch({
            'viewport.offsetX': offsetX,
            'viewport.offsetY': offsetY,
        })
    },
    setViewportScale: (scale: number) => appState.set('viewport.scale', scale),

    // Selection actions
    setSelection: (objectIds: string[]) => {
        appState.set('selection.objectIds', objectIds)
    },
    setSelectionBounds: (bounds: SelectionBounds | null) => {
        appState.set('selection.bounds', bounds)
    },
    clearSelection: () => {
        appState.batch({
            'selection.objectIds': [],
            'selection.bounds': null,
        })
    },

    // History actions
    setHistoryState: (canUndo: boolean, canRedo: boolean, pointer: number, size: number) => {
        appState.batch({
            'history.canUndo': canUndo,
            'history.canRedo': canRedo,
            'history.pointer': pointer,
            'history.size': size,
        })
    },

    // Network actions
    setNetworkStatus: (status: NetworkStatus) => {
        appState.set('network.status', status)
    },
    setRoomCode: (roomCode: string | null) => {
        appState.set('network.roomCode', roomCode)
    },
    setUserId: (userId: string | null) => {
        appState.set('network.userId', userId)
    },
    setUserColor: (userColor: string | null) => {
        appState.set('network.userColor', userColor)
    },
    setUsers: (users: User[]) => {
        appState.set('network.users', users)
    },
    setRemoteCursors: (cursors: Record<string, RemoteCursor>) => {
        appState.set('network.remoteCursors', cursors)
    },
    addRemoteCursor: (userId: string, cursor: RemoteCursor) => {
        const cursors = appState.get('network.remoteCursors') as Record<string, RemoteCursor>
        appState.set('network.remoteCursors', { ...cursors, [userId]: cursor })
    },
    removeRemoteCursor: (userId: string) => {
        const cursors = appState.get('network.remoteCursors') as Record<string, RemoteCursor>
        const { [userId]: _, ...newCursors } = cursors
        appState.set('network.remoteCursors', newCursors)
    },
    setIsAuthenticating: (isAuthenticating: boolean) => {
        appState.set('network.isAuthenticating', isAuthenticating)
    },
    setReconnectAttempts: (attempts: number) => {
        appState.set('network.reconnectAttempts', attempts)
    },
    incrementReconnectAttempts: () => {
        const current = appState.get('network.reconnectAttempts') as number
        appState.set('network.reconnectAttempts', current + 1)
    },
    resetReconnectAttempts: () => {
        appState.set('network.reconnectAttempts', 0)
    },
    setNetworkState: (
        status: NetworkStatus,
        roomCode: string | null = null,
        userId: string | null = null
    ) => {
        const updates: Record<string, unknown> = { 'network.status': status }
        if (roomCode !== null) updates['network.roomCode'] = roomCode
        if (userId !== null) updates['network.userId'] = userId
        appState.batch(updates)
    },
}
