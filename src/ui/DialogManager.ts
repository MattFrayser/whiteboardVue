/**
 * DialogManager
 *
 * Centralized dialog/modal management for the application
 * Handles password prompts, confirmation dialogs, and join room dialogs
 * Provides consistent overlay behavior and keyboard handling
 */

import { DIALOG_FOCUS_DELAY } from '../constants'

export class DialogManager {
    currentDialog: HTMLElement | null

    constructor() {
        this.currentDialog = null
    }

    /**
     * Show a password input dialog
     * @param {string} roomCode - The room code requiring password
     * @param {string} errorMessage - Optional error message to display (for retry attempts)
     * @returns {Promise<string|null>} The entered password, or null if cancelled
     */
    showPasswordDialog(roomCode: string, errorMessage: string | null = null): Promise<string | null> {
        return new Promise((resolve) => {
            // Close any existing dialog
            this.close()

            // Create dialog element
            const dialog = document.createElement('div')
            dialog.className = 'join-room-dialog-overlay'
            dialog.innerHTML = `
                <div class="join-room-dialog">
                    <h2>Password Required</h2>
                    <p>Room <strong>${roomCode}</strong> is password-protected.</p>
                    ${errorMessage ? `<p class="error-message" style="color: #ff6b6b; font-weight: 500;">${errorMessage}</p>` : ''}
                    <input type="password" id="room-password" placeholder="Enter password" autocomplete="off" />
                    <div class="join-room-actions">
                        <button class="join-room-btn join-btn">Enter</button>
                        <button class="join-room-btn stay-local-btn">Cancel</button>
                    </div>
                </div>
            `

            // Add to page
            document.body.appendChild(dialog)
            this.currentDialog = dialog

            // Get elements
            const passwordInput = dialog.querySelector('#room-password') as HTMLInputElement
            const enterBtn = dialog.querySelector('.join-btn')
            const cancelBtn = dialog.querySelector('.stay-local-btn')

            // Store listener references for cleanup
            const handleEscapeKey = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && this.currentDialog === dialog) {
                    handleCancel()
                }
            }

            const handleOverlayClick = (e: Event) => {
                if (e.target === dialog) {
                    handleCancel()
                }
            }

            const handleEnterKey = (e: Event) => {
                if ((e as KeyboardEvent).key === 'Enter') {
                    handleEnter()
                }
            }

            // Cleanup function
            const cleanup = () => {
                document.removeEventListener('keydown', handleEscapeKey)
                dialog.removeEventListener('click', handleOverlayClick)
                passwordInput.removeEventListener('keypress', handleEnterKey)
                enterBtn?.removeEventListener('click', handleEnter)
                cancelBtn?.removeEventListener('click', handleCancel)
            }

            // Handle Enter button
            const handleEnter = () => {
                const password = passwordInput.value.trim()
                cleanup()
                this.close()
                resolve(password || null)
            }

            // Handle Cancel button
            const handleCancel = () => {
                cleanup()
                this.close()
                resolve(null)
            }

            // Add event listeners
            enterBtn?.addEventListener('click', handleEnter)
            cancelBtn?.addEventListener('click', handleCancel)
            passwordInput.addEventListener('keypress', handleEnterKey)
            document.addEventListener('keydown', handleEscapeKey)
            dialog.addEventListener('click', handleOverlayClick)

            // Focus the input
            setTimeout(() => (passwordInput as HTMLElement).focus(), DIALOG_FOCUS_DELAY)
        })
    }

    /**
     * Show a join room dialog
     * @param {string} roomCode - The room code to join
     * @param {Function} onJoin - Callback function to call when user clicks "Join"
     * @param {Function} onCancel - Optional callback function to call when user clicks "Cancel"
     * @returns {Promise<boolean>} True if user chose to join, false if cancelled
     */
    showJoinRoomDialog(roomCode: string, onJoin: (() => void | Promise<void>) | null = null, onCancel: (() => void) | null = null): Promise<boolean> {
        return new Promise((resolve) => {
            // Close any existing dialog
            this.close()

            // Create dialog element
            const dialog = document.createElement('div')
            dialog.className = 'join-room-dialog-overlay'
            dialog.innerHTML = `
                <div class="join-room-dialog">
                    <h2>Join Room?</h2>
                    <p>You've been invited to join room <strong>${roomCode}</strong></p>
                    <p>Would you like to join this collaborative session?</p>
                    <div class="join-room-actions">
                        <button class="join-room-btn join-btn">Join Room</button>
                        <button class="join-room-btn stay-local-btn">Stay Local</button>
                    </div>
                </div>
            `

            // Add to page
            document.body.appendChild(dialog)
            this.currentDialog = dialog

            // Get buttons
            const joinBtn = dialog.querySelector('.join-btn')
            const stayLocalBtn = dialog.querySelector('.stay-local-btn')

            // Store listener references for cleanup
            const handleEscapeKey = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && this.currentDialog === dialog) {
                    handleCancel()
                }
            }

            const handleOverlayClick = (e: Event) => {
                if (e.target === dialog) {
                    handleCancel()
                }
            }

            // Cleanup function
            const cleanup = () => {
                document.removeEventListener('keydown', handleEscapeKey)
                dialog.removeEventListener('click', handleOverlayClick)
                joinBtn?.removeEventListener('click', handleJoin)
                stayLocalBtn?.removeEventListener('click', handleCancel)
            }

            // Handle Join button
            const handleJoin = async () => {
                cleanup()
                this.close()
                if (onJoin) {
                    await onJoin()
                }
                resolve(true)
            }

            // Handle Stay Local button
            const handleCancel = () => {
                cleanup()
                this.close()
                // Remove room code from URL
                window.history.replaceState({}, '', window.location.pathname)
                if (onCancel) {
                    onCancel()
                }
                resolve(false)
            }

            // Add event listeners
            joinBtn?.addEventListener('click', handleJoin)
            stayLocalBtn?.addEventListener('click', handleCancel)
            document.addEventListener('keydown', handleEscapeKey)
            dialog.addEventListener('click', handleOverlayClick)

            // Focus the join button
            setTimeout(() => (joinBtn as HTMLElement).focus(), DIALOG_FOCUS_DELAY)
        })
    }

    /**
     * Show a generic confirmation dialog
     * @param {Object} config - Configuration object
     * @param {string} config.title - Dialog title
     * @param {string} config.message - Dialog message
     * @param {string} config.confirmText - Text for confirm button (default: "Confirm")
     * @param {string} config.cancelText - Text for cancel button (default: "Cancel")
     * @param {string} config.confirmClass - CSS class for confirm button (default: "join-btn")
     * @returns {Promise<boolean>} True if confirmed, false if cancelled
     */
    showConfirmDialog({
        title = 'Confirm',
        message = 'Are you sure?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        confirmClass = 'join-btn'
    }: {
        title?: string
        message?: string
        confirmText?: string
        cancelText?: string
        confirmClass?: string
    } = {}): Promise<boolean> {
        return new Promise((resolve) => {
            // Close any existing dialog
            this.close()

            // Create dialog element
            const dialog = document.createElement('div')
            dialog.className = 'join-room-dialog-overlay'
            dialog.innerHTML = `
                <div class="join-room-dialog">
                    <h2>${title}</h2>
                    <p>${message}</p>
                    <div class="join-room-actions">
                        <button class="join-room-btn ${confirmClass}">${confirmText}</button>
                        <button class="join-room-btn stay-local-btn">${cancelText}</button>
                    </div>
                </div>
            `

            // Add to page
            document.body.appendChild(dialog)
            this.currentDialog = dialog

            // Get buttons
            const confirmBtn = dialog.querySelector(`.${confirmClass}`)
            const cancelBtn = dialog.querySelector('.stay-local-btn')

            // Store listener references for cleanup
            const handleEnterKey = (e: KeyboardEvent) => {
                if (e.key === 'Enter' && this.currentDialog === dialog) {
                    handleConfirm()
                }
            }

            const handleEscapeKey = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && this.currentDialog === dialog) {
                    handleCancel()
                }
            }

            const handleOverlayClick = (e: Event) => {
                if (e.target === dialog) {
                    handleCancel()
                }
            }

            // Cleanup function
            const cleanup = () => {
                document.removeEventListener('keydown', handleEnterKey)
                document.removeEventListener('keydown', handleEscapeKey)
                dialog.removeEventListener('click', handleOverlayClick)
                confirmBtn?.removeEventListener('click', handleConfirm)
                cancelBtn?.removeEventListener('click', handleCancel)
            }

            // Handle Confirm button
            const handleConfirm = () => {
                cleanup()
                this.close()
                resolve(true)
            }

            // Handle Cancel button
            const handleCancel = () => {
                cleanup()
                this.close()
                resolve(false)
            }

            // Add event listeners
            confirmBtn?.addEventListener('click', handleConfirm)
            cancelBtn?.addEventListener('click', handleCancel)
            document.addEventListener('keydown', handleEnterKey)
            document.addEventListener('keydown', handleEscapeKey)
            dialog.addEventListener('click', handleOverlayClick)

            // Focus the confirm button
            setTimeout(() => (confirmBtn as HTMLElement).focus(), DIALOG_FOCUS_DELAY)
        })
    }

    /**
     * Close the current dialog
     */
    close(): void {
        if (this.currentDialog && this.currentDialog.parentNode) {
            this.currentDialog.remove()
        }
        this.currentDialog = null
    }

    /**
     * Cleanup method for component destruction
     */
    destroy(): void {
        this.close()
    }
}
