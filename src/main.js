import './style.css'
import { DrawingEngine } from './core/DrawingEngine'
import { Toolbar } from './ui/Toolbar'

// init
const canvas = document.getElementById('canvas')
const engine = new DrawingEngine(canvas)
const toolbar = new Toolbar(engine)
engine.setToolbar(toolbar)

engine.start()
toolbar.updateUndoRedoButtons()

