/**
 * Dialogs are pop up overlays that user interacts with 
 *
 * Base Provides common functionality:
 * - Overlay creation and management
 * - ESC key to close
 * - Click outside to close
 * - Event listener cleanup
 * - Focus management
 * - Promise-based show/hide API
 */
 
import { DIALOG_FOCUS_DELAY } from '../../shared/constants'
 
export abstract class BaseDialog<T = any> {
    protected overlay: HTMLElement | null = null
    protected dialogContent: HTMLElement | null = null
    protected cleanupFns: (() => void)[] = []
    protected resolve: ((value: T) => void) | null = null
 

    // For subclasses
    protected abstract buildContent(): HTMLElement
    protected abstract getFocusElement(): HTMLElement | null
 
    show(): Promise<T> {
        return new Promise((resolve) => {
            this.resolve = resolve
            this.render()
            this.setupBaseListeners()
            this.focusDefault()
        })
    }
 
    protected render(): void {
        // Create overlay
        this.overlay = document.createElement('div')
        this.overlay.className = 'join-room-dialog-overlay'
 
        // Create dialog container
        this.dialogContent = document.createElement('div')
        this.dialogContent.className = 'join-room-dialog'
 
        // Build content from subclass
        const content = this.buildContent()
        this.dialogContent.appendChild(content)
 
        this.overlay.appendChild(this.dialogContent)
        document.body.appendChild(this.overlay)
    }
 
    /**
     * Setup base event listeners (ESC, overlay click)
     */
    protected setupBaseListeners(): void {
        if (!this.overlay) return
 
        // ESC key to close
        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.handleCancel()
            }
        }
 
        // Click overlay to close
        const handleOverlayClick = (e: Event) => {
            if (e.target === this.overlay) {
                this.handleCancel()
            }
        }
 
        document.addEventListener('keydown', handleEscapeKey)
        this.overlay.addEventListener('click', handleOverlayClick)
 
        // Store cleanup functions
        this.cleanupFns.push(() => {
            document.removeEventListener('keydown', handleEscapeKey)
            this.overlay?.removeEventListener('click', handleOverlayClick)
        })
    }
 
    // registered event listeners will be cleaned up automatically
    protected registerListener<K extends keyof HTMLElementEventMap>(
        element: HTMLElement | Document,
        event: K,
        handler: (e: HTMLElementEventMap[K]) => void
    ): void {
        element.addEventListener(event, handler as EventListener)
        this.cleanupFns.push(() => {
            element.removeEventListener(event, handler as EventListener)
        })
    }
 
    protected focusDefault(): void {
        const element = this.getFocusElement()
        if (element) {
            setTimeout(() => element.focus(), DIALOG_FOCUS_DELAY)
        }
    }
 
    // Subclasses can override to customize cancel behavior
    protected handleCancel(): void {
        this.close(this.getCancelValue())
    }
 
    /**
     * Get the value to return when dialog is cancelled
     * Subclasses should override this
     */
    protected abstract getCancelValue(): T
 
    // Close the dialog and resolve the promise
    protected close(value: T): void {
        this.cleanup()
 
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.remove()
        }
 
        this.overlay = null
        this.dialogContent = null
 
        if (this.resolve) {
            this.resolve(value)
            this.resolve = null
        }
    }
 
    protected cleanup(): void {
        this.cleanupFns.forEach(fn => fn())
        this.cleanupFns = []
    }
 
    //==================================
    // Helper functions
    //===================================
    protected createButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button')
        button.className = `join-room-btn ${className}`
        button.textContent = text
        this.registerListener(button, 'click', onClick)
        return button
    }
 
    protected createHeading(text: string): HTMLHeadingElement {
        const heading = document.createElement('h2')
        heading.textContent = text
        return heading
    }
 

    protected createParagraph(text: string, className?: string): HTMLParagraphElement {
        const paragraph = document.createElement('p')
        paragraph.textContent = text
        if (className) {
            paragraph.className = className
        }
        return paragraph
    }
 
    protected createActionsContainer(): HTMLDivElement {
        const actions = document.createElement('div')
        actions.className = 'join-room-actions'
        return actions
    }
}
