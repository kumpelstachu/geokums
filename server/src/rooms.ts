import {
  DUEL_MAX_ROUNDS,
  DUEL_START_HP,
  MULTI_ROUND_SECONDS,
  distanceKm,
  normalizeSettings,
  scoreCountryGuess,
  scoreFromDistanceKm,
  type GamePhase,
  type GameSettings,
  type GameStatePublic,
  type GuessPayload,
  type LatLng,
  type Location,
  type PlayerPublic,
  type RoundReveal,
  type ChatMessage,
} from '@geoguess/shared';
import { sampleLocations } from './data/locations.js';

export type Player = {
  id: string;
  nickname: string;
  score: number;
  hp: number;
  isHost: boolean;
  connected: boolean;
  guess: LatLng | null;
  countryGuess: string | null;
};

export type Room = {
  code: string;
  phase: GamePhase;
  settings: GameSettings;
  players: Map<string, Player>;
  locations: Location[];
  roundIndex: number;
  reveal: RoundReveal | null;
  roundEndsAt: number | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  chat: ChatMessage[];
};

const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += codeChars[Math.floor(Math.random() * codeChars.length)];
  }
  return code;
}

function isDuel(settings: GameSettings) {
  return settings.playMode === 'duels';
}

export class RoomManager {
  rooms = new Map<string, Room>();
  onChange: ((roomCode: string) => void) | null = null;

  private notify(room: Room) {
    this.onChange?.(room.code);
  }

