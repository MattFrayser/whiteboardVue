/**
 * Application State Definition
 * Centralized state structure for the whiteboard application
 *
 * This serves as the single source of truth for application state.
 * All components subscribe to relevant slices of this state.
 */

import { StateStore } from './StateStore'
import { DEFAULT_COLOR } from '../constants'

// Type definitions for the application state
export type Tool = 'draw' | 'select' | 'erase' | 'text'
export type NetworkStatus = 'local' | 'connecting' | 'connected' | 'disconnected' | 'error'

export interface DrawingObject {
    id: string
    [key: string]: unknown
}

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

interface AppStateShape extends Record<string, unknown> {
    ui: {
        tool: Tool
        color: string
        brushSize: number
        cursor: string
    }
    objects: {
        items: DrawingObject[]
        version: number
    }
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
        users: User[]
    }
}

const initialState: AppStateShape = {

    // UI State: Drawing tool settings
    ui: {
        tool: 'draw',           // Current tool: 'draw', 'select', 'erase', 'text'
        color: DEFAULT_COLOR,   // Current drawing color
        brushSize: 5,           // Current brush size
        cursor: 'crosshair',    // Current cursor style
    },

    // Objects: Drawing objects in the canvas
    objects: {
        items: [],              // Array of DrawingObject instances
        version: 0,             // Incremented on each change (for sync)
    },

    // Selection: Currently selected objects
    selection: {
        objectIds: [],          // IDs of selected objects
        bounds: null,           // Bounding box { x, y, width, height }
    },

    // History: Undo/redo state
    history: {
        canUndo: false,         // Can undo?
        canRedo: false,         // Can redo?
        pointer: -1,            // Current position in history
        size: 0,                // Total history size
    },

    // Network: WebSocket connection state
    network: {
        status: 'local',        // 'local' | 'connecting' | 'connected' | 'disconnected' | 'error'
        roomCode: null,         // Current room code (null in local mode)
        userId: null,           // Current user's ID (temporary local ID in local mode, server ID when connected)
        users: [],              // Other connected users [{ id, color, cursor }]
    },
}


export const appState = new StateStore<AppStateShape>(initialState)

/**
 * State selectors and actions- convenient getters and setters
 * These are optional but make it easier/cleaner to access
 */
export const selectors = {
    // UI selectors
    getTool: () => appState.get('ui.tool') as Tool,
    getColor: () => appState.get('ui.color') as string,
    getBrushSize: () => appState.get('ui.brushSize') as number,
    getCursor: () => appState.get('ui.cursor') as string,

    // Object selectors
    getObjects: () => appState.get('objects.items') as DrawingObject[],
    getObjectsVersion: () => appState.get('objects.version') as number,

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
    getUsers: () => appState.get('network.users') as User[],
    isConnected: () => appState.get('network.status') === 'connected',
    isLocalMode: () => appState.get('network.status') === 'local',
}

export const actions = {
    // UI actions
    setTool: (tool: Tool) => appState.set('ui.tool', tool),
    setColor: (color: string) => appState.set('ui.color', color),
    setBrushSize: (size: number) => appState.set('ui.brushSize', size),
    setCursor: (cursor: string) => appState.set('ui.cursor', cursor),

    // Object actions
    setObjects: (objects: DrawingObject[]) => {
        appState.batch({
            'objects.items': objects,
            'objects.version': (appState.get('objects.version') as number) + 1,
        })
    },
    addObject: (object: DrawingObject) => {
        const current = appState.get('objects.items') as DrawingObject[]
        appState.batch({
            'objects.items': [...current, object],
            'objects.version': (appState.get('objects.version') as number) + 1,
        })
    },
    updateObject: (objectId: string, updates: Partial<DrawingObject>) => {
        const current = appState.get('objects.items') as DrawingObject[]
        const updated = current.map(obj =>
            obj.id === objectId ? { ...obj, ...updates } : obj
        )
        appState.batch({
            'objects.items': updated,
            'objects.version': (appState.get('objects.version') as number) + 1,
        })
    },
    deleteObject: (objectId: string) => {
        const current = appState.get('objects.items') as DrawingObject[]
        appState.batch({
            'objects.items': current.filter(obj => obj.id !== objectId),
            'objects.version': (appState.get('objects.version') as number) + 1,
        })
    },

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
    setUsers: (users: User[]) => {
        appState.set('network.users', users)
    },
    setNetworkState: (status: NetworkStatus, roomCode: string | null = null, userId: string | null = null) => {
        const updates: Record<string, unknown> = { 'network.status': status }
        if (roomCode !== null) updates['network.roomCode'] = roomCode
        if (userId !== null) updates['network.userId'] = userId
        appState.batch(updates)
    },
}
