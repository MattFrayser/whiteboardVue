/**
 * Network message type guards
 */

import { isString, isObject, isHexColor, isNumber, isArray } from './primitives'
import { isValidObject } from './objects'
import type { DrawingObjectData } from '../types/common'

export function isAuthenticatedMessage(msg: unknown): msg is { 
    type: 'authenticated'; 
    userId?: string 
} {
    if (!isObject(msg)) return false
    if (msg.type !== 'authenticated') return false
    if (msg.userId !== undefined && !isString(msg.userId)) return false
    return true
}

export function isRoomJoinedMessage(msg: unknown): msg is { 
    type: 'room_joined'; 
    color?: string 
} {
    if (!isObject(msg)) return false
    if (msg.type !== 'room_joined') return false
    if (msg.color !== undefined && !isHexColor(msg.color)) return false
    return true
}

export function isSyncMessage(msg: unknown): msg is { 
    type: 'sync'; 
    objects: DrawingObjectData[] 
} {
    if (!isObject(msg)) return false
    if (msg.type !== 'sync') return false
    if (!isArray(msg.objects)) return false
    return msg.objects.every(isValidObject)
}

export function isObjectAddedMessage(msg: unknown): msg is { 
    type: 'objectAdded'; 
    object: DrawingObjectData; 
    userId?: string 
} {
    if (!isObject(msg)) return false
    if (msg.type !== 'objectAdded') return false
    if (!isValidObject(msg.object)) return false
    if (msg.userId !== undefined && !isString(msg.userId)) return false
    return true
}

export function isObjectUpdatedMessage(msg: unknown): msg is { 
    type: 'objectUpdated'; 
    object: DrawingObjectData; 
    userId?: string 
} {
    if (!isObject(msg)) return false
    if (msg.type !== 'objectUpdated') return false
    if (!isValidObject(msg.object)) return false
    if (msg.userId !== undefined && !isString(msg.userId)) return false
    return true
}

export function isObjectDeletedMessage(msg: unknown): msg is { 
    type: 'objectDeleted'; 
    objectId: string; 
    userId?: string 
} {
    if (!isObject(msg)) return false
    if (msg.type !== 'objectDeleted') return false
    if (!isString(msg.objectId)) return false
    if (msg.userId !== undefined && !isString(msg.userId)) return false
    return true
}

export function isCursorMessage(msg: unknown): msg is { 
    type: 'cursor'; 
    userId: string; 
    x: number; 
    y: number; 
    color: string; 
    tool: string 
} {
    if (!isObject(msg)) return false
    if (msg.type !== 'cursor') return false
    if (!isString(msg.userId)) return false
    if (!isNumber(msg.x)) return false
    if (!isNumber(msg.y)) return false
    if (!isHexColor(msg.color)) return false
    if (!isString(msg.tool)) return false
    return true
}

export function isUserDisconnectedMessage(msg: unknown): msg is { 
    type: 'userDisconnected'; 
    userId: string 
} {
    if (!isObject(msg)) return false
    if (msg.type !== 'userDisconnected') return false
    if (!isString(msg.userId)) return false
    return true
}

export function isErrorMessage(msg: unknown): msg is { 
    type: 'error'; 
    code?: string; 
    message?: string 
} {
    if (!isObject(msg)) return false
    if (msg.type !== 'error') return false
    if (msg.code !== undefined && !isString(msg.code)) return false
    if (msg.message !== undefined && !isString(msg.message)) return false
    return true
}

/**
 * Basic message structure check
 */
export function isValidMessageStructure(data: unknown): data is { type: string } {
    if (!isObject(data)) {
        console.error('[Validation] Message is not an object:', data)
        return false
    }
    if (!isString(data.type)) {
        console.error('[Validation] Message missing type field:', data)
        return false
    }
    return true
}

/**
 * Safe JSON parser
 */
export function parseJSON(rawData: string): unknown {
    try {
        return JSON.parse(rawData)
    } catch (error) {
        console.error('[Validation] Failed to parse JSON:', error)
        return null
    }
}

