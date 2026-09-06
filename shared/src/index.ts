export type LatLng = {
  lat: number;
  lng: number;
};

export type Location = {
  id: string;
  lat: number;
  lng: number;
  panoId?: string;
  country?: string;
  region?: string;
};

export type GamePhase = 'lobby' | 'guessing' | 'reveal' | 'finished';

export type PlayerPublic = {
  id: string;
  nickname: string;
  score: number;
  hasGuessed: boolean;
  isHost: boolean;
  connected: boolean;
};

export type RoundPublic = {
  index: number;
  total: number;
  panoId: string;
};

export type RoundReveal = {
  answer: LatLng;
  guesses: Array<{
    playerId: string;
    nickname: string;
    guess: LatLng | null;
    distanceKm: number | null;
    score: number;
  }>;
};

export type GameStatePublic = {
  roomCode: string;
  phase: GamePhase;
  players: PlayerPublic[];
  round: RoundPublic | null;
  reveal: RoundReveal | null;
  roundEndsAt: number | null;
  totalRounds: number;
};

export type SoloRound = {
  index: number;
  total: number;
  panoId: string;
};

export type SoloReveal = {
  answer: LatLng;
  guess: LatLng;
  distanceKm: number;
  score: number;
};

export type SoloGameState = {
  gameId: string;
  phase: 'guessing' | 'reveal' | 'finished';
  round: SoloRound;
  reveal: SoloReveal | null;
  totalScore: number;
  history: SoloReveal[];
};

export const ROUNDS_PER_GAME = 5;
export const MAX_ROUND_SCORE = 5000;
export const MULTI_ROUND_SECONDS = 90;

/** GeoGuessr-style exponential score from distance in km. */
export function scoreFromDistanceKm(distanceKm: number): number {
  if (distanceKm < 0.025) return MAX_ROUND_SCORE;
  const score = Math.round(MAX_ROUND_SCORE * Math.exp(-distanceKm / 2000));
  return Math.max(0, Math.min(MAX_ROUND_SCORE, score));
}

/** Haversine distance in kilometers. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
