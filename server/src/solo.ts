import {
  distanceKm,
  normalizeSettings,
  scoreCountryGuess,
  scoreFromDistanceKm,
  type GameSettings,
  type GuessPayload,
  type Location,
  type SoloGameState,
  type SoloReveal,
} from '@geoguess/shared';
import { sampleLocations } from './data/locations.js';

type SoloGame = {
  id: string;
  settings: GameSettings;
  locations: Location[];
  roundIndex: number;
  phase: 'guessing' | 'reveal' | 'finished';
  totalScore: number;
  history: SoloReveal[];
  lastReveal: SoloReveal | null;
};

const games = new Map<string, SoloGame>();

function id(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function createSoloGame(
  settings?: Partial<GameSettings>,
): Promise<SoloGameState> {
  const normalized = normalizeSettings(settings);
  if (normalized.playMode === 'duels') {
    throw new Error('Duels require a multiplayer room');
  }
  const locations = await sampleLocations(normalized.rounds, normalized.mapPack);
  const game: SoloGame = {
    id: id(),
    settings: normalized,
    locations,
    roundIndex: 0,
    phase: 'guessing',
    totalScore: 0,
    history: [],
    lastReveal: null,
  };
  games.set(game.id, game);
  return toPublic(game);
}

export function getSoloGame(gameId: string): SoloGameState | null {
  const game = games.get(gameId);
  return game ? toPublic(game) : null;
}

export function submitSoloGuess(gameId: string, payload: GuessPayload): SoloGameState {
  const game = games.get(gameId);
  if (!game) throw new Error('Game not found');
  if (game.phase !== 'guessing') throw new Error('Not guessing');
  const loc = game.locations[game.roundIndex];
  const answer = { lat: loc.lat, lng: loc.lng };
  const answerCountry = loc.country || null;

  let score = 0;
  let distance: number | null = null;
  let guess = null as SoloReveal['guess'];
  let countryGuess = null as string | null;

  if (game.settings.playMode === 'country') {
    if (payload.type !== 'country') throw new Error('Pick a country');
    countryGuess = payload.country.trim();
    score = scoreCountryGuess(countryGuess, answerCountry);
  } else {
    if (payload.type !== 'pin') throw new Error('Place a pin');
    guess = { lat: payload.lat, lng: payload.lng };
    distance = distanceKm(guess, answer);
    score = scoreFromDistanceKm(distance);
  }

  const reveal: SoloReveal = {
    answer,
    answerCountry,
    guess,
    countryGuess,
    distanceKm: distance,
    score,
  };
  game.totalScore += score;
  game.history.push(reveal);
  game.lastReveal = reveal;
  game.phase = 'reveal';
  return toPublic(game);
}

export function advanceSolo(gameId: string): SoloGameState {
  const game = games.get(gameId);
  if (!game) throw new Error('Game not found');
  if (game.phase !== 'reveal') throw new Error('Not in reveal');
  if (game.roundIndex >= game.locations.length - 1) {
    game.phase = 'finished';
    game.lastReveal = null;
    return toPublic(game);
  }
  game.roundIndex += 1;
  game.phase = 'guessing';
  game.lastReveal = null;
  return toPublic(game);
}

function toPublic(game: SoloGame): SoloGameState {
  const loc = game.locations[game.roundIndex];
  if (!loc.panoId) throw new Error('Round missing Street View panorama');
  return {
    gameId: game.id,
    phase: game.phase,
    settings: game.settings,
    round: {
      index: game.roundIndex,
      total: game.locations.length,
      panoId: loc.panoId,
    },
    reveal: game.phase === 'reveal' ? game.lastReveal : null,
    totalScore: game.totalScore,
    history: game.history,
  };
}
