/**
 * PasswordAuthenticator
 *
 * Handles password authentication flow with retry logic
 */
import type { DialogManager, NotificationManager } from '../../shared/types/ui'
import { hashPassword } from '../../shared/utils/passwordHash' 

export interface PasswordResult {
    success: boolean
    password: string | null
    cancelled: boolean
    maxAttemptsExceeded: boolean
}

export class PasswordAuthenticator {
    private dialogManager: DialogManager
    private notificationManager: NotificationManager
    private maxAttempts: number

    constructor(
        dialogManager: DialogManager,
        notificationManager: NotificationManager,
        maxAttempts: number = 3
    ) {
        this.dialogManager = dialogManager
        this.notificationManager = notificationManager
        this.maxAttempts = maxAttempts
    }

    /**
     * Prompt user for initial password
     */
    async promptForPassword(roomCode: string): Promise<PasswordResult> {
        const password = await this.dialogManager.showPasswordDialog(roomCode)

        if (!password) {
            return {
                success: false,
                password: null,
                cancelled: true,
                maxAttemptsExceeded: false,
            }
        }

        const hashedPassword = await hashPassword(password)


        return {
            success: true,
            password: hashedPassword,
            cancelled: false,
            maxAttemptsExceeded: false,
        }
    }

    /**
     * Handle invalid password with retry logic
     */
    async handleInvalidPassword(
        roomCode: string,
        currentAttempt: number
    ): Promise<PasswordResult> {
        const attemptsRemaining = this.maxAttempts - currentAttempt

        if (currentAttempt >= this.maxAttempts) {
            this.notificationManager.showError('Maximum password attempts exceeded')
            return {
                success: false,
                password: null,
                cancelled: false,
                maxAttemptsExceeded: true,
            }
        }

        // Show error notification
        const errorMessage = `Incorrect password. Please try again (${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining)`
        this.notificationManager.showError(errorMessage)

        // Brief pause for user to see error
        await new Promise(resolve => setTimeout(resolve, 500))

        // Prompt for retry
        const retryPassword = await this.dialogManager.showPasswordDialog(roomCode, errorMessage)

        if (!retryPassword) {
            return {
                success: false,
                password: null,
                cancelled: true,
                maxAttemptsExceeded: false,
            }
        }
        const hashedPassword = await hashPassword(retryPassword)

        return {
            success: true,
            password: hashedPassword,  
            cancelled: false,
            maxAttemptsExceeded: false,
        }
    }
}
