import React, { useRef, useState, useCallback } from 'react';
import type { Cell } from '../types';
import { BOARD_SIZE, colLabel, rowLabel } from '../types';

interface BoardProps {
  board: Cell[][];
  currentPlayer: 'black' | 'white';
  winLine: [number, number][] | null;
  lastMove: [number, number] | null;
  viewOnly?: boolean;
  onPlace: (row: number, col: number) => void;
}

const PADDING = 36;
const CELL = 44;
const SIZE = PADDING * 2 + CELL * (BOARD_SIZE - 1);
const STONE_R = CELL * 0.44;
const DOT_POSITIONS: [number, number][] = [
  [3, 3], [3, 11], [11, 3], [11, 11], [7, 7],
];

function cx(col: number) { return PADDING + col * CELL; }
function cy(row: number) { return PADDING + row * CELL; }

export default function Board({ board, currentPlayer, winLine, lastMove, viewOnly, onPlace }: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<[number, number] | null>(null);

  const nearestCell = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const col = Math.round((x - PADDING) / CELL);
    const row = Math.round((y - PADDING) / CELL);
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    return [row, col];
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (viewOnly) return;
    const cell = nearestCell(e.clientX, e.clientY);
    setHover(cell && board[cell[0]][cell[1]] === 0 ? cell : null);
  }, [nearestCell, board, viewOnly]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (viewOnly) return;
    const cell = nearestCell(e.clientX, e.clientY);
    if (cell && board[cell[0]][cell[1]] === 0) {
      onPlace(cell[0], cell[1]);
      setHover(null);
    }
  }, [nearestCell, board, onPlace, viewOnly]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (viewOnly) return;
    e.preventDefault(); // prevent ghost click
    const touch = e.changedTouches[0];
    if (!touch) return;
    const cell = nearestCell(touch.clientX, touch.clientY);
    if (cell && board[cell[0]][cell[1]] === 0) {
      onPlace(cell[0], cell[1]);
      setHover(null);
    }
  }, [nearestCell, board, onPlace, viewOnly]);

  const winSet = new Set(winLine?.map(([r, c]) => `${r},${c}`) ?? []);

  return (
    <svg
      ref={svgRef}
      data-board="gomoku"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      style={{ maxWidth: '560px', display: 'block', cursor: viewOnly ? 'default' : 'crosshair', userSelect: 'none', touchAction: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
    >
      {/* Board background */}
      <rect width={SIZE} height={SIZE} fill="#1c1c1c" rx="6" />
      <rect
        x={PADDING - CELL * 0.15}
        y={PADDING - CELL * 0.15}
        width={CELL * (BOARD_SIZE - 1) + CELL * 0.3}
        height={CELL * (BOARD_SIZE - 1) + CELL * 0.3}
        fill="#242018"
        rx="3"
      />

      {/* Grid lines */}
      {Array.from({ length: BOARD_SIZE }, (_, i) => (
        <React.Fragment key={i}>
          <line
            x1={cx(0)} y1={cy(i)} x2={cx(BOARD_SIZE - 1)} y2={cy(i)}
            stroke="#3d3830" strokeWidth={i === 0 || i === BOARD_SIZE - 1 ? 1.5 : 0.7}
          />
          <line
            x1={cx(i)} y1={cy(0)} x2={cx(i)} y2={cy(BOARD_SIZE - 1)}
            stroke="#3d3830" strokeWidth={i === 0 || i === BOARD_SIZE - 1 ? 1.5 : 0.7}
          />
        </React.Fragment>
      ))}

      {/* Star points */}
      {DOT_POSITIONS.map(([r, c]) => (
        <circle key={`dot-${r}-${c}`} cx={cx(c)} cy={cy(r)} r={3.5} fill="#5a5348" />
      ))}

      {/* Coordinate labels */}
      {Array.from({ length: BOARD_SIZE }, (_, i) => (
        <React.Fragment key={`lbl-${i}`}>
          <text x={cx(i)} y={PADDING - 16} textAnchor="middle" fontSize={10} fill="#6b6357" fontFamily="monospace">
            {colLabel(i)}
          </text>
          <text x={cx(i)} y={SIZE - PADDING + 22} textAnchor="middle" fontSize={10} fill="#6b6357" fontFamily="monospace">
            {colLabel(i)}
          </text>
          <text x={PADDING - 18} y={cy(i) + 4} textAnchor="middle" fontSize={10} fill="#6b6357" fontFamily="monospace">
            {rowLabel(i)}
          </text>
          <text x={SIZE - PADDING + 18} y={cy(i) + 4} textAnchor="middle" fontSize={10} fill="#6b6357" fontFamily="monospace">
            {rowLabel(i)}
          </text>
        </React.Fragment>
      ))}

      {/* Hover preview */}
      {hover && (
        <circle
          cx={cx(hover[1])} cy={cy(hover[0])} r={STONE_R}
          fill={currentPlayer === 'black' ? 'rgba(30,30,30,0.55)' : 'rgba(240,237,232,0.4)'}
          stroke={currentPlayer === 'black' ? '#555' : '#ccc'}
          strokeWidth={1}
        />
      )}

      {/* Stones */}
      {board.map((row, r) =>
        row.map((cell, c) => {
          if (cell === 0) return null;
          const isBlack = cell === 1;
          const isWin = winSet.has(`${r},${c}`);
          const isLast = lastMove?.[0] === r && lastMove?.[1] === c;
          const x = cx(c), y = cy(r);

          return (
            <g key={`stone-${r}-${c}`}>
              <circle cx={x + 1.5} cy={y + 2} r={STONE_R} fill="rgba(0,0,0,0.4)" />
              <circle
                cx={x} cy={y} r={STONE_R}
                fill={isBlack
                  ? (isWin ? 'url(#blackWinGrad)' : 'url(#blackGrad)')
                  : (isWin ? 'url(#whiteWinGrad)' : 'url(#whiteGrad)')
                }
                stroke={isWin ? '#c8a96e' : (isBlack ? '#000' : '#bbb')}
                strokeWidth={isWin ? 2 : 0.5}
              />
              {isLast && !isWin && (
                <circle cx={x} cy={y} r={STONE_R * 0.28}
                  fill={isBlack ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'}
                />
              )}
              {isWin && (
                <circle cx={x} cy={y} r={STONE_R * 0.3}
                  fill="none" stroke="#c8a96e" strokeWidth={1.5}
                />
              )}
            </g>
          );
        })
      )}

      {/* Gradients */}
      <defs>
        <radialGradient id="blackGrad" cx="38%" cy="32%" r="60%">
          <stop offset="0%" stopColor="#5a5a5a" />
          <stop offset="100%" stopColor="#111" />
        </radialGradient>
        <radialGradient id="blackWinGrad" cx="38%" cy="32%" r="60%">
          <stop offset="0%" stopColor="#7a6a4a" />
          <stop offset="100%" stopColor="#2a1a00" />
        </radialGradient>
        <radialGradient id="whiteGrad" cx="38%" cy="32%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ccbfb0" />
        </radialGradient>
        <radialGradient id="whiteWinGrad" cx="38%" cy="32%" r="60%">
          <stop offset="0%" stopColor="#ffe8a0" />
          <stop offset="100%" stopColor="#c8a060" />
        </radialGradient>
      </defs>
    </svg>
  );
}
