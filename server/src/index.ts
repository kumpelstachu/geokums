import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import type { GameSettings, GuessPayload } from '@geoguess/shared';
import { rooms } from './rooms.js';
import { advanceSolo, createSoloGame, getSoloGame, submitSoloGuess } from './solo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    sourceCommit: process.env.SOURCE_COMMIT || null,
  });
});

app.post('/api/solo', async (req, res) => {
  try {
    const settings = (req.body?.settings || req.body) as Partial<GameSettings> | undefined;
    res.json(await createSoloGame(settings));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/solo/:id', (req, res) => {
  const game = getSoloGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  res.json(game);
});

app.post('/api/solo/:id/guess', (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    let payload: GuessPayload;
    if (body.type === 'country' || typeof body.country === 'string') {
      payload = { type: 'country', country: String(body.country || '') };
    } else if (
      body.type === 'pin' ||
      (typeof body.lat === 'number' && typeof body.lng === 'number')
    ) {
      payload = { type: 'pin', lat: Number(body.lat), lng: Number(body.lng) };
    } else {
      return res.status(400).json({ error: 'Invalid guess' });
    }
    res.json(submitSoloGuess(req.params.id, payload));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/solo/:id/next', (req, res) => {
  try {
    res.json(advanceSolo(req.params.id));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

function emitState(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit('game:state', rooms.toPublic(room));
}

rooms.onChange = emitState;

io.on('connection', (socket) => {
  socket.on('room:create', ({ nickname, settings }, ack) => {
    try {
      const room = rooms.createRoom(socket.id, String(nickname || 'Host'), settings);
      socket.join(room.code);
      const state = rooms.toPublic(room);
      ack?.({ ok: true, state });
      emitState(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('room:settings', (settings, ack) => {
    try {
      const room = rooms.findRoomByPlayer(socket.id);
      if (!room) throw new Error('Not in a room');
      rooms.updateSettings(room, socket.id, settings || {});
      ack?.({ ok: true });
      emitState(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('room:join', ({ code, nickname }, ack) => {
    try {
      const room = rooms.joinRoom(String(code || ''), socket.id, String(nickname || 'Player'));
      socket.join(room.code);
      const state = rooms.toPublic(room);
      ack?.({ ok: true, state });
      emitState(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:start', async (ack) => {
    try {
      const room = rooms.findRoomByPlayer(socket.id);
      if (!room) throw new Error('Not in a room');
      await rooms.startGame(room, socket.id);
      ack?.({ ok: true });
      emitState(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('guess:submit', (payload, ack) => {
    try {
      const room = rooms.findRoomByPlayer(socket.id);
      if (!room) throw new Error('Not in a room');
      const body = (payload || {}) as Record<string, unknown>;
      let guess: GuessPayload;
      if (body.type === 'country' || typeof body.country === 'string') {
        guess = { type: 'country', country: String(body.country || '') };
      } else {
        guess = { type: 'pin', lat: Number(body.lat), lng: Number(body.lng) };
      }
      rooms.submitGuess(room, socket.id, guess);
      ack?.({ ok: true });
      emitState(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:next', (ack) => {
    try {
      const room = rooms.findRoomByPlayer(socket.id);
      if (!room) throw new Error('Not in a room');
      rooms.nextRound(room, socket.id);
      ack?.({ ok: true });
      emitState(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:rematch', async (ack) => {
    try {
      const room = rooms.findRoomByPlayer(socket.id);
      if (!room) throw new Error('Not in a room');
      await rooms.rematch(room, socket.id);
      ack?.({ ok: true });
      emitState(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:lobby', (ack) => {
    try {
      const room = rooms.findRoomByPlayer(socket.id);
      if (!room) throw new Error('Not in a room');
      rooms.returnToLobby(room, socket.id);
      ack?.({ ok: true });
      emitState(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('chat:send', ({ text }, ack) => {
    try {
      const room = rooms.findRoomByPlayer(socket.id);
      if (!room) throw new Error('Not in a room');
      const msg = rooms.addChat(room, socket.id, String(text || ''));
      io.to(room.code).emit('chat:message', msg);
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('room:leave', () => {
    const room = rooms.leaveRoom(socket.id);
    if (room) emitState(room.code);
  });

  socket.on('disconnect', () => {
    const room = rooms.findRoomByPlayer(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) player.connected = false;
    if (room.phase === 'lobby') {
      const left = rooms.leaveRoom(socket.id);
      if (left) emitState(left.code);
    } else {
      rooms.maybeFinishRound(room);
      emitState(room.code);
    }
  });
});

const clientDist = join(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api(?:\/|$)|\/socket\.io(?:\/|$)).*/, (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

httpServer.listen(PORT, () => {
  console.log(`GeoGuess server on http://localhost:${PORT}`);
});
