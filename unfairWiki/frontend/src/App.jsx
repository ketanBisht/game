import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './Lobby';
import Game from './Game';
import { Trophy, LogOut, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const socket = io('http://localhost:3001');

function App() {
  const [gameState, setGameState] = useState('lobby'); // lobby | playing | game_over
  const [roomState, setRoomState] = useState(null);
  const [winnerInfo, setWinnerInfo] = useState(null);

  useEffect(() => {
    socket.on('connect', () => console.log('Connected to server'));

    socket.on('game_started', (state) => {
      setRoomState(state);
      setGameState('playing');
    });

    socket.on('game_over', (data) => {
      setRoomState(data.roomState);
      setWinnerInfo({
        id: data.winnerId,
        name: data.winnerName,
        reason: data.reason || null
      });
      setGameState('game_over');
    });

    return () => {
      socket.off('connect');
      socket.off('game_started');
      socket.off('game_over');
    };
  }, []);

  const handleLeaveRoom = () => {
    if (roomState?.id) {
      socket.emit('leave_room', roomState.id);
    }
    setRoomState(null);
    setWinnerInfo(null);
    setGameState('lobby');
  };

  // Helper: build a readable result headline
  const getResultHeadline = () => {
    if (!winnerInfo) return null;
    const { id, name, reason } = winnerInfo;
    if (reason === 'all_surrendered') return { text: 'Everyone Surrendered', sub: 'No winner this round.', isWin: false };
    if (reason === 'last_standing') return { text: id === socket.id ? 'You Win!' : 'Game Over', sub: `${name} won — last player standing!`, isWin: id === socket.id };
    return { text: id === socket.id ? 'Victory!' : 'Game Over', sub: `${name} reached "${roomState?.targetPage?.replace(/_/g, ' ')}" first!`, isWin: id === socket.id };
  };

  const result = getResultHeadline();

  return (
    <AnimatePresence mode="wait">

      {gameState === 'lobby' && (
        <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Lobby socket={socket} onGameStart={(state) => {
            setRoomState(state);
            setGameState('playing');
          }} />
        </motion.div>
      )}

      {gameState === 'playing' && (
        <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-screen w-full">
          <Game socket={socket} roomState={roomState} />
        </motion.div>
      )}

      {gameState === 'game_over' && (
        <motion.div
          key="game_over"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen bg-slate-900 text-white flex flex-col items-center py-10 px-4"
        >
          <div className="w-full max-w-5xl">

            {/* ===== RESULT HEADER ===== */}
            <div className="text-center mb-10">
              <Trophy
                size={72}
                className={`mx-auto mb-5 ${result?.isWin ? 'text-yellow-400' : 'text-slate-600'}`}
              />
              <h1 className="text-5xl md:text-7xl font-black mb-3 uppercase tracking-tight">
                {result?.isWin
                  ? <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">{result.text}</span>
                  : <span className="text-slate-300">{result?.text ?? 'Game Over'}</span>
                }
              </h1>
              <p className="text-xl text-slate-400">{result?.sub}</p>
            </div>

            {/* ===== ALL PLAYER PATHS ===== */}
            {roomState && (
              <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl mb-8 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-200">Everyone's Journey</h3>
                  <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full ml-auto">
                    Target: <span className="text-green-400 font-bold">{roomState.targetPage?.replace(/_/g, ' ')}</span>
                  </span>
                </div>

                <div className="divide-y divide-slate-700/50 max-h-[55vh] overflow-y-auto">
                  {Object.values(roomState.players)
                    .sort((a, b) => {
                      // Winner first, then active, then surrendered
                      if (a.id === winnerInfo?.id) return -1;
                      if (b.id === winnerInfo?.id) return 1;
                      if (a.surrendered && !b.surrendered) return 1;
                      if (!a.surrendered && b.surrendered) return -1;
                      return a.path.length - b.path.length;
                    })
                    .map(player => (
                      <div key={player.id} className="px-6 py-5">
                        {/* Player header row */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="font-bold text-white text-base">{player.name}</span>
                          {player.id === socket.id && (
                            <span className="text-[10px] bg-purple-600 border border-purple-500 text-white px-2 py-0.5 rounded font-black">YOU</span>
                          )}
                          {player.id === winnerInfo?.id && (
                            <span className="text-[10px] bg-yellow-500 text-slate-900 px-2 py-0.5 rounded-full font-black">🏆 WINNER</span>
                          )}
                          {player.surrendered && (
                            <span className="flex items-center gap-1 text-[10px] bg-red-900/40 border border-red-500/40 text-red-400 px-2 py-0.5 rounded font-bold">
                              <Flag size={9} /> SURRENDERED
                            </span>
                          )}
                          <span className="ml-auto text-xs text-slate-500 font-mono">
                            {player.path.length} {player.path.length === 1 ? 'click' : 'clicks'}
                          </span>
                        </div>

                        {/* Path breadcrumb */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {player.path.length === 0 ? (
                            <span className="text-slate-500 text-sm italic">No pages visited</span>
                          ) : (
                            player.path.map((page, index) => (
                              <div key={`${page}-${index}`} className="flex items-center gap-1.5">
                                <span className={`text-xs px-2 py-1 rounded border font-mono ${page.toLowerCase() === roomState.targetPage?.toLowerCase()
                                    ? 'bg-green-900/40 border-green-500/50 text-green-400 font-bold'
                                    : index === 0
                                      ? 'bg-blue-900/20 border-blue-700/40 text-blue-300'
                                      : 'bg-slate-900 border-slate-700/50 text-slate-400'
                                  }`}>
                                  {page.replace(/_/g, ' ')}
                                </span>
                                {index < player.path.length - 1 && (
                                  <span className="text-slate-600 text-xs">→</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ===== LEAVE LOBBY BUTTON ===== */}
            <div className="flex justify-center">
              <button
                onClick={handleLeaveRoom}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 transition-all px-8 py-3.5 rounded-full font-bold text-white shadow-lg"
              >
                <LogOut size={18} /> Leave Lobby
              </button>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
