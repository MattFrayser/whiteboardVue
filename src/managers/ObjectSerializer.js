import { Circle } from '../objects/Circle'
import { Line } from '../objects/Line'
import { Rectangle } from '../objects/Rectangle'
import { Stroke } from '../objects/Stroke'
import { Text } from '../objects/Text'

/**
 * Handles serialization and deserialization of drawing objects
 */
export class ObjectSerializer {
    /**
     * Create an object from JSON data
     */
    static createObjectFromData(data) {
        let obj = null
        switch (data.type) {
            case 'stroke':
                obj = new Stroke(data.id, data.data)
                break
            case 'rectangle':
                obj = new Rectangle(data.id, data.data)
                break
            case 'circle':
                obj = new Circle(data.id, data.data)
                break
            case 'line':
                obj = new Line(data.id, data.data)
                break
            case 'text':
                obj = new Text(data.id, data.data)
                break
        }

        // Preserve userId and zIndex from remote data
        if (obj) {
            obj.userId = data.userId
            obj.zIndex = data.zIndex || 0
        }

        return obj
    }
}
