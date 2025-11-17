/**
 * Prompt user to join a collaborative room
 *
 * Shows room code and asks if user wants to join
 * Returns true if user joins, false if cancelled
 */
 
import { BaseDialog } from './BaseDialog'
import type { JoinRoomDialogConfig } from './types'
import { sanitizeRoomCode } from '../../utils/validation'
 
export class JoinRoomDialog extends BaseDialog<boolean> {
    private config: JoinRoomDialogConfig
    private joinButton: HTMLButtonElement | null = null
 
    constructor(config: JoinRoomDialogConfig) {
        super()
        this.config = config
    }
 
    protected buildContent(): HTMLElement {
        const container = document.createElement('div')
 
        // Sanitize room code to prevent XSS
        const safeRoomCode = sanitizeRoomCode(this.config.roomCode)
 
        container.appendChild(this.createHeading('Join Room?'))
 
        // Room code info
        const roomParagraph = document.createElement('p')
        roomParagraph.innerHTML = 'You\'ve been invited to join room <strong></strong>'
        roomParagraph.querySelector('strong')!.textContent = safeRoomCode  // Safe: sanitized + textContent prevents XSS
        container.appendChild(roomParagraph)
 
        container.appendChild(
            this.createParagraph('Would you like to join this collaborative session?')
        )
 
        // Actions
        const actions = this.createActionsContainer()
        this.joinButton = this.createButton('Join Room', 'join-btn', () => this.handleJoin())
        actions.appendChild(this.joinButton)
        actions.appendChild(this.createButton('Stay Local', 'stay-local-btn', () => this.handleStayLocal()))
        container.appendChild(actions)
 
        return container
    }
 
    protected getFocusElement(): HTMLElement | null {
        return this.joinButton
    }
 
    protected getCancelValue(): boolean {
        return false
    }
 
    private async handleJoin(): Promise<void> {
        // Call onJoin callback if provided
        if (this.config.onJoin) {
            await this.config.onJoin()
        }
        this.close(true)
    }
 
    private handleStayLocal(): void {
        // Remove room code from URL
        window.history.replaceState({}, '', window.location.pathname)
 
        // Call onCancel callback if provided
        if (this.config.onCancel) {
            this.config.onCancel()
        }
 
        this.close(false)
    }
 
    protected override handleCancel(): void {
        // When ESC or overlay click, treat as "Stay Local"
        this.handleStayLocal()
    }
}
