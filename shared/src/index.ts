export type LatLng = {
  lat: number;
  lng: number;
};

export type MapPack = 'world' | 'poland';
export type MovementMode = 'moving' | 'noMove';
/** classic = pin map; country = pick country; duels = 1v1 HP damage */
export type PlayMode = 'classic' | 'country' | 'duels';

export type GameSettings = {
  mapPack: MapPack;
  movement: MovementMode;
  playMode: PlayMode;
  showCompass: boolean;
  rounds: number;
};

export const DEFAULT_SETTINGS: GameSettings = {
  mapPack: 'world',
  movement: 'moving',
  playMode: 'classic',
  showCompass: true,
  rounds: 5,
};

export const DUEL_START_HP = 6000;
export const DUEL_MAX_ROUNDS = 25;

export type Location = {
  id: string;
  lat: number;
  lng: number;
  panoId?: string;
  country?: string;
  region?: string;
  pack?: MapPack;
};

export type GamePhase = 'lobby' | 'guessing' | 'reveal' | 'finished';

export type PlayerPublic = {
  id: string;
  nickname: string;
  score: number;
  hp: number;
  hasGuessed: boolean;
  isHost: boolean;
  connected: boolean;
};

export type RoundPublic = {
  index: number;
  total: number;
  panoId: string;
};

export type GuessPayload =
  | { type: 'pin'; lat: number; lng: number }
  | { type: 'country'; country: string };

export type RoundRevealGuess = {
  playerId: string;
  nickname: string;
  guess: LatLng | null;
  countryGuess: string | null;
  distanceKm: number | null;
  score: number;
  damageTaken: number;
};

export type RoundReveal = {
  answer: LatLng;
  answerCountry: string | null;
  guesses: RoundRevealGuess[];
};

export type GameStatePublic = {
  roomCode: string;
  phase: GamePhase;
  settings: GameSettings;
  players: PlayerPublic[];
  round: RoundPublic | null;
  reveal: RoundReveal | null;
  roundEndsAt: number | null;
  totalRounds: number;
  isDuel: boolean;
  chat: ChatMessage[];
};

export type ChatMessage = {
  id: string;
  playerId: string;
  nickname: string;
  text: string;
  at: number;
};

export type SoloRound = {
  index: number;
  total: number;
  panoId: string;
};

export type SoloReveal = {
  answer: LatLng;
  answerCountry: string | null;
  guess: LatLng | null;
  countryGuess: string | null;
  distanceKm: number | null;
  score: number;
};

export type SoloGameState = {
  gameId: string;
  phase: 'guessing' | 'reveal' | 'finished';
  settings: GameSettings;
  round: SoloRound;
  reveal: SoloReveal | null;
  totalScore: number;
  history: SoloReveal[];
};

export const ROUNDS_PER_GAME = 5;
export const MAX_ROUND_SCORE = 5000;
export const MULTI_ROUND_SECONDS = 90;

export const COUNTRIES = [
  'Argentina',
  'Australia',
  'Austria',
  'Belgium',
  'Brazil',
  'Canada',
  'Chile',
  'China',
  'Czechia',
  'Denmark',
  'Egypt',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'India',
  'Indonesia',
  'Ireland',
  'Israel',
  'Italy',
  'Japan',
  'Kenya',
  'Mexico',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Russia',
  'Singapore',
  'South Africa',
  'South Korea',
  'Spain',
  'Sweden',
  'Taiwan',
  'Thailand',
  'Turkey',
  'UAE',
  'UK',
  'USA',
] as const;

export type CountryName = (typeof COUNTRIES)[number] | string;

export function normalizeCountry(name: string): string {
  return name.trim().toLowerCase();
}

export function countriesMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  return normalizeCountry(a) === normalizeCountry(b);
}

/** GeoGuessr-style exponential score from distance in km. */
export function scoreFromDistanceKm(distanceKm: number): number {
  if (distanceKm < 0.025) return MAX_ROUND_SCORE;
  const score = Math.round(MAX_ROUND_SCORE * Math.exp(-distanceKm / 2000));
  return Math.max(0, Math.min(MAX_ROUND_SCORE, score));
}

export function scoreCountryGuess(guess: string, answer: string | undefined | null): number {
  return countriesMatch(guess, answer) ? MAX_ROUND_SCORE : 0;
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

export function clampRounds(n: number): number {
  return Math.min(10, Math.max(1, Math.round(n) || ROUNDS_PER_GAME));
}

export function normalizeSettings(input?: Partial<GameSettings> | null): GameSettings {
  const base = { ...DEFAULT_SETTINGS, ...(input || {}) };
  return {
    mapPack: base.mapPack === 'poland' ? 'poland' : 'world',
    movement: base.movement === 'noMove' ? 'noMove' : 'moving',
    playMode:
      base.playMode === 'country' || base.playMode === 'duels' ? base.playMode : 'classic',
    showCompass: base.showCompass !== false,
    rounds: clampRounds(base.rounds),
  };
}
