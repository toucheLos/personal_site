import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Board from './components/Board';
import MoveNavigator from './components/MoveNavigator';
import GameHistory from './components/GameHistory';
import NameEntry from './components/NameEntry';
import ModeSelect from './components/ModeSelect';
import OnlineSetup from './components/OnlineSetup';
import WaitingRoom from './components/WaitingRoom';
import { usePeerGame } from './hooks/usePeerGame';
import { getBotMove } from './ai';
import type { GameState, Move, Player, Cell, AppMode, PeerRole } from './types';
import { emptyBoard, checkWinner, getWinLine } from './types';
import {
  saveGame, loadAutosave, clearAutosave, loadHistory, appendToHistory,
  loadDisplayName,
} from './storage';

function newGame(fromState?: GameState, fromMoveIndex?: number): GameState {
  if (fromState && fromMoveIndex !== undefined) {
    const moves = fromState.moves.slice(0, fromMoveIndex + 1);
    const board = emptyBoard();
    moves.forEach((m) => { board[m.row][m.col] = m.player === 'black' ? 1 : 2; });
    return { id: uuidv4(), startedAt: new Date().toISOString(), moves, winner: null, board };
  }
  return { id: uuidv4(), startedAt: new Date().toISOString(), moves: [], winner: null, board: emptyBoard() };
}

function boardAtMove(allMoves: Move[], upTo: number): { board: Cell[][], lastMove: [number, number] | null } {
  const board = emptyBoard();
  let lastMove: [number, number] | null = null;
  for (let i = 0; i <= upTo && i < allMoves.length; i++) {
    const m = allMoves[i];
    board[m.row][m.col] = m.player === 'black' ? 1 : 2;
    if (i === upTo) lastMove = [m.row, m.col];
  }
  return { board, lastMove };
}

type Tab = 'game' | 'history';

