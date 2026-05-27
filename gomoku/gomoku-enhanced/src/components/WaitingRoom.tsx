import { useState, useEffect, useCallback } from 'react';
import Board from './Board';
import type { Cell, Player, PeerRole } from '../types';
import { emptyBoard, checkWinner, getWinLine } from '../types';
import { getBotMove } from '../ai';

interface Props {
  role: PeerRole;
  roomCode: string;
  isConnected: boolean;
  error: string | null;
  onBack: () => void;
}

function newBotBoard() {
  return { board: emptyBoard(), moves: [] as { row: number; col: number; player: Player }[], winner: null as Player | null };
}

export default function WaitingRoom({ role, roomCode, isConnected, error, onBack }: Props) {
  const [showBotGame, setShowBotGame] = useState(false);
  const [botState, setBotState] = useState(newBotBoard);
  const [copied, setCopied] = useState(false);

  const currentPlayer: Player = botState.moves.length % 2 === 0 ? 'black' : 'white';

  const winLine = (() => {
    const last = botState.moves.at(-1);
    if (!last || !botState.winner) return null;
    const cell: Cell = last.player === 'black' ? 1 : 2;
    return getWinLine(botState.board, last.row, last.col, cell);
  })();

  // Bot plays white
  useEffect(() => {
    if (!showBotGame || botState.winner || currentPlayer !== 'white') return;
    const t = setTimeout(() => {
      const move = getBotMove(botState.board, 2);
      if (!move) return;
      const [row, col] = move;
      const newBoard = botState.board.map((r) => [...r]) as Cell[][];
      newBoard[row][col] = 2;
      const won = checkWinner(newBoard, row, col, 2);
      setBotState((prev) => ({
        board: newBoard,
        moves: [...prev.moves, { row, col, player: 'white' }],
        winner: won ? 'white' : null,
      }));
    }, 400);
    return () => clearTimeout(t);
  }, [showBotGame, botState, currentPlayer]);

  const handlePlace = useCallback(
    (row: number, col: number) => {
      if (botState.winner || botState.board[row][col] !== 0 || currentPlayer !== 'black') return;
      const newBoard = botState.board.map((r) => [...r]) as Cell[][];
      newBoard[row][col] = 1;
      const won = checkWinner(newBoard, row, col, 1);
      setBotState((prev) => ({
        board: newBoard,
        moves: [...prev.moves, { row, col, player: 'black' }],
        winner: won ? 'black' : null,
      }));
    },
    [botState, currentPlayer],
  );

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?join=${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: show the URL
    }
  };

  if (role === 'guest' && !isConnected && !error) {
    return (
      <div className="min-h-screen bg-[#111] text-stone-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-8 border border-stone-800 rounded-xl bg-[#0e0e0e] max-w-sm w-full mx-4">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#111] border-2 border-stone-600" />
            <div className="w-3.5 h-3.5 rounded-full bg-stone-100 border border-stone-400" />
            <span className="text-stone-300 font-medium tracking-wide text-sm ml-1">Gomoku</span>
          </div>
          <p className="text-stone-400 text-sm">Connecting to game...</p>
          <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          <button onClick={onBack} className="text-xs text-stone-600 hover:text-stone-400 transition-colors mt-2">
            ← Cancel
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#111] text-stone-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-8 border border-stone-800 rounded-xl bg-[#0e0e0e] max-w-sm w-full mx-4">
          <p className="text-stone-400 text-sm">Connection error</p>
          <p className="text-red-400 text-xs text-center">{error}</p>
          <button
            onClick={onBack}
            className="py-2 px-4 rounded border border-stone-700 text-stone-300 hover:bg-stone-800 transition-colors text-sm"
          >
            ← Back to menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-stone-200 flex flex-col items-center justify-center gap-6 p-4">
      {/* Waiting card */}
      {!showBotGame && (
        <div className="flex flex-col items-center gap-5 p-8 border border-stone-800 rounded-xl bg-[#0e0e0e] max-w-sm w-full">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#111] border-2 border-stone-600" />
            <div className="w-3.5 h-3.5 rounded-full bg-stone-100 border border-stone-400" />
            <span className="text-stone-300 font-medium tracking-wide text-sm ml-1">Gomoku</span>
          </div>
          <p className="text-stone-400 text-sm">Waiting for opponent...</p>
          <div className="flex flex-col items-center gap-1">
            <p className="text-stone-600 text-xs uppercase tracking-wider">Room code</p>
            <p className="font-mono text-2xl text-stone-100 tracking-widest">{roomCode}</p>
          </div>
          <button
            onClick={copyLink}
            className="w-full py-2 rounded border border-stone-700 text-stone-400 hover:text-stone-200 hover:border-stone-500 transition-colors text-sm"
          >
            {copied ? '✓ Link copied!' : 'Copy invite link'}
          </button>
          <button
            onClick={() => setShowBotGame(true)}
            className="w-full py-2.5 rounded border border-amber-700/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/30 transition-colors text-sm font-medium"
          >
            Play vs Bot while you wait
          </button>
          <button onClick={onBack} className="text-xs text-stone-600 hover:text-stone-400 transition-colors">
            ← Cancel
          </button>
        </div>
      )}

      {/* Bot sub-game */}
      {showBotGame && (
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="flex items-center justify-between w-full max-w-2xl px-2">
            <div className="flex items-center gap-3">
              <span className="text-stone-400 text-xs">Practice game — not saved</span>
              {botState.winner ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-500 border border-amber-800/40 capitalize">
                  {botState.winner} wins
                </span>
              ) : (
                <span className="text-xs text-stone-500 capitalize">{currentPlayer}&apos;s turn</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-stone-600 text-xs font-mono">
                Room: {roomCode}
              </span>
              {botState.winner && (
                <button
                  onClick={() => setBotState(newBotBoard())}
                  className="text-xs py-1 px-2 rounded border border-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
                >
                  New practice game
                </button>
              )}
              <button
                onClick={() => { setShowBotGame(false); setBotState(newBotBoard()); }}
                className="text-xs py-1 px-2 rounded border border-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
              >
                Hide board
              </button>
            </div>
          </div>
          <Board
            board={botState.board}
            currentPlayer={currentPlayer}
            winLine={winLine}
            lastMove={botState.moves.length > 0 ? [botState.moves.at(-1)!.row, botState.moves.at(-1)!.col] : null}
            viewOnly={!!botState.winner || currentPlayer === 'white'}
            onPlace={handlePlace}
          />
        </div>
      )}
    </div>
  );
}
