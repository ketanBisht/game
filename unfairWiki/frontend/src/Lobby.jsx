import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Settings, Info, Users, ChevronDown, ChevronUp, Zap, Target, Trophy, AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// How to Play Panel
// ---------------------------------------------------------------------------
const HOW_TO_PLAY_STEPS = [
    {
        icon: <Users size={16} className="text-purple-400" />,
        title: "Create or Join a Room",
        desc: "Enter your name and a room code. Share the code with friends and wait in the lobby."
    },
    {
        icon: <Target size={16} className="text-green-400" />,
        title: "Race to the Target",
        desc: "Everyone starts on a random Wikipedia page. Click internal links to navigate to the target page."
    },
    {
        icon: <Zap size={16} className="text-yellow-400" />,
        title: "Survive the Chaos",
        desc: "With Chaos Mode on, the server randomly teleports everyone to a new page — no warning!"
    },
    {
        icon: <Trophy size={16} className="text-amber-400" />,
        title: "Win the Race",
        desc: "First player to land on the target page wins. Fewer clicks = more bragging rights."
    },
    {
        icon: <AlertTriangle size={16} className="text-red-400" />,
        title: "The Rules",
        desc: "Only click Wikipedia links inside the article — no search, no browser back. You can surrender anytime."
    }
];

