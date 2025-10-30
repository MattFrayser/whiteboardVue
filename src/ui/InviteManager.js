import { appState, selectors } from '../stores/AppState'

export class InviteManager {
    constructor(roomCode) {
        this.roomCode = roomCode // null in local mode, string when networked
        this.button = document.querySelector('.invite-link button')
        this.notification = document.querySelector('.invite-notification')
        this.passwordToggle = document.getElementById('password-toggle')
        this.passwordInput = document.getElementById('password-input')
        this.createSessionMenu = document.querySelector('.createSession-overlay')
        this.createSessionButton = this.createSessionMenu.querySelector('button')

        this.setUpListeners()
        this.updateUI() // Set initial UI state

        // Subscribe to network status changes
        appState.subscribe('network.status', () => {
            this.updateUI()
        })
    }

    setUpListeners() {
        this.button.addEventListener('click', () => this.handleButtonClick())
        this.passwordToggle.addEventListener('change', () => this.togglePassword())
        this.createSessionButton.addEventListener('click', () => this.handleCreateSession())

        // Close modal on overlay click
        this.createSessionMenu.addEventListener('click', (e) => {
            if (e.target === this.createSessionMenu) {
                this.hideSettings()
            }
        })
    }

    /**
     * Update UI based on network status (local vs networked)
     */
    updateUI() {
        const status = selectors.getNetworkStatus()

        if (status === 'local') {
            // Local mode - show "Start Session" button
            this.button.textContent = 'Start Session'
            this.button.disabled = false
        } else if (status === 'connected') {
            // Connected - show "Invite Others" with room code
            this.button.textContent = `Invite Others`
            this.button.disabled = false
        } else if (status === 'connecting') {
            // Connecting - show loading state
            this.button.textContent = 'Connecting...'
            this.button.disabled = true
        } else {
            // Disconnected/Error - disable button
            this.button.textContent = 'Connection Error'
            this.button.disabled = true
        }
    }

    /**
     * Handle main button click - different behavior for local vs networked
     */
    handleButtonClick() {
        const status = selectors.getNetworkStatus()

        if (status === 'local') {
            // Local mode - show settings modal to create session
            this.showSettings()
        } else if (status === 'connected') {
            // Connected mode - copy invite link
            const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomCode}`
            this.copyToClipboard(inviteUrl)
        }
    }

    /**
     * Handle Create Session button click in settings modal
     */
    async handleCreateSession() {
        // Collect settings from modal
        const settings = {
            password: this.passwordToggle.checked ? this.passwordInput.value : null,
        }

        console.log('[InviteManager] Collected settings:', settings)

        // Hide settings modal
        this.hideSettings()

        // Call global createSession function from main.js
        if (window.whiteboardApp && window.whiteboardApp.createSession) {
            try {
                await window.whiteboardApp.createSession(settings)
                this.showNotification('Session created successfully!')
            } catch (error) {
                console.error('[InviteManager] Failed to create session:', error)
                this.showNotification('Failed to create session', 'error')
            }
        } else {
            console.error('[InviteManager] whiteboardApp.createSession not found')
        }
    }

    /**
     * Set room code (called when session is created)
     */
    setRoomCode(roomCode) {
        this.roomCode = roomCode
        this.updateUI()
    }

    togglePassword() {
        if (this.passwordToggle.checked) {
            this.passwordInput.disabled = false;
            this.passwordInput.focus();
        } else {
            this.passwordInput.disabled = true;
            this.passwordInput.value = '';
        }
    }

    async copyToClipboard(link) {
        try {
            await navigator.clipboard.writeText(link)
            this.showNotification('Copied to clipboard')
        } catch (error) {
            this.showNotification('Error encountered while copying to clipboard', 'error')
        }
    }

    showNotification(message, type = 'success') {
        this.notification.textContent = message
        this.notification.className = `invite-notification ${type}`
        this.notification.classList.add('show')

        // fade out
        setTimeout(() => {
            this.notification.classList.remove('show')
        }, 3000)
    }

    showSettings() {
        this.createSessionMenu.style.display = 'block'
        this.createSessionMenu.classList.add('show')
    }

    hideSettings() {
        this.createSessionMenu.style.display = 'none'
        this.createSessionMenu.classList.remove('show')
    }
}
