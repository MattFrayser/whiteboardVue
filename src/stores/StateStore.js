/**
 * Reactive State Store
 * Provides centralized state management with path-based subscriptions
 * Similar to Zustand/Redux but optimized for vanilla JS
 *
 * Usage:
 *   const store = new StateStore(initialState)
 *   store.set('tool', 'draw')
 *   store.subscribe('tool', (tool) => console.log(tool))
 *   const unsubscribe = store.subscribe('color', updateColor)
 *   unsubscribe() // Clean up
 */

import { ErrorHandler } from '../utils/ErrorHandler'

export class StateStore {
    constructor(initialState = {}) {
        this.state = this._deepClone(initialState)
        this.listeners = new Map() // path -> Set of callbacks
        this.devMode = import.meta.env.DEV

        // Dev tools: log all state changes
        if (this.devMode) {
            this._setupDevTools()
        }
    }

    /**
     * path - Dot-separated path (e.g., 'network.status')
     */

    get(path) {
        if (!path) return this.state

        const keys = path.split('.')
        return keys.reduce((obj, key) => obj?.[key], this.state)
    }

    set(path, value) {
        const oldValue = this.get(path)

        // Only update if value changed
        if (this._deepEqual(oldValue, value)) {
            return
        }

        // Update state
        if (path.includes('.')) {
            const keys = path.split('.')
            const lastKey = keys.pop()
            const target = keys.reduce((obj, key) => {
                if (!obj[key]) obj[key] = {}
                return obj[key]
            }, this.state)
            target[lastKey] = value
        } else {
            this.state[path] = value
        }

        // Log in dev mode
        if (this.devMode) {
            this._logStateChange(path, oldValue, value)
        }

        // Notify subscribers
        this._notify(path, value)
    }

    // Used for updating multiple
    batch(updates) {
        const changes = []

        // Apply all updates
        for (const [path, value] of Object.entries(updates)) {
            const oldValue = this.get(path)

            if (!this._deepEqual(oldValue, value)) {
                // Update without notifying yet
                if (path.includes('.')) {
                    const keys = path.split('.')
                    const lastKey = keys.pop()
                    const target = keys.reduce((obj, key) => {
                        if (!obj[key]) obj[key] = {}
                        return obj[key]
                    }, this.state)
                    target[lastKey] = value
                } else {
                    this.state[path] = value
                }

                changes.push({ path, oldValue, value })
            }
        }

        // Log batch in dev mode
        if (this.devMode && changes.length > 0) {
            console.group('[StateStore] Batch update')
            changes.forEach(({ path, oldValue, value }) => {
                this._logStateChange(path, oldValue, value)
            })
            console.groupEnd()
        }

        // Notify all subscribers
        changes.forEach(({ path, value }) => {
            this._notify(path, value)
        })
    }

    subscribe(path, callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }

        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set())
        }

        this.listeners.get(path).add(callback)

        // Call immediately with current value
        const currentValue = this.get(path)
        if (currentValue !== undefined) {
            try {
                callback(currentValue)
            } catch (error) {
                ErrorHandler.silent(error, {
                    context: 'StateStore',
                    metadata: { path, phase: 'initialCall', subscriberError: true }
                })
            }
        }

        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(path)
            if (callbacks) {
                callbacks.delete(callback)
                if (callbacks.size === 0) {
                    this.listeners.delete(path)
                }
            }
        }
    }

    // used for cleanup
    clear() {
        this.listeners.clear()
    }

    /**
     * Notify subscribers of a state change
     * @private
     */
    _notify(path, value) {
        // Notify exact path subscribers
        const exactListeners = this.listeners.get(path)
        if (exactListeners) {
            exactListeners.forEach(callback => {
                try {
                    callback(value)
                } catch (error) {
                    ErrorHandler.silent(error, {
                        context: 'StateStore',
                        metadata: { path, subscriberError: true }
                    })
                }
            })
        }

        // Notify parent path subscribers (e.g., 'network' when 'network.status' changes)
        const parts = path.split('.')
        for (let i = parts.length - 1; i > 0; i--) {
            const parentPath = parts.slice(0, i).join('.')
            const parentListeners = this.listeners.get(parentPath)

            if (parentListeners) {
                const parentValue = this.get(parentPath)
                parentListeners.forEach(callback => {
                    try {
                        callback(parentValue)
                    } catch (error) {
                        ErrorHandler.silent(error, {
                            context: 'StateStore',
                            metadata: { path: parentPath, parentPath, subscriberError: true }
                        })
                    }
                })
            }
        }
    }

    /**
     * Setup dev tools for debugging
     * @private
     */
    _setupDevTools() {
        // Expose store to window for debugging
        if (typeof window !== 'undefined') {
            window.__WHITEBOARD_STORE__ = this
            console.log('[StateStore] Dev mode enabled. Access store via window.__WHITEBOARD_STORE__')
        }
    }

    /**
     * Log state changes in dev mode
     * @private
     */
    _logStateChange(path, oldValue, newValue) {
        console.log(
            `%c[StateStore] %c${path}%c changed`,
            'color: #888',
            'color: #4CAF50; font-weight: bold',
            'color: #888',
            '\n  Old:', oldValue,
            '\n  New:', newValue
        )
    }

    /**
     * Deep equality check
     * @private
     */
    _deepEqual(a, b) {
        if (a === b) return true
        if (a == null || b == null) return false
        if (typeof a !== 'object' || typeof b !== 'object') return false

        const keysA = Object.keys(a)
        const keysB = Object.keys(b)

        if (keysA.length !== keysB.length) return false

        for (const key of keysA) {
            if (!keysB.includes(key)) return false
            if (!this._deepEqual(a[key], b[key])) return false
        }

        return true
    }

    /**
     * Deep clone an object
     * @private
     */
    _deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj
        if (obj instanceof Date) return new Date(obj)
        if (obj instanceof Array) return obj.map(item => this._deepClone(item))

        const cloned = {}
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this._deepClone(obj[key])
            }
        }
        return cloned
    }
}