const HowToPlay = () => {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-4 bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-700/40 transition-colors"
            >
                <span className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                    <Info size={15} className="text-purple-400" /> How to Play
                </span>
                {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-6 pt-4 space-y-4 border-t border-slate-700/60">
                            {HOW_TO_PLAY_STEPS.map((step, i) => (
                                <div key={i} className="flex gap-3">
                                    <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                                        {step.icon}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white text-sm">{step.title}</p>
                                        <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                            <p className="text-center text-xs text-slate-600 italic pt-2 border-t border-slate-700/40">
                                Wikipedia knowledge + chaos = Unfair Wiki 🎲
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Lobby = ({ socket, onGameStart }) => {
    const [playerName, setPlayerName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [roomState, setRoomState] = useState(null);
    const [error, setError] = useState('');

    // Settings State
    const [jumpTimerSeconds, setJumpTimerSeconds] = useState(60);
    const [randomJumpEnabled, setRandomJumpEnabled] = useState(true);
    const [customTarget, setCustomTarget] = useState('');

    useEffect(() => {
        if (!socket) return;

        // Listen for room updates
        const handleRoomStateUpdate = (newState) => {
            setRoomState(newState);
            setError('');
        };

        const handleGameStarted = (newState) => {
            setRoomState(newState);
            if (onGameStart) onGameStart(newState);
        };

        socket.on('room_state_update', handleRoomStateUpdate);
        socket.on('game_started', handleGameStarted);

        return () => {
            socket.off('room_state_update', handleRoomStateUpdate);
            socket.off('game_started', handleGameStarted);
        };
    }, [socket, onGameStart]);

    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!playerName || !roomId) {
            setError("Name and Room ID are required.");
            return;
        }

        socket.emit('create_room', { playerName, roomId }, (response) => {
            if (response.error) {
                setError(response.error);
            }
        });
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (!playerName || !roomId) {
            setError("Name and Room ID are required.");
            return;
        }

        socket.emit('join_room', { playerName, roomId }, (response) => {
            if (response.error) {
                setError(response.error);
            }
        });
    };

    const handleUpdateSettings = () => {
        if (roomState && roomState.hostId === socket.id) {
            socket.emit('update_settings', {
                roomId: roomState.id,
                settings: {
                    randomJumpEnabled,
                    jumpTimerSeconds: parseInt(jumpTimerSeconds, 10)
                },
                targetPage: customTarget.trim() !== '' ? customTarget : null
            });
        }
    };

    const handleStartGame = () => {
        if (roomState && roomState.hostId === socket.id) {
            socket.emit('start_game', roomState.id);
        }
    };

    // ---------------------------------------------------------------------------
    // View 1: Initial Entry (Create / Join form)
    // ---------------------------------------------------------------------------
    if (!roomState) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 w-full">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full"
                >
                    <div className="text-center mb-8">
                        <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                            Unfair Wiki
                        </h1>
                        <p className="text-slate-400">The chaotic Wikipedia racing game.</p>
                    </div>

                    <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500 text-red-500 rounded p-3 text-sm mb-4">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Your Name</label>
                                <input
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium text-white"
                                    placeholder="e.g. WikiWizard"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Room Code</label>
                                <input
                                    type="text"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono font-bold tracking-wider text-white"
                                    placeholder="e.g. CODE123"
                                    maxLength={10}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button
                                    onClick={handleCreateRoom}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    Create Room
                                </button>
                                <button
                                    onClick={handleJoinRoom}
                                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    Join Room
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* How to Play */}
                    <HowToPlay />
                </motion.div>
            </div>

        );
    }

    // ---------------------------------------------------------------------------
    // View 2: Inside the Lobby
    // ---------------------------------------------------------------------------
    const isHost = roomState.hostId === socket.id;
    const playersList = Object.values(roomState.players);

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 w-full block">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <div>
                        <h2 className="text-3xl font-black mb-1">Room: <span className="text-purple-400 font-mono">{roomState.id}</span></h2>
                        <p className="text-slate-400 flex items-center gap-2">
                            <Users size={16} /> {playersList.length} / 8 Players
                        </p>
                    </div>
                    {isHost ? (
                        <button
                            onClick={handleStartGame}
                            className="mt-4 md:mt-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-purple-500/30 transition-all transform hover:scale-105 flex items-center gap-2"
                        >
                            <Swords size={20} /> START GAME
                        </button>
                    ) : (
                        <div className="mt-4 md:mt-0 px-6 py-3 bg-slate-700/50 rounded-full text-slate-300 font-medium border border-slate-600">
                            Waiting for host to start...
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Players List */}
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-300">
                            Players
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {playersList.map(player => (
                                <div key={player.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                                    <span className="font-semibold text-white">{player.name}</span>
                                    {player.id === roomState.hostId && (
                                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-bold border border-yellow-500/30">HOST</span>
                                    )}
                                </div>
                            ))}
                            {/* Empty Slots */}
                            {Array.from({ length: 8 - playersList.length }).map((_, i) => (
                                <div key={`empty-${i}`} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center justify-center text-slate-600 border-dashed">
                                    Empty Slot
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Game Settings */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-300">
                            <Settings size={20} /> Settings
                        </h3>
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">

                            {/* The Chaos Toggle */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="font-semibold text-white">Random Jump Chaos</label>
                                    {isHost && (
                                        <button
                                            onClick={() => {
                                                setRandomJumpEnabled(!randomJumpEnabled);
                                                setTimeout(handleUpdateSettings, 50);
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${randomJumpEnabled ? 'bg-purple-600' : 'bg-slate-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${randomJumpEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    )}
                                    {!isHost && (
                                        <span className={roomState.settings.randomJumpEnabled ? 'text-green-400 font-bold' : 'text-slate-500 font-bold'}>
                                            {roomState.settings.randomJumpEnabled ? 'ON' : 'OFF'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400">If enabled, everyone gets periodically teleported to a random page mid-race.</p>
                            </div>

                            {/* Timer Slider */}
                            {(isHost ? randomJumpEnabled : roomState.settings.randomJumpEnabled) && (
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-sm font-medium text-slate-300">Jump Frequency</label>
                                        <span className="text-sm font-bold text-purple-400">
                                            {isHost ? jumpTimerSeconds : roomState.settings.jumpTimerSeconds}s
                                        </span>
                                    </div>
                                    {isHost ? (
                                        <input
                                            type="range"
                                            min="30" max="180" step="10"
                                            value={jumpTimerSeconds}
                                            onChange={(e) => setJumpTimerSeconds(e.target.value)}
                                            onMouseUp={handleUpdateSettings}
                                            onTouchEnd={handleUpdateSettings}
                                            className="w-full accent-purple-600"
                                        />
                                    ) : (
                                        <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${(roomState.settings.jumpTimerSeconds / 180) * 100}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Target Page Selection */}
                            <div className="pt-4 border-t border-slate-700">
                                <label className="block text-sm font-medium text-slate-300 mb-2">Race Destination (Target Page)</label>
                                {isHost ? (
                                    <>
                                        <input
                                            type="text"
                                            value={customTarget}
                                            onChange={(e) => setCustomTarget(e.target.value)}
                                            onBlur={handleUpdateSettings}
                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateSettings()}
                                            placeholder="e.g. Banana (Leave empty for random)"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 mb-2 text-white"
                                        />
                                        <p className="text-xs text-slate-400 flex items-start gap-2">
                                            <Info size={14} className="flex-shrink-0 mt-0.5" />
                                            If left blank, a random target page will be assigned when the game starts.
                                        </p>
                                    </>
                                ) : (
                                    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300">
                                        {roomState.targetPage ? roomState.targetPage.replace(/_/g, ' ') : 'Randomly Assigned on Start'}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Lobby;
