/**
 * Event Handler Type Definitions
 *
 * Essential generic type definitions for event handlers and callbacks.
 * Use these as building blocks rather than specific type aliases.
 */

// ============================================================================
// Generic Event Handler Types
// ============================================================================

/**
 * Generic DOM event handler
 * Usage: DOMEventHandler<MouseEvent>, DOMEventHandler<KeyboardEvent>, etc.
 */
export type DOMEventHandler<T extends Event = Event> = (event: T) => void

/**
 * Generic callback function
 */
export type CallbackFunction<T = void, R = void> = (arg: T) => R

/**
 * No-argument callback
 */
export type VoidCallback = () => void

// ============================================================================
// Advanced Event Handler Types
// ============================================================================

/**
 * Event handler with typed event target
 * Usage: TypedEventHandler<MouseEvent, HTMLButtonElement>
 */
export type TypedEventHandler<E extends Event, T extends EventTarget> = (
    event: E & { target: T }
) => void

/**
 * Async event handler
 */
export type AsyncEventHandler<T extends Event = Event> = (event: T) => Promise<void>

/**
 * Async callback
 */
export type AsyncCallback<T = void, R = void> = (arg: T) => Promise<R>

// ============================================================================
// State Management Types
// ============================================================================

/**
 * State change listener for reactive state
 */
export type StateChangeListener<T> = (value: T) => void

/**
 * Unsubscribe function for event subscriptions
 */
export type UnsubscribeFunction = () => void
