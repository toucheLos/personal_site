# Personal Site — CLAUDE.md

## Project structure

```
personal_site/
├── index.html                  # Portfolio homepage (vanilla HTML/CSS/JS, single file)
└── gomoku/
    └── gomoku-enhanced/        # Gomoku game (React 19 + TypeScript + Vite + Tailwind CSS 4)
        ├── src/
        │   ├── App.tsx         # Root component; owns all mode + game state
        │   ├── ai.ts           # Heuristic bot (no minimax; threat-scoring)
        │   ├── types.ts        # All shared types + board utilities + win detection
        │   ├── storage.ts      # localStorage helpers (game, history, display name)
        │   ├── components/
        │   │   ├── Board.tsx         # SVG board renderer + click handling
        │   │   ├── NameEntry.tsx     # First-visit name input
        │   │   ├── ModeSelect.tsx    # "Play vs Bot" / "Play vs Friend" screen
        │   │   ├── OnlineSetup.tsx   # Create or join a P2P room
        │   │   ├── WaitingRoom.tsx   # Room code display + practice bot sub-game
        │   │   ├── MoveNavigator.tsx # Move history controls (chess-style)
        │   │   └── GameHistory.tsx   # Past completed games browser
        │   └── hooks/
        │       └── usePeerGame.ts    # PeerJS WebRTC hook for P2P multiplayer
        ├── package.json
        └── vite.config.ts
```

## Development

```bash
cd gomoku/gomoku-enhanced
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # TypeScript compile + Vite build → dist/
npm run preview  # Preview built app locally
```

The portfolio homepage (`index.html`) is static — open directly in a browser or serve with any HTTP server. No build step needed.

## App mode state machine

`App.tsx` owns `appMode: AppMode` which drives which screen renders:

```
name-entry → select → local-vs-bot
                    → online-setup → online-waiting → online-game
```

- `name-entry`: shown on first visit; skipped if `gomoku_display_name` is in localStorage
- `select`: mode select screen
- `local-vs-bot`: game board active; bot `useEffect` fires when `currentPlayer === 'white'`
- `online-setup`: create (host) or join (guest) a P2P room
- `online-waiting`: waiting for peer to connect; WaitingRoom renders
- `online-game`: game board active; peer moves arrive via `usePeerGame` hook

## Multiplayer (P2P via PeerJS)

No backend. No database. Uses PeerJS's free hosted signaling server for the WebRTC handshake only — no data is stored anywhere.

- **Host** creates an 8-char room code and calls `new Peer(roomCode)`. Plays black.
- **Guest** calls `peer.connect(roomCode)`. Plays white.
- Moves, rematch requests, and accepts are sent as typed `PeerMessage` objects over the `DataConnection`.
- Game history is saved to localStorage on both sides (same as local games).
- Guest can auto-join via `?join=<code>` URL param (OnlineSetup reads this on mount).

`usePeerGame(role, myName, roomCode, currentPlayer)` returns the full P2P interface. It resets all state when `role` or `roomCode` become null (i.e. when leaving online mode).

## AI bot

`src/ai.ts` exports `getBotMove(board, botCell): [row, col] | null`.

Two-phase heuristic:
1. **Forced moves** — immediate win → block opponent win → create open-4 → block open-4
2. **Positional scoring** — scores each empty cell across 4 directions using `countLine` (pattern weights: open-3 +800, open-3 opp +700, etc.) plus center proximity and random jitter

Bot always plays white. Triggered via `setTimeout(..., 400)` in a `useEffect` in App.tsx so it feels natural and doesn't block the UI.

## Key types (`src/types.ts`)

```ts
type Cell = 0 | 1 | 2          // 0=empty, 1=black, 2=white
type Player = 'black' | 'white'
type AppMode = 'name-entry' | 'select' | 'local-vs-bot' | 'online-setup' | 'online-waiting' | 'online-game'
type PeerRole = 'host' | 'guest'
type PeerMessage = { type: 'init' | 'guest-info' | 'move' | 'rematch-request' | 'rematch-accept' | 'resign', ... }
```

Win detection: `checkWinner(board, row, col, cell)` — checks 4 directions from the placed stone.

## localStorage keys

| Key | Purpose |
|-----|---------|
| `gomoku_display_name` | Player's display name |
| `gomoku_autosave` | Current in-progress game |
| `gomoku_history` | Array of completed games (max 50) |
| `gomoku_session_id` | Not currently used (reserved) |

## Vercel deployment

Both the portfolio and Gomoku app are served from one Vercel project.

**Build flow** (`npm run build` at repo root):
1. Builds the Gomoku React app (`gomoku/gomoku-enhanced/`) → `gomoku/gomoku-enhanced/dist/`
2. Copies `index.html` → `public/index.html`
3. Copies Gomoku dist → `public/gomoku/`

Vercel serves the `public/` output directory. `vercel.json` rewrites `/gomoku/*` to `/gomoku/index.html` for React SPA routing.

Vite is configured with `base: '/gomoku/'` so all asset paths are correct in production.

**`public/` is a build artifact — never commit it** (it's gitignored).

To deploy: push to the repo branch Vercel is watching. No extra Vercel configuration needed beyond what `vercel.json` declares.

## Personal site (`index.html`)

Single-page portfolio. Sections: Research, Projects & Companies, Experience, Education, Writing.

The Projects grid uses `<article class="project-card">` elements inside `.projects-grid`. The Gomoku card links to `./gomoku/gomoku-enhanced/`.

Animated canvas backgrounds: neural network simulation (upper-left) and HPC cluster simulation (lower-right). Both pause when the tab is hidden.

### Neural network backdrop (lines ~555–860 in `index.html`)

The `NN` object runs a biophysically-grounded connectome simulation with four layers of theory:

| Layer | Model | Reference |
|---|---|---|
| Neuron dynamics | Hodgkin-Huxley (m/h/n gating, INa/IK/IL currents) | Hodgkin & Huxley (1952) |
| Synaptic plasticity | STDP: Δw = A± exp(−|Δt|/τ±) based on pre/post spike timing | Bi & Poo (1998) |
| Structural plasticity | Synaptogenesis via spike-trace correlation; pruning when weight decays below threshold | Holtmaat & Bhatt (2009) |
| Global modulation | Single-head self-attention: softmax(QKᵀ/√d) · V over neuron state vectors | Vaswani et al. (2017) |

**Click interaction:** clicking anywhere on the page injects `I_ext` into nearby neurons via a Gaussian kernel (σ = 15% of viewport width), producing a ripple animation and local burst of firing.

**Structural dynamics:**
- New synapses form when two neurons' spike traces are both elevated (co-activity gate), up to `MAX_NEURONS = 20`
- Weak synapses (`weight < 0.008`) that remain quiescent for 180 frames (~3 s) are pruned
- New neurons spawn (up to cap) when global `activityAccum` exceeds threshold
- New synapses fade in over 90 frames via `ageFade = min(1, age/90)`

**Key constants:** `STDP_A_PLUS = 0.01`, `STDP_TAU_PLUS/MINUS = 20 frames`, `ATTN_GAMMA = 0.2`, `K_FORM = 0.15`, `CLICK_I = 15`.