export default function App() {
  // ── Game state ─────────────────────────────────────────────────────
  const [game, setGame] = useState<GameState>(() => loadAutosave() ?? newGame());
  const [viewIndex, setViewIndex] = useState<number>(-1);
  const [history, setHistory] = useState<GameState[]>(() => loadHistory());
  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [replayGame, setReplayGame] = useState<GameState | null>(null);

  // ── Mode / multiplayer state ───────────────────────────────────────
  const [appMode, setAppMode] = useState<AppMode>(() =>
    loadDisplayName() ? 'select' : 'name-entry',
  );
  const [displayName, setDisplayName] = useState<string>(() => loadDisplayName());
  const [peerRole, setPeerRole] = useState<PeerRole | null>(null);
  const [peerRoomCode, setPeerRoomCode] = useState<string | null>(null);
  const [rematchState, setRematchState] = useState<'idle' | 'i-requested' | 'peer-requested'>('idle');

  // ── Derived ───────────────────────────────────────────────────────
  const displayGame = replayGame ?? game;
  const isViewingReplay = replayGame !== null;
  const isViewingHistory = viewIndex !== -1;
  const currentPlayer: Player = displayGame.moves.length % 2 === 0 ? 'black' : 'white';

  const viewedBoard = (() => {
    if (viewIndex === -1) {
      const lm = displayGame.moves.length > 0
        ? [displayGame.moves.at(-1)!.row, displayGame.moves.at(-1)!.col] as [number, number]
        : null;
      return { board: displayGame.board, lastMove: lm };
    }
    return boardAtMove(displayGame.moves, viewIndex);
  })();

  const winLine = (() => {
    const lastMoveEntry = viewIndex === -1 ? displayGame.moves.at(-1) : displayGame.moves[viewIndex];
    if (!lastMoveEntry || !displayGame.winner) return null;
    const playerCell: Cell = lastMoveEntry.player === 'black' ? 1 : 2;
    return getWinLine(viewedBoard.board, lastMoveEntry.row, lastMoveEntry.col, playerCell);
  })();

  // ── P2P hook ──────────────────────────────────────────────────────
  const {
    myColor: myPeerColor,
    peerName,
    isConnected,
    isMyTurn: isPeerMyTurn,
    peerMove,
    peerWantsRematch,
    peerAcceptedRematch,
    sendMove,
    sendRematchRequest,
    sendRematchAccept,
    clearPeerMove,
    clearPeerAcceptedRematch,
    error: peerError,
  } = usePeerGame(peerRole, displayName, peerRoomCode, currentPlayer);

  // ── Callbacks ─────────────────────────────────────────────────────
  const refreshHistory = useCallback(() => setHistory(loadHistory()), []);

  const handlePlace = useCallback((row: number, col: number) => {
    if (game.winner || viewIndex !== -1 || replayGame) return;
    setGame((prev) => {
      const player: Player = prev.moves.length % 2 === 0 ? 'black' : 'white';
      const cell: Cell = player === 'black' ? 1 : 2;
      if (prev.board[row][col] !== 0) return prev;
      const newBoard = prev.board.map((r) => [...r]) as Cell[][];
      newBoard[row][col] = cell;
      const won = checkWinner(newBoard, row, col, cell);
      const move: Move = { row, col, player, timestamp: new Date().toISOString() };
      const next: GameState = {
        ...prev,
        moves: [...prev.moves, move],
        winner: won ? player : null,
        board: newBoard,
      };
      saveGame(next);
      if (won) {
        appendToHistory(next);
        clearAutosave();
        setHistory(loadHistory());
      }
      return next;
    });
  }, [game.winner, viewIndex, replayGame]);

  const startNewGame = useCallback(() => {
    const g = newGame();
    setGame(g);
    setViewIndex(-1);
    setReplayGame(null);
    saveGame(g);
  }, []);

  const handleReplay = useCallback((g: GameState) => {
    setReplayGame(g);
    setViewIndex(g.moves.length > 0 ? g.moves.length - 1 : -1);
    setHistoryOpen(false);
    setActiveTab('game');
  }, []);

  const handleResumeFromHere = useCallback(() => {
    if (!replayGame || viewIndex === -1) return;
    const forked = newGame(replayGame, viewIndex);
    setGame(forked);
    setReplayGame(null);
    setViewIndex(-1);
    saveGame(forked);
  }, [replayGame, viewIndex]);

  const navFirst = () => setViewIndex(displayGame.moves.length > 0 ? 0 : -1);
  const navPrev = () => setViewIndex((v) => {
    if (v === -1) return displayGame.moves.length - 1;
    return Math.max(0, v - 1);
  });
  const navNext = () => setViewIndex((v) => {
    if (v === -1 || v >= displayGame.moves.length - 1) return -1;
    return v + 1;
  });
  const navLast = () => setViewIndex(-1);
  const navJump = (i: number) => setViewIndex(Math.max(0, Math.min(i, displayGame.moves.length - 1)));

  // ── Effects ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!replayGame) saveGame(game);
  }, [game, replayGame]);

  // Bot plays white in local-vs-bot mode
  useEffect(() => {
    if (appMode !== 'local-vs-bot') return;
    if (game.winner || viewIndex !== -1 || replayGame) return;
    if (currentPlayer !== 'white') return;
    const t = setTimeout(() => {
      const move = getBotMove(game.board, 2);
      if (move) handlePlace(move[0], move[1]);
    }, 400);
    return () => clearTimeout(t);
  }, [appMode, game, currentPlayer, viewIndex, replayGame, handlePlace]);

  // Apply incoming peer move
  useEffect(() => {
    if (appMode !== 'online-game' || !peerMove) return;
    handlePlace(peerMove.row, peerMove.col);
    clearPeerMove();
  }, [appMode, peerMove, handlePlace, clearPeerMove]);

  // Peer wants rematch
  useEffect(() => {
    if (peerWantsRematch) setRematchState('peer-requested');
  }, [peerWantsRematch]);

  // Peer accepted my rematch request
  useEffect(() => {
    if (!peerAcceptedRematch || rematchState !== 'i-requested') return;
    setRematchState('idle');
    clearPeerAcceptedRematch();
    startNewGame();
  }, [peerAcceptedRematch, rematchState, clearPeerAcceptedRematch, startNewGame]);

  // Transition waiting → online-game once connected
  useEffect(() => {
    if (appMode === 'online-waiting' && isConnected) {
      startNewGame();
      setAppMode('online-game');
    }
  }, [isConnected, appMode, startNewGame]);

  // ── Board interaction ─────────────────────────────────────────────
  const handleBoardClick = useCallback((row: number, col: number) => {
    if (appMode === 'online-game') {
      if (!isPeerMyTurn || game.winner) return;
      sendMove(row, col);
    }
    handlePlace(row, col);
  }, [appMode, isPeerMyTurn, game.winner, sendMove, handlePlace]);

  const boardViewOnly =
    !!game.winner ||
    isViewingHistory ||
    isViewingReplay ||
    (appMode === 'online-game' && !isPeerMyTurn) ||
    (appMode === 'local-vs-bot' && currentPlayer === 'white');

  // ── Mode-specific full-screen views ───────────────────────────────
  if (appMode === 'name-entry') {
    return (
      <NameEntry
        onDone={(name) => { setDisplayName(name); setAppMode('select'); }}
      />
    );
  }
  if (appMode === 'select') {
    return (
      <ModeSelect
        playerName={displayName}
        onSelectBot={() => { startNewGame(); setAppMode('local-vs-bot'); }}
        onSelectFriend={() => setAppMode('online-setup')}
        onChangeName={() => setAppMode('name-entry')}
      />
    );
  }
  if (appMode === 'online-setup') {
    return (
      <OnlineSetup
        onCreated={(code) => {
          setPeerRoomCode(code);
          setPeerRole('host');
          setAppMode('online-waiting');
        }}
        onJoined={(code) => {
          setPeerRoomCode(code);
          setPeerRole('guest');
          setAppMode('online-waiting');
        }}
        onBack={() => setAppMode('select')}
      />
    );
  }
  if (appMode === 'online-waiting') {
    return (
      <WaitingRoom
        role={peerRole!}
        roomCode={peerRoomCode!}
        isConnected={isConnected}
        error={peerError}
        onBack={() => {
          setPeerRole(null);
          setPeerRoomCode(null);
          setAppMode('select');
        }}
      />
    );
  }

  // ── Display names ─────────────────────────────────────────────────
  const myName = displayName || 'You';
  const opponentName = appMode === 'online-game' ? (peerName ?? 'Opponent') : 'Bot';
  const blackName = appMode === 'online-game'
    ? (myPeerColor === 'black' ? myName : opponentName)
    : myName;
  const whiteName = appMode === 'online-game'
    ? (myPeerColor === 'white' ? myName : opponentName)
    : opponentName;
  const winnerName = game.winner === 'black' ? blackName : whiteName;

  // ── Navigation ────────────────────────────────────────────────────
  const goToMenu = () => {
    if (appMode === 'online-game') {
      if (!confirm('Leave the current game?')) return;
      setPeerRole(null);
      setPeerRoomCode(null);
      setRematchState('idle');
    }
    startNewGame();
    setAppMode('select');
  };

  // ── Rematch button ────────────────────────────────────────────────
  const rematchButton = (() => {
    if (!game.winner || isViewingReplay) return null;
    if (appMode === 'local-vs-bot') {
      return (
        <button
          onClick={startNewGame}
          className="ml-2 text-xs py-1 px-3 rounded border border-amber-700/50 text-amber-500 hover:bg-amber-900/20 transition-colors"
        >
          Rematch
        </button>
      );
    }
    if (appMode === 'online-game') {
      if (rematchState === 'idle') {
        return (
          <button
            onClick={() => { setRematchState('i-requested'); sendRematchRequest(myName); }}
            className="ml-2 text-xs py-1 px-3 rounded border border-amber-700/50 text-amber-500 hover:bg-amber-900/20 transition-colors"
          >
            Rematch
          </button>
        );
      }
      if (rematchState === 'i-requested') {
        return (
          <span className="ml-2 text-xs text-stone-500 italic">
            Waiting for {opponentName}...
          </span>
        );
      }
      if (rematchState === 'peer-requested') {
        return (
          <button
            onClick={() => {
              sendRematchAccept();
              setRematchState('idle');
              startNewGame();
            }}
            className="ml-2 text-xs py-1 px-3 rounded border border-amber-600 bg-amber-900/40 text-amber-400 animate-pulse hover:animate-none hover:bg-amber-900/60 transition-colors"
          >
            {opponentName} wants a rematch — Accept!
          </button>
        );
      }
    }
    return null;
  })();

  // ── Main game UI ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#111] text-stone-200 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-stone-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#111] border-2 border-stone-600" />
            <div className="w-3.5 h-3.5 rounded-full bg-stone-100 border border-stone-400" />
          </div>
          <span className="text-stone-300 font-medium tracking-wide text-sm">Gomoku</span>
          {isViewingReplay && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-500 border border-amber-800/40">
              Replay
            </span>
          )}
          {isViewingHistory && !isViewingReplay && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-500 border border-stone-700">
              Move {viewIndex + 1} of {displayGame.moves.length}
            </span>
          )}
          {appMode === 'online-game' && !isViewingReplay && (
            <span className="text-xs text-stone-500">
              {blackName} vs {whiteName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isViewingReplay && (
            <button
              onClick={() => { setReplayGame(null); setViewIndex(-1); }}
              className="text-xs py-1 px-3 rounded border border-stone-700 text-stone-400 hover:text-stone-200 hover:border-stone-500 transition-colors"
            >
              Exit replay
            </button>
          )}
          <button
            onClick={goToMenu}
            className="text-xs py-1 px-3 rounded border border-stone-700 text-stone-300 hover:bg-stone-800 transition-colors"
          >
            Menu
          </button>
          <button
            onClick={() => { setHistoryOpen((o) => !o); setActiveTab('history'); }}
            className={`text-xs py-1 px-3 rounded border transition-colors ${
              historyOpen
                ? 'border-amber-700/50 text-amber-500 bg-amber-900/20'
                : 'border-stone-700 text-stone-400 hover:text-stone-200'
            }`}
          >
            History {history.length > 0 && `(${history.length})`}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <main className="flex-1 flex flex-col items-center justify-center gap-4 p-4 overflow-auto">
          {/* Status bar */}
          <div className="flex items-center gap-3 h-8 flex-wrap">
            {game.winner && !isViewingReplay ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-700/40 bg-amber-900/20 text-sm flex-wrap">
                <StoneIndicator player={game.winner} />
                <span className="font-medium text-amber-400">{winnerName} wins!</span>
                {rematchButton}
                <button
                  onClick={goToMenu}
                  className="ml-1 text-xs text-stone-400 hover:text-stone-200 underline underline-offset-2"
                >
                  Menu
                </button>
              </div>
            ) : isViewingReplay && replayGame?.winner ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-stone-700 text-xs text-stone-400">
                <StoneIndicator player={replayGame.winner} />
                <span className="capitalize">{replayGame.winner} won · {replayGame.moves.length} moves</span>
              </div>
            ) : !isViewingReplay ? (
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <StoneIndicator player={currentPlayer} />
                {appMode === 'local-vs-bot' && currentPlayer === 'white' ? (
                  <span>{opponentName} thinking...</span>
                ) : (
                  <span>
                    {currentPlayer === 'black' ? blackName : whiteName}&apos;s turn
                    {appMode === 'online-game' && isPeerMyTurn && (
                      <span className="text-amber-600/80 ml-1">(you)</span>
                    )}
                  </span>
                )}
                {game.moves.length > 0 && (
                  <span className="text-stone-600">· move {game.moves.length + 1}</span>
                )}
              </div>
            ) : null}
          </div>

          <Board
            board={viewedBoard.board}
            currentPlayer={currentPlayer}
            winLine={winLine}
            lastMove={viewedBoard.lastMove}
            viewOnly={boardViewOnly}
            onPlace={handleBoardClick}
          />
        </main>

        {/* Right panel */}
        <aside className="w-64 flex-shrink-0 flex flex-col border-l border-stone-800 bg-[#0e0e0e]">
          <div className="flex border-b border-stone-800">
            <TabBtn active={activeTab === 'game'} onClick={() => setActiveTab('game')}>Navigator</TabBtn>
            <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
              History{history.length > 0 ? ` (${history.length})` : ''}
            </TabBtn>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'game' ? (
              <MoveNavigator
                moves={displayGame.moves}
                viewIndex={viewIndex}
                totalMoves={displayGame.moves.length}
                onFirst={navFirst}
                onPrev={navPrev}
                onNext={navNext}
                onLast={navLast}
                onJump={navJump}
                onResumeFromHere={handleResumeFromHere}
                isViewingHistory={isViewingReplay && viewIndex !== -1}
              />
            ) : (
              <GameHistory
                history={history}
                onReplay={handleReplay}
                onHistoryChange={refreshHistory}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="px-5 py-1.5 border-t border-stone-900 flex items-center justify-between text-xs text-stone-700">
        <span>15×15 · Five in a row wins</span>
        {!isViewingReplay && <span>Move {game.moves.length}</span>}
      </footer>
    </div>
  );
}

function StoneIndicator({ player }: { player: Player }) {
  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-full border flex-shrink-0"
      style={{
        background: player === 'black' ? '#1a1a1a' : '#ece8e0',
        borderColor: player === 'black' ? '#555' : '#bbb',
        boxShadow: player === 'black'
          ? 'inset -1px -1px 3px rgba(255,255,255,0.1)'
          : 'inset -1px -1px 3px rgba(0,0,0,0.15)',
      }}
    />
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-xs transition-colors ${
        active
          ? 'text-stone-200 border-b-2 border-amber-600 bg-stone-900/30'
          : 'text-stone-500 hover:text-stone-300 border-b-2 border-transparent'
      }`}
    >
      {children}
    </button>
  );
}
