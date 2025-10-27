/** 
 * Event bus for decoupling components
 * Implements pub-sub pattern
 */

export class EventBus {
    constructor() {
        this.listeners = new Map() // event -> set of callbacks
        this.onceListeners = new Map() // event -> set of callbacks (one-time)
    }

    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set())
        }

        this.listeners.get(event).add(callback)

        return () => this.unSubscribe(event, callback)
    }

    unSubscribe(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback)
        }
        if (this.onceListeners.has(event)) {
            this.onceListeners.get(event).delete(callback)
        }
    }

    publish(event, data) {
        // Call regular listeners
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data)
                } catch (error) {
                    console.error(`Error in event listener for "${event}":`, error)
                }
            })
        }

        // Call and remove one-time listeners
        if (this.onceListeners.has(event)) {
            this.onceListeners.get(event).forEach(callback => {
                try {
                    callback(data)
                } catch (error) {
                    console.error(`Error in one-time listener for "${event}":`, error)
                }
            })
            this.onceListeners.delete(event)
        }
    }

    once(event, callback) {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set())
        }
        this.onceListeners.get(event).add(callback)
    }

    clear(event) {
        if (event) {
            this.listeners.delete(event)
            this.onceListeners.delete(event)
        } else {
            this.listeners.clear()
            this.onceListeners.clear()
        }
    }
}

