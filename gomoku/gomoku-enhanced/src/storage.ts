import type { GameState } from './types';

const AUTOSAVE_KEY = 'gomoku_autosave';
const HISTORY_KEY = 'gomoku_history';
const MAX_HISTORY = 50;

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
  } catch {}
}

export function loadAutosave(): GameState | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

export function loadHistory(): GameState[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as GameState[]) : [];
  } catch {
    return [];
  }
}

export function appendToHistory(state: GameState): void {
  try {
    const history = loadHistory();
    const idx = history.findIndex((g) => g.id === state.id);
    if (idx >= 0) {
      history[idx] = state;
    } else {
      history.unshift(state);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {}
}

export function deleteFromHistory(id: string): void {
  try {
    const history = loadHistory().filter((g) => g.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

const DISPLAY_NAME_KEY = 'gomoku_display_name';

export function saveDisplayName(name: string): void {
  try { localStorage.setItem(DISPLAY_NAME_KEY, name); } catch {}
}

export function loadDisplayName(): string {
  try { return localStorage.getItem(DISPLAY_NAME_KEY) ?? ''; } catch { return ''; }
}

export function exportHistory(): void {
  const history = loadHistory();
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gomoku-history-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