  createRoom(hostId: string, nickname: string, settings?: Partial<GameSettings>): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const normalized = normalizeSettings(settings);
    const room: Room = {
      code,
      phase: 'lobby',
      settings: normalized,
      players: new Map(),
      locations: [],
      roundIndex: 0,
      reveal: null,
      roundEndsAt: null,
      roundTimer: null,
      chat: [],
    };
    room.players.set(hostId, {
      id: hostId,
      nickname: nickname.slice(0, 20) || 'Host',
      score: 0,
      hp: DUEL_START_HP,
      isHost: true,
      connected: true,
      guess: null,
      countryGuess: null,
    });
    this.rooms.set(code, room);
    return room;
  }

  updateSettings(room: Room, hostId: string, settings: Partial<GameSettings>): void {
    const host = room.players.get(hostId);
    if (!host?.isHost) throw new Error('Only host can change settings');
    if (room.phase !== 'lobby') throw new Error('Game already started');
    room.settings = normalizeSettings({ ...room.settings, ...settings });
  }

  joinRoom(code: string, playerId: string, nickname: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('Room not found');
    if (room.phase !== 'lobby') throw new Error('Game already started');
    const maxPlayers = isDuel(room.settings) ? 2 : 8;
    if (room.players.size >= maxPlayers) throw new Error('Room is full');
    for (const p of room.players.values()) {
      if (p.nickname.toLowerCase() === nickname.trim().toLowerCase()) {
        throw new Error('Nickname taken');
      }
    }
    room.players.set(playerId, {
      id: playerId,
      nickname: nickname.slice(0, 20) || 'Player',
      score: 0,
      hp: DUEL_START_HP,
      isHost: false,
      connected: true,
      guess: null,
      countryGuess: null,
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
    if (room.phase !== 'lobby' && room.phase !== 'finished') {
      throw new Error('Already started');
    }
    if (isDuel(room.settings) && room.players.size !== 2) {
      throw new Error('Duels need exactly 2 players');
    }
    if (room.players.size < 1) throw new Error('Need at least 1 player');

    this.clearTimer(room);
    const rounds = isDuel(room.settings)
      ? DUEL_MAX_ROUNDS
      : room.settings.rounds;

    room.locations = await sampleLocations(rounds, room.settings.mapPack);
    room.roundIndex = 0;
    room.reveal = null;
    for (const p of room.players.values()) {
      p.score = 0;
      p.hp = DUEL_START_HP;
      p.guess = null;
      p.countryGuess = null;
    }
    this.beginRound(room);
  }

  /** Host starts another match with the same settings / players. */
  async rematch(room: Room, hostId: string): Promise<void> {
    if (room.phase !== 'finished') throw new Error('Game is not finished');
    await this.startGame(room, hostId);
  }

  /** Host returns everyone to lobby to change settings. */
  returnToLobby(room: Room, hostId: string): void {
    const host = room.players.get(hostId);
    if (!host?.isHost) throw new Error('Only host can return to lobby');
    if (room.phase !== 'finished' && room.phase !== 'reveal' && room.phase !== 'guessing') {
      throw new Error('Already in lobby');
    }
    this.clearTimer(room);
    room.phase = 'lobby';
    room.locations = [];
    room.roundIndex = 0;
    room.reveal = null;
    room.roundEndsAt = null;
    for (const p of room.players.values()) {
      p.score = 0;
      p.hp = DUEL_START_HP;
      p.guess = null;
      p.countryGuess = null;
    }
  }

  addChat(room: Room, playerId: string, text: string): ChatMessage {
    const player = room.players.get(playerId);
    if (!player) throw new Error('Not in room');
    const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!cleaned) throw new Error('Empty message');
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2, 10),
      playerId,
      nickname: player.nickname,
      text: cleaned,
      at: Date.now(),
    };
    room.chat.push(msg);
    if (room.chat.length > 50) room.chat.splice(0, room.chat.length - 50);
    return msg;
  }

  beginRound(room: Room): void {
    this.clearTimer(room);
    room.phase = 'guessing';
    room.reveal = null;
    for (const p of room.players.values()) {
      p.guess = null;
      p.countryGuess = null;
    }
    room.roundEndsAt = Date.now() + MULTI_ROUND_SECONDS * 1000;
    room.roundTimer = setTimeout(() => {
      this.finishRound(room);
      this.notify(room);
    }, MULTI_ROUND_SECONDS * 1000);
  }

  submitGuess(room: Room, playerId: string, payload: GuessPayload): void {
    if (room.phase !== 'guessing') throw new Error('Not guessing');
    const player = room.players.get(playerId);
    if (!player) throw new Error('Not in room');
    if (player.guess || player.countryGuess) throw new Error('Already guessed');

    if (room.settings.playMode === 'country') {
      if (payload.type !== 'country' || !payload.country.trim()) {
        throw new Error('Pick a country');
      }
      player.countryGuess = payload.country.trim();
    } else {
      if (payload.type !== 'pin') throw new Error('Place a pin');
      player.guess = { lat: payload.lat, lng: payload.lng };
    }
    this.maybeFinishRound(room);
  }

  maybeFinishRound(room: Room): void {
    if (room.phase !== 'guessing') return;
    const connected = [...room.players.values()].filter((p) => p.connected);
    if (connected.length === 0) return;
    const done = connected.every((p) =>
      room.settings.playMode === 'country' ? !!p.countryGuess : !!p.guess,
    );
    if (done) this.finishRound(room);
  }

  finishRound(room: Room): void {
    if (room.phase !== 'guessing') return;
    this.clearTimer(room);
    const loc = room.locations[room.roundIndex];
    const answer = { lat: loc.lat, lng: loc.lng };
    const answerCountry = loc.country || null;

    const scored: Array<{ player: Player; score: number; distanceKm: number | null }> = [];
    for (const p of room.players.values()) {
      let score = 0;
      let distance: number | null = null;
      if (room.settings.playMode === 'country') {
        score = p.countryGuess ? scoreCountryGuess(p.countryGuess, answerCountry) : 0;
      } else if (p.guess) {
        distance = distanceKm(p.guess, answer);
        score = scoreFromDistanceKm(distance);
      }
      p.score += score;
      scored.push({ player: p, score, distanceKm: distance });
    }

    // Duel damage: lower score takes |diff| damage
    const damageById = new Map<string, number>();
    if (isDuel(room.settings) && scored.length === 2) {
      const [a, b] = scored;
      const diff = Math.abs(a.score - b.score);
      if (a.score < b.score) {
        a.player.hp = Math.max(0, a.player.hp - diff);
        damageById.set(a.player.id, diff);
        damageById.set(b.player.id, 0);
      } else if (b.score < a.score) {
        b.player.hp = Math.max(0, b.player.hp - diff);
        damageById.set(b.player.id, diff);
        damageById.set(a.player.id, 0);
      } else {
        damageById.set(a.player.id, 0);
        damageById.set(b.player.id, 0);
      }
    }

    room.reveal = {
      answer,
      answerCountry,
      guesses: scored.map(({ player: p, score, distanceKm: distance }) => ({
        playerId: p.id,
        nickname: p.nickname,
        guess: p.guess,
        countryGuess: p.countryGuess,
        distanceKm: distance,
        score,
        damageTaken: damageById.get(p.id) || 0,
      })),
    };
    room.phase = 'reveal';
    room.roundEndsAt = null;
  }

  nextRound(room: Room, hostId: string): void {
    const host = room.players.get(hostId);
    if (!host?.isHost) throw new Error('Only host can continue');
    if (room.phase !== 'reveal') throw new Error('Not in reveal');

    if (isDuel(room.settings)) {
      const dead = [...room.players.values()].some((p) => p.hp <= 0);
      const lastRound = room.roundIndex >= room.locations.length - 1;
      if (dead || lastRound) {
        room.phase = 'finished';
        room.reveal = null;
        return;
      }
    } else if (room.roundIndex >= room.locations.length - 1) {
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
      hp: p.hp,
      hasGuessed:
        room.settings.playMode === 'country' ? !!p.countryGuess : !!p.guess,
      isHost: p.isHost,
      connected: p.connected,
    }));
    return {
      roomCode: room.code,
      phase: room.phase,
      settings: room.settings,
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
      totalRounds: room.locations.length || room.settings.rounds,
      isDuel: isDuel(room.settings),
      chat: room.chat.slice(-40),
    };
  }
}

export const rooms = new RoomManager();
