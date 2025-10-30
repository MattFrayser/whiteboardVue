/**
 * Application State Definition
 * Centralized state structure for the whiteboard application
 *
 * This serves as the single source of truth for application state.
 * All components subscribe to relevant slices of this state.
 */

import { StateStore } from './StateStore'

const initialState = {

    // UI State: Drawing tool settings
    ui: {
        tool: 'draw',           // Current tool: 'draw', 'select', 'erase', 'text'
        color: '#000000',       // Current drawing color
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


export const appState = new StateStore(initialState)

/**
 * State selectors and actions- convenient getters and setters
 * These are optional but make it easier/cleaner to access
 */
export const selectors = {
    // UI selectors
    getTool: () => appState.get('ui.tool'),
    getColor: () => appState.get('ui.color'),
    getBrushSize: () => appState.get('ui.brushSize'),
    getCursor: () => appState.get('ui.cursor'),

    // Object selectors
    getObjects: () => appState.get('objects.items'),
    getObjectsVersion: () => appState.get('objects.version'),

    // Selection selectors
    getSelectedObjectIds: () => appState.get('selection.objectIds'),
    getSelectionBounds: () => appState.get('selection.bounds'),
    isSelected: (objectId) => {
        const selected = appState.get('selection.objectIds')
        return selected.includes(objectId)
    },

    // History selectors
    canUndo: () => appState.get('history.canUndo'),
    canRedo: () => appState.get('history.canRedo'),

    // Network selectors
    getNetworkStatus: () => appState.get('network.status'),
    getRoomCode: () => appState.get('network.roomCode'),
    getUserId: () => appState.get('network.userId'),
    getUsers: () => appState.get('network.users'),
    isConnected: () => appState.get('network.status') === 'connected',
    isLocalMode: () => appState.get('network.status') === 'local',
}

export const actions = {
    // UI actions
    setTool: (tool) => appState.set('ui.tool', tool),
    setColor: (color) => appState.set('ui.color', color),
    setBrushSize: (size) => appState.set('ui.brushSize', size),
    setCursor: (cursor) => appState.set('ui.cursor', cursor),

    // Object actions
    setObjects: (objects) => {
        appState.batch({
            'objects.items': objects,
            'objects.version': appState.get('objects.version') + 1,
        })
    },
    addObject: (object) => {
        const current = appState.get('objects.items')
        appState.batch({
            'objects.items': [...current, object],
            'objects.version': appState.get('objects.version') + 1,
        })
    },
    updateObject: (objectId, updates) => {
        const current = appState.get('objects.items')
        const updated = current.map(obj =>
            obj.id === objectId ? { ...obj, ...updates } : obj
        )
        appState.batch({
            'objects.items': updated,
            'objects.version': appState.get('objects.version') + 1,
        })
    },
    deleteObject: (objectId) => {
        const current = appState.get('objects.items')
        appState.batch({
            'objects.items': current.filter(obj => obj.id !== objectId),
            'objects.version': appState.get('objects.version') + 1,
        })
    },

    // Selection actions
    setSelection: (objectIds) => {
        appState.set('selection.objectIds', objectIds)
    },
    setSelectionBounds: (bounds) => {
        appState.set('selection.bounds', bounds)
    },
    clearSelection: () => {
        appState.batch({
            'selection.objectIds': [],
            'selection.bounds': null,
        })
    },

    // History actions
    setHistoryState: (canUndo, canRedo, pointer, size) => {
        appState.batch({
            'history.canUndo': canUndo,
            'history.canRedo': canRedo,
            'history.pointer': pointer,
            'history.size': size,
        })
    },

    // Network actions
    setNetworkStatus: (status) => {
        appState.set('network.status', status)
    },
    setRoomCode: (roomCode) => {
        appState.set('network.roomCode', roomCode)
    },
    setUserId: (userId) => {
        appState.set('network.userId', userId)
    },
    setUsers: (users) => {
        appState.set('network.users', users)
    },
    setNetworkState: (status, roomCode = null, userId = null) => {
        const updates = { 'network.status': status }
        if (roomCode !== null) updates['network.roomCode'] = roomCode
        if (userId !== null) updates['network.userId'] = userId
        appState.batch(updates)
    },
}
