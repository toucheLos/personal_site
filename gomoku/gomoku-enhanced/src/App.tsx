import { useState, useCallback, useEffect, useRef } from 'react';
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

const TURN_SECONDS = 300; // 5 minutes

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

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

type Tab = 'game' | 'history' | 'chat';

export default function App() {
  // ── Game state ─────────────────────────────────────────────────────
  const [game, setGame] = useState<GameState>(() => loadAutosave() ?? newGame());
  const [viewIndex, setViewIndex] = useState<number>(-1);
  const [history, setHistory] = useState<GameState[]>(() => loadHistory());
  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [replayGame, setReplayGame] = useState<GameState | null>(null);

  // ── Mode / multiplayer state ───────────────────────────────────────
  const [appMode, setAppMode] = useState<AppMode>(() => {
    if (!loadDisplayName()) return 'name-entry';
    return new URLSearchParams(window.location.search).get('join') ? 'online-setup' : 'select';
  });
  const [displayName, setDisplayName] = useState<string>(() => loadDisplayName());
  const [peerRole, setPeerRole] = useState<PeerRole | null>(null);
  const [peerRoomCode, setPeerRoomCode] = useState<string | null>(null);
  const [rematchState, setRematchState] = useState<'idle' | 'i-requested' | 'peer-requested'>('idle');

  // ── Timer state ────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);

  // ── Resign confirm ─────────────────────────────────────────────────
  const [confirmResign, setConfirmResign] = useState(false);

  // ── Chat UI state ──────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const prevChatLenRef = useRef(0);
  const activeTabRef = useRef<Tab>('game');

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
    peerResigned,
    chatMessages,
    sendMove,
    sendRematchRequest,
    sendRematchAccept,
    sendResign,
    sendChat,
    clearPeerMove,
    clearPeerAcceptedRematch,
    clearPeerResigned,
    reconnect: peerReconnect,
    error: peerError,
  } = usePeerGame(peerRole, displayName, peerRoomCode, currentPlayer);

  // ── Callbacks ─────────────────────────────────────────────────────
  const refreshHistory = useCallback(() => setHistory(loadHistory()), []);

  const handleGameOver = useCallback((winner: Player) => {
    setGame(prev => {
      if (prev.winner) return prev;
      const next = { ...prev, winner };
      appendToHistory(next);
      clearAutosave();
      setHistory(loadHistory());
      return next;
    });
  }, []);

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

  // ── Timer derived ─────────────────────────────────────────────────
  const timerRunning =
    !game.winner &&
    viewIndex === -1 &&
    !replayGame &&
    (appMode === 'local-vs-bot' || (appMode === 'online-game' && isConnected)) &&
    !(appMode === 'local-vs-bot' && currentPlayer === 'white') &&
    !(appMode === 'online-game' && !isPeerMyTurn);

  // ── Effects ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!replayGame) saveGame(game);
  }, [game, replayGame]);

  // Reset timer on new game or new move
  useEffect(() => {
    setTimeLeft(TURN_SECONDS);
    setConfirmResign(false);
  }, [game.id, game.moves.length]);

  // Timer countdown
  useEffect(() => {
    if (!timerRunning || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [timerRunning, timeLeft]);

  // Timer expiry → forfeit
  useEffect(() => {
    if (timeLeft > 0 || !timerRunning || game.winner) return;
    if (appMode === 'local-vs-bot') {
      handleGameOver('white');
    } else if (appMode === 'online-game') {
      sendResign();
      const opponent: Player = (myPeerColor ?? 'black') === 'black' ? 'white' : 'black';
      handleGameOver(opponent);
    }
  }, [timeLeft, timerRunning, game.winner, appMode, myPeerColor, handleGameOver, sendResign]);

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

  // Peer resigned → I win
  useEffect(() => {
    if (!peerResigned || appMode !== 'online-game') return;
    clearPeerResigned();
    if (myPeerColor) handleGameOver(myPeerColor);
  }, [peerResigned, appMode, myPeerColor, clearPeerResigned, handleGameOver]);

  // Transition waiting → online-game once connected
  useEffect(() => {
    if (appMode === 'online-waiting' && isConnected) {
      startNewGame();
      setAppMode('online-game');
    }
  }, [isConnected, appMode, startNewGame]);

  // Track active tab in ref for chat unread logic
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Chat unread badge
  useEffect(() => {
    if (chatMessages.length <= prevChatLenRef.current) return;
    const newMsgs = chatMessages.slice(prevChatLenRef.current);
    prevChatLenRef.current = chatMessages.length;
    if (activeTabRef.current !== 'chat' && newMsgs.some(m => !m.isMe)) {
      setUnreadChat(n => n + newMsgs.filter(m => !m.isMe).length);
    }
  }, [chatMessages]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

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
        onDone={(name) => {
          setDisplayName(name);
          const dest = new URLSearchParams(window.location.search).get('join') ? 'online-setup' : 'select';
          setAppMode(dest);
        }}
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
    setConfirmResign(false);
    setUnreadChat(0);
    if (activeTab === 'chat') setActiveTab('game');
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
      <header className="flex items-center justify-between px-3 md:px-5 py-2 md:py-3 border-b border-stone-800/80 gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-[#111] border-2 border-stone-600 flex-shrink-0" />
            <div className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-stone-100 border border-stone-400 flex-shrink-0" />
          </div>
          <span className="text-stone-300 font-medium tracking-wide text-sm flex-shrink-0">Gomoku</span>
          {isViewingReplay && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-500 border border-amber-800/40 flex-shrink-0">
              Replay
            </span>
          )}
          {isViewingHistory && !isViewingReplay && (
            <span className="hidden sm:inline text-xs px-1.5 py-0.5 rounded-full bg-stone-800 text-stone-500 border border-stone-700">
              Move {viewIndex + 1}/{displayGame.moves.length}
            </span>
          )}
          {appMode === 'online-game' && !isViewingReplay && (
            <span className="hidden md:inline text-xs text-stone-500 truncate">
              {blackName} vs {whiteName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
          {isViewingReplay && (
            <button
              onClick={() => { setReplayGame(null); setViewIndex(-1); }}
              className="text-xs py-1 px-2 md:px-3 rounded border border-stone-700 text-stone-400 hover:text-stone-200 hover:border-stone-500 transition-colors"
            >
              Exit replay
            </button>
          )}
          <button
            onClick={goToMenu}
            className="text-xs py-1 px-2 md:px-3 rounded border border-stone-700 text-stone-300 hover:bg-stone-800 transition-colors"
          >
            Menu
          </button>
          <button
            onClick={() => { setHistoryOpen((o) => !o); setActiveTab('history'); }}
            className={`text-xs py-1 px-2 md:px-3 rounded border transition-colors ${
              historyOpen
                ? 'border-amber-700/50 text-amber-500 bg-amber-900/20'
                : 'border-stone-700 text-stone-400 hover:text-stone-200'
            }`}
          >
            History{history.length > 0 ? ` (${history.length})` : ''}
          </button>
        </div>
      </header>

      {/* Main layout — stacked on mobile, side-by-side on md+ */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row" style={{ minHeight: 0 }}>

        {/* Board area */}
        <main className="flex-1 flex flex-col items-center justify-center gap-2 md:gap-4 p-2 md:p-4 overflow-auto min-h-0">

          {/* Connection lost banner */}
          {appMode === 'online-game' && !isConnected && !game.winner && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-red-900/40 bg-red-950/30 text-xs">
              <span className="text-red-400">Connection lost</span>
              <button
                onClick={peerReconnect}
                className="text-amber-400 underline underline-offset-2 hover:no-underline"
              >
                Reconnect
              </button>
            </div>
          )}

          {/* Status bar */}
          <div className="flex items-center gap-2 flex-wrap justify-center min-h-[28px]">
            {game.winner && !isViewingReplay ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-700/40 bg-amber-900/20 text-sm flex-wrap justify-center">
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
              <div className="flex items-center gap-2 text-xs text-stone-400 flex-wrap justify-center">
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
                {timerRunning && (
                  <span className={`font-mono ml-1 tabular-nums ${
                    timeLeft < 10 ? 'text-red-400 animate-pulse' :
                    timeLeft < 30 ? 'text-red-500' :
                    timeLeft < 60 ? 'text-amber-500' :
                    'text-stone-600'
                  }`}>
                    {formatTime(timeLeft)}
                  </span>
                )}
                {game.moves.length > 0 && (
                  <span className="text-stone-600">· move {game.moves.length + 1}</span>
                )}
                {/* Resign button (online mode) */}
                {appMode === 'online-game' && !game.winner && !isViewingReplay && (
                  confirmResign ? (
                    <span className="flex items-center gap-1 ml-1">
                      <span className="text-stone-500">Resign?</span>
                      <button
                        onClick={() => {
                          setConfirmResign(false);
                          sendResign();
                          const opponent: Player = (myPeerColor ?? 'black') === 'black' ? 'white' : 'black';
                          handleGameOver(opponent);
                        }}
                        className="py-0.5 px-1.5 rounded bg-red-900/50 text-red-300 border border-red-800/50 hover:bg-red-900/70 transition-colors"
                      >Yes</button>
                      <button
                        onClick={() => setConfirmResign(false)}
                        className="py-0.5 px-1.5 rounded border border-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
                      >No</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmResign(true)}
                      className="ml-1 text-xs py-0.5 px-2 rounded border border-red-900/40 text-red-600/70 hover:text-red-400 hover:border-red-800 transition-colors"
                    >
                      Resign
                    </button>
                  )
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

        {/* Right panel — bottom strip on mobile, sidebar on desktop */}
        <aside className="w-full md:w-60 flex-shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-stone-800 bg-[#0e0e0e] h-48 md:h-auto">
          <div className="flex border-b border-stone-800">
            <TabBtn active={activeTab === 'game'} onClick={() => setActiveTab('game')}>
              <span className="hidden md:inline">Navigator</span>
              <span className="md:hidden">Nav</span>
            </TabBtn>
            <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
              <span className="hidden md:inline">History{history.length > 0 ? ` (${history.length})` : ''}</span>
              <span className="md:hidden">History</span>
            </TabBtn>
            {appMode === 'online-game' && (
              <TabBtn
                active={activeTab === 'chat'}
                onClick={() => { setActiveTab('chat'); setUnreadChat(0); }}
              >
                Chat{unreadChat > 0 ? ` (${unreadChat})` : ''}
              </TabBtn>
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeTab === 'game' && (
              <div className="p-2 md:p-3">
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
              </div>
            )}
            {activeTab === 'history' && (
              <div className="p-2 md:p-3">
                <GameHistory
                  history={history}
                  onReplay={handleReplay}
                  onHistoryChange={refreshHistory}
                />
              </div>
            )}
            {activeTab === 'chat' && appMode === 'online-game' && (
              <div className="flex flex-col h-full">
                <div
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0"
                >
                  {chatMessages.length === 0 ? (
                    <p className="text-xs text-stone-600 text-center mt-3">No messages yet</p>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-xs text-stone-600 mb-0.5">{msg.sender}</span>
                        <div className={`px-2 py-1 rounded text-xs max-w-[85%] break-words ${
                          msg.isMe
                            ? 'bg-amber-900/40 text-amber-200 border border-amber-800/40'
                            : 'bg-stone-800 text-stone-300 border border-stone-700'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-1 p-2 border-t border-stone-800 flex-shrink-0">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && chatInput.trim()) {
                        sendChat(chatInput.trim());
                        setChatInput('');
                      }
                    }}
                    placeholder="Message..."
                    maxLength={200}
                    className="flex-1 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-stone-500 min-w-0"
                  />
                  <button
                    onClick={() => {
                      if (chatInput.trim()) { sendChat(chatInput.trim()); setChatInput(''); }
                    }}
                    className="px-2 py-1 rounded border border-stone-700 text-stone-400 hover:text-stone-200 text-xs flex-shrink-0 transition-colors"
                  >
                    ↑
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="px-3 md:px-5 py-1.5 border-t border-stone-900 flex items-center justify-between text-xs text-stone-700">
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
      className={`flex-1 py-2 text-xs transition-colors ${
        active
          ? 'text-stone-200 border-b-2 border-amber-600 bg-stone-900/30'
          : 'text-stone-500 hover:text-stone-300 border-b-2 border-transparent'
      }`}
    >
      {children}
    </button>
  );
}
