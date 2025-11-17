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

type StateValue = unknown
type Listener = (value: StateValue) => void

export class StateStore<T extends Record<string, unknown> = Record<string, unknown>> {
    state: T
    initialState: T
    listeners: Map<string, Set<Listener>>
    devMode: boolean

    constructor(initialState: T = {} as T) {
        // Use structuredClone for simple, efficient cloning
        this.initialState = structuredClone(initialState)
        this.state = structuredClone(initialState)
        this.listeners = new Map() // path -> Set of callbacks
        this.devMode = import.meta.env?.DEV as boolean

        // Dev tools: log all state changes
        if (this.devMode) {
            this._setupDevTools()
        }
    }

    /**
     * path - Dot-separated path (e.g., 'network.status')
     */

    get(path: string): StateValue {
        if (!path) return this.state

        const keys = path.split('.')
        return keys.reduce((obj: StateValue, key: string) => {
            if (obj && typeof obj === 'object' && key in obj) {
                return (obj as Record<string, unknown>)[key]
            }
            return undefined
        }, this.state as StateValue)
    }

    set(path: string, value: StateValue): void {
        const oldValue = this.get(path)

        // Only update if value changed (strict equality for most values)
        if (oldValue === value) {
            return
        }

        // Update state
        if (path.includes('.')) {
            const keys = path.split('.')
            const lastKey = keys.pop()
            const target = keys.reduce((obj: Record<string, unknown>, key: string) => {
                if (!obj[key]) obj[key] = {}
                return obj[key] as Record<string, unknown>
            }, this.state as Record<string, unknown>)
            if (lastKey) {
                target[lastKey] = value
            }
        } else {
            (this.state as Record<string, unknown>)[path] = value
        }

        // Log in dev mode
        if (this.devMode) {
            this._logStateChange(path, oldValue, value)
        }

        // Notify subscribers
        this._notify(path, value)
    }

    // Used for updating multiple
    batch(updates: Record<string, StateValue>): void {
        const changes: Array<{ path: string; oldValue: StateValue; value: StateValue }> = []

        // Apply all updates
        for (const [path, value] of Object.entries(updates)) {
            const oldValue = this.get(path)

            if (oldValue !== value) {
                // Update without notifying yet
                if (path.includes('.')) {
                    const keys = path.split('.')
                    const lastKey = keys.pop()
                    const target = keys.reduce((obj: Record<string, unknown>, key: string) => {
                        if (!obj[key]) obj[key] = {}
                        return obj[key] as Record<string, unknown>
                    }, this.state as Record<string, unknown>)
                    if (lastKey) {
                        target[lastKey] = value
                    }
                } else {
                    (this.state as Record<string, unknown>)[path] = value
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

    subscribe(path: string, callback: Listener): () => void {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }

        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set())
        }

        this.listeners.get(path)!.add(callback)

        // Call immediately with current value
        const currentValue = this.get(path)
        if (currentValue !== undefined) {
            try {
                callback(currentValue)
            } catch (error) {
                ErrorHandler.silent(error as string | Error, {
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

    // Used for cleanup - clears all listeners and resets state to initial values
    clear(): void {
        this.listeners.clear()
        this.state = structuredClone(this.initialState)
    }

    /**
     * Notify subscribers of a state change
     * @private
     */
    _notify(path: string, value: StateValue): void {
        // Notify exact path subscribers
        const exactListeners = this.listeners.get(path)
        if (exactListeners) {
            exactListeners.forEach(callback => {
                try {
                    callback(value)
                } catch (error) {
                    ErrorHandler.silent(error as string | Error, {
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
                        ErrorHandler.silent(error as string | Error, {
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
    _setupDevTools(): void {
        // Expose store to window for debugging
        if (typeof window !== 'undefined') {
            ;(window as typeof window & { __WHITEBOARD_STORE__: StateStore<T> }).__WHITEBOARD_STORE__ = this
            console.log('[StateStore] Dev mode enabled. Access store via window.__WHITEBOARD_STORE__')
        }
    }

    /**
     * Log state changes in dev mode
     * @private
     */
    _logStateChange(path: string, oldValue: StateValue, newValue: StateValue): void {
        console.log(
            `%c[StateStore] %c${path}%c changed`,
            'color: #888',
            'color: #4CAF50; font-weight: bold',
            'color: #888',
            '\n  Old:', oldValue,
            '\n  New:', newValue
        )
    }
}
