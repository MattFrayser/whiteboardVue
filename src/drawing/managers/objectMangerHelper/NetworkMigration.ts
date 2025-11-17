/**
 * Network Migration
 * Handles the one-time migration from local-only mode to networked mode
 * - Transitions localStorage objects to network-synced mode
 * - Broadcasts all local objects to server with confirmation
 * - Reports success/failure for each object
 */


import type { DrawingObject } from '../../objects/DrawingObject'
import type { WebSocketManager } from '../../../collaboration/network/WebSocketManager'
import type { MigrationResult } from '../../../shared/types/network'
import { createLogger } from '../../../shared/utils/logger'
const log = createLogger('NetworkMigration')

/**
 * Context needed for network migration
 */
export interface MigrationContext {
    oldUserId: string | null
    newUserId: string
    getAllObjects: () => DrawingObject[]
    clearLocalStorage: () => void
    disableLocalStorage: () => void
    migrateHistoryUserId: (oldId: string, newId: string) => void
}

/**
 * Transition from local mode to networked mode
 * Returns objects that need to be broadcast to server
 */
export function prepareNetworkMigration(ctx: MigrationContext): DrawingObject[] {
    log.debug('Preparing migration from local to networked mode')

    // Clear localStorage - no longer needed
    ctx.clearLocalStorage()
    ctx.disableLocalStorage()

    // Get all objects that belong to old userId (local objects)
    const localObjects = ctx.getAllObjects().filter(
        obj => obj.userId === ctx.oldUserId
    )

    log.debug('Found local objects to migrate', { count: localObjects.length }) 

    // Update all objects to new server-assigned userId
    localObjects.forEach(obj => {
        obj.userId = ctx.newUserId
    })

    // Migrate history manager userId references
    if (ctx.oldUserId) {
        ctx.migrateHistoryUserId(ctx.oldUserId, ctx.newUserId)
    }

    log.debug('Migration preparation complete')

    return localObjects
}

/**
 * Broadcast local objects to server with confirmation tracking
 * Returns detailed results for each object (succeeded/failed)
 */
export async function broadcastLocalObjects(
    objects: DrawingObject[],
    networkManager: WebSocketManager
): Promise<MigrationResult> {
    if (!objects || objects.length === 0) {
        log.debug('No objects to broadcast')
        return { succeeded: [], failed: [] }
    }

    log.info('Broadcasting objects to server', { count: objects.length })

    // Use Promise.allSettled to handle both successes and failures
    const results = await Promise.allSettled(
        objects.map(obj =>
            networkManager.broadcastObjectAddedWithConfirmation(obj)
                .then(() => ({ status: 'success' as const, objectId: obj.id }))
                .catch(err => ({ 
                    status: 'error' as const, 
                    objectId: obj.id, 
                    error: err.message 
                }))
        )
    )

    // Separate succeeded and failed objects
    const succeeded: string[] = []
    const failed: Array<{ objectId: string; error: string }> = []

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            const migrationResult = result.value
            if (migrationResult.status === 'success') {
                succeeded.push(migrationResult.objectId)
            } else if (migrationResult.status === 'error') {
                failed.push({
                    objectId: migrationResult.objectId,
                    error: migrationResult.error
                })
            }
        } else {
            // Promise rejected
            const obj = objects[index]
            if (obj) {
                failed.push({
                    objectId: obj.id,
                    error: result.reason?.message || 'Unknown error'
                })
            }
        }
    })

    log.debug('Migration complete', { 
        total: objects.length, 
        succeeded: succeeded.length, 
        failed: failed.length 
    })

    if (failed.length > 0) {
        log.error('Objects failed to migrate', { failedObjects: failed })
    }

    return { succeeded, failed }
}
