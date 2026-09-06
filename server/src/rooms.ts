import {
  ROUNDS_PER_GAME,
  MULTI_ROUND_SECONDS,
  distanceKm,
  scoreFromDistanceKm,
  type GamePhase,
  type GameStatePublic,
  type LatLng,
  type Location,
  type PlayerPublic,
  type RoundReveal,
} from '@geoguess/shared';
import { sampleLocations } from './data/locations.js';

export type Player = {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  guess: LatLng | null;
};

export type Room = {
  code: string;
  phase: GamePhase;
  players: Map<string, Player>;
  locations: Location[];
  roundIndex: number;
  reveal: RoundReveal | null;
  roundEndsAt: number | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
};

const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += codeChars[Math.floor(Math.random() * codeChars.length)];
  }
  return code;
}

export class RoomManager {
  rooms = new Map<string, Room>();
  onChange: ((roomCode: string) => void) | null = null;

  private notify(room: Room) {
    this.onChange?.(room.code);
  }

  createRoom(hostId: string, nickname: string): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const room: Room = {
      code,
      phase: 'lobby',
      players: new Map(),
      locations: [],
      roundIndex: 0,
      reveal: null,
      roundEndsAt: null,
      roundTimer: null,
    };
    room.players.set(hostId, {
      id: hostId,
      nickname: nickname.slice(0, 20) || 'Host',
      score: 0,
      isHost: true,
      connected: true,
      guess: null,
    });
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, playerId: string, nickname: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('Room not found');
    if (room.phase !== 'lobby') throw new Error('Game already started');
    if (room.players.size >= 8) throw new Error('Room is full');
    for (const p of room.players.values()) {
      if (p.nickname.toLowerCase() === nickname.trim().toLowerCase()) {
        throw new Error('Nickname taken');
      }
    }
    room.players.set(playerId, {
      id: playerId,
      nickname: nickname.slice(0, 20) || 'Player',
      score: 0,
      isHost: false,
      connected: true,
      guess: null,
    });
    return room;
  }

  leaveRoom(playerId: string): Room | null {
    const room = this.findRoomByPlayer(playerId);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;
    room.players.delete(playerId);
    if (room.players.size === 0) {
      this.clearTimer(room);
      this.rooms.delete(room.code);
      return null;
    }
    if (player.isHost) {
      const next = room.players.values().next().value as Player;
      next.isHost = true;
    }
    if (room.phase === 'guessing') {
      this.maybeFinishRound(room);
    }
    return room;
  }

  findRoomByPlayer(playerId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) return room;
    }
    return null;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  async startGame(room: Room, hostId: string): Promise<void> {
    const host = room.players.get(hostId);
    if (!host?.isHost) throw new Error('Only host can start');
    if (room.phase !== 'lobby') throw new Error('Already started');
    if (room.players.size < 1) throw new Error('Need at least 1 player');
    room.locations = await sampleLocations(ROUNDS_PER_GAME);
    room.roundIndex = 0;
    room.reveal = null;
    for (const p of room.players.values()) {
      p.score = 0;
      p.guess = null;
    }
    this.beginRound(room);
  }

  beginRound(room: Room): void {
    this.clearTimer(room);
    room.phase = 'guessing';
    room.reveal = null;
    for (const p of room.players.values()) p.guess = null;
    room.roundEndsAt = Date.now() + MULTI_ROUND_SECONDS * 1000;
    room.roundTimer = setTimeout(() => {
      this.finishRound(room);
      this.notify(room);
    }, MULTI_ROUND_SECONDS * 1000);
  }

  submitGuess(room: Room, playerId: string, guess: LatLng): void {
    if (room.phase !== 'guessing') throw new Error('Not guessing');
    const player = room.players.get(playerId);
    if (!player) throw new Error('Not in room');
    if (player.guess) throw new Error('Already guessed');
    player.guess = guess;
    this.maybeFinishRound(room);
  }

  maybeFinishRound(room: Room): void {
    if (room.phase !== 'guessing') return;
    const connected = [...room.players.values()].filter((p) => p.connected);
    if (connected.length === 0) return;
    if (connected.every((p) => p.guess)) {
      this.finishRound(room);
    }
  }

  finishRound(room: Room): void {
    if (room.phase !== 'guessing') return;
    this.clearTimer(room);
    const loc = room.locations[room.roundIndex];
    const answer = { lat: loc.lat, lng: loc.lng };
    const guesses: RoundReveal['guesses'] = [];
    for (const p of room.players.values()) {
      let distance: number | null = null;
      let score = 0;
      if (p.guess) {
        distance = distanceKm(p.guess, answer);
        score = scoreFromDistanceKm(distance);
        p.score += score;
      }
      guesses.push({
        playerId: p.id,
        nickname: p.nickname,
        guess: p.guess,
        distanceKm: distance,
        score,
      });
    }
    room.reveal = { answer, guesses };
    room.phase = 'reveal';
    room.roundEndsAt = null;
  }

  nextRound(room: Room, hostId: string): void {
    const host = room.players.get(hostId);
    if (!host?.isHost) throw new Error('Only host can continue');
    if (room.phase !== 'reveal') throw new Error('Not in reveal');
    if (room.roundIndex >= room.locations.length - 1) {
      room.phase = 'finished';
      room.reveal = null;
      return;
    }
    room.roundIndex += 1;
    this.beginRound(room);
  }

  clearTimer(room: Room): void {
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }
  }

  toPublic(room: Room): GameStatePublic {
    const loc = room.locations[room.roundIndex];
    const players: PlayerPublic[] = [...room.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      hasGuessed: !!p.guess,
      isHost: p.isHost,
      connected: p.connected,
    }));
    return {
      roomCode: room.code,
      phase: room.phase,
      players,
      round:
        room.phase === 'guessing' || room.phase === 'reveal'
          ? {
              index: room.roundIndex,
              total: room.locations.length,
              panoId: loc.panoId!,
            }
          : null,
      reveal: room.phase === 'reveal' ? room.reveal : null,
      roundEndsAt: room.roundEndsAt,
      totalRounds: ROUNDS_PER_GAME,
    };
  }
}

export const rooms = new RoomManager();
