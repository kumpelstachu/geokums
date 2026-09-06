import { io, Socket } from 'socket.io-client';
import type { ChatMessage, GameSettings, GameStatePublic, GuessPayload } from '@geoguess/shared';

type Ack = { ok: true; state?: GameStatePublic } | { ok: false; error: string };

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function createRoom(
  nickname: string,
  settings: GameSettings,
): Promise<GameStatePublic> {
  return new Promise((resolve, reject) => {
    getSocket().emit('room:create', { nickname, settings }, (ack: Ack) => {
      if (!ack?.ok) reject(new Error(ack?.error || 'Failed'));
      else resolve(ack.state!);
    });
  });
}

export function updateRoomSettings(settings: Partial<GameSettings>): Promise<void> {
  return new Promise((resolve, reject) => {
    getSocket().emit('room:settings', settings, (ack: Ack) => {
      if (!ack?.ok) reject(new Error(ack?.error || 'Failed'));
      else resolve();
    });
  });
}

export function joinRoom(code: string, nickname: string): Promise<GameStatePublic> {
  return new Promise((resolve, reject) => {
    getSocket().emit('room:join', { code, nickname }, (ack: Ack) => {
      if (!ack?.ok) reject(new Error(ack?.error || 'Failed'));
      else resolve(ack.state!);
    });
  });
}

export function startGame(): Promise<void> {
  return new Promise((resolve, reject) => {
    getSocket().emit('game:start', (ack: Ack) => {
      if (!ack?.ok) reject(new Error(ack?.error || 'Failed'));
      else resolve();
    });
  });
}

export function rematch(): Promise<void> {
  return new Promise((resolve, reject) => {
    getSocket().emit('game:rematch', (ack: Ack) => {
      if (!ack?.ok) reject(new Error(ack?.error || 'Failed'));
      else resolve();
    });
  });
}

export function returnToLobby(): Promise<void> {
  return new Promise((resolve, reject) => {
    getSocket().emit('game:lobby', (ack: Ack) => {
      if (!ack?.ok) reject(new Error(ack?.error || 'Failed'));
      else resolve();
    });
  });
}

export function submitGuess(guess: GuessPayload): Promise<void> {
  return new Promise((resolve, reject) => {
    getSocket().emit('guess:submit', guess, (ack: Ack) => {
      if (!ack?.ok) reject(new Error(ack?.error || 'Failed'));
      else resolve();
    });
  });
}

export function nextRound(): Promise<void> {
  return new Promise((resolve, reject) => {
    getSocket().emit('game:next', (ack: Ack) => {
      if (!ack?.ok) reject(new Error(ack?.error || 'Failed'));
      else resolve();
    });
  });
}

export function sendChat(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getSocket().emit('chat:send', { text }, (ack: Ack) => {
      if (!ack?.ok) reject(new Error(ack?.error || 'Failed'));
      else resolve();
    });
  });
}

export function leaveRoom(): void {
  getSocket().emit('room:leave');
}

export function onGameState(handler: (state: GameStatePublic) => void): () => void {
  const s = getSocket();
  s.on('game:state', handler);
  return () => {
    s.off('game:state', handler);
  };
}

export function onChatMessage(handler: (msg: ChatMessage) => void): () => void {
  const s = getSocket();
  s.on('chat:message', handler);
  return () => {
    s.off('chat:message', handler);
  };
}
