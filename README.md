# Whiteboard Frontend

A collaborative, anonymous whiteboard application built with vanilla TypeScript and Vite.

## Features

- Local-first architecture with localStorage persistence
- Real-time collaboration via WebSockets
- No user accounts required
- Drawing tools: pen, shapes (rectangle, circle, line), text, eraser
- Undo/redo with history management
- Object selection and manipulation
- Password-protected rooms (optional)
- Permission controls (view-only, edit-own-only)

## Tech Stack

- **TypeScript** - Pure vanilla TypeScript (no frameworks)
- **Vite** - Build tool and dev server
- **Canvas API** - Rendering
- **WebSockets** - Real-time collaboration
- **Vitest** - Testing framework

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

- `engine/` - Core rendering and input handling
- `tools/` - Drawing tools (pen, shapes, text, etc.)
- `objects/` - Drawing object definitions
- `managers/` - State management (objects, history, selection, etc.)
- `network/` - WebSocket and session management
- `stores/` - Application state store
- `ui/` - UI components (toolbar, notifications, dialogs)
- `utils/` - Utility functions (quadtree, validation, errors)

## Configuration

Copy `.env.example` to `.env` and configure:

```
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
```
