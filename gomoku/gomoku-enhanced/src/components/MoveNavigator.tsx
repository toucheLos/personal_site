import type { Move } from '../types';
import { moveLabel } from '../types';

interface MoveNavigatorProps {
  moves: Move[];
  viewIndex: number;           // -1 = current (end), 0..n = index into moves
  totalMoves: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onJump: (index: number) => void;
  onResumeFromHere: () => void;
  isViewingHistory: boolean;
}

export default function MoveNavigator({
  moves, viewIndex, totalMoves,
  onFirst, onPrev, onNext, onLast, onJump, onResumeFromHere, isViewingHistory,
}: MoveNavigatorProps) {
  const current = viewIndex === -1 ? totalMoves : viewIndex + 1;
  const pct = totalMoves === 0 ? 0 : (current / totalMoves) * 100;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Nav buttons */}
      <div className="flex items-center gap-2 justify-center">
        <NavBtn onClick={onFirst} disabled={current <= 0} title="First">
          <span className="font-mono text-xs tracking-tighter">|◀</span>
        </NavBtn>
        <NavBtn onClick={onPrev} disabled={current <= 0} title="Previous">
          <span className="font-mono text-xs">◀</span>
        </NavBtn>
        <span className="text-xs text-stone-400 font-mono min-w-[60px] text-center">
          {totalMoves === 0 ? '—' : `${current} / ${totalMoves}`}
        </span>
        <NavBtn onClick={onNext} disabled={viewIndex === -1 || viewIndex >= totalMoves - 1} title="Next">
          <span className="font-mono text-xs">▶</span>
        </NavBtn>
        <NavBtn onClick={onLast} disabled={viewIndex === -1} title="Last">
          <span className="font-mono text-xs tracking-tighter">▶|</span>
        </NavBtn>
      </div>

      {/* Scrubber */}
      {totalMoves > 0 && (
        <div className="px-1">
          <input
            type="range"
            min={0}
            max={totalMoves}
            value={current}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v === totalMoves) onLast();
              else onJump(v - 1);
            }}
            className="w-full h-1 appearance-none rounded-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, #c8a96e ${pct}%, #3a3830 ${pct}%)`,
            }}
          />
        </div>
      )}

      {/* Resume button */}
      {isViewingHistory && (
        <button
          onClick={onResumeFromHere}
          className="text-xs py-1.5 px-3 rounded border border-amber-700/50 text-amber-500 hover:bg-amber-900/20 transition-colors text-center"
        >
          Fork game from move {current}
        </button>
      )}

      {/* Move list */}
      {moves.length > 0 && (
        <div className="overflow-y-auto max-h-64 rounded border border-stone-800 bg-stone-900/50">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-stone-900">
              <tr className="border-b border-stone-800">
                <th className="text-left py-1.5 px-2 text-stone-500 font-normal">#</th>
                <th className="text-left py-1.5 px-2 text-stone-500 font-normal">Player</th>
                <th className="text-left py-1.5 px-2 text-stone-500 font-normal">Move</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m, i) => {
                const isActive = viewIndex === -1 ? i === moves.length - 1 : i === viewIndex;
                return (
                  <tr
                    key={i}
                    onClick={() => onJump(i)}
                    className={`cursor-pointer border-b border-stone-800/50 transition-colors ${
                      isActive ? 'bg-amber-900/30 text-amber-400' : 'hover:bg-stone-800/50 text-stone-400'
                    }`}
                  >
                    <td className="py-1 px-2 font-mono text-stone-600">{i + 1}</td>
                    <td className="py-1 px-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full border"
                          style={{
                            background: m.player === 'black' ? '#222' : '#ece8e0',
                            borderColor: m.player === 'black' ? '#555' : '#bbb',
                          }}
                        />
                        <span className="capitalize">{m.player}</span>
                      </span>
                    </td>
                    <td className="py-1 px-2 font-mono">{moveLabel(m)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NavBtn({ onClick, disabled, title, children }: {
  onClick: () => void; disabled: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded border border-stone-700 text-stone-400
        hover:border-stone-500 hover:text-stone-200 disabled:opacity-30 disabled:cursor-not-allowed
        transition-colors bg-stone-900"
    >
      {children}
    </button>
  );
}
