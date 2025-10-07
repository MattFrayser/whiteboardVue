import './style.css'
import { DrawingEngine } from './core/DrawingEngine'

// init
const canvas = document.getElementById('canvas')
const engine = new DrawingEngine(canvas)

engine.start()

