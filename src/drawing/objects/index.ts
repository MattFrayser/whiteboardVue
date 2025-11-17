/**
 * Object Type Registration
 *
 * This file registers all available drawing object types with the ObjectRegistry.
 */

import { ObjectRegistry } from './registry/ObjectRegistry'
import { Stroke } from './types/Stroke'
import { Circle } from './types/Circle'
import { Rectangle } from './types/Rectangle'
import { Line } from './types/Line'
import { Text } from './types/Text'

// Register all object types
ObjectRegistry.register('stroke', Stroke)
ObjectRegistry.register('circle', Circle)
ObjectRegistry.register('rectangle', Rectangle)
ObjectRegistry.register('line', Line)
ObjectRegistry.register('text', Text)

// Export ObjectRegistry for use in other modules
export { ObjectRegistry }

// Export object classes for direct use when needed
export { Stroke, Circle, Rectangle, Line, Text }
