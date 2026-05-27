import type { GameState } from '../types';
import { deleteFromHistory, exportHistory } from '../storage';

interface GameHistoryProps {
  history: GameState[];
  onReplay: (game: GameState) => void;
  onHistoryChange: () => void;
}

export default function GameHistory({ history, onReplay, onHistoryChange }: GameHistoryProps) {
  const handleDelete = (id: string) => {
    deleteFromHistory(id);
    onHistoryChange();
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-400">{history.length} game{history.length !== 1 ? 's' : ''}</span>
        {history.length > 0 && (
          <button
            onClick={exportHistory}
            className="text-xs py-1 px-2.5 rounded border border-stone-700 text-stone-400 hover:text-stone-200 hover:border-stone-500 transition-colors"
          >
            Export JSON
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-xs text-stone-600 text-center py-8">
          No saved games yet.<br />Complete a game to save it.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto">
          {history.map((game) => {
            const date = new Date(game.startedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            const shortId = game.id.slice(0, 8);
            return (
              <div
                key={game.id}
                className="rounded border border-stone-800 bg-stone-900/60 p-2.5 hover:border-stone-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-stone-500">{shortId}</span>
                      {game.winner ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <span
                            className="inline-block w-2 h-2 rounded-full border"
                            style={{
                              background: game.winner === 'black' ? '#222' : '#ece8e0',
                              borderColor: game.winner === 'black' ? '#555' : '#bbb',
                            }}
                          />
                          <span className="capitalize text-stone-300">{game.winner} wins</span>
                        </span>
                      ) : (
                        <span className="text-xs text-stone-500">in progress</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-600">{date} · {game.moves.length} moves</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => onReplay(game)}
                      className="text-xs py-0.5 px-2 rounded border border-stone-700 text-amber-600 hover:text-amber-400 hover:border-amber-700/50 transition-colors"
                    >
                      Replay
                    </button>
                    <button
                      onClick={() => handleDelete(game.id)}
                      className="text-xs py-0.5 px-2 rounded border border-stone-800 text-stone-600 hover:text-red-400 hover:border-red-900 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
