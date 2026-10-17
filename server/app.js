import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Server } from 'socket.io';
import { z } from 'zod';
import {
  GameError, createRoom, joinRoom, startRound, playTurn, expireTurn, showHand, abortMatch, roomView,
} from './game.js';

const guestSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(24, 'Use 24 characters or fewer.'),
});
const codeSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/) });
const createSchema = z.object({
  name: z.string().trim().min(2).max(36),
  capacity: z.number().int().min(3).max(10),
  pointsToEliminate: z.union([z.literal(101), z.literal(201), z.literal(401), z.literal(1001)]).default(201),
  rules: z.object({
    sameNumber: z.boolean(), rummy: z.boolean(), anyCard: z.boolean(), continuation: z.boolean(),
  }).refine((rules) => Object.values(rules).some(Boolean), 'Enable at least one rule.'),
});
const playSchema = z.object({
  revision: z.number().int().nonnegative(),
  cardIds: z.array(z.string().max(40)).max(54),
  drawSource: z.enum(['drawPile', 'discard']).default('drawPile'),
  discardCardId: z.string().min(1).max(40).optional(),
});
const revisionSchema = z.object({ revision: z.number().int().nonnegative() });
const chatSchema = z.object({ text: z.string().trim().min(1).max(280) });
const bearer = (request) => request.headers.authorization?.startsWith('Bearer ')
  ? request.headers.authorization.slice(7) : '';
const TURN_MS = 30_000;
const ROUND_BREAK_MS = 15_000;

