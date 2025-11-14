# CLAUDE.md - Whiteboard Frontend Development Guide

This guide provides AI assistants with comprehensive information about the whiteboardVue codebase structure, architecture patterns, and development workflows.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Codebase Structure](#codebase-structure)
3. [Architecture Patterns](#architecture-patterns)
4. [Development Workflow](#development-workflow)
5. [Code Conventions](#code-conventions)
6. [TypeScript Configuration](#typescript-configuration)
7. [Adding New Features](#adding-new-features)
8. [Testing](#testing)
9. [Memory Management](#memory-management)
10. [Common Tasks](#common-tasks)
11. [Important Files Reference](#important-files-reference)

---

## Project Overview

**Name:** Whiteboard Frontend
**Type:** Collaborative, anonymous whiteboard application
**Tech Stack:** Vanilla TypeScript + Vite
**Architecture:** Local-first with optional real-time collaboration

### Key Features

- Local-first architecture with localStorage persistence
- Real-time collaboration via WebSockets
- No user accounts required
- Drawing tools: pen, shapes (rectangle, circle, line), text, eraser
- Undo/redo with operation-based history
- Object selection and manipulation
- Password-protected rooms (optional)
- Permission controls (view-only, edit-own-only)

### Project Statistics

- **~80 TypeScript files**
- **100% TypeScript** (no frameworks like React/Vue/Angular)
- **Strict TypeScript configuration** enabled
- **Pure Canvas API** for rendering

---

## Codebase Structure

```
src/
├── constants/          # Centralized constants (no magic numbers/strings)
│   ├── colors.ts       # Color constants
│   ├── limits.ts       # Limits, thresholds, boundaries
│   ├── input.ts        # Input-related constants
│   ├── timeouts.ts     # Timeout durations
│   ├── network.ts      # Network configuration
│   ├── ui.ts           # UI constants
│   └── index.ts        # Re-exports all constants
│
├── engine/             # Core rendering and input handling
│   ├── DrawingEngine.ts    # Main rendering loop, viewport, canvas management
│   ├── InputHandler.ts     # Mouse/keyboard event handling
│   └── Coordinates.ts      # Coordinate transformations (screen ↔ world)
│
├── interfaces/         # Abstraction layer for decoupling
│   ├── IObjectManager.ts       # Object lifecycle contract
│   ├── IObjectLifecycle.ts     # Object lifecycle events
│   ├── INetworkManager.ts      # Network communication contract
│   └── INetworkSync.ts         # Network sync contract
│
├── managers/           # State and lifecycle management
│   ├── ObjectManager.ts            # Main object orchestrator
│   ├── ObjectStore.ts              # Object storage with Quadtree
│   ├── ObjectLifecycleManager.ts   # Object lifecycle events
│   ├── HistoryManager.ts           # Undo/redo with operations
│   ├── SelectionManager.ts         # Object selection logic
│   ├── ClipboardManager.ts         # Copy/paste functionality
│   ├── ClipboardCoordinator.ts     # Clipboard coordination
│   ├── PersistenceCoordinator.ts   # Local storage coordination
│   ├── LocalStorageManager.ts      # LocalStorage abstraction
│   ├── NetworkSyncManager.ts       # Network sync orchestration
│   ├── CursorManager.ts            # Cursor state management
│   ├── VisibilitySync.ts           # Tab visibility sync
│   └── operations/                 # Command pattern for history
│       ├── Operation.ts            # Base operation interface
│       ├── AddObjectOperation.ts
│       ├── UpdateObjectOperation.ts
│       ├── DeleteObjectOperation.ts
│       ├── MoveObjectsOperation.ts
│       └── index.ts
│
├── network/            # WebSocket and session management
│   ├── WebSocketManager.ts         # WebSocket lifecycle
│   ├── WebSocketConnection.ts      # Connection wrapper
│   ├── SessionManager.ts           # Session orchestration
│   ├── MessageRouter.ts            # Message routing
│   ├── BroadcastService.ts         # Broadcast helpers
│   ├── ReconnectionManager.ts      # Reconnection logic
│   └── AckTracker.ts               # Message acknowledgment
│
├── objects/            # Drawing object types
│   ├── DrawingObject.ts    # Base class (abstract)
│   ├── Stroke.ts           # Free-hand drawing (pen)
│   ├── Rectangle.ts
│   ├── Circle.ts
│   ├── Line.ts
│   ├── Text.ts
│   ├── ObjectRegistry.ts   # Factory pattern for object creation
│   └── index.ts            # Registers all object types
│
├── stores/             # Application state management
│   ├── StateStore.ts   # Observable state store implementation
│   └── AppState.ts     # Application state definition + selectors/actions
│
├── tools/              # Drawing tools
│   ├── Tool.ts             # Base tool class (abstract)
│   ├── DrawTool.ts         # Pen/brush tool
│   ├── SelectTool.ts       # Selection tool
│   ├── EraserTool.ts       # Eraser tool
│   ├── TextTool.ts         # Text tool
│   ├── BaseShapeTool.ts    # Base for shape tools
│   ├── RectangleTool.ts
│   ├── CircleTool.ts
│   ├── LineTool.ts
│   ├── ToolRegistry.ts     # Factory pattern for tool instantiation
│   └── index.ts            # Registers all tools
│
├── types/              # TypeScript type definitions
│   ├── common.ts       # Common types (Point, Bounds, DrawingObjectData, etc.)
│   ├── network.ts      # Network message types
│   ├── events.ts       # Event types
│   ├── ui.ts           # UI types
│   └── index.ts        # Re-exports all types
│
├── ui/                 # UI components (vanilla JS, no framework)
│   ├── Toolbar.ts                      # Drawing toolbar
│   ├── NotificationManager.ts          # Toast notifications
│   ├── DialogManager.ts                # Modal dialogs
│   ├── InviteManager.ts                # Room invite handling
│   └── ConnectionStatusIndicator.ts    # Network status indicator
│
├── utils/              # Utility functions
│   ├── Quadtree.ts         # Spatial indexing for objects
│   ├── ErrorHandler.ts     # Centralized error handling
│   ├── ErrorTypes.ts       # Error categories, codes, messages
│   ├── logger.ts           # Logging utilities
│   ├── validation.ts       # Input validation
│   ├── crypto.ts           # Crypto utilities (hashing)
│   └── simplify.ts         # Path simplification (Ramer-Douglas-Peucker)
│
├── main.ts             # Application entry point
├── style.css           # Global styles
└── vite-env.d.ts       # Vite type definitions
```

---

## Architecture Patterns

### 1. **Local-First Architecture**

The application starts in **local mode** without network:
- Temporary `local-{random}` userId assigned
- Objects stored in localStorage
- Full drawing functionality available offline
- Network can be attached later for collaboration

```typescript
// main.ts pattern
const localUserId = generateLocalUserId() // 'local-abc123'
const objectManager = new ObjectManager(null) // null = no network
const engine = new DrawingEngine(canvas, objectManager, null)

// Later: attach network when joining session
await sessionManager.joinSession(roomCode)
```

### 2. **Dependency Injection via Interfaces**

Core components depend on interfaces, not concrete implementations:

```typescript
// IObjectManager defines contract
export interface IObjectManager {
    addObject(object: DrawingObject, saveHistory?: boolean): DrawingObject
    removeObject(object: DrawingObject, saveHistory?: boolean): boolean
    // ... other methods
}

// INetworkManager defines contract
export interface INetworkManager {
    broadcastObjectAdded(object: DrawingObject): void
    broadcastObjectUpdated(object: DrawingObject): void
    // ... other methods
}

// DrawingEngine depends on interfaces, not concrete classes
class DrawingEngine {
    constructor(
        canvas: HTMLCanvasElement,
        objectManager: IObjectManager,
        networkManager: INetworkManager | null
    ) { ... }
}
```

**Why:** Enables testability, reduces coupling, allows local-first mode

### 3. **Registry Pattern (Factory)**

Both tools and objects use the registry pattern:

```typescript
// tools/index.ts
ToolRegistry.register('draw', DrawTool)
ToolRegistry.register('select', SelectTool)

// objects/index.ts
ObjectRegistry.register('stroke', Stroke)
ObjectRegistry.register('rectangle', Rectangle)

// Usage
const tool = ToolRegistry.create('draw', engine)
const object = ObjectRegistry.create('stroke', id, data, zIndex)
```

**Why:** Extensible, dynamic tool/object creation

### 4. **Command Pattern (Operations)**

All history operations implement the `Operation` interface:

```typescript
interface Operation {
    readonly id: string
    readonly type: string
    readonly userId: string
    readonly timestamp: number

    execute(objectStore: ObjectStore): void
    undo(objectStore: ObjectStore): void
    toJSON(): Record<string, unknown>

    canMergeWith?(other: Operation): boolean
    mergeWith?(other: Operation): Operation
}
```

**Operations:**
- `AddObjectOperation` - Adding new objects
- `UpdateObjectOperation` - Modifying objects
- `DeleteObjectOperation` - Removing objects
- `MoveObjectsOperation` - Moving multiple objects (supports merging)

**Why:** Makes undo/redo trivial, serializable history

### 5. **Observer Pattern (State Management)**

Centralized state with subscription support:

```typescript
// stores/AppState.ts
const appState = new StateStore<AppStateShape>(initialState)

// Subscribe to specific path
const unsubscribe = appState.subscribe('ui.tool', (tool) => {
    engine.setTool(tool)
})

// Update state
actions.setTool('select')

// Batch updates (single notification)
appState.batch({
    'ui.tool': 'draw',
    'ui.color': '#ff0000',
    'ui.brushSize': 10
})
```

**State Structure:**
- `ui` - Tool, color, brush size, cursor
- `viewport` - Camera offset and zoom scale
- `selection` - Selected object IDs and bounds
- `history` - Undo/redo state
- `network` - Connection status, room code, users, cursors

### 6. **Spatial Indexing (Quadtree)**

Objects are indexed in a Quadtree for efficient spatial queries:

```typescript
// ObjectStore maintains Quadtree
const objectsInView = objectStore.getObjectsInBounds(viewport)
const objectAtPoint = objectStore.getObjectAt(point)
```

**Why:** O(log n) queries instead of O(n), crucial for performance with many objects

### 7. **Error Handling Strategy**

Centralized error handling with categories:

```typescript
// utils/ErrorTypes.ts
const ErrorCategory = {
    NETWORK: 'network',
    VALIDATION: 'validation',
    STORAGE: 'storage',
    CRITICAL: 'critical',
    SILENT: 'silent' // Logged but not shown to user
}

// Usage
ErrorHandler.handle(error, ErrorCategory.NETWORK, {
    context: 'WebSocketManager',
    metadata: { roomCode },
    showNotification: true
})
```

**Error codes** map to user-friendly messages (see `ErrorTypes.ts`)

### 8. **Memory Leak Prevention**

Components follow a strict lifecycle pattern:

```typescript
class MyComponent {
    private unsubscribers: (() => void)[] = []

    constructor() {
        // Track all subscriptions
        this.unsubscribers.push(
            appState.subscribe('ui.tool', this.handleToolChange.bind(this))
        )

        // Track event listeners
        window.addEventListener('resize', this.handleResize)
    }

    destroy() {
        // Unsubscribe from all state changes
        this.unsubscribers.forEach(fn => fn())
        this.unsubscribers = []

        // Remove event listeners
        window.removeEventListener('resize', this.handleResize)

        // Clean up other resources
        this.quadtree?.clear()
    }
}
```

**Recent cleanup (commit b5b9679):** Fixed 8 memory leaks including event listeners, quadtree instances, and state subscriptions.

---

## Development Workflow

### Setup

```bash
# Install dependencies
npm install

# Start dev server (with HMR)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint          # Check
npm run lint:fix      # Auto-fix

# Formatting
npm run format        # Format all files
npm run format:check  # Check formatting
```

### Testing

```bash
# Run tests (Vitest)
npm test

# Run with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

**Note:** Test files currently gitignored (`tests/*` in `.gitignore`)

### Environment Variables

Create `.env` in project root:

```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
```

Access via `import.meta.env.VITE_API_URL`

---

## Code Conventions

### TypeScript Style

#### 1. **Strict TypeScript**

All strict options enabled in `tsconfig.json`:
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noUncheckedIndexedAccess: true`
- `noImplicitReturns: true`

#### 2. **Naming Conventions**

- **Classes:** PascalCase (`DrawingEngine`, `ObjectManager`)
- **Interfaces:** PascalCase with `I` prefix (`IObjectManager`, `INetworkManager`)
- **Functions/methods:** camelCase (`addObject`, `broadcastUpdate`)
- **Constants:** SCREAMING_SNAKE_CASE (`MAX_ZOOM_SCALE`, `DEFAULT_COLOR`)
- **Private members:** Prefix with `_` (`_handleError`, `_safeOnMouseDown`)
- **Type aliases:** PascalCase (`Point`, `Bounds`, `DrawingObjectData`)

#### 3. **Unused Parameters**

Prefix with `_` to indicate intentionally unused:

```typescript
onMouseDown(_worldPos: Point, _e: MouseEvent): void {
    // Base class - subclasses override
}
```

#### 4. **Path Aliases**

Use `@/` for absolute imports:

```typescript
// tsconfig.json
"paths": {
    "@/*": ["./src/*"]
}

// Usage
import { DrawingEngine } from '@/engine/DrawingEngine'
```

### Code Style (Prettier)

```json
{
  "semi": false,              // No semicolons
  "singleQuote": true,        // Single quotes
  "trailingComma": "es5",     // Trailing commas where valid in ES5
  "tabWidth": 4,              // 4 spaces for indentation
  "printWidth": 100,          // 100 character line width
  "arrowParens": "avoid",     // x => x (not (x) => x)
  "endOfLine": "lf"           // Unix line endings
}
```

### ESLint Rules (Key Highlights)

- **Equality:** Always use `===` and `!==` (`eqeqeq: 'error'`)
- **Curly braces:** Always required (`curly: 'error'`)
- **Console:** Warn on `console.log`, allow `console.warn`/`console.error`
- **Unused vars:** Error, but allow `_` prefix
- **Imports:** Alphabetically ordered, no blank lines between groups
- **Prefer const:** Error on `let` when `const` works
- **No var:** Error (use `let`/`const`)

### File Organization

#### Barrel Exports

Use `index.ts` to re-export from directories:

```typescript
// constants/index.ts
export * from './colors'
export * from './timeouts'
export * from './network'
// ...

// Usage: import { DEFAULT_COLOR, MAX_ZOOM_SCALE } from '../constants'
```

#### Registration Files

Tools and objects self-register via `index.ts`:

```typescript
// tools/index.ts
import { ToolRegistry } from './ToolRegistry'
import { DrawTool } from './DrawTool'
import { SelectTool } from './SelectTool'

ToolRegistry.register('draw', DrawTool)
ToolRegistry.register('select', SelectTool)

// main.ts imports this to trigger registration
import './tools'
```

### Documentation

Use JSDoc for public APIs:

```typescript
/**
 * IObjectManager - Object lifecycle and state management abstraction
 *
 * Defines the contract for managing drawing objects, including:
 * - Adding/removing/updating objects
 * - Undo/redo history
 * - Selection management
 * - Network synchronization
 * - Rendering
 */
export interface IObjectManager {
    /**
     * Add object locally (triggers history and network broadcast)
     */
    addObject(object: DrawingObject, saveHistory?: boolean): DrawingObject
}
```

### Constants Philosophy

**NO MAGIC NUMBERS OR STRINGS!**

All values must be constants:

```typescript
// ❌ BAD
if (zoom > 10) { ... }

// ✅ GOOD
import { MAX_ZOOM_SCALE } from '../constants'
if (zoom > MAX_ZOOM_SCALE) { ... }
```

**Commit 0654036:** "Consolidation of values, no more magic number/strings"

---

## TypeScript Configuration

### Compiler Options

```json
{
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true
}
```

### Type Patterns

#### Discriminated Unions

```typescript
// types/network.ts
type NetworkMessage =
    | { type: 'object_added'; data: DrawingObjectData }
    | { type: 'object_updated'; data: DrawingObjectData }
    | { type: 'object_deleted'; objectId: string }
    | { type: 'cursor_update'; cursor: CursorData }

function handleMessage(msg: NetworkMessage) {
    switch (msg.type) {
        case 'object_added':
            // TypeScript knows msg.data exists
            break
    }
}
```

#### Type Guards

```typescript
function isDrawingObject(obj: unknown): obj is DrawingObject {
    return obj !== null &&
           typeof obj === 'object' &&
           'id' in obj &&
           'type' in obj
}
```

---

## Adding New Features

### Adding a New Tool

1. **Create tool class** in `src/tools/MyTool.ts`:

```typescript
import { Tool } from './Tool'
import type { Point } from '../types'
import type { DrawingEngine } from '../engine/DrawingEngine'

export class MyTool extends Tool {
    private isDrawing = false

    constructor(engine: DrawingEngine) {
        super(engine)
    }

    activate(): void {
        super.activate()
        // Setup
    }

    deactivate(): void {
        super.deactivate()
        // Cleanup
    }

    onMouseDown(worldPos: Point, e: MouseEvent): void {
        this.isDrawing = true
        // Handle mouse down
    }

    onMouseMove(worldPos: Point, e: MouseEvent): void {
        if (!this.isDrawing) return
        // Handle mouse move
    }

    onMouseUp(worldPos: Point, e: MouseEvent): void {
        this.isDrawing = false
        // Handle mouse up
    }

    renderPreview(ctx: CanvasRenderingContext2D): void {
        // Render preview while drawing
    }
}
```

2. **Register in `src/tools/index.ts`:**

```typescript
import { MyTool } from './MyTool'
ToolRegistry.register('mytool', MyTool)
```

3. **Add to toolbar** in `src/ui/Toolbar.ts`

4. **Update cursor** in `src/utils/getCursorForTool.ts`

### Adding a New Object Type

1. **Create object class** in `src/objects/MyObject.ts`:

```typescript
import { DrawingObject } from './DrawingObject'
import type { Bounds, Point, DrawingObjectData } from '../types'

export class MyObject extends DrawingObject {
    constructor(id: string | null, data: DrawingObjectData, zIndex: number) {
        super(id, 'myobject', data, zIndex)
    }

    getBounds(): Bounds {
        // Calculate bounding box
        return { x: 0, y: 0, width: 100, height: 100 }
    }

    containsPoint(point: Point): boolean {
        // Check if point is inside object
        return false
    }

    move(dx: number, dy: number): void {
        // Update position
    }

    applyBounds(newBounds: Bounds, handleIndex: number): void {
        // Apply resize
    }

    render(ctx: CanvasRenderingContext2D): void {
        // Render object
        ctx.fillStyle = this.data.color
        // ... drawing code
    }
}
```

2. **Register in `src/objects/index.ts`:**

```typescript
import { MyObject } from './MyObject'
ObjectRegistry.register('myobject', MyObject)
```

### Adding a New Operation (for undo/redo)

1. **Create operation** in `src/managers/operations/MyOperation.ts`:

```typescript
import type { Operation } from './Operation'
import type { ObjectStore } from '../ObjectStore'

export class MyOperation implements Operation {
    readonly id: string
    readonly type = 'my_operation'
    readonly userId: string
    readonly timestamp: number

    constructor(
        userId: string,
        private data: SomeData
    ) {
        this.id = Date.now().toString(36) + Math.random().toString(36)
        this.userId = userId
        this.timestamp = Date.now()
    }

    execute(objectStore: ObjectStore): void {
        // Apply operation
    }

    undo(objectStore: ObjectStore): void {
        // Reverse operation
    }

    toJSON(): Record<string, unknown> {
        return {
            id: this.id,
            type: this.type,
            userId: this.userId,
            timestamp: this.timestamp,
            data: this.data
        }
    }
}
```

2. **Use in manager:**

```typescript
const operation = new MyOperation(this.userId!, data)
this.historyManager.execute(operation)
```

### Adding Constants

Add to appropriate file in `src/constants/`:

```typescript
// constants/limits.ts
export const MY_NEW_LIMIT = 100

// Will be available via:
import { MY_NEW_LIMIT } from '../constants'
```

---

## Testing

### Test Structure (when tests are added)

```
tests/
├── unit/
│   ├── utils/
│   ├── managers/
│   └── objects/
├── integration/
└── e2e/
```

### Testing Tools

- **Framework:** Vitest
- **DOM:** happy-dom (lightweight jsdom alternative)
- **Coverage:** Vitest coverage (c8/istanbul)

### Example Test Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { MyClass } from '../src/MyClass'

describe('MyClass', () => {
    let instance: MyClass

    beforeEach(() => {
        instance = new MyClass()
    })

    it('should do something', () => {
        const result = instance.doSomething()
        expect(result).toBe(expected)
    })
})
```

---

## Memory Management

### Lifecycle Pattern

**EVERY component must implement `destroy()`:**

```typescript
class MyComponent {
    private unsubscribers: (() => void)[] = []
    private quadtree: Quadtree | null = null

    constructor() {
        // Track subscriptions
        this.unsubscribers.push(
            appState.subscribe('some.path', this.handler)
        )
    }

    destroy(): void {
        // 1. Unsubscribe from state
        this.unsubscribers.forEach(fn => fn())
        this.unsubscribers = []

        // 2. Remove event listeners
        window.removeEventListener('resize', this.handleResize)

        // 3. Clean up data structures
        this.quadtree?.clear()
        this.quadtree = null

        // 4. Destroy child components
        this.childComponent?.destroy()
    }
}
```

### Main Cleanup

See `main.ts` for cleanup on `beforeunload`:

```typescript
window.addEventListener('beforeunload', () => {
    unsubscribeToolChange()
    engine.destroy()
    toolbar.destroy()
    cursorManager.destroy()
    // ... all components
    appState.clear()
})
```

### Common Leak Sources (FIXED in b5b9679)

1. Event listeners not removed
2. State subscriptions not unsubscribed
3. Quadtree instances not cleared
4. Timers not cancelled
5. WebSocket connections not closed
6. Canvas contexts not released

---

## Common Tasks

### Reading Application State

```typescript
import { appState, selectors, actions } from './stores/AppState'

// Get current tool
const tool = selectors.getTool()

// Subscribe to changes
const unsubscribe = appState.subscribe('ui.tool', (newTool) => {
    console.log('Tool changed to:', newTool)
})

// Update state
actions.setTool('select')
```

### Broadcasting Network Events

```typescript
// Via INetworkManager interface
networkManager.broadcastObjectAdded(object)
networkManager.broadcastObjectUpdated(object)
networkManager.broadcastObjectDeleted(object)
networkManager.broadcastCursor(cursorData)
```

### Working with Objects

```typescript
// Add object (triggers history + network)
const object = objectManager.addObject(drawingObject, saveHistory: true)

// Update object
object.move(dx, dy)
objectManager.broadcastObjectUpdate(object)

// Remove object
objectManager.removeObject(object, saveHistory: true)

// Query objects
const objectAtPoint = objectManager.getObjectAt(point)
const allObjects = objectManager.getAllObjects()
```

### Undo/Redo

```typescript
objectManager.undo()
objectManager.redo()

// Check if possible
if (selectors.canUndo()) {
    objectManager.undo()
}
```

### Error Handling

```typescript
import { ErrorHandler, ErrorCategory, ErrorCode } from './utils/ErrorHandler'

try {
    // Risky operation
} catch (error) {
    ErrorHandler.handle(error as Error, ErrorCategory.NETWORK, {
        context: 'MyComponent',
        metadata: { some: 'data' },
        showNotification: true
    })
}

// Silent errors (logged only)
ErrorHandler.silent(error, { context: 'MyComponent' })
```

---

## Important Files Reference

### Entry Points

- **`src/main.ts`** - Application initialization, component wiring
- **`index.html`** - HTML template
- **`vite.config.ts`** - Vite configuration

### Core Initialization

```typescript
// main.ts initialization order:
// 1. Import registries (triggers tool/object registration)
import './tools'
import './objects'

// 2. Create ObjectManager (local-first, no network)
const objectManager = new ObjectManager(null)

// 3. Create DrawingEngine
const engine = new DrawingEngine(canvas, objectManager, null)

// 4. Create UI components
const toolbar = new Toolbar(engine)
const notificationManager = new NotificationManager()
// ...

// 5. Initialize ErrorHandler
ErrorHandler.init(notificationManager, dialogManager)

// 6. Create SessionManager (network manager)
const sessionManager = new SessionManager(...)

// 7. Start engine
engine.start()
```

### Configuration Files

- **`tsconfig.json`** - TypeScript compiler config
- **`eslint.config.mjs`** - Linting rules
- **`.prettierrc`** - Code formatting
- **`.gitignore`** - Git ignore patterns
- **`package.json`** - Dependencies and scripts

### Key Interfaces

- **`IObjectManager`** (`interfaces/IObjectManager.ts`) - Object management contract
- **`INetworkManager`** (`interfaces/INetworkManager.ts`) - Network communication contract

### State Management

- **`AppState.ts`** - Single source of truth for application state
- **`StateStore.ts`** - Observable state implementation

---

## Recent Major Changes

Review recent commits for context:

- **`7ee12b4`** - Tool logic separation for easier extensibility
- **`b5b9679`** - Decoupling + 8 memory leak fixes (event listeners, quadtree, state)
- **`0654036`** - Constants consolidation (no magic numbers/strings)
- **`9cb7be1`** - THE BIG ONE: Full TypeScript rewrite
- **`a1f0fa3`** - Centralized error handling with ErrorHandler

---

## Git Workflow

### Commit Message Style

Review `git log --oneline` for patterns:

- Present tense, imperative mood
- Descriptive but concise
- Reference specific components/features

Examples:
- ✅ "Attempting to separate logic into a way i like it. Tool logic broken down to allow easier adding of tools"
- ✅ "Consolidation of values, no more magic number/strings"
- ✅ "Fixed race condition in Object Manager and removed UI components from main.js"

### Branching

- Main branch for stable releases
- Feature branches prefixed: `claude/claude-md-{id}`
- Always push to designated feature branch

---

## Best Practices Summary

### Do's ✅

- Use interfaces for dependencies (IObjectManager, INetworkManager)
- Implement `destroy()` for all components
- Track all subscriptions and clean them up
- Use constants from `src/constants/` (no magic values)
- Follow strict TypeScript (enable all strict options)
- Use the Operation pattern for history
- Validate all user input
- Handle errors with ErrorHandler
- Use Quadtree for spatial queries
- Register tools/objects via Registry pattern

### Don'ts ❌

- Don't use magic numbers or strings
- Don't skip implementing `destroy()` methods
- Don't forget to unsubscribe from state changes
- Don't use `any` type (use `unknown` then narrow)
- Don't commit without running `npm run type-check`
- Don't skip error handling
- Don't iterate all objects for spatial queries (use Quadtree)
- Don't mutate state directly (use `appState.set()`)

---

## Questions or Clarifications

When in doubt:

1. **Check existing patterns:** Look at similar components
2. **Review interfaces:** Start with `IObjectManager` and `INetworkManager`
3. **Check constants:** All limits/thresholds in `src/constants/`
4. **Follow TypeScript:** Let the compiler guide you
5. **Test memory:** Always implement `destroy()` and test cleanup

---

**Last Updated:** 2025-11-14
**Project Version:** 0.0.0
**TypeScript Version:** 5.9.3
**Vite Version:** 7.1.7
