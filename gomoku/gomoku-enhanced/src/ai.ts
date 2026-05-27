import type { Cell } from './types';
import { BOARD_SIZE } from './types';

const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
const CENTER = Math.floor(BOARD_SIZE / 2);

function countLine(
  board: Cell[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  forCell: Cell,
): { count: number; openEnds: number } {
  let count = 1; // the candidate cell itself counts as forCell
  let openEnds = 0;
  for (const [sr, sc] of [[dr, dc], [-dr, -dc]] as [number, number][]) {
    for (let d = 1; d <= 5; d++) {
      const r = row + sr * d;
      const c = col + sc * d;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r][c] === forCell) count++;
      else {
        if (board[r][c] === 0) openEnds++;
        break;
      }
    }
  }
  return { count, openEnds };
}

function scoreCell(
  board: Cell[][],
  row: number,
  col: number,
  myCell: Cell,
  oppCell: Cell,
): number {
  let score = 0;
  for (const [dr, dc] of DIRS) {
    const my = countLine(board, row, col, dr, dc, myCell);
    if (my.count >= 5) return 1e9;
    if (my.count === 4 && my.openEnds >= 1) score += 10000;
    else if (my.count === 4) score += 1000;
    else if (my.count === 3 && my.openEnds === 2) score += 800;
    else if (my.count === 3 && my.openEnds === 1) score += 200;
    else if (my.count === 2 && my.openEnds === 2) score += 150;
    else if (my.count === 2 && my.openEnds === 1) score += 50;

    const opp = countLine(board, row, col, dr, dc, oppCell);
    if (opp.count >= 5) score += 1e8;
    else if (opp.count === 4 && opp.openEnds >= 1) score += 9000;
    else if (opp.count === 4) score += 900;
    else if (opp.count === 3 && opp.openEnds === 2) score += 700;
    else if (opp.count === 3 && opp.openEnds === 1) score += 180;
    else if (opp.count === 2 && opp.openEnds === 2) score += 120;
  }
  const dist = Math.abs(row - CENTER) + Math.abs(col - CENTER);
  score += Math.max(0, 100 - dist * 8);
  score += Math.random() * 15;
  return score;
}

export function getBotMove(board: Cell[][], botCell: Cell): [number, number] | null {
  const oppCell: Cell = botCell === 1 ? 2 : 1;
  let best = -Infinity;
  let move: [number, number] | null = null;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] !== 0) continue;
      const s = scoreCell(board, row, col, botCell, oppCell);
      if (s > best) {
        best = s;
        move = [row, col];
      }
    }
  }
  return move;
}
