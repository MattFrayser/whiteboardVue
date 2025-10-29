export class InviteManager {
    constructor(roomCode) {
        this.roomCode = roomCode
        this.button = document.querySelector('.invite-link button')
        this.notification = document.querySelector('.invite-notification')
        this.passwordToggle = document.getElementById('password-toggle');
        this.passwordInput = document.getElementById('password-input');
        this.createSessionMenu = document.querySelector('.createSession-overlay')

        this.setUpListeners()
    }

    setUpListeners() {
        this.button.addEventListener('click', () => this.handleClick('session'))
        this.passwordToggle.addEventListener('change', () => this.togglePassword())
    }

    handleClick(button) {
        switch (button) {
            case 'session':
                this.showSettings()
                break
            case 'link':
                const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomCode}`
                this.copyToClipboard(inviteUrl)
                break
        }
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
            this.showNotification('Error encountered while copying to clipboard', 'failed')
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
        this.settings.classList.add('show')
    }
}
