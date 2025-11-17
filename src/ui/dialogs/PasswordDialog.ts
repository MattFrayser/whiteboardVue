/**
 * Password input dialog for protected rooms
 *
 * Shows a password input field and handles submission
 * Returns the entered password or null if cancelled
 */
 
import { BaseDialog } from './BaseDialog'
import type { PasswordDialogConfig } from './types'
import { sanitizeRoomCode } from '../../shared/utils/validation'
 
export class PasswordDialog extends BaseDialog<string | null> {
    private config: PasswordDialogConfig
    private passwordInput: HTMLInputElement | null = null
 
    constructor(config: PasswordDialogConfig) {
        super()
        this.config = config
    }
 
    protected buildContent(): HTMLElement {
        const fragment = document.createDocumentFragment()
        const container = document.createElement('div')
 
        // Sanitize room code to prevent XSS (defense-in-depth)
        const safeRoomCode = sanitizeRoomCode(this.config.roomCode)
 
        container.appendChild(this.createHeading('Password Required'))
 
        // Room info
        const roomParagraph = document.createElement('p')
        const roomText = document.createTextNode('Room ')
        const strong = document.createElement('strong')
        strong.textContent = safeRoomCode
        const protectedText = document.createTextNode(' is password-protected.')
        roomParagraph.appendChild(roomText)
        roomParagraph.appendChild(strong)
        roomParagraph.appendChild(protectedText)
        container.appendChild(roomParagraph)
 
        // Error message (if retry)
        if (this.config.errorMessage) {
            const errorParagraph = document.createElement('p')
            errorParagraph.className = 'error-message'
            errorParagraph.style.color = '#ff6b6b'
            errorParagraph.style.fontWeight = '500'
            errorParagraph.textContent = this.config.errorMessage
            container.appendChild(errorParagraph)
        }
 
        // Password input
        this.passwordInput = document.createElement('input')
        this.passwordInput.type = 'password'
        this.passwordInput.id = 'room-password'
        this.passwordInput.placeholder = 'Enter password'
        this.passwordInput.autocomplete = 'off'
        container.appendChild(this.passwordInput)
 
        // Handle Enter key on input
        this.registerListener(this.passwordInput, 'keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSubmit()
            }
        })
 
        // Actions
        const actions = this.createActionsContainer()
        actions.appendChild(this.createButton('Enter', 'join-btn', () => this.handleSubmit()))
        actions.appendChild(this.createButton('Cancel', 'stay-local-btn', () => this.handleCancel()))
        container.appendChild(actions)
 
        fragment.appendChild(container)
        return container
    }
 
    protected getFocusElement(): HTMLElement | null {
        return this.passwordInput
    }
 
    protected getCancelValue(): string | null {
        return null
    }
 
    private handleSubmit(): void {
        const password = this.passwordInput?.value.trim() || ''
        this.close(password || null)
    }
}
