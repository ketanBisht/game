import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, AlertTriangle, Flag, ChevronDown, ChevronUp, Users } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://unfairwiki.onrender.com';

// Readable sans for data values (page names, numbers) — keeps 8-bit feel for labels only
const DATA_FONT = { fontFamily: 'system-ui, -apple-system, sans-serif' };

const Game = ({ socket, roomState: initialRoomState }) => {
    const [roomState, setRoomState] = useState(initialRoomState);
    const [wikiHtml, setWikiHtml] = useState('');
    const [pageTitle, setPageTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [showJumpOverlay, setShowJumpOverlay] = useState(false);
    const [hudExpanded, setHudExpanded] = useState(false);
    const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

    // === Countdown Timer ===
    const [jumpCountdown, setJumpCountdown] = useState(null);
    const countdownRef = useRef(null);

    const resetCountdown = (seconds) => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setJumpCountdown(seconds);
        countdownRef.current = setInterval(() => {
            setJumpCountdown(prev => {
                if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    useEffect(() => {
        if (initialRoomState?.settings?.randomJumpEnabled) {
            resetCountdown(initialRoomState.settings.jumpTimerSeconds);
        }
        return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Inject Wikipedia's real Vector CSS so articles look exactly like Wikipedia
    useEffect(() => {
        const id = 'wikipedia-vector-css';
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = 'https://en.wikipedia.org/w/load.php?lang=en&modules=skin.vector.styles&only=styles';
            document.head.appendChild(link);
        }
        return () => { document.getElementById('wikipedia-vector-css')?.remove(); };
    }, []);

    const contentRef = useRef(null);
    const me = roomState?.players[socket.id];
    const currentPage = me?.currentPage;

    // --- Fetch Wikipedia ---
    useEffect(() => {
        if (!currentPage) return;
        const fetchWikiPage = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${BACKEND_URL}/api/wiki/${encodeURIComponent(currentPage)}`);
                const data = await response.json();
                setWikiHtml(data.html || '');
                setPageTitle(data.title || currentPage);
                window.scrollTo(0, 0);
            } catch {
                setWikiHtml('<div style="padding:2rem;text-align:center">Failed to load page.</div>');
            } finally {
                setLoading(false);
            }
        };
        fetchWikiPage();
    }, [currentPage]);

    // --- Link Clicks ---
    useEffect(() => {
        const handleWikiClick = (e) => {
            const link = e.target.closest('a.wiki-internal-link');
            if (link) {
                e.preventDefault();
                const p = link.getAttribute('data-wiki-page');
                if (p) socket.emit('navigated', { roomId: roomState.id, newPage: p });
            } else if (e.target.tagName === 'A') {
                e.preventDefault();
            }
        };
        const container = contentRef.current;
        if (container) container.addEventListener('click', handleWikiClick);
        return () => { if (container) container.removeEventListener('click', handleWikiClick); };
    }, [wikiHtml, socket, roomState]);

    // --- Room sync ---
    useEffect(() => {
        const handleRoomUpdate = (s) => setRoomState(s);
        const handleJump = (s) => {
            setRoomState(s);
            setShowJumpOverlay(true);
            setTimeout(() => setShowJumpOverlay(false), 3000);
            if (s.settings?.randomJumpEnabled) {
                setTimeout(() => resetCountdown(s.settings.jumpTimerSeconds), 3100);
            }
        };
        socket.on('room_state_update', handleRoomUpdate);
        socket.on('random_jump_triggered', handleJump);
        return () => {
            socket.off('room_state_update', handleRoomUpdate);
            socket.off('random_jump_triggered', handleJump);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket]);

    const handleSurrender = () => { socket.emit('surrender', { roomId: roomState.id }); setShowSurrenderConfirm(false); };

    if (!roomState) return null;
    const players = Object.values(roomState.players);

    // Countdown colour ramp
    const cdUrgent = jumpCountdown !== null && jumpCountdown <= 10;
    const cdWarn = jumpCountdown !== null && jumpCountdown <= 30 && !cdUrgent;
    const cdColor = cdUrgent ? '#c0392b' : cdWarn ? '#b07800' : '#f0e6c8';

    // HUD constants — dark sepia strip above white wiki
    const hudBg = '#1a160e';
    const hudCard = '#2a2216';
    const hudBord = 'rgba(240,230,200,0.18)';
    const hudText = '#f0e6c8';
    const hudDim = 'rgba(240,230,200,0.5)';

    return (
        <div className="min-h-screen bg-white">

            {/* ══════════════════════════════ HUD ══════════════════════════════ */}
            <div className="fixed top-0 left-0 right-0 z-50">

                {/* Main bar */}
                <div className="flex items-center gap-2 px-3 flex-wrap"
                    style={{ backgroundColor: hudBg, borderBottom: `2px solid ${hudBord}`, minHeight: '52px' }}>

                    {/* Badge */}
                    <span className="text-[8px] hidden sm:block tracking-widest shrink-0" style={{ color: hudText }}>
                        UNFAIR WIKI
                    </span>
                    <div className="w-px h-5 hidden sm:block shrink-0" style={{ backgroundColor: hudBord }} />

                    {/* Target page */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded shrink-0"
                        style={{ backgroundColor: hudCard, border: `1px solid ${hudBord}` }}>
                        <Target size={11} style={{ color: '#a0d4a0' }} className="shrink-0" />
                        <span className="text-[7px]" style={{ color: hudDim }}>TARGET</span>
                        {/* Page name in readable sans */}
                        <span className="font-bold text-[12px] ml-1 leading-none" style={{ color: '#a0d4a0', ...DATA_FONT }}>
                            {roomState.targetPage ? roomState.targetPage.replace(/_/g, ' ') : '???'}
                        </span>
                    </div>

                    {/* Current page — flexible width */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded flex-1 min-w-0"
                        style={{ backgroundColor: hudCard, border: `1px solid rgba(240,230,200,0.3)` }}>
                        <span className="text-[7px] shrink-0" style={{ color: hudDim }}>YOU</span>
                        <span className="font-semibold text-[13px] truncate" style={{ color: hudText, ...DATA_FONT }}>
                            {currentPage?.replace(/_/g, ' ') || '…'}
                        </span>
                    </div>

                    {/* Players toggle */}
                    <button onClick={() => setHudExpanded(v => !v)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors shrink-0"
                        style={{ backgroundColor: hudCard, border: `1px solid ${hudBord}`, color: hudText }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#f0e6c8'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = hudBord}>
                        <Users size={12} />
                        <span className="text-[10px] hidden sm:inline" style={{ ...DATA_FONT }}>{players.length}</span>
                        {hudExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>

                    {/* ── Countdown Timer ── */}
                    {roomState.settings?.randomJumpEnabled && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded shrink-0"
                            style={{ backgroundColor: hudCard, border: `1px solid ${cdColor}55`, minWidth: '90px' }}>
                            <AlertTriangle size={12} style={{ color: cdColor }}
                                className={cdUrgent ? 'animate-pulse' : ''} />
                            <div className="flex flex-col items-center leading-none">
                                <span className="text-[7px] mb-0.5" style={{ color: hudDim }}>JUMP IN</span>
                                {/* Big readable countdown number */}
                                <span className="font-bold leading-none"
                                    style={{
                                        color: cdColor,
                                        fontSize: '20px',
                                        ...DATA_FONT,
                                        textShadow: cdUrgent ? `0 0 10px ${cdColor}` : 'none'
                                    }}>
                                    {jumpCountdown !== null ? jumpCountdown : '--'}
                                    <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '2px' }}>s</span>
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Surrender */}
                    <button onClick={() => setShowSurrenderConfirm(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[8px] transition-all ml-auto shrink-0"
                        style={{ backgroundColor: '#2a0a0a', border: '1px solid rgba(180,60,60,0.4)', color: '#e08080' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#c0392b'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#c0392b'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#2a0a0a'; e.currentTarget.style.color = '#e08080'; e.currentTarget.style.borderColor = 'rgba(180,60,60,0.4)'; }}>
                        <Flag size={11} /> <span>SURRENDER</span>
                    </button>
                </div>

                {/* ── Expanded players panel ── */}
                <AnimatePresence>
                    {hudExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                            style={{ backgroundColor: '#120f09', borderBottom: `2px solid ${hudBord}` }}>
                            <div className="px-4 py-3 flex flex-wrap gap-3">
                                {players.map(p => {
                                    const isMe = p.id === socket.id;
                                    return (
                                        <div key={p.id} className="flex items-start gap-3 px-3 py-2.5 rounded"
                                            style={{
                                                backgroundColor: isMe ? 'rgba(240,230,200,0.1)' : hudCard,
                                                border: `1px solid ${isMe ? 'rgba(240,230,200,0.45)' : hudBord}`,
                                                minWidth: '180px'
                                            }}>
                                            <div className="flex flex-col gap-1 flex-1 min-w-0">

                                                {/* Player name row */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[8px] font-bold" style={{ color: hudText }}>
                                                        {p.name}
                                                    </span>
                                                    {isMe && (
                                                        <span className="text-[7px] px-1.5 py-0.5 rounded-sm"
                                                            style={{ backgroundColor: '#f0e6c8', color: '#0f0d0a' }}>YOU</span>
                                                    )}
                                                    {p.id === roomState.hostId && (
                                                        <span className="text-[7px] px-1.5 py-0.5 rounded-sm"
                                                            style={{ border: '1px solid rgba(240,210,100,0.5)', color: 'rgba(240,210,100,0.8)' }}>HOST</span>
                                                    )}
                                                </div>

                                                {/* Current page — readable sans */}
                                                <span className="text-[12px] truncate leading-tight"
                                                    style={{ color: 'rgba(240,230,200,0.65)', ...DATA_FONT, maxWidth: '160px' }}>
                                                    {p.currentPage?.replace(/_/g, ' ') || '…'}
                                                </span>
                                            </div>

                                            {/* Click count */}
                                            <span className="text-[13px] font-bold shrink-0 self-center"
                                                style={{ color: hudDim, ...DATA_FONT }}>
                                                {p.path.length}<span style={{ fontSize: '10px', opacity: 0.6 }}>cl</span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ══════════════════════ LOADING OVERLAY ══════════════════════ */}
            <AnimatePresence>
                {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 flex items-center justify-center"
                        style={{ top: '52px', backgroundColor: 'rgba(240,230,200,0.93)', backdropFilter: 'blur(3px)' }}>
                        <div className="flex flex-col items-center gap-5">
                            <div className="animate-spin h-12 w-12 border-t-4 border-b-4 border-[#0f0d0a] rounded-full" />
                            <p className="text-[9px] text-[#0f0d0a]">LOADING WIKIPEDIA...</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══════════════════════ CHAOS JUMP OVERLAY ══════════════════════ */}
            <AnimatePresence>
                {showJumpOverlay && (
                    <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }} transition={{ duration: 0.35, type: 'spring' }}
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        style={{ backgroundColor: '#f0e6c8' }}>
                        <div className="text-center p-8">
                            <motion.div animate={{ rotate: [0, -10, 10, -10, 10, 0] }} transition={{ duration: 0.5, repeat: 3 }}>
                                <AlertTriangle size={90} className="mx-auto mb-6 text-[#0f0d0a]" />
                            </motion.div>
                            <h1 className="text-2xl md:text-3xl mb-5 text-[#0f0d0a] uppercase" style={{ textShadow: '4px 4px 0 rgba(15,13,10,0.15)' }}>
                                CHAOS JUMP!
                            </h1>
                            <p className="text-[10px] leading-loose" style={{ color: 'rgba(15,13,10,0.55)' }}>
                                TELEPORTING EVERYONE TO A RANDOM PAGE...
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══════════════════════ SURRENDER MODAL ══════════════════════ */}
            <AnimatePresence>
                {showSurrenderConfirm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ backgroundColor: 'rgba(240,230,200,0.88)', backdropFilter: 'blur(3px)' }}>
                        <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 20 }}
                            className="border-2 p-8 max-w-sm w-full text-center pixel-border"
                            style={{ backgroundColor: '#e4d8b0', borderColor: 'rgba(15,13,10,0.25)', color: '#0f0d0a' }}>
                            <Flag size={40} className="mx-auto mb-5 text-[#0f0d0a]" />
                            <h2 className="text-sm mb-4">GIVE UP?</h2>
                            <p className="text-[13px] mb-8 leading-relaxed" style={{ color: 'rgba(15,13,10,0.55)', ...DATA_FONT }}>
                                You'll be removed from the race. The game continues for others.
                            </p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowSurrenderConfirm(false)}
                                    className="flex-1 border-2 py-3 text-[8px] transition-all"
                                    style={{ borderColor: 'rgba(15,13,10,0.2)', color: '#0f0d0a', backgroundColor: '#d4c898' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c8bc8c'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#d4c898'}>
                                    KEEP GOING
                                </button>
                                <button onClick={handleSurrender}
                                    className="flex-1 py-3 text-[8px] border-2 border-[#0f0d0a] transition-all"
                                    style={{ backgroundColor: '#0f0d0a', color: '#f0e6c8' }}
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0e6c8'; e.currentTarget.style.color = '#0f0d0a'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0f0d0a'; e.currentTarget.style.color = '#f0e6c8'; }}>
                                    SURRENDER
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══════════════════════ WIKIPEDIA CONTENT ══════════════════════ */}
            <div className="pt-[52px]">
                {/* Outer page wrapper — matches Wikipedia's #mw-page-base + content-wrapper */}
                <div style={{ backgroundColor: '#fff', minHeight: 'calc(100vh - 52px)' }}>
                    {/* Content column — Wikipedia uses max ~960px centered */}
                    <div style={{ maxWidth: '983px', margin: '0 auto', padding: '0 20px 40px' }}>
                        {/* Page title */}
                        <h1 id="firstHeading" className="firstHeading"
                            style={{
                                fontFamily: "'Linux Libertine', 'Linux Libertine O', Georgia, Times, serif",
                                fontSize: '2em', fontWeight: 'normal',
                                borderBottom: '1px solid #a2a9b1',
                                paddingBottom: '3px', marginBottom: '10px',
                                color: '#000', paddingTop: '18px',
                                lineHeight: 1.3
                            }}
                            dangerouslySetInnerHTML={{ __html: pageTitle }}
                        />
                        {/* Article body — wiki-content class preserves our link interception */}
                        <div ref={contentRef} className="wiki-content mw-parser-output"
                            style={{ backgroundColor: '#fff', color: '#202122' }}
                            dangerouslySetInnerHTML={{ __html: wikiHtml }}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Game;
