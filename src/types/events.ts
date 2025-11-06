/**
 * Event Handler Type Definitions
 *
 * Generic and specific type definitions for event handlers,
 * callbacks, and listener functions.
 */

// ============================================================================
// Generic Event Handler Types
// ============================================================================

/**
 * Generic DOM event handler type
 * @template T - The specific Event type (Event, MouseEvent, KeyboardEvent, etc.)
 */
export type DOMEventHandler<T extends Event = Event> = (event: T) => void

/**
 * Generic callback function type
 * @template T - The type of the argument passed to the callback
 * @template R - The return type of the callback (defaults to void)
 */
export type CallbackFunction<T = void, R = void> = (arg: T) => R

/**
 * Generic callback with no arguments
 */
export type VoidCallback = () => void

// ============================================================================
// Specific Event Handler Types
// ============================================================================

export type InputEventHandler = DOMEventHandler<Event>
export type KeyboardEventHandler = DOMEventHandler<KeyboardEvent>
export type MouseEventHandler = DOMEventHandler<MouseEvent>
export type ClickEventHandler = DOMEventHandler<MouseEvent>
export type ChangeEventHandler = DOMEventHandler<Event>
export type FocusEventHandler = DOMEventHandler<FocusEvent>
export type BlurEventHandler = DOMEventHandler<FocusEvent>

// ============================================================================
// WebSocket Event Handler Types
// ============================================================================

export type WebSocketOpenHandler = DOMEventHandler<Event>
export type WebSocketCloseHandler = DOMEventHandler<CloseEvent>
export type WebSocketErrorHandler = DOMEventHandler<Event>
export type WebSocketMessageHandler = DOMEventHandler<MessageEvent>

// ============================================================================
// Custom Event Handler Types
// ============================================================================

/**
 * State change listener type for reactive state management
 * @template T - The type of the state value
 */
export type StateChangeListener<T> = (value: T) => void

/**
 * Unsubscribe function returned by event subscriptions
 */
export type UnsubscribeFunction = () => void

// ============================================================================
// Event Handler with Target Types
// ============================================================================

/**
 * Event handler with typed event target
 * @template E - The Event type
 * @template T - The EventTarget type (e.g., HTMLInputElement)
 */
export type TypedEventHandler<E extends Event, T extends EventTarget> = (
    event: E & { target: T }
) => void

/**
 * Common typed event handlers for HTML elements
 */
export type InputElementChangeHandler = TypedEventHandler<Event, HTMLInputElement>
export type ButtonClickHandler = TypedEventHandler<MouseEvent, HTMLButtonElement>
export type FormSubmitHandler = TypedEventHandler<SubmitEvent, HTMLFormElement>

// ============================================================================
// Async Event Handler Types
// ============================================================================

/**
 * Async event handler that returns a Promise
 */
export type AsyncEventHandler<T extends Event = Event> = (event: T) => Promise<void>

/**
 * Async callback function
 */
export type AsyncCallback<T = void, R = void> = (arg: T) => Promise<R>
