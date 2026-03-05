import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './Lobby';
import Game from './Game';
import { LogOut, Flag, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://unfairwiki.onrender.com';
const socket = io(BACKEND_URL);

const DATA = { fontFamily: 'system-ui, -apple-system, sans-serif' };

function App() {
  const [gameState, setGameState] = useState('lobby');
  const [roomState, setRoomState] = useState(null);
  const [winnerInfo, setWinnerInfo] = useState(null);

  useEffect(() => {
    socket.on('connect', () => console.log('Connected'));
    socket.on('game_started', (state) => { setRoomState(state); setGameState('playing'); });
    socket.on('game_over', (data) => {
      setRoomState(data.roomState);
      setWinnerInfo({ id: data.winnerId, name: data.winnerName, reason: data.reason || null });
      setGameState('game_over');
    });
    // Host triggered Play Again — everyone returns to lobby
    socket.on('returned_to_lobby', (resetRoom) => {
      setRoomState(resetRoom);
      setWinnerInfo(null);
      setGameState('lobby');
    });
    return () => {
      socket.off('connect');
      socket.off('game_started');
      socket.off('game_over');
      socket.off('returned_to_lobby');
    };
  }, []);

  const handleLeaveLobby = () => {
    if (roomState?.id) socket.emit('leave_room', roomState.id);
    setRoomState(null); setWinnerInfo(null); setGameState('lobby');
  };

  const handlePlayAgain = () => {
    // Host emits play_again; all players receive 'returned_to_lobby'
    if (roomState?.id) socket.emit('play_again', roomState.id);
  };

  const getResult = () => {
    if (!winnerInfo) return null;
    const { id, name, reason } = winnerInfo;
    const isMine = id === socket.id;
    if (reason === 'all_surrendered') return { label: 'ALL SURRENDERED', sub: 'Everyone waved the white flag.', emoji: '🏳️', isWin: false };
    if (reason === 'last_standing') return { label: isMine ? 'LAST STANDING!' : 'GAME OVER', sub: `${name} outlasted everyone!`, emoji: isMine ? '🎖️' : '💀', isWin: isMine };
    return { label: isMine ? 'YOU WIN!' : 'GAME OVER', sub: `${name} reached the target!`, emoji: isMine ? '🏆' : '💀', isWin: isMine };
  };
  const result = getResult();
  const isHost = roomState?.hostId === socket.id;

  return (
    <AnimatePresence mode="wait">

      {gameState === 'lobby' && (
        <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Lobby
            socket={socket}
            initialRoomState={roomState}
            onGameStart={(s) => { setRoomState(s); setGameState('playing'); }}
            onLeave={() => { setRoomState(null); }}
          />
        </motion.div>
      )}

      {gameState === 'playing' && (
        <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-screen w-full">
          <Game socket={socket} roomState={roomState} />
        </motion.div>
      )}

      {/* ═══════════════════ FINISH / GAME OVER SCREEN ═══════════════════ */}
      {gameState === 'game_over' && (
        <motion.div key="game_over" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="min-h-screen w-full" style={{ backgroundColor: '#f0e6c8', color: '#0f0d0a' }}>

          {/* ── Pixel-border header strip ── */}
          <div className="w-full py-10 px-6 text-center"
            style={{ borderBottom: '4px solid #0f0d0a', backgroundColor: '#e4d8b0', boxShadow: '0 4px 0 0 rgba(15,13,10,0.1)' }}>

            {/* Big emoji — no invisible SVG */}
            <motion.div
              initial={{ scale: 0.3, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 13 }}
              style={{ fontSize: '72px', lineHeight: 1, marginBottom: '1.25rem' }}>
              {result?.emoji ?? '🎮'}
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="text-2xl md:text-4xl uppercase mb-3"
              style={{ color: '#0f0d0a', textShadow: '3px 3px 0 rgba(15,13,10,0.12)', letterSpacing: '0.05em' }}>
              {result?.label ?? 'GAME OVER'}
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
              className="text-[15px] mb-5" style={{ color: 'rgba(15,13,10,0.55)', ...DATA }}>
              {result?.sub}
            </motion.p>

            {/* Target page chip */}
            {roomState?.targetPage && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-3 px-5 py-2"
                style={{ backgroundColor: '#f0e6c8', border: '2px solid rgba(15,13,10,0.25)', display: 'inline-flex' }}>
                <span className="text-[8px]" style={{ color: 'rgba(15,13,10,0.45)' }}>TARGET PAGE</span>
                <span className="text-[16px] font-semibold" style={{ color: '#0f0d0a', ...DATA }}>
                  {roomState.targetPage.replace(/_/g, ' ')}
                </span>
              </motion.div>
            )}
          </div>

          {/* ── Scoreboard ── */}
          <div className="px-4 py-8 max-w-4xl mx-auto w-full">
            <div className="text-[9px] mb-4 tracking-widest" style={{ color: 'rgba(15,13,10,0.35)' }}>
              ── SCOREBOARD ──────────────────────────────
            </div>

            <div className="space-y-3">
              {roomState && Object.values(roomState.players)
                .sort((a, b) => {
                  if (a.id === winnerInfo?.id) return -1;
                  if (b.id === winnerInfo?.id) return 1;
                  if (a.surrendered && !b.surrendered) return 1;
                  if (!a.surrendered && b.surrendered) return -1;
                  return a.path.length - b.path.length;
                })
                .map((player, idx) => {
                  const isWinner = player.id === winnerInfo?.id;
                  const isMe = player.id === socket.id;
                  const medals = ['🥇', '🥈', '🥉'];
                  const medal = player.surrendered ? '🏳️' : (medals[idx] ?? `#${idx + 1}`);
                  return (
                    <motion.div key={player.id}
                      initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.07, type: 'spring', stiffness: 180 }}>

                      {/* Player header row */}
                      <div className="flex items-center px-4 py-3 gap-3"
                        style={{ backgroundColor: isWinner ? '#0f0d0a' : '#d4c898', border: `2px solid ${isWinner ? '#0f0d0a' : 'rgba(15,13,10,0.2)'}`, borderBottom: 0 }}>
                        <span style={{ fontSize: '22px', lineHeight: 1, minWidth: '28px', textAlign: 'center' }}>{medal}</span>
                        <span className="text-[11px] font-bold" style={{ color: isWinner ? '#f0e6c8' : '#0f0d0a' }}>{player.name}</span>
                        {isMe && <span className="text-[8px] px-2 py-0.5" style={{ backgroundColor: isWinner ? '#f0e6c8' : '#0f0d0a', color: isWinner ? '#0f0d0a' : '#f0e6c8' }}>YOU</span>}
                        {player.surrendered && <span className="text-[8px] flex items-center gap-1" style={{ color: isWinner ? 'rgba(240,230,200,0.5)' : 'rgba(15,13,10,0.4)' }}><Flag size={8} /> GAVE UP</span>}
                        <span className="ml-auto text-[16px] font-bold" style={{ color: isWinner ? 'rgba(240,230,200,0.7)' : 'rgba(15,13,10,0.45)', ...DATA }}>
                          {player.path.length}<span style={{ fontSize: '11px', opacity: 0.6 }}> clicks</span>
                        </span>
                      </div>

                      {/* Path */}
                      <div className="px-4 py-3 flex flex-wrap gap-1.5 items-center"
                        style={{ backgroundColor: isWinner ? '#1e1a12' : '#e4d8b0', border: `2px solid ${isWinner ? '#0f0d0a' : 'rgba(15,13,10,0.2)'}`, borderTop: `1px solid ${isWinner ? 'rgba(240,230,200,0.1)' : 'rgba(15,13,10,0.08)'}` }}>
                        {player.path.length === 0
                          ? <span className="text-[12px] italic" style={{ color: 'rgba(15,13,10,0.3)', ...DATA }}>No pages visited</span>
                          : player.path.map((page, i) => {
                            const isTarget = page.toLowerCase() === roomState.targetPage?.toLowerCase();
                            const isStart = i === 0;
                            return (
                              <div key={`${page}-${i}`} className="flex items-center gap-1">
                                <span className="text-[12px] px-2 py-0.5 leading-snug"
                                  style={{ ...DATA, fontWeight: isTarget ? 700 : isStart ? 600 : 400, backgroundColor: isTarget ? '#0f0d0a' : isStart ? '#c8bc96' : '#cec2a2', color: isTarget ? '#f0e6c8' : '#0f0d0a', border: `1px solid ${isTarget ? 'transparent' : 'rgba(15,13,10,0.12)'}` }}>
                                  {page.replace(/_/g, ' ')}
                                </span>
                                {i < player.path.length - 1 && <span style={{ color: 'rgba(15,13,10,0.2)', fontSize: '12px' }}>›</span>}
                              </div>
                            );
                          })}
                      </div>
                    </motion.div>
                  );
                })}
            </div>

            {/* PLAY AGAIN + LEAVE LOBBY */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              {isHost ? (
                <button onClick={handlePlayAgain}
                  className="flex items-center gap-3 border-2 border-[#0f0d0a] text-[9px] px-10 py-4 pixel-border transition-all"
                  style={{ backgroundColor: '#0f0d0a', color: '#f0e6c8' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0e6c8'; e.currentTarget.style.color = '#0f0d0a'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0f0d0a'; e.currentTarget.style.color = '#f0e6c8'; }}>
                  <RefreshCw size={14} /> PLAY AGAIN
                </button>
              ) : (
                <div className="text-[8px] px-8 py-4 border-2 border-dashed"
                  style={{ borderColor: 'rgba(15,13,10,0.2)', color: 'rgba(15,13,10,0.4)' }}>
                  WAITING FOR HOST TO REMATCH...
                </div>
              )}
              <button onClick={handleLeaveLobby}
                className="flex items-center gap-3 border-2 text-[9px] px-10 py-4 pixel-border transition-all"
                style={{ backgroundColor: '#e4d8b0', color: '#0f0d0a', borderColor: 'rgba(15,13,10,0.3)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#d4c898'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#e4d8b0'; }}>
                <LogOut size={14} /> LEAVE LOBBY
              </button>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
