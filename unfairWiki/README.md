# 🏁 Unfair Wiki

[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC.svg)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-black.svg)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **The Wikipedia race where the finish line keeps moving.**

Unfair Wiki is a high-stakes, multiplayer web game that transforms the classic "Wiki Race" into a chaotic battle of speed, knowledge, and luck. While traditional Wikipedia races reward the fastest clickers, Unfair Wiki introduces a **Chaos Engine** that ensures no lead is ever safe.

---

## 📖 About the Project

Wikipedia racing is a beloved internet pastime where players start on one page and try to reach a target page using only internal links. 

**Unfair Wiki** takes this concept and adds a layer of unpredictable gameplay. Every minute (or as configured by the host), the **Chaos Timer** strikes. When it does, every player—regardless of how close they are to the target—is forcibly "jumped" to a completely different random Wikipedia page.

### Why "Unfair"?
Most games strive for perfect balance. Unfair Wiki thrives on the lack of it. It tests a player's ability to pivot their strategy instantly. You might be one click away from "Albert Einstein" when suddenly you're teleported to "List of common misconceptions about dogs." 

It's frustrating, it's hilarious, and it's intentionally **unfair**.

---

## 🎮 Gameplay Features

*   **⚡ Real-Time Multiplayer**: Join a lobby with friends and see their progress live on the leaderboard.
*   **🌪️ The Chaos Engine**: A backend-driven timer that periodically teleports all players to random locations.
*   **🕵️ Custom Wiki Viewer**: A bespoke Wikipedia renderer that strips away distractions (sidebars, ads, metadata) to focus purely on the links and content.
*   **👑 Host Authority**: Room hosts can choose the target page, set the chaos frequency, and control the start of the race.
*   **📊 Post-Game Analysis**: Review the paths taken by every player to see exactly where they went wrong (or right).

---

## 🚀 Tech Stack

### Frontend
- **React 18** with **Vite** for ultra-fast HMR.
- **Tailwind CSS 4.0** for a modern, responsive, and "glassmorphic" UI.
- **Framer Motion** for sleek transitions and chaos alerts.
- **Socket.io-client** for low-latency state synchronization.

### Backend
- **Node.js & Express** serving as the game coordinator.
- **Socket.io** managing room state, timers, and broadcasting.
- **Cheerio** for real-time HTML parsing and link injection.
- **Axios** for efficient Wikipedia API communication.

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** or **yarn**

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/unfair-wiki.git
   cd unfair-wiki
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm start
   ```
   *The server will initialize on `http://localhost:3001`.*

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
   *The client will be available at `http://localhost:5173`.*

---

## 📂 Project Architecture

```text
unfairWiki/
├── backend/
│   ├── server.js          # The "Brain": Handles Socket.io events, game logic, and Wiki proxying
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx        # Routing and Layout container
    │   ├── Lobby.jsx      # The waiting room: player management and host settings
    │   ├── Game.jsx       # The arena: Wiki rendering and live leaderboard
    │   └── index.css      # Design system and global styles
    └── vite.config.js
```

---

## 🤝 Contributing

We welcome contributions from developers who want to make the game even more chaotic!

### How to Help
1.  **Issue Triage**: Look at our open issues or suggest new features.
2.  **Logic Improvements**: Optimize the random jump algorithm in `backend/server.js`.
3.  **UI Polish**: Enhance the Wikipedia reader in `frontend/src/Game.jsx` with better styling or dark mode support.
4.  **New Features**:
    *   Add a "Spectator Mode".
    *   Implement "Power-ups" (e.g., freeze another player's screen).
    *   Create a global high-score system.

### Development Workflow
- Fork the repo.
- Create a feature branch (`git checkout -b feature/chaos-mode`).
- Commit your changes.
- Push to the branch and open a Pull Request.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📬 Contact

Project Link: [https://github.com/yourusername/unfair-wiki](https://github.com/yourusername/unfair-wiki)
