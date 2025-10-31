import { appState, selectors } from '../stores/AppState'
import { ErrorHandler, ErrorCategory } from '../utils/ErrorHandler'

export class InviteManager {
    constructor(roomCode, notificationManager = null, sessionManager = null) {
        this.roomCode = roomCode // null in local mode, string when networked
        this.notificationManager = notificationManager
        this.sessionManager = sessionManager
        this.button = document.querySelector('.invite-link button')
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

    /**
     * Set session manager (called after SessionManager is created)
     * @param {SessionManager} sessionManager - The session manager instance
     */
    setSessionManager(sessionManager) {
        this.sessionManager = sessionManager
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

        // Create session using SessionManager
        if (this.sessionManager) {
            try {
                await this.sessionManager.createSession(settings)
                if (this.notificationManager) {
                    this.notificationManager.showSuccess('Session created successfully!', 3000)
                }
            } catch (error) {
                ErrorHandler.silent(error, {
                    context: 'InviteManager',
                    metadata: { operation: 'createSession' }
                })
                if (this.notificationManager) {
                    this.notificationManager.showError('Failed to create session', 3000)
                }
            }
        } else {
            ErrorHandler.silent(new Error('SessionManager not set'), {
                context: 'InviteManager',
                metadata: { operation: 'createSession' }
            })
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
            if (this.notificationManager) {
                this.notificationManager.showSuccess('Copied to clipboard', 3000)
            }
        } catch (error) {
            if (this.notificationManager) {
                this.notificationManager.showError('Error encountered while copying to clipboard', 3000)
            }
        }
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
