# Gomoku Enhanced

A local Gomoku app with autosave, chess-style move navigator, and game history — built after recon of papergames.io.

## Setup

```bash
cd gomoku-enhanced
npm install
npm run dev        # http://localhost:5173
```

The recon script (Phase 1) requires Playwright in the root:

```bash
npm install        # in project root
npx ts-node --project tsconfig.json scripts/recon.ts
```

---

## Phase 1: Recon Findings

**Target:** https://papergames.io/en/gomoku

| Finding | Detail |
|---|---|
| Framework | Angular 19 (SSR, `ng-version="19.2.9"`) |
| Transport | Socket.IO — `wss://papergames.io/socket.io/?EIO=4&transport=websocket` |
| Board type | Not present on landing page; loads inside a game room after auth |
| API endpoints | `GET /api/tournament/open?type=Gomoku`, `POST /api/authentication/refresh` |
| Move encoding | Unknown — game room not accessible without credentials |
| localStorage | Ad-tech / analytics keys only; no game state on lobby page |

**Phase 3 (sync bridge) status: skipped.** The game board only renders inside an authenticated game room. The Socket.IO handshake is readable, but game move events are inaccessible without logging in and entering a match. A sync bridge would require stored credentials and Playwright staying live inside the game room, which is outside the scope of a passive scraper.

---

## Phase 2 Architecture

```
gomoku-enhanced/
└── src/
    ├── types.ts          — GameState, Move, win detection, board utilities
    ├── storage.ts        — localStorage helpers (autosave + 50-game history)
    ├── App.tsx           — main game engine + layout
    └── components/
        ├── Board.tsx         — SVG 15×15 board with hover, stones, win highlight
        ├── MoveNavigator.tsx — chess-style nav (|◀ ◀ ▶ ▶|), scrubber, move list
        └── GameHistory.tsx   — collapsible history browser with replay/delete/export
```

### Game state shape

```ts
interface GameState {
  id: string;           // uuid generated at game start
  startedAt: string;    // ISO timestamp
  moves: Move[];        // { row, col, player, timestamp }[]
  winner: 'black' | 'white' | null;
  board: (0 | 1 | 2)[][];  // 0=empty, 1=black, 2=white
}
```

### Autosave

Every move calls `saveGame()` → `localStorage.gomoku_autosave`. On game-over the completed game is appended to `localStorage.gomoku_history` (capped at 50 entries) and the autosave key is cleared. On reload, the autosave is restored if present.

### Move navigator

- `|◀` `◀` `▶` `▶|` buttons + slider scrub through any game
- Clicking a row in the move list jumps directly to that position
- Board renders the historical snapshot — stones appear/disappear correctly
- **Fork game from move N** button creates a new game initialised from the viewed board state

### History browser

Right-panel tab lists all completed games with date, move count, winner. Per-entry: **Replay** (load into navigator) and **×** (delete). **Export JSON** downloads the full history array.

### Visual aesthetic

Dark board (`#242018` wood tone), stone gradients (radial highlight for depth), amber win highlights, minimal stone-800/900 UI — matches the papergames.io palette.
