/**
 * Operations for undo/redo functionality
 * Each operation is reversible and can be serialized
 */

export { type Operation, type OperationFactory } from './Operation'
export { AddObjectOperation } from './AddObjectOperation'
export { UpdateObjectOperation } from './UpdateObjectOperation'
export { DeleteObjectOperation } from './DeleteObjectOperation'
export { MoveObjectsOperation } from './MoveObjectsOperation'
