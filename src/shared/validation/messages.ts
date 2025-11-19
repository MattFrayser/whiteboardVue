/**
 * Network message type guards
 */

import { isString, isObject, isHexColor, isNumber, isArray } from './primitives'
import { isValidObject } from './objects'
import type { DrawingObjectData } from '../types/common'

type FieldValidator = (value: unknown) => boolean

interface MessageSchema {
    type: string
    requiredFields?: Record<string, FieldValidator>
    optionalFields?: Record<string, FieldValidator>
}

function createMessageValidator<T extends { type: string }>(
    schema: MessageSchema
): (msg: unknown) => msg is T {
    return (msg: unknown): msg is T => {
        // Check if object
        if (!isObject(msg)) return false
        
        // Check type field
        if (msg.type !== schema.type) return false
        
        // Validate required fields
        if (schema.requiredFields) {
            for (const [field, validator] of Object.entries(schema.requiredFields)) {
                if (!validator(msg[field])) {
                    return false
                }
            }
        }
        
        // Validate optional fields (if present)
        if (schema.optionalFields) {
            for (const [field, validator] of Object.entries(schema.optionalFields)) {
                if (msg[field] !== undefined && !validator(msg[field])) {
                    return false
                }
            }
        }
        
        return true
    }
}

export const isAuthenticatedMessage = createMessageValidator<{
    type: 'authenticated'
    userId?: string
}>({
    type: 'authenticated',
    optionalFields: {
        userId: isString
    }
})

export const isRoomJoinedMessage = createMessageValidator<{
    type: 'room_joined'
    color?: string
}>({
    type: 'room_joined',
    optionalFields: {
        color: isHexColor
    }
})

export const isSyncMessage = createMessageValidator<{
    type: 'sync'
    objects: DrawingObjectData[]
}>({
    type: 'sync',
    requiredFields: {
        objects: (val): val is DrawingObjectData[] => 
            isArray(val) && val.every(isValidObject)
    }
})

export const isObjectAddedMessage = createMessageValidator<{
    type: 'objectAdded'
    object: DrawingObjectData
    userId?: string
}>({
    type: 'objectAdded',
    requiredFields: {
        object: isValidObject
    },
    optionalFields: {
        userId: isString
    }
})

export const isObjectUpdatedMessage = createMessageValidator<{
    type: 'objectUpdated'
    object: DrawingObjectData
    userId?: string
}>({
    type: 'objectUpdated',
    requiredFields: {
        object: isValidObject
    },
    optionalFields: {
        userId: isString
    }
})

export const isObjectDeletedMessage = createMessageValidator<{
    type: 'objectDeleted'
    objectId: string
    userId?: string
}>({
    type: 'objectDeleted',
    requiredFields: {
        objectId: isString
    },
    optionalFields: {
        userId: isString
    }
})

export const isCursorMessage = createMessageValidator<{
    type: 'cursor'
    userId: string
    x: number
    y: number
    color: string
    tool: string
}>({
    type: 'cursor',
    requiredFields: {
        userId: isString,
        x: isNumber,
        y: isNumber,
        color: isHexColor,
        tool: isString
    }
})

export const isUserDisconnectedMessage = createMessageValidator<{
    type: 'userDisconnected'
    userId: string
}>({
    type: 'userDisconnected',
    requiredFields: {
        userId: isString
    }
})

export const isErrorMessage = createMessageValidator<{
    type: 'error'
    code?: string
    message?: string
}>({
    type: 'error',
    optionalFields: {
        code: isString,
        message: isString
    }
})
