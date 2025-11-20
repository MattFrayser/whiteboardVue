/**
 * Centralized state management w/ path-based subscriptions
 * use dot notation (network.status) for nested access
 */


 // Usage:
 //   const store = new StateStore(initialState)
 //   store.set('tool', 'draw')
 //   store.subscribe('tool', (tool) => console.log(tool))
 //   const unsubscribe = store.subscribe('color', updateColor)
 //   unsubscribe() // Clean up

import { ErrorHandler } from '../utils/ErrorHandler'

type StateValue = unknown
type Listener = (value: StateValue) => void

export class StateStore<T extends Record<string, unknown> = Record<string, unknown>> {
    state: T
    initialState: T // backup for resets
    listeners: Map<string, Set<Listener>> 
    devMode: boolean

    constructor(initialState: T = {} as T) {
        this.initialState = structuredClone(initialState)
        this.state = structuredClone(initialState)
        this.listeners = new Map() // path -> Set of callbacks
        this.devMode = import.meta.env?.DEV as boolean

        // Dev tools: log all state changes
        if (this.devMode) {
            this._setupDevTools()
        }
    }

    /*
     * `as Record<string, unknown>` is  used for type assertions.
     * TypeScript doesn't allow dynamic property access on generic types. 
     * Choosing to sacrifice compile-time type checking of paths
     * in exchange for runtime flexibility to access nested properties dynamically.
     *
     * This helper is for clairity.
     */
    private asIndexable(obj: unknown): Record<string, unknown> {
        return obj as Record<string, unknown>
    }
    
    // path = Dot-separated path (ex: network.status)
    // walk down obj tree using reduce to get value
    get(path: string): StateValue {
        if (!path) return this.state

        const keys = path.split('.')
        return keys.reduce((obj: StateValue, key: string) => {
            if (obj && typeof obj === 'object' && key in obj) {
                return this.asIndexable(obj)[key]
            }
            return undefined
        }, this.state as StateValue)
    }

    set(path: string, value: StateValue): void {
        const oldValue = this.get(path)

        // Only update if value changed 
        if (oldValue === value) {
            return
        }

        // Update state
        if (path.includes('.')) {
            const keys = path.split('.')
            const lastKey = keys.pop()
            const target = keys.reduce(
                (obj: Record<string, unknown>, key: string) => {
                    if (!obj[key]) obj[key] = {} // create missing objects
                    return this.asIndexable(obj[key])
                },
                this.asIndexable(this.state)
            )
            if (lastKey) {
                target[lastKey] = value
            }
        } else {
            this.asIndexable(this.state)[path] = value
        }

        if (this.devMode) {
            this._logStateChange(path, oldValue, value)
        }

        // Notify all subscribers
        this._notify(path, value)
    }

    // Used for updating multiple
    batch(updates: Record<string, StateValue>): void {
        const changes: Array<{ path: string; oldValue: StateValue; value: StateValue }> = []

        // Apply all updates
        for (const [path, value] of Object.entries(updates)) {
            const oldValue = this.get(path)

            if (oldValue !== value) {
                // Update w/o notifying
                if (path.includes('.')) {
                    const keys = path.split('.')
                    const lastKey = keys.pop()
                    const target = keys.reduce(
                        (obj: Record<string, unknown>, key: string) => {
                            if (!obj[key]) obj[key] = {}
                            return this.asIndexable(obj[key])
                        },
                        this.asIndexable(this.state)
                    )
                    if (lastKey) {
                        target[lastKey] = value
                    }
                } else {
                    this.asIndexable(this.state)[path] = value
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

        // Now notify all subscribers, only once
        changes.forEach(({ path, value }) => {
            this._notify(path, value)
        })
    }

    subscribe(path: string, callback: Listener): () => void {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }

        // add callback to map
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
                    metadata: { path, phase: 'initialCall', subscriberError: true },
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

    // for cleanup - clear all listeners and reset state 
    clear(): void {
        this.listeners.clear()
        this.state = structuredClone(this.initialState)
    }

    // notify subscribers
    _notify(path: string, value: StateValue): void {
        // Exact path subscribers
        const exactListeners = this.listeners.get(path)
        if (exactListeners) {
            exactListeners.forEach(callback => {
                try {
                    callback(value)
                } catch (error) {
                    ErrorHandler.silent(error as string | Error, {
                        context: 'StateStore',
                        metadata: { path, subscriberError: true },
                    })
                }
            })
        }

        // Parent path subscribers (ex: 'network' when 'network.status' changes)
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
                            metadata: { path: parentPath, parentPath, subscriberError: true },
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
            ;(
                window as typeof window & { __WHITEBOARD_STORE__: StateStore<T> }
            ).__WHITEBOARD_STORE__ = this
            console.log(
                '[StateStore] Dev mode enabled. Access store via window.__WHITEBOARD_STORE__'
            )
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
            '\n  Old:',
            oldValue,
            '\n  New:',
            newValue
        )
    }
}
