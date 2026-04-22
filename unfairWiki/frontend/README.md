# 🖥️ Unfair Wiki - Frontend

This is the client-side application for **Unfair Wiki**, built with React, Vite, and Tailwind CSS. It provides a highly interactive and responsive interface for players to race through Wikipedia.

## 🛠️ Tech Stack
- **React 18**: Component-based UI architecture.
- **Vite**: Next-generation frontend tooling for rapid development.
- **Tailwind CSS 4.0**: Utility-first CSS framework for modern styling.
- **Socket.io Client**: Real-time event handling for game state updates.
- **Framer Motion**: Declarative animations for UI transitions and alerts.

## 🚀 Development Workflow

1. **Install Dependencies**
   ```bash
   npm install
   ```
2. **Start Development Server**
   ```bash
   npm run dev
   ```
3. **Build for Production**
   ```bash
   npm run build
   ```

## 📂 Core Components
- **`Lobby.jsx`**: Manages the pre-game state. Handles player registration, room joining logic, and the host's settings panel (target page and chaos frequency).
- **`Game.jsx`**: The main gameplay loop. It intercepts clicks on Wikipedia links, communicates navigation events to the backend, and renders the real-time leaderboard.
- **`App.jsx`**: Orchestrates the connection to the Socket.io server and manages the high-level application state.

---
*For full project details and setup instructions, please refer to the [Main Project README](../README.md).*
