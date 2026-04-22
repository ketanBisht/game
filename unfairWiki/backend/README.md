# ⚙️ Unfair Wiki - Backend

The engine behind the chaos. This Node.js server manages game rooms, broadcasts real-time updates via WebSockets, and acts as a smart proxy for Wikipedia content.

## 🛠️ Core Capabilities
- **Real-Time Orchestration**: Uses Socket.io to synchronize game state across multiple concurrent rooms.
- **Wikipedia Proxy API**: Fetches live content from Wikipedia and uses **Cheerio** to sanitize the HTML—removing ads, navboxes, and external links while injecting custom tracking attributes.
- **Chaos Engine**: Manages the server-side timers that trigger random teleportation events for all active players.
- **Game State Management**: Tracks player paths, current locations, and win conditions in-memory for low-latency performance.

## 🚀 Development Workflow

1. **Install Dependencies**
   ```bash
   npm install
   ```
2. **Start Server**
   ```bash
   npm start
   ```

## 📁 Key Logic (`server.js`)
- **Room Lifecycle**: Functions for creating, joining, leaving, and cleaning up rooms.
- **Wiki Fetching**: The `GET /api/wiki/:title` route which handles the heavy lifting of content transformation.
- **Randomization**: Logic to fetch random Wikipedia titles to facilitate the "Chaos" mechanic.

---
*For full project details and setup instructions, please refer to the [Main Project README](../README.md).*
