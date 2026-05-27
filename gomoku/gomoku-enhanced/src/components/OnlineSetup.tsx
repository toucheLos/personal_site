import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  onCreated: (roomCode: string) => void;
  onJoined: (roomCode: string) => void;
  onBack: () => void;
}

export default function OnlineSetup({ onCreated, onJoined, onBack }: Props) {
  const [joinCode, setJoinCode] = useState('');

  // Auto-fill from ?join= URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) setJoinCode(code.toUpperCase());
  }, []);

  const handleCreate = () => {
    const code = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    onCreated(code);
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    onJoined(code);
  };

  return (
    <div className="min-h-screen bg-[#111] text-stone-200 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8 border border-stone-800 rounded-xl bg-[#0e0e0e] max-w-sm w-full mx-4">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-[#111] border-2 border-stone-600" />
          <div className="w-3.5 h-3.5 rounded-full bg-stone-100 border border-stone-400" />
          <span className="text-stone-300 font-medium tracking-wide text-sm ml-1">Gomoku</span>
        </div>

        <div className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-stone-400 text-xs uppercase tracking-wider">Start a new game</p>
            <button
              onClick={handleCreate}
              className="w-full py-3 rounded border border-amber-700/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/30 transition-colors font-medium"
            >
              Create a game
            </button>
          </div>

          <div className="flex items-center gap-3">
            <hr className="flex-1 border-stone-800" />
            <span className="text-stone-600 text-xs">or</span>
            <hr className="flex-1 border-stone-800" />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-stone-400 text-xs uppercase tracking-wider">Join a friend's game</p>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="Enter room code"
              maxLength={12}
              className="w-full bg-[#111] border border-stone-700 rounded px-3 py-2 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 text-center font-mono tracking-widest"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.trim().length < 4}
              className="w-full py-2.5 rounded border border-stone-700 text-stone-300 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Connect
            </button>
          </div>
        </div>

        <button
          onClick={onBack}
          className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
