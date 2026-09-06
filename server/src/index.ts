import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import type { LatLng } from '@geoguess/shared';
import { rooms } from './rooms.js';
import { advanceSolo, createSoloGame, getSoloGame, submitSoloGuess } from './solo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/solo', async (_req, res) => {
  try {
    res.json(await createSoloGame());
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
    const { lat, lng } = req.body as LatLng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Invalid guess' });
    }
    res.json(submitSoloGuess(req.params.id, { lat, lng }));
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
  socket.on('room:create', ({ nickname }, ack) => {
    try {
      const room = rooms.createRoom(socket.id, String(nickname || 'Host'));
      socket.join(room.code);
      const state = rooms.toPublic(room);
      ack?.({ ok: true, state });
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

  socket.on('guess:submit', ({ lat, lng }, ack) => {
    try {
      const room = rooms.findRoomByPlayer(socket.id);
      if (!room) throw new Error('Not in a room');
      rooms.submitGuess(room, socket.id, { lat, lng });
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
