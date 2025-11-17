/**
 * Generic confirmation dialog
 *
 * Customizable title, message, and button text
 * Returns true if confirmed, false if cancelled
 */
 
import { BaseDialog } from './BaseDialog'
import type { ConfirmDialogConfig } from './types'
 
export class ConfirmDialog extends BaseDialog<boolean> {
    private config: ConfirmDialogConfig
    private confirmButton: HTMLButtonElement | null = null
 
    constructor(config: ConfirmDialogConfig = {}) {
        super()
        this.config = {
            title: config.title || 'Confirm',
            message: config.message || 'Are you sure?',
            confirmText: config.confirmText || 'Confirm',
            cancelText: config.cancelText || 'Cancel',
            confirmClass: config.confirmClass || 'join-btn'
        }
    }
 
    protected buildContent(): HTMLElement {
        const container = document.createElement('div')
 
        container.appendChild(this.createHeading(this.config.title!))
        container.appendChild(this.createParagraph(this.config.message!))
 
        const actions = this.createActionsContainer()
        this.confirmButton = this.createButton(
            this.config.confirmText!,
            this.config.confirmClass!,
            () => this.handleConfirm()
        )
        actions.appendChild(this.confirmButton)
        actions.appendChild(
            this.createButton(this.config.cancelText!, 'stay-local-btn', () => this.handleCancelClick())
        )
        container.appendChild(actions)
 
        return container
    }
 
    protected override setupBaseListeners(): void {
        super.setupBaseListeners()
 
        // Add Enter key to confirm
        const handleEnterKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                this.handleConfirm()
            }
        }
 
        document.addEventListener('keydown', handleEnterKey)
        this.cleanupFns.push(() => {
            document.removeEventListener('keydown', handleEnterKey)
        })
    }
 
    protected getFocusElement(): HTMLElement | null {
        return this.confirmButton
    }
 
    protected getCancelValue(): boolean {
        return false
    }
 
    private handleConfirm(): void {
        this.close(true)
    }
 
    private handleCancelClick(): void {
        this.close(false)
    }
}
