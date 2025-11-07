import { appState, selectors } from '../stores/AppState'
import { ErrorHandler } from '../utils/ErrorHandler'

export class InviteManager {
    roomCode: any
    notificationManager: any
    sessionManager: any
    button: any
    passwordToggle: any
    passwordInput: any
    createSessionMenu: any
    createSessionButton: any
    unsubscribeNetworkStatus: (() => void) | null
    boundHandleButtonClick: (() => void) | null
    boundTogglePassword: (() => void) | null
    boundHandleCreateSession: (() => void) | null
    boundHandleOverlayClick: ((e: MouseEvent) => void) | null

    constructor(roomCode: string | null, notificationManager: any = null, sessionManager: any = null) {
        this.roomCode = roomCode // null in local mode, string when networked
        this.notificationManager = notificationManager
        this.sessionManager = sessionManager
        this.button = document.querySelector('.invite-link button')
        this.passwordToggle = document.getElementById('password-toggle')
        this.passwordInput = document.getElementById('password-input')
        this.createSessionMenu = document.querySelector('.createSession-overlay')
        this.createSessionButton = this.createSessionMenu.querySelector('button')

        // Initialize bound handlers
        this.unsubscribeNetworkStatus = null
        this.boundHandleButtonClick = null
        this.boundTogglePassword = null
        this.boundHandleCreateSession = null
        this.boundHandleOverlayClick = null

        this.setUpListeners()
        this.updateUI() // Set initial UI state

        // Subscribe to network status changes and store unsubscribe function
        this.unsubscribeNetworkStatus = appState.subscribe('network.status', () => {
            this.updateUI()
        })
    }

    /**
     * Set session manager (called after SessionManager is created)
     * @param {SessionManager} sessionManager - The session manager instance
     */
    setSessionManager(sessionManager: any) {
        this.sessionManager = sessionManager
    }

    setUpListeners() {
        // Store bound handlers for cleanup
        this.boundHandleButtonClick = () => this.handleButtonClick()
        this.boundTogglePassword = () => this.togglePassword()
        this.boundHandleCreateSession = () => this.handleCreateSession()
        this.boundHandleOverlayClick = (e: MouseEvent) => {
            if (e.target === this.createSessionMenu) {
                this.hideSettings()
            }
        }

        this.button.addEventListener('click', this.boundHandleButtonClick)
        this.passwordToggle.addEventListener('change', this.boundTogglePassword)
        this.createSessionButton.addEventListener('click', this.boundHandleCreateSession)
        this.createSessionMenu.addEventListener('click', this.boundHandleOverlayClick)
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
                ErrorHandler.silent(error as Error, {
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
    setRoomCode(roomCode: string) {
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

    async copyToClipboard(link: string) {
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

    /**
     * Cleanup method - remove event listeners and subscriptions
     */
    destroy() {
        // Unsubscribe from state changes
        if (this.unsubscribeNetworkStatus) {
            this.unsubscribeNetworkStatus()
            this.unsubscribeNetworkStatus = null
        }

        // Remove event listeners
        if (this.boundHandleButtonClick) {
            this.button.removeEventListener('click', this.boundHandleButtonClick)
            this.boundHandleButtonClick = null
        }
        if (this.boundTogglePassword) {
            this.passwordToggle.removeEventListener('change', this.boundTogglePassword)
            this.boundTogglePassword = null
        }
        if (this.boundHandleCreateSession) {
            this.createSessionButton.removeEventListener('click', this.boundHandleCreateSession)
            this.boundHandleCreateSession = null
        }
        if (this.boundHandleOverlayClick) {
            this.createSessionMenu.removeEventListener('click', this.boundHandleOverlayClick)
            this.boundHandleOverlayClick = null
        }
    }
}
