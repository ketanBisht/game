require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "https://unfairwiki.vercel.app",
            "https://game-a4ir.vercel.app",
            "http://localhost:5173"
        ],
        methods: ["GET", "POST"]
    }
});

// --- Game State Memory ---
// In a production app, use Redis. For this prototype, memory is fine.
const activeRooms = {};
/*
Room structure:
{
  id: "room-123",
  hostId: "socketId",
  targetPage: "Isaac_Newton",
  status: "waiting", // waiting | playing | finished
  settings: {
    randomJumpEnabled: true,
    jumpTimerSeconds: 60
  },
  jumpInterval: null, // Holds the setTimeout/setInterval reference
  players: {
    "socketId": {
      id: "socketId",
      name: "Player 1",
      currentPage: "Start_Page",
      path: ["Start_Page"]
    }
  }
}
/*
Room structure:
{
...
}
*/

// Helper to sanitize room before broadcasting
const getCleanRoom = (roomId) => {
    if (!activeRooms[roomId]) return null;
    const clean = { ...activeRooms[roomId] };
    delete clean.jumpInterval;
    return clean;
}

// --- Wikipedia Proxy Route ---
app.get("/", (req, res) => {
    res.send("Backend running");
});

app.get('/api/wiki/:title', async (req, res) => {
    try {
        const title = req.params.title;
        console.log(`Fetching wiki page: ${title}`);

        // Wikipedia API URL to get the HTML of a page
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&format=json&prop=text|displaytitle`;

        const response = await axios.get(wikiUrl, {
            headers: {
                'User-Agent': 'UnfairWikiGameBot/1.0 (prototype testing)'
            }
        });

        if (response.data.error) {
            return res.status(404).json({ error: "Page not found" });
        }

        const htmlString = response.data.parse.text['*'];
        const displayTitle = response.data.parse.displaytitle;

        // Use Cheerio to parse and sanitize the HTML
        const $ = cheerio.load(htmlString);

        // 1. Remove things we don't want (edit citations, reference lists)
        $('.mw-editsection').remove();
        $('.reference').remove();
        $('.references').remove();
        $('.reflist').remove();
        $('.navbox').remove();
        // NOTE: we intentionally keep .infobox — it contains the key facts summary table

        // 2. Process Links
        $('a').each(function () {
            const href = $(this).attr('href');

            if (!href) return;

            // Only keep internal wikipedia links, convert them so frontend can intercept via data-attribute or class
            if (href.startsWith('/wiki/') && !href.includes(':')) { // Avoid /wiki/File:, /wiki/Special:
                const pageName = href.replace('/wiki/', '');
                // We leave the href as # and add a custom data attribute for our React app to intercept
                $(this).attr('href', '#');
                $(this).attr('data-wiki-page', pageName);
                $(this).addClass('wiki-internal-link');
            } else {
                // Disable external links or meta links
                $(this).removeAttr('href');
                $(this).css('text-decoration', 'none');
                $(this).css('color', 'inherit');
                $(this).css('cursor', 'text');
            }
        });

        // 3. Fix images: make protocol-relative URLs absolute
        $('img').each(function () {
            const src = $(this).attr('src');
            if (src && src.startsWith('//')) {
                $(this).attr('src', 'https:' + src);
            }
            const srcset = $(this).attr('srcset');
            if (srcset) {
                $(this).attr('srcset', srcset.replace(/\/\//g, 'https://'));
            }
        });

        res.json({
            title: displayTitle,
            html: $('body').html()
        });

    } catch (err) {
        console.error("Wiki Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch page" });
    }
});

// Helper to get a random wiki page
async function getRandomWikiPage() {
    try {
        const response = await axios.get('https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json', {
            headers: {
                'User-Agent': 'UnfairWikiGameBot/1.0 (prototype testing)'
            }
        });
        return response.data.query.random[0].title.replace(/ /g, '_');
    } catch (err) {
        console.error("Random page error", err);
        return "Wikipedia"; // Fallback
    }
}

// --- Socket.IO Real-time Logic ---
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Helper to send updated room state to everyone in the room
    const broadcastRoomState = (roomId) => {
        const cleanRoom = getCleanRoom(roomId);
        if (cleanRoom) {
            io.to(roomId).emit('room_state_update', cleanRoom);
        }
    };

    socket.on('create_room', (data, callback) => {
        const { playerName, roomId } = data;

        // Simple validation
        if (activeRooms[roomId]) {
            return callback({ error: "Room already exists" });
        }

        activeRooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            targetPage: null, // Will be set before game starts
            status: "waiting",
            settings: {
                randomJumpEnabled: true,
                jumpTimerSeconds: 60
            },
            players: {
                [socket.id]: {
                    id: socket.id,
                    name: playerName,
                    currentPage: null,
                    path: []
                }
            }
        };

        socket.join(roomId);
        callback({ success: true, room: activeRooms[roomId] });
        broadcastRoomState(roomId);
        console.log(`Room created: ${roomId} by ${playerName}`);
    });

    socket.on('join_room', (data, callback) => {
        const { playerName, roomId } = data;

        const room = activeRooms[roomId];
        if (!room) {
            return callback({ error: "Room not found" });
        }
        if (room.status !== "waiting") {
            return callback({ error: "Game already in progress" });
        }
        if (Object.keys(room.players).length >= 8) {
            return callback({ error: "Room is full (max 8 players)" });
        }

        room.players[socket.id] = {
            id: socket.id,
            name: playerName,
            currentPage: null,
            path: []
        };

        socket.join(roomId);
        callback({ success: true, room });
        broadcastRoomState(roomId);
        console.log(`Player ${playerName} joined ${roomId}`);
    });

    socket.on('update_settings', (data) => {
        const { roomId, settings, targetPage } = data;
        const room = activeRooms[roomId];

        if (room && room.hostId === socket.id && room.status === "waiting") {
            if (settings) room.settings = { ...room.settings, ...settings };
            if (targetPage) room.targetPage = targetPage.replace(/ /g, '_');
            broadcastRoomState(roomId);
        }
    });

    socket.on('start_game', async (roomId) => {
        const room = activeRooms[roomId];
        if (room && room.hostId === socket.id && room.status === "waiting") {

            if (!room.targetPage) {
                // Assign a random target if none is set
                room.targetPage = await getRandomWikiPage();
            }

            room.status = "playing";

            // Assign random starting pages to all players
            const playerIds = Object.keys(room.players);
            for (const pid of playerIds) {
                const startPage = await getRandomWikiPage();
                room.players[pid].currentPage = startPage;
                room.players[pid].path = [startPage];
            }

            // Broadcast start event
            io.to(roomId).emit('game_started', getCleanRoom(roomId));

            // Setup Random Jump Timer
            if (room.settings.randomJumpEnabled) {
                startRandomJumpTimer(roomId);
            }
        }
    });

    // Navigate to a new page (clicked a link)
    socket.on('navigated', (data) => {
        const { roomId, newPage } = data;
        const room = activeRooms[roomId];

        if (room && room.status === "playing" && room.players[socket.id]) {
            const player = room.players[socket.id];
            const formattedPage = newPage.replace(/ /g, '_');

            player.currentPage = formattedPage;
            player.path.push(formattedPage);

            // Check Win Condition
            if (formattedPage.toLowerCase() === room.targetPage.toLowerCase()) {
                room.status = "finished";
                clearTimeout(room.jumpInterval); // Stop chaos timer
                io.to(roomId).emit('game_over', {
                    winnerId: socket.id,
                    winnerName: player.name,
                    roomState: getCleanRoom(roomId)
                });
            } else {
                // Just a normal navigation, update others
                broadcastRoomState(roomId);
            }
        }
    });

    // Player surrenders — mark them but keep them in the room so they see results
    socket.on('surrender', (data) => {
        const { roomId } = data;
        const room = activeRooms[roomId];

        if (!room || !room.players[socket.id] || room.status !== 'playing') return;

        const player = room.players[socket.id];
        player.surrendered = true;
        console.log(`Player ${player.name} surrendered in room ${roomId}`);

        // Count remaining active (non-surrendered) players
        const activePlayers = Object.values(room.players).filter(p => !p.surrendered);

        if (activePlayers.length === 0) {
            // Everyone surrendered — end the game, no winner
            room.status = 'finished';
            clearTimeout(room.jumpInterval);
            io.to(roomId).emit('game_over', {
                winnerId: null,
                winnerName: null,
                roomState: getCleanRoom(roomId),
                reason: 'all_surrendered'
            });
        } else if (activePlayers.length === 1) {
            // Last active player wins
            const lastPlayer = activePlayers[0];
            room.status = 'finished';
            clearTimeout(room.jumpInterval);
            io.to(roomId).emit('game_over', {
                winnerId: lastPlayer.id,
                winnerName: lastPlayer.name,
                roomState: getCleanRoom(roomId),
                reason: 'last_standing'
            });
        } else {
            // Game continues — update everyone on the new status
            broadcastRoomState(roomId);
        }
    });

    // Player explicitly leaves the post-game lobby
    socket.on('leave_room', (roomId) => {
        const room = activeRooms[roomId];
        if (!room) return;

        delete room.players[socket.id];
        socket.leave(roomId);

        if (Object.keys(room.players).length === 0) {
            clearTimeout(room.jumpInterval);
            delete activeRooms[roomId];
            console.log(`Room ${roomId} deleted (all left)`);
        } else {
            if (room.hostId === socket.id) {
                room.hostId = Object.keys(room.players)[0];
            }
            broadcastRoomState(roomId);
        }
    });

    // Host requests a rematch — resets room to lobby state, same players
    socket.on('play_again', (roomId) => {
        const room = activeRooms[roomId];
        if (!room) return;
        if (room.hostId !== socket.id) return; // only host can trigger

        // Stop any running jump timer
        if (room.jumpInterval) {
            clearTimeout(room.jumpInterval);
            room.jumpInterval = null;
        }

        // Reset room back to waiting state
        room.status = 'waiting';
        room.targetPage = null;

        // Reset every player's path and position
        Object.values(room.players).forEach(p => {
            p.currentPage = null;
            p.path = [];
            p.surrendered = false;
        });

        console.log(`Room ${roomId} reset for rematch`);
        // Notify all players to return to lobby
        io.to(roomId).emit('returned_to_lobby', getCleanRoom(roomId));
    });


    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        for (const roomId in activeRooms) {
            const room = activeRooms[roomId];
            if (!room.players[socket.id]) continue;

            const wasPlaying = room.status === 'playing';
            delete room.players[socket.id];

            const allPlayers = Object.keys(room.players);
            const activePlayers = Object.values(room.players).filter(p => !p.surrendered);

            if (allPlayers.length === 0) {
                // Room is completely empty
                clearTimeout(room.jumpInterval);
                delete activeRooms[roomId];
                console.log(`Room ${roomId} deleted (empty)`);
            } else if (wasPlaying && activePlayers.length === 1) {
                // Last active player wins
                const lastPlayer = activePlayers[0];
                room.status = 'finished';
                clearTimeout(room.jumpInterval);
                console.log(`Room ${roomId}: last player standing — ${lastPlayer.name} wins`);
                io.to(roomId).emit('game_over', {
                    winnerId: lastPlayer.id,
                    winnerName: lastPlayer.name,
                    roomState: getCleanRoom(roomId),
                    reason: 'last_standing'
                });
            } else if (wasPlaying && activePlayers.length === 0) {
                // All active players gone — end with no winner
                room.status = 'finished';
                clearTimeout(room.jumpInterval);
                io.to(roomId).emit('game_over', {
                    winnerId: null, winnerName: null,
                    roomState: getCleanRoom(roomId),
                    reason: 'all_surrendered'
                });
            } else {
                if (room.hostId === socket.id && allPlayers.length > 0) {
                    room.hostId = allPlayers[0];
                }
                broadcastRoomState(roomId);
            }
        }
    });
});

// --- Timer Logic ---
function startRandomJumpTimer(roomId) {
    const room = activeRooms[roomId];
    if (!room || room.status !== 'playing') return;

    if (room.jumpInterval) clearTimeout(room.jumpInterval);

    const ms = room.settings.jumpTimerSeconds * 1000;

    room.jumpInterval = setTimeout(async () => {
        // Always re-check: room may have been deleted or finished during the await
        const currentRoom = activeRooms[roomId];
        if (!currentRoom || currentRoom.status !== 'playing') return;

        console.log(`BAM! Random Jump triggering for room ${roomId}`);

        const playerIds = Object.keys(currentRoom.players);
        for (const pid of playerIds) {
            // Re-check after every async call — a surrender/disconnect could have fired
            if (!activeRooms[roomId] || activeRooms[roomId].status !== 'playing') return;
            const newRandomPage = await getRandomWikiPage();
            // Player might have left while we awaited — guard before writing
            if (activeRooms[roomId]?.players[pid]) {
                activeRooms[roomId].players[pid].currentPage = newRandomPage;
                activeRooms[roomId].players[pid].path.push(newRandomPage);
            }
        }

        // Final check before emitting
        if (!activeRooms[roomId] || activeRooms[roomId].status !== 'playing') return;

        io.to(roomId).emit('random_jump_triggered', getCleanRoom(roomId));
        startRandomJumpTimer(roomId);
    }, ms);
}


const PORT = process.env.PORT || 3001; // Backend on 3001, Vite frontend usually on 5173
server.listen(PORT, () => {
    console.log(`Unfair Wiki Backend running on http://localhost:${PORT}`);
});
