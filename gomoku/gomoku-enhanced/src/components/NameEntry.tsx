import { useState } from 'react';
import { loadDisplayName, saveDisplayName } from '../storage';

interface Props {
  onDone: (name: string) => void;
}

export default function NameEntry({ onDone }: Props) {
  const [name, setName] = useState(() => loadDisplayName());

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveDisplayName(trimmed);
    onDone(trimmed);
  };

  return (
    <div className="min-h-screen bg-[#111] text-stone-200 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8 border border-stone-800 rounded-xl bg-[#0e0e0e] max-w-sm w-full mx-4">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-[#111] border-2 border-stone-600" />
          <div className="w-3.5 h-3.5 rounded-full bg-stone-100 border border-stone-400" />
          <span className="text-stone-300 font-medium tracking-wide text-sm ml-1">Gomoku</span>
        </div>
        <h1 className="text-stone-200 text-lg font-medium">What's your name?</h1>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          maxLength={20}
          placeholder="Enter your name"
          autoFocus
          className="w-full bg-[#111] border border-stone-700 rounded px-3 py-2 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 text-center"
        />
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full py-2.5 rounded border border-amber-700/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Let's play →
        </button>
      </div>
    </div>
  );
}