export function createApp({ store, clientOrigin = 'http://localhost:5173', production = false, trustProxy = false }) {
  const app = express();
  if (trustProxy) app.set('trust proxy', 1);
  const allowedOrigins = clientOrigin.split(',').map((origin) => origin.trim());
  const corsOptions = { origin: allowedOrigins };
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '16kb' }));
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many new player sessions. Please wait 15 minutes.' } });
  app.get('/api/health', (_request, response) => response.json({
    ok: true, storage: store.persistent ? 'postgresql' : 'memory', activeMatches: 'in-memory',
  }));
  app.post('/api/guest', authLimiter, async (request, response) => {
    const parsed = guestSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0].message });
    const user = await store.createPlayer(parsed.data.name);
    const token = await store.session(user);
    response.status(201).json({ user, token });
  });
  const requireUser = async (request, response, next) => {
    const user = await store.authenticate(bearer(request));
    if (!user) return response.status(401).json({ error: 'Your session ended. Enter your name to play again.' });
    request.user = user;
    next();
  };
  app.get('/api/me', requireUser, (request, response) => response.json({ user: request.user }));
  app.get('/api/leaderboard', requireUser, async (_request, response) => response.json(await store.leaderboard()));
  app.get('/api/history', requireUser, async (request, response) => response.json(await store.history(request.user.id)));

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: corsOptions, maxHttpBufferSize: 16_384,
    allowRequest: (request, callback) => callback(null, !request.headers.origin || allowedOrigins.includes(request.headers.origin)),
  });
  const rooms = new Map();
  const locks = new Set();
  const connections = new Map();
  const connectedIds = () => new Set([...io.sockets.sockets.values()]
    .filter((socket) => socket.data.code).map((socket) => socket.data.user.id));
  const findRoom = (userId) => [...rooms.values()].find((room) => room.players.some((player) => player.id === userId));
  const lobbyView = () => [...rooms.values()].map((room) => ({
    code: room.code, name: room.name, capacity: room.capacity, count: room.players.length,
    status: room.status, host: room.players.find((p) => p.id === room.hostId)?.name,
    rules: room.rules,
  }));
  const broadcastLobby = () => io.emit('lobby', lobbyView());
  const broadcastRoom = (room) => {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.code === room.code) {
        socket.emit('room', {
          ...roomView(room, socket.data.user.id, connectedIds()),
          turnDeadline: room.turnDeadline,
        });
      }
    }
  };
  const tickTurn = (room) => {
    room.turnDeadline = room.status === 'playing' ? Date.now() + TURN_MS : null;
  };
  const changeRoom = async (room, change, { resetTurn = true } = {}) => {
    if (locks.has(room.code)) throw new GameError('The table is updating. Please try again.');
    locks.add(room.code);
    try {
      const next = structuredClone(room);
      change(next);
      next.revision++;
      next.updatedAt = Date.now();
      if (resetTurn) tickTurn(next);
      if (next.status !== 'roundEnd') next.nextRoundDeadline = null;
      else if (room.status !== 'roundEnd') next.nextRoundDeadline = Date.now() + ROUND_BREAK_MS;
      // Persist completed matches before announcing a successful result.
      if (next.status === 'finished' && room.status !== 'finished') await store.saveMatch(next);
      rooms.set(next.code, next);
      broadcastRoom(next);
      broadcastLobby();
      return next;
    } finally {
      locks.delete(room.code);
    }
  };
  app.post('/api/logout', requireUser, async (request, response) => {
    await store.logout(bearer(request));
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.token === bearer(request)) socket.disconnect(true);
    }
    response.json({ ok: true });
  });

  io.use(async (socket, next) => {
    try {
      const user = await store.authenticate(socket.handshake.auth?.token);
      if (!user) {
        const error = new Error('Your session expired. Enter your name to play again.');
        error.data = { code: 'AUTH_REQUIRED' };
        return next(error);
      }
      if ((connections.get(user.id) || 0) >= 5) return next(new Error('Too many open connections. Close another tab.'));
      socket.data.user = user;
      socket.data.token = socket.handshake.auth.token;
      connections.set(user.id, (connections.get(user.id) || 0) + 1);
      next();
    } catch (error) {
      console.error('Socket authentication failed:', error);
      next(new Error('Unable to connect. Please try again.'));
    }
  });
  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.emit('lobby', lobbyView());
    const existing = findRoom(user.id);
    if (existing) {
      socket.data.code = existing.code;
      broadcastRoom(existing);
    }
    let windowStart = Date.now();
    let actions = 0;
    let lastChat = 0;
    const handle = (event, schema, action) => socket.on(event, async (payload, ack) => {
      if (typeof ack !== 'function') return;
      try {
        if (Date.now() - windowStart > 10_000) { windowStart = Date.now(); actions = 0; }
        if (++actions > 40) throw new GameError('Slow down a little and try again.');
        if (!await store.authenticate(socket.data.token)) {
          ack({ ok: false, code: 'AUTH_REQUIRED', error: 'Your session expired. Enter your name to play again.' });
          socket.disconnect(true);
          return;
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) throw new GameError(parsed.error.issues[0].message);
        await action(parsed.data);
        ack({ ok: true });
      } catch (error) {
        if (!(error instanceof GameError)) console.error(`Socket ${event} failed:`, error);
        ack({ ok: false, code: error instanceof GameError ? 'INVALID_ACTION' : 'SERVER_ERROR',
          error: error instanceof GameError ? error.message : 'The server could not save this action. Please retry.' });
      }
    });
    const currentRoom = () => {
      const room = rooms.get(socket.data.code);
      if (!room || !room.players.some((p) => p.id === user.id)) throw new GameError('Join a table first.');
      return room;
    };
    const requireRevision = (revision) => {
      const room = currentRoom();
      if (room.revision !== revision) throw new GameError('The table changed. Review the latest cards and try again.');
      return room;
    };
    handle('room:create', createSchema, async (options) => {
      if (findRoom(user.id)) throw new GameError('Leave your current table before creating another.');
      if (rooms.size >= 100) throw new GameError('All tables are currently occupied. Please try later.');
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code;
      do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(code));
      const room = createRoom(code, user, options);
      rooms.set(code, room);
      for (const peer of io.sockets.sockets.values()) {
        if (peer.data.user.id === user.id) peer.data.code = code;
      }
      broadcastRoom(room);
      broadcastLobby();
    });
    handle('room:join', codeSchema, async ({ code }) => {
      const existingRoom = findRoom(user.id);
      if (existingRoom && existingRoom.code !== code) throw new GameError('Leave your current table first.');
      const room = rooms.get(code);
      if (!room) throw new GameError('Table not found. Check the six-character code.');
      await changeRoom(room, (next) => joinRoom(next, user), { resetTurn: false });
      for (const peer of io.sockets.sockets.values()) {
        if (peer.data.user.id === user.id) peer.data.code = code;
      }
      broadcastRoom(rooms.get(code));
    });
    handle('room:leave', z.object({}), async () => {
      const room = currentRoom();
      if (!['waiting', 'finished', 'aborted'].includes(room.status)) throw new GameError('You cannot leave an active match. Your seat is kept for reconnecting.');
      if (room.players.length === 1) rooms.delete(room.code);
      else await changeRoom(room, (next) => {
        next.players = next.players.filter((p) => p.id !== user.id);
        if (next.hostId === user.id) next.hostId = next.players[0].id;
      }, { resetTurn: false });
      for (const peer of io.sockets.sockets.values()) {
        if (peer.data.user.id === user.id) {
          peer.data.code = null;
          peer.emit('room', null);
        }
      }
      broadcastLobby();
    });
    handle('game:abort', revisionSchema, async ({ revision }) => {
      await changeRoom(requireRevision(revision), (room) => abortMatch(room, user.id));
    });
    handle('game:start', revisionSchema, async ({ revision }) => {
      const room = requireRevision(revision);
      if (room.status === 'roundEnd') throw new GameError('The next round starts automatically after the 15-second break.');
      await changeRoom(room, (next) => startRound(next, user.id));
    });
    handle('game:play', playSchema, async ({ revision, cardIds, drawSource, discardCardId }) => {
      await changeRoom(requireRevision(revision), (room) => playTurn(room, user.id, cardIds, drawSource, discardCardId));
    });
    handle('game:show', revisionSchema, async ({ revision }) => {
      await changeRoom(requireRevision(revision), (room) => showHand(room, user.id));
    });
    handle('game:finish', revisionSchema, async () => {
      throw new GameError('Finishing at current scores is no longer available. Rounds continue automatically until the match ends.');
    });
    handle('chat:send', chatSchema, async ({ text }) => {
      if (Date.now() - lastChat < 800) throw new GameError('Please wait a moment before sending another message.');
      await changeRoom(currentRoom(), (room) => {
        room.chat.push({ id: randomUUID(), userId: user.id, name: user.name, text, at: Date.now() });
        room.chat = room.chat.slice(-100);
      }, { resetTurn: false });
      lastChat = Date.now();
    });
    socket.on('disconnect', () => {
      const count = (connections.get(user.id) || 1) - 1;
      if (count) connections.set(user.id, count);
      else connections.delete(user.id);
      const room = rooms.get(socket.data.code);
      if (room) broadcastRoom(room);
    });
  });
  const timer = setInterval(() => {
    const online = connectedIds();
    for (const room of rooms.values()) {
      const anyoneOnline = room.players.some((p) => online.has(p.id));
      if (!anyoneOnline && Date.now() - room.updatedAt > 30 * 60_000 && !locks.has(room.code)) {
        rooms.delete(room.code);
        broadcastLobby();
        continue;
      }
      if (anyoneOnline && room.status === 'playing' && room.turnDeadline <= Date.now() && !locks.has(room.code)) {
        changeRoom(room, (next) => {
          expireTurn(next);
        }).catch((error) => {
          console.error('Automatic turn failed:', error);
          io.emit('server:error', { error: 'A timed turn could not complete. Please retry your turn.' });
        });
      }
      if (anyoneOnline && room.status === 'roundEnd' && Number.isFinite(room.nextRoundDeadline)
        && room.nextRoundDeadline <= Date.now() && !locks.has(room.code)) {
        changeRoom(room, (next) => startRound(next, next.hostId)).catch((error) => {
          console.error('Automatic round failed:', error);
          io.emit('server:error', { error: 'The next round could not start. The server will retry automatically.' });
        });
      }
    }
  }, 1000);
  timer.unref();
  const dist = fileURLToPath(new URL('../dist', import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (request, response, next) => {
      if (request.path.startsWith('/api/')) return next();
      response.sendFile(join(dist, 'index.html'));
    });
  } else if (production) {
    console.warn('No frontend build found. The API is running; host the frontend separately or run npm run build.');
  }
  app.use((_request, response) => response.status(404).json({ error: 'Not found.' }));
  app.use((error, _request, response, _next) => {
    console.error('Request failed:', error);
    response.status(error.status === 400 ? 400 : 500).json({
      error: error.status === 400 ? 'Invalid JSON request.' : 'The server could not complete the request.',
    });
  });
  return {
    app, httpServer, io, rooms,
    async close() {
      clearInterval(timer);
      await new Promise((resolve) => io.close(resolve));
      await store.close();
    },
  };
}
