export class InviteManager {
    constructor(roomCode) {
        this.roomCode = roomCode
        this.button = document.querySelector('.invite-link button')
        this.notification = document.querySelector('.invite-notification')
        this.settings = document.querySelector('.settings')

        this.setUpListeners()
    }

    setUpListeners() {
        this.button.addEventListener('click', () => this.handleClick('session'))
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
        this.settings.classList.add('show')
    }
}
