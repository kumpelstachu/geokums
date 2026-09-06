import type { GameSettings, GuessPayload, SoloGameState } from '@geoguess/shared';

async function json<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export function fetchHealth(): Promise<{ ok: boolean; sourceCommit: string | null }> {
  return fetch('/api/health').then((r) => json(r));
}

export function startSolo(settings: GameSettings): Promise<SoloGameState> {
  return fetch('/api/solo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  }).then((r) => json(r));
}

export function submitSoloGuess(gameId: string, guess: GuessPayload): Promise<SoloGameState> {
  return fetch(`/api/solo/${gameId}/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(guess),
  }).then((r) => json(r));
}

export function nextSoloRound(gameId: string): Promise<SoloGameState> {
  return fetch(`/api/solo/${gameId}/next`, { method: 'POST' }).then((r) => json(r));
}
