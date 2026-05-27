export type Player = 'black' | 'white';
export type Cell = 0 | 1 | 2; // 0=empty, 1=black, 2=white

export interface Move {
  row: number;
  col: number;
  player: Player;
  timestamp: string;
}

export interface GameState {
  id: string;
  startedAt: string;
  moves: Move[];
  winner: Player | null;
  board: Cell[][];
}

export const BOARD_SIZE = 15;
export const WIN_LENGTH = 5;

export function emptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0) as Cell[]);
}

export function colLabel(col: number): string {
  return String.fromCharCode(65 + (col >= 8 ? col + 1 : col)); // skip 'I'
}

export function rowLabel(row: number): string {
  return String(BOARD_SIZE - row);
}

export function moveLabel(move: Move): string {
  return `${colLabel(move.col)}${rowLabel(move.row)}`;
}

export function checkWinner(board: Cell[][], row: number, col: number, player: Cell): boolean {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let d = 1; d < WIN_LENGTH; d++) {
      const r = row + dr * d, c = col + dc * d;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
      count++;
    }
    for (let d = 1; d < WIN_LENGTH; d++) {
      const r = row - dr * d, c = col - dc * d;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
      count++;
    }
    if (count >= WIN_LENGTH) return true;
  }
  return false;
}

export type AppMode =
  | 'name-entry'
  | 'select'
  | 'local-vs-bot'
  | 'online-setup'
  | 'online-waiting'
  | 'online-game';

export type PeerRole = 'host' | 'guest';

export type PeerMessage =
  | { type: 'init'; guestColor: 'white'; hostName: string }
  | { type: 'guest-info'; name: string }
  | { type: 'move'; row: number; col: number }
  | { type: 'rematch-request'; name: string }
  | { type: 'rematch-accept' }
  | { type: 'resign' };

export function getWinLine(board: Cell[][], row: number, col: number, player: Cell): [number, number][] | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const cells: [number, number][] = [[row, col]];
    for (let d = 1; d < WIN_LENGTH; d++) {
      const r = row + dr * d, c = col + dc * d;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
      cells.push([r, c]);
    }
    for (let d = 1; d < WIN_LENGTH; d++) {
      const r = row - dr * d, c = col - dc * d;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== player) break;
      cells.unshift([r, c]);
    }
    if (cells.length >= WIN_LENGTH) return cells.slice(0, WIN_LENGTH);
  }
  return null;
}
