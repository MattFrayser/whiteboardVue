/**
 * Centralized dialog/modal management for the application
 * Delegates to specialized dialog classes for clean separation of concerns
 */

import { BaseDialog } from './BaseDialog'
import { PasswordDialog } from './PasswordDialog'
import { JoinRoomDialog } from './JoinRoomDialog'
import { ConfirmDialog } from './ConfirmDialog'
import type { ConfirmDialogConfig } from './types'

export class DialogManager {
    private currentDialog: BaseDialog<any> | null

    constructor() {
        this.currentDialog = null
    }

    showPasswordDialog(
        roomCode: string,
        errorMessage: string | null = null
    ): Promise<string | null> {
        const dialog = new PasswordDialog({ roomCode, errorMessage })
        this.currentDialog = dialog
        return dialog.show()
    }

    showJoinRoomDialog(
        roomCode: string,
        onJoin: (() => void | Promise<void>) | null = null,
        onCancel: (() => void) | null = null
    ): Promise<boolean> {
        const dialog = new JoinRoomDialog({ roomCode, onJoin, onCancel })
        this.currentDialog = dialog
        return dialog.show()
    }

    showConfirmDialog(config: ConfirmDialogConfig = {}): Promise<boolean> {
        const dialog = new ConfirmDialog(config)
        this.currentDialog = dialog
        return dialog.show()
    }

    close(): void {
        if (this.currentDialog) {
            this.currentDialog['close'](this.currentDialog['getCancelValue']())
            this.currentDialog = null
        }
    }

    destroy(): void {
        this.close()
    }
}
