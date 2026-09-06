import {
  ROUNDS_PER_GAME,
  distanceKm,
  scoreFromDistanceKm,
  type LatLng,
  type Location,
  type SoloGameState,
  type SoloReveal,
} from '@geoguess/shared';
import { sampleLocations } from './data/locations.js';

type SoloGame = {
  id: string;
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

export async function createSoloGame(): Promise<SoloGameState> {
  const locations = await sampleLocations(ROUNDS_PER_GAME);
  const game: SoloGame = {
    id: id(),
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

export function submitSoloGuess(gameId: string, guess: LatLng): SoloGameState {
  const game = games.get(gameId);
  if (!game) throw new Error('Game not found');
  if (game.phase !== 'guessing') throw new Error('Not guessing');
  const loc = game.locations[game.roundIndex];
  const answer = { lat: loc.lat, lng: loc.lng };
  const dist = distanceKm(guess, answer);
  const score = scoreFromDistanceKm(dist);
  const reveal: SoloReveal = {
    answer,
    guess,
    distanceKm: dist,
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
