interface Props {
  playerName: string;
  onSelectBot: () => void;
  onSelectFriend: () => void;
  onChangeName: () => void;
}

export default function ModeSelect({ playerName, onSelectBot, onSelectFriend, onChangeName }: Props) {
  return (
    <div className="min-h-screen bg-[#111] text-stone-200 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8 border border-stone-800 rounded-xl bg-[#0e0e0e] max-w-sm w-full mx-4">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-[#111] border-2 border-stone-600" />
          <div className="w-3.5 h-3.5 rounded-full bg-stone-100 border border-stone-400" />
          <span className="text-stone-300 font-medium tracking-wide text-sm ml-1">Gomoku</span>
        </div>
        <p className="text-stone-400 text-sm">
          Playing as{' '}
          <span className="text-stone-200 font-medium">{playerName}</span>
        </p>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onSelectBot}
            className="w-full py-3 rounded border border-stone-700 text-stone-300 hover:bg-stone-800 hover:border-stone-600 transition-colors font-medium"
          >
            Play vs Bot
          </button>
          <button
            onClick={onSelectFriend}
            className="w-full py-3 rounded border border-amber-700/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/30 transition-colors font-medium"
          >
            Play vs Friend
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onChangeName}
            className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
          >
            Change name
          </button>
          <span className="text-stone-800">·</span>
          <a
            href="/"
            className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
          >
            ← Portfolio
          </a>
        </div>
      </div>
    </div>
  );
}
