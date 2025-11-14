/**
 * Object Type Registration
 *
 * This file registers all available drawing object types with the ObjectRegistry.
 * To add a new object type:
 * 1. Create your object class extending DrawingObject
 * 2. Import it here
 * 3. Call ObjectRegistry.register() with the type name
 *
 * That's it! No need to modify ObjectStore or other core files.
 */

import { ObjectRegistry } from './ObjectRegistry'
import { Stroke } from './Stroke'
import { Circle } from './Circle'
import { Rectangle } from './Rectangle'
import { Line } from './Line'
import { Text } from './Text'

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
export { DrawingObject } from './DrawingObject'
