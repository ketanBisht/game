import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Settings, Info, Users, ChevronDown, ChevronUp, Zap, Target, Trophy, AlertTriangle } from 'lucide-react';

// === CREAM + BLACK RETRO PALETTE ===
// bg: #f0e6c8  surface: #e4d8b0  deep-surface: #d4c898  text: #0f0d0a  dim: rgba(15,13,10,0.5)

const HOW_TO_PLAY_STEPS = [
    { icon: <Users size={13} />, title: "Create / Join Room", desc: "Enter your name and a room code. Share the code with friends and wait in the lobby." },
    { icon: <Target size={13} />, title: "Race to the Target", desc: "Everyone starts on a random Wikipedia page. Click links to navigate toward the target." },
    { icon: <Zap size={13} />, title: "Survive the Chaos", desc: "Chaos Mode teleports everyone to a random page at any time — no warning!" },
    { icon: <Trophy size={13} />, title: "Win the Race", desc: "First player to land on the target page wins. Fewer clicks = more bragging rights." },
    { icon: <AlertTriangle size={13} />, title: "The Rules", desc: "Only click Wikipedia links inside the article. No search, no back button. Surrender anytime." },
];

const HowToPlay = () => {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-4 border-2 border-[#0f0d0a]/20 pixel-border" style={{ backgroundColor: '#e4d8b0' }}>
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-all text-[#0f0d0a]"
                style={{ fontSize: '9px' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(15,13,10,0.05)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <span className="flex items-center gap-3"><Info size={12} /> HOW TO PLAY</span>
                {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-6 pt-4 space-y-5" style={{ borderTop: '1px solid rgba(15,13,10,0.12)' }}>
                            {HOW_TO_PLAY_STEPS.map((step, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="mt-0.5 shrink-0 w-7 h-7 border-2 border-[#0f0d0a]/20 flex items-center justify-center" style={{ backgroundColor: '#f0e6c8' }}>
                                        {step.icon}
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-[#0f0d0a] mb-1">{step.title}</p>
                                        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(15,13,10,0.55)', fontFamily: 'system-ui, sans-serif' }}>{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                            <p className="text-center text-[8px] pt-3" style={{ color: 'rgba(15,13,10,0.3)', borderTop: '1px solid rgba(15,13,10,0.1)' }}>
                                Wikipedia knowledge + chaos = Unfair Wiki 🎲
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://unfairwiki.onrender.com';

const Lobby = ({ socket, initialRoomState = null, onGameStart, onLeave }) => {
    const [playerName, setPlayerName] = useState('');
    const [roomId, setRoomId] = useState('');
    // Initialize from prop so Play Again correctly restores room view
    const [roomState, setRoomState] = useState(initialRoomState);
    const [error, setError] = useState('');
    const [jumpTimerSeconds, setJumpTimerSeconds] = useState(
        initialRoomState?.settings?.jumpTimerSeconds ?? 60
    );
    const [randomJumpEnabled, setRandomJumpEnabled] = useState(
        initialRoomState?.settings?.randomJumpEnabled ?? true
    );
    const [customTarget, setCustomTarget] = useState('');

    // Target page validation state
    const [targetValidating, setTargetValidating] = useState(false);
    const [targetValid, setTargetValid] = useState(null); // null | true | false
    const [targetError, setTargetError] = useState('');
    const validateTimerRef = React.useRef(null);

    useEffect(() => {
        if (!socket) return;
        const onRoomUpdate = (s) => { setRoomState(s); setError(''); };
        const onGameStarted = (s) => { setRoomState(s); if (onGameStart) onGameStart(s); };
        socket.on('room_state_update', onRoomUpdate);
        socket.on('game_started', onGameStarted);
        return () => { socket.off('room_state_update', onRoomUpdate); socket.off('game_started', onGameStarted); };
    }, [socket, onGameStart]);

    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!playerName || !roomId) { setError("Name and Room ID are required."); return; }
        socket.emit('create_room', { playerName, roomId }, (r) => { if (r.error) setError(r.error); });
    };
    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (!playerName || !roomId) { setError("Name and Room ID are required."); return; }
        socket.emit('join_room', { playerName, roomId }, (r) => { if (r.error) setError(r.error); });
    };
    const handleUpdateSettings = () => {
        if (roomState && roomState.hostId === socket.id) {
            // Don't save target if it's still being validated or was found invalid
            const safeTarget = customTarget.trim() !== '' && targetValid !== false
                ? customTarget.trim()
                : null;
            socket.emit('update_settings', {
                roomId: roomState.id,
                settings: { randomJumpEnabled, jumpTimerSeconds: parseInt(jumpTimerSeconds, 10) },
                targetPage: safeTarget
            });
        }
    };
    const handleStartGame = () => {
        if (targetValid === false) { setError('Target page not found on Wikipedia!'); return; }
        if (roomState && roomState.hostId === socket.id) socket.emit('start_game', roomState.id);
    };
    const handleLeaveRoom = () => {
        if (roomState?.id) socket.emit('leave_room', roomState.id);
        setRoomState(null);
        setError('');
        if (onLeave) onLeave();
    };

    // --- Target page validation (debounced, checks via our backend proxy) ---
    const handleTargetChange = (val) => {
        setCustomTarget(val);
        setTargetValid(null);
        setTargetError('');
        if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
        if (!val.trim()) return;
        setTargetValidating(true);
        validateTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${BACKEND_URL}/api/wiki/${encodeURIComponent(val.trim().replace(/ /g, '_'))}`
                );
                const data = await res.json();
                if (data.error || !data.title) {
                    setTargetValid(false);
                    setTargetError(`"${val.trim()}" not found on Wikipedia.`);
                } else {
                    setTargetValid(true);
                    setTargetError('');
                    // Auto-update canonical title from Wikipedia
                    setCustomTarget(data.title);
                    setTimeout(() => handleUpdateSettingsWithTarget(data.title), 50);
                }
            } catch {
                setTargetValid(false);
                setTargetError('Could not verify page. Check your connection.');
            } finally {
                setTargetValidating(false);
            }
        }, 800); // 800ms debounce
    };

    const handleUpdateSettingsWithTarget = (target) => {
        if (roomState && roomState.hostId === socket.id) {
            socket.emit('update_settings', {
                roomId: roomState.id,
                settings: { randomJumpEnabled, jumpTimerSeconds: parseInt(jumpTimerSeconds, 10) },
                targetPage: target || null
            });
        }
    };

    // Shared styles
    const inputStyle = {
        backgroundColor: '#f0e6c8', border: '2px solid rgba(15,13,10,0.25)',
        color: '#0f0d0a', outline: 'none',
        fontFamily: "'Press Start 2P', monospace", fontSize: '9px',
        width: '100%', padding: '12px 16px',
    };
    const btnPrimary = { backgroundColor: '#0f0d0a', color: '#f0e6c8', border: '2px solid #0f0d0a' };
    const btnSecondary = { backgroundColor: '#e4d8b0', color: '#0f0d0a', border: '2px solid rgba(15,13,10,0.3)' };

    // ── View 1: Entry Screen ──────────────────────────────────────────────────
    if (!roomState) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 w-full" style={{ backgroundColor: '#f0e6c8', color: '#0f0d0a' }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full">

                    <div className="text-center mb-10">
                        <h1 className="text-xl md:text-3xl mb-3 uppercase" style={{ textShadow: '3px 3px 0 rgba(15,13,10,0.15)' }}>
                            UNFAIR WIKI
                        </h1>
                        <p className="text-[8px]" style={{ color: 'rgba(15,13,10,0.45)' }}>THE CHAOTIC WIKIPEDIA RACING GAME</p>
                    </div>

                    <div className="border-2 border-[#0f0d0a]/20 p-8 pixel-border" style={{ backgroundColor: '#e4d8b0' }}>
                        {error && (
                            <div className="border-2 border-[#0f0d0a]/40 text-[9px] p-3 mb-5 leading-relaxed" style={{ backgroundColor: '#d4c898', color: '#0f0d0a' }}>
                                ⚠ {error}
                            </div>
                        )}
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[8px] mb-2" style={{ color: 'rgba(15,13,10,0.6)' }}>YOUR NAME</label>
                                <input
                                    type="text" value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    style={inputStyle}
                                    onFocus={e => e.target.style.borderColor = '#0f0d0a'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(15,13,10,0.25)'}
                                    placeholder="e.g. WikiWizard"
                                />
                            </div>
                            <div>
                                <label className="block text-[8px] mb-2" style={{ color: 'rgba(15,13,10,0.6)' }}>ROOM CODE</label>
                                <input
                                    type="text" value={roomId}
                                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                    style={{ ...inputStyle, letterSpacing: '0.15em' }}
                                    onFocus={e => e.target.style.borderColor = '#0f0d0a'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(15,13,10,0.25)'}
                                    placeholder="e.g. CODE123" maxLength={10}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <button onClick={handleCreateRoom} style={btnPrimary}
                                    className="text-[8px] py-4 px-3 pixel-border transition-all"
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0e6c8'; e.currentTarget.style.color = '#0f0d0a'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0f0d0a'; e.currentTarget.style.color = '#f0e6c8'; }}>
                                    CREATE ROOM
                                </button>
                                <button onClick={handleJoinRoom} style={btnSecondary}
                                    className="text-[8px] py-4 px-3 pixel-border transition-all"
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0f0d0a'; e.currentTarget.style.color = '#f0e6c8'; e.currentTarget.style.borderColor = '#0f0d0a'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#e4d8b0'; e.currentTarget.style.color = '#0f0d0a'; e.currentTarget.style.borderColor = 'rgba(15,13,10,0.3)'; }}>
                                    JOIN ROOM
                                </button>
                            </div>
                        </div>
                    </div>

                    <HowToPlay />
                </motion.div>
            </div>
        );
    }

    // ── View 2: Lobby ─────────────────────────────────────────────────────────
    const isHost = roomState.hostId === socket.id;
    const playersList = Object.values(roomState.players);

    return (
        <div className="min-h-screen p-4 md:p-8 w-full" style={{ backgroundColor: '#f0e6c8', color: '#0f0d0a' }}>
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-2 border-[#0f0d0a]/20 p-6 pixel-border" style={{ backgroundColor: '#e4d8b0' }}>
                    <div>
                        <h2 className="text-base mb-2">ROOM: <span className="text-[#0f0d0a]">{roomState.id}</span></h2>
                        <p className="text-[8px] flex items-center gap-2" style={{ color: 'rgba(15,13,10,0.5)' }}>
                            <Users size={12} /> {playersList.length} / 8 PLAYERS
                        </p>
                    </div>
                    {isHost ? (
                        <div className="mt-4 md:mt-0 flex items-center gap-3">
                            <button onClick={handleStartGame}
                                className="text-[8px] px-8 py-4 flex items-center gap-3 pixel-border transition-all"
                                style={btnPrimary}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0e6c8'; e.currentTarget.style.color = '#0f0d0a'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0f0d0a'; e.currentTarget.style.color = '#f0e6c8'; }}>
                                <Swords size={14} /> START GAME
                            </button>
                            <button onClick={handleLeaveRoom}
                                className="text-[8px] px-5 py-4 flex items-center gap-2 pixel-border transition-all"
                                style={{ backgroundColor: '#e4d8b0', color: '#0f0d0a', border: '2px solid rgba(15,13,10,0.25)' }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#d4c898'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#e4d8b0'; }}>
                                LEAVE
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 md:mt-0 flex items-center gap-3">
                            <div className="px-6 py-3 border border-[#0f0d0a]/20 text-[8px]" style={{ color: 'rgba(15,13,10,0.45)', backgroundColor: '#d4c898' }}>
                                WAITING FOR HOST...
                            </div>
                            <button onClick={handleLeaveRoom}
                                className="text-[8px] px-5 py-3 flex items-center gap-2 pixel-border transition-all"
                                style={{ backgroundColor: '#e4d8b0', color: '#0f0d0a', border: '2px solid rgba(15,13,10,0.25)' }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#d4c898'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#e4d8b0'; }}>
                                LEAVE
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Players */}
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="text-[9px]" style={{ color: 'rgba(15,13,10,0.6)' }}>PLAYERS</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {playersList.map(player => (
                                <div key={player.id} className="border-2 border-[#0f0d0a]/15 flex items-center justify-between p-4" style={{ backgroundColor: '#e4d8b0' }}>
                                    <span className="text-[8px] text-[#0f0d0a]">{player.name}</span>
                                    {player.id === roomState.hostId && (
                                        <span className="text-[7px] border border-[#0f0d0a]/40 px-2 py-0.5 text-[#0f0d0a]">HOST</span>
                                    )}
                                </div>
                            ))}
                            {Array.from({ length: 8 - playersList.length }).map((_, i) => (
                                <div key={`empty-${i}`} className="flex items-center justify-center p-4 text-[8px]"
                                    style={{ border: '2px dashed rgba(15,13,10,0.12)', color: 'rgba(15,13,10,0.25)', backgroundColor: '#ece2c4' }}>
                                    EMPTY SLOT
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="space-y-4">
                        <h3 className="text-[9px] flex items-center gap-2" style={{ color: 'rgba(15,13,10,0.6)' }}>
                            <Settings size={13} /> SETTINGS
                        </h3>
                        <div className="border-2 border-[#0f0d0a]/15 p-5 space-y-6" style={{ backgroundColor: '#e4d8b0' }}>

                            {/* Chaos Toggle */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-[8px]">CHAOS JUMP</label>
                                    {isHost ? (
                                        <button
                                            onClick={() => { setRandomJumpEnabled(!randomJumpEnabled); setTimeout(handleUpdateSettings, 50); }}
                                            className="relative inline-flex h-5 w-10 items-center border-2 transition-colors"
                                            style={{ backgroundColor: randomJumpEnabled ? '#0f0d0a' : '#d4c898', borderColor: randomJumpEnabled ? '#0f0d0a' : 'rgba(15,13,10,0.3)' }}
                                        >
                                            <span className={`inline-block h-3 w-3 transform transition-transform ${randomJumpEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                                                style={{ backgroundColor: randomJumpEnabled ? '#f0e6c8' : '#0f0d0a' }} />
                                        </button>
                                    ) : (
                                        <span className="text-[8px]" style={{ color: roomState.settings.randomJumpEnabled ? '#0f0d0a' : 'rgba(15,13,10,0.3)' }}>
                                            {roomState.settings.randomJumpEnabled ? 'ON' : 'OFF'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(15,13,10,0.45)', fontFamily: 'system-ui, sans-serif' }}>
                                    Randomly teleports all players mid-race.
                                </p>
                            </div>

                            {/* Timer — max 300s */}
                            {(isHost ? randomJumpEnabled : roomState.settings.randomJumpEnabled) && (
                                <div>
                                    <div className="flex justify-between mb-3">
                                        <label className="text-[8px]" style={{ color: 'rgba(15,13,10,0.7)' }}>JUMP FREQ</label>
                                        <span className="text-[9px] font-bold">
                                            {isHost ? jumpTimerSeconds : roomState.settings.jumpTimerSeconds}s
                                        </span>
                                    </div>
                                    {isHost ? (
                                        <input type="range" min="30" max="300" step="10"
                                            value={jumpTimerSeconds}
                                            onChange={(e) => setJumpTimerSeconds(e.target.value)}
                                            onMouseUp={handleUpdateSettings} onTouchEnd={handleUpdateSettings}
                                            className="w-full" style={{ accentColor: '#0f0d0a' }} />
                                    ) : (
                                        <div className="h-1.5 w-full border border-[#0f0d0a]/15" style={{ backgroundColor: '#d4c898' }}>
                                            <div className="h-full transition-all duration-300" style={{ width: `${(roomState.settings.jumpTimerSeconds / 300) * 100}%`, backgroundColor: '#0f0d0a' }}></div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Target Page */}
                            <div style={{ paddingTop: '1rem', borderTop: '1px solid rgba(15,13,10,0.1)' }}>
                                <label className="block text-[8px] mb-3" style={{ color: 'rgba(15,13,10,0.6)' }}>TARGET PAGE</label>
                                {isHost ? (
                                    <>
                                        <div className="relative">
                                            <input type="text" value={customTarget}
                                                onChange={(e) => handleTargetChange(e.target.value)}
                                                placeholder="e.g. Banana"
                                                style={{ ...inputStyle, marginBottom: '0.5rem', paddingRight: '36px' }}
                                                onFocus={e => e.target.style.borderColor = '#0f0d0a'}
                                                onBlur={e => e.target.style.borderColor = targetValid === false ? 'rgba(180,60,60,0.6)' : targetValid === true ? 'rgba(30,120,30,0.6)' : 'rgba(15,13,10,0.25)'}
                                            />
                                            {/* Validation indicator */}
                                            <span className="absolute right-3 top-3 text-[14px]">
                                                {targetValidating && <span style={{ fontFamily: 'system-ui', fontSize: '11px', color: 'rgba(15,13,10,0.4)' }}>...</span>}
                                                {!targetValidating && targetValid === true && <span>✓</span>}
                                                {!targetValidating && targetValid === false && <span style={{ color: '#b03030' }}>✗</span>}
                                            </span>
                                        </div>
                                        {/* Validation feedback */}
                                        {targetError && (
                                            <p className="text-[10px] mb-1" style={{ color: '#b03030', fontFamily: 'system-ui, sans-serif' }}>⚠ {targetError}</p>
                                        )}
                                        {targetValid === true && (
                                            <p className="text-[10px] mb-1" style={{ color: '#2a6a2a', fontFamily: 'system-ui, sans-serif' }}>✓ Page found on Wikipedia</p>
                                        )}
                                        <p className="text-[10px] flex items-start gap-1.5 leading-relaxed mt-1" style={{ color: 'rgba(15,13,10,0.4)', fontFamily: 'system-ui, sans-serif' }}>
                                            <Info size={10} className="mt-0.5 flex-shrink-0" /> Leave blank for a random target.
                                        </p>
                                    </>
                                ) : (
                                    <div className="border border-[#0f0d0a]/15 px-3 py-2 text-[8px]" style={{ backgroundColor: '#f0e6c8' }}>
                                        {roomState.targetPage ? roomState.targetPage.replace(/_/g, ' ') : 'RANDOM ON START'}
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
