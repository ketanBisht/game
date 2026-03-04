import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, AlertTriangle, Flag, ChevronDown, ChevronUp, Users } from 'lucide-react';

const Game = ({ socket, roomState: initialRoomState }) => {
    const [roomState, setRoomState] = useState(initialRoomState);
    const [wikiHtml, setWikiHtml] = useState('');
    const [pageTitle, setPageTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [showJumpOverlay, setShowJumpOverlay] = useState(false);
    const [hudExpanded, setHudExpanded] = useState(false);
    const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
    const contentRef = useRef(null);

    const me = roomState?.players[socket.id];
    const currentPage = me?.currentPage;

    // --- Fetch Wikipedia Content ---
    useEffect(() => {
        if (!currentPage) return;

        const fetchWikiPage = async () => {
            setLoading(true);
            try {
                const response = await fetch(`http://localhost:3001/api/wiki/${encodeURIComponent(currentPage)}`);
                const data = await response.json();
                setWikiHtml(data.html || '');
                setPageTitle(data.title || currentPage);
                window.scrollTo(0, 0);
            } catch (err) {
                console.error('Error fetching Wiki page', err);
                setWikiHtml('<div style="padding:2rem;color:red;text-align:center">Failed to load Wikipedia page. Check your connection.</div>');
            } finally {
                setLoading(false);
            }
        };

        fetchWikiPage();
    }, [currentPage]);

    // --- Intercept Link Clicks ---
    useEffect(() => {
        const handleWikiClick = (e) => {
            const link = e.target.closest('a.wiki-internal-link');
            if (link) {
                e.preventDefault();
                const targetPageName = link.getAttribute('data-wiki-page');
                if (targetPageName) {
                    socket.emit('navigated', { roomId: roomState.id, newPage: targetPageName });
                }
            } else if (e.target.tagName === 'A') {
                e.preventDefault();
            }
        };
        const container = contentRef.current;
        if (container) container.addEventListener('click', handleWikiClick);
        return () => { if (container) container.removeEventListener('click', handleWikiClick); };
    }, [wikiHtml, socket, roomState]);

    // --- Sync roomState from server ---
    useEffect(() => {
        const handleRoomUpdate = (updatedRoomState) => setRoomState(updatedRoomState);

        const handleJump = (updatedRoomState) => {
            setRoomState(updatedRoomState);
            setShowJumpOverlay(true);
            setTimeout(() => setShowJumpOverlay(false), 3000);
        };

        socket.on('room_state_update', handleRoomUpdate);
        socket.on('random_jump_triggered', handleJump);
        return () => {
            socket.off('room_state_update', handleRoomUpdate);
            socket.off('random_jump_triggered', handleJump);
        };
    }, [socket]);

    const handleSurrender = () => {
        socket.emit('surrender', { roomId: roomState.id });
        setShowSurrenderConfirm(false);
    };

    if (!roomState) return null;

    const players = Object.values(roomState.players);

    return (
        <div className="min-h-screen bg-white text-slate-900">

            {/* ===== FLOATING HUD BAR ===== */}
            <div className="fixed top-0 left-0 right-0 z-50 shadow-2xl">

                {/* Main HUD Row */}
                <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700 px-4 py-2.5 flex items-center gap-3 flex-wrap">

                    {/* Game Badge */}
                    <div className="text-purple-400 font-black text-sm tracking-widest uppercase hidden sm:block">
                        Unfair Wiki
                    </div>

                    <div className="w-px h-5 bg-slate-700 hidden sm:block" />

                    {/* Target Page */}
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
                        <Target size={13} className="text-green-400 shrink-0" />
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wide">Target:</span>
                        <span className="text-green-400 font-black text-sm ml-1">
                            {roomState.targetPage ? roomState.targetPage.replace(/_/g, ' ') : '???'}
                        </span>
                    </div>

                    {/* Current Page Indicator */}
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-purple-500/40 rounded-lg px-3 py-1.5 flex-1 min-w-0">
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wide shrink-0">You:</span>
                        <span className="text-purple-300 font-semibold text-sm truncate">
                            {currentPage?.replace(/_/g, ' ') || '...'}
                        </span>
                    </div>

                    {/* Players Toggle */}
                    <button
                        onClick={() => setHudExpanded(v => !v)}
                        className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 text-slate-300 transition-colors text-sm font-medium"
                    >
                        <Users size={13} />
                        <span className="hidden sm:inline">{players.length}</span>
                        {hudExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {/* Chaos Indicator */}
                    {roomState.settings?.randomJumpEnabled && (
                        <div className="flex items-center gap-1.5 text-orange-400 text-xs font-bold animate-pulse">
                            <AlertTriangle size={13} />
                            <span className="hidden md:inline">Chaos ON</span>
                        </div>
                    )}

                    {/* Surrender Button */}
                    <button
                        onClick={() => setShowSurrenderConfirm(true)}
                        className="flex items-center gap-1.5 bg-red-900/40 border border-red-500/50 hover:bg-red-800/60 hover:border-red-400 text-red-400 hover:text-red-300 rounded-lg px-3 py-1.5 text-sm font-bold transition-all ml-auto shrink-0"
                    >
                        <Flag size={13} />
                        <span>Surrender</span>
                    </button>
                </div>

                {/* Expanded Players Panel */}
                <AnimatePresence>
                    {hudExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden bg-slate-900/95 backdrop-blur-md border-b border-slate-700"
                        >
                            <div className="px-4 py-3 flex flex-wrap gap-3">
                                {players.map(p => (
                                    <div
                                        key={p.id}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${p.id === socket.id
                                                ? 'bg-purple-900/50 border-purple-500/60 text-purple-200'
                                                : 'bg-slate-800 border-slate-700 text-slate-300'
                                            }`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold flex items-center gap-1.5">
                                                {p.name}
                                                {p.id === socket.id && (
                                                    <span className="text-[9px] bg-purple-600 px-1.5 py-0.5 rounded font-black text-white">YOU</span>
                                                )}
                                                {p.id === roomState.hostId && (
                                                    <span className="text-[9px] bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 px-1.5 py-0.5 rounded font-bold">HOST</span>
                                                )}
                                            </span>
                                            <span className="text-xs text-slate-400 mt-0.5 truncate max-w-[140px]">
                                                {p.currentPage?.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <span className="text-xs font-mono bg-slate-900/60 border border-slate-700/50 px-2 py-1 rounded text-slate-400 ml-auto">
                                            {p.path.length} clicks
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ===== PAGE LOADING OVERLAY ===== */}
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-white/90 backdrop-blur-sm z-40 flex items-center justify-center"
                        style={{ top: '52px' }}
                    >
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-purple-600" />
                            <p className="text-purple-700 font-bold text-lg animate-pulse">Loading Wikipedia...</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== CHAOS JUMP OVERLAY ===== */}
            <AnimatePresence>
                {showJumpOverlay && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.2 }}
                        transition={{ duration: 0.4, type: 'spring' }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
                    >
                        <div className="text-center p-8">
                            <motion.div
                                animate={{ rotate: [0, -12, 12, -12, 12, 0] }}
                                transition={{ duration: 0.5, repeat: 3 }}
                            >
                                <AlertTriangle size={120} className="text-red-500 mx-auto mb-6" />
                            </motion.div>
                            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500 mb-4 uppercase tracking-tighter">
                                Chaos Jump!
                            </h1>
                            <p className="text-2xl text-slate-300 font-medium">
                                Teleporting everyone to a random page...
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== SURRENDER CONFIRM MODAL ===== */}
            <AnimatePresence>
                {showSurrenderConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, y: 20 }}
                            className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center"
                        >
                            <Flag size={48} className="text-red-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-black text-white mb-2">Give Up?</h2>
                            <p className="text-slate-400 mb-8 text-sm">
                                You'll be removed from the race. The game continues for others.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSurrenderConfirm(false)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    Keep Going
                                </button>
                                <button
                                    onClick={handleSurrender}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    Surrender
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== FULL-PAGE WIKIPEDIA CONTENT ===== */}
            <div className="pt-[52px]"> {/* offset for fixed HUD */}
                {/* Wikipedia-style header */}
                <div className="border-b border-slate-200 bg-white px-4 md:px-12 pt-8 pb-4 max-w-5xl mx-auto">
                    <h1
                        className="text-3xl md:text-4xl font-serif font-normal text-slate-900 leading-tight"
                        dangerouslySetInnerHTML={{ __html: pageTitle }}
                    />
                </div>

                {/* Wikipedia body */}
                <div className="max-w-5xl mx-auto px-4 md:px-12 py-6">
                    <div
                        ref={contentRef}
                        className="wiki-content"
                        dangerouslySetInnerHTML={{ __html: wikiHtml }}
                    />
                </div>
            </div>

        </div>
    );
};

export default Game;
