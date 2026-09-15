import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const MAX_PLAYERS_PER_ROOM = Number(process.env.MAX_PLAYERS_PER_ROOM || 24);
const MAX_MESSAGE_BYTES = 260_000;
const HEARTBEAT_MS = 20_000;
const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9-_]{0,47}$/i;
const SCENE_IDS = new Set(['alley', 'downstairs', 'upstairs', 'roof']);
const ROLES = new Set([
  'dj',
  'producer',
  'dancer',
  'musician',
  'promoter',
  'vj',
  'photographer',
  'explorer',
]);

const rooms = new Map();

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

function sanitizeText(value, max = 32) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function sanitizeAvatar(value = {}) {
  const faceTexture =
    value.shareFaceMultiplayer === true &&
    typeof value.faceTexture === 'string' &&
    value.faceTexture.length <= 180_000 &&
    /^data:image\/(?:png|webp|jpeg);base64,/i.test(value.faceTexture)
      ? value.faceTexture
      : null;
  return {
    displayName: sanitizeText(value.displayName || 'Guest', 24) || 'Guest',
    identity: sanitizeText(value.identity, 20) || 'neutral',
    body: ['slim', 'regular', 'broad'].includes(value.body) ? value.body : 'regular',
    hair: ['buzz', 'short', 'bob', 'long', 'bald'].includes(value.hair) ? value.hair : 'short',
    outfit: ['black', 'club', 'studio', 'bright', 'sport'].includes(value.outfit)
      ? value.outfit
      : 'black',
    role: ROLES.has(value.role) ? value.role : 'explorer',
    skinTone: ['light', 'warm', 'tan', 'brown', 'deep'].includes(value.skinTone)
      ? value.skinTone
      : 'warm',
    photoConsent: value.photoConsent !== false,
    faceTexture,
    shareFaceMultiplayer: value.shareFaceMultiplayer === true && !!faceTexture,
  };
}

function sanitizeState(value = {}) {
  const sceneId = SCENE_IDS.has(value.sceneId) ? value.sceneId : 'alley';
  const position = Array.isArray(value.position) ? value.position : [0, 0, 0];
  return {
    sceneId,
    position: [
      clamp(position[0], -120, 120),
      clamp(position[1], -20, 80),
      clamp(position[2], -120, 120),
    ],
    rotationY: finite(value.rotationY),
    moving: value.moving === true,
    dancing: value.dancing === true,
    seated: value.seated === true,
    grounded: value.grounded !== false,
    sentAt: Date.now(),
  };
}

function roomFor(id, create = false) {
  if (!rooms.has(id) && create) rooms.set(id, new Map());
  return rooms.get(id) ?? null;
}

function publicPlayer(player) {
  return {
    id: player.id,
    avatar: player.avatar,
    state: player.state,
  };
}

function send(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function broadcast(roomId, payload, except = null) {
  const room = roomFor(roomId);
  if (!room) return;
  for (const player of room.values()) {
    if (player.socket === except) continue;
    send(player.socket, payload);
  }
}

function leave(socket) {
  const player = socket.player;
  if (!player) return;
  const room = roomFor(player.roomId);
  room?.delete(player.id);
  if (room?.size === 0) rooms.delete(player.roomId);
  broadcast(player.roomId, { type: 'player_left', id: player.id });
  socket.player = null;
}

function join(socket, message) {
  if (socket.player) return;
  const roomId = ROOM_ID_PATTERN.test(message.room) ? message.room : 'breakglass-main';
  const room = roomFor(roomId, true);
  if (room.size >= MAX_PLAYERS_PER_ROOM) {
    send(socket, { type: 'error', code: 'ROOM_FULL', message: 'That Breakglass room is full.' });
    socket.close(1013, 'room full');
    return;
  }

  const player = {
    id: crypto.randomUUID(),
    roomId,
    socket,
    avatar: sanitizeAvatar(message.avatar),
    state: sanitizeState(message.state),
    lastStateAt: 0,
    lastMessageAt: Date.now(),
  };
  socket.player = player;
  room.set(player.id, player);

  send(socket, {
    type: 'welcome',
    id: player.id,
    room: roomId,
    players: [...room.values()].filter((other) => other !== player).map(publicPlayer),
    serverTime: Date.now(),
  });
  broadcast(roomId, { type: 'player_joined', player: publicPlayer(player) }, socket);
}

function updateState(socket, message) {
  const player = socket.player;
  if (!player) return;
  const now = Date.now();
  if (now - player.lastStateAt < 35) return;
  player.lastStateAt = now;
  player.state = sanitizeState(message.state);
  broadcast(
    player.roomId,
    {
      type: 'state',
      id: player.id,
      state: player.state,
    },
    socket,
  );
}

function emote(socket, message) {
  const player = socket.player;
  if (!player) return;
  const kind = ['wave', 'dance', 'highfive'].includes(message.kind) ? message.kind : null;
  if (!kind) return;
  const room = roomFor(player.roomId);
  const targetId =
    typeof message.targetId === 'string' && room?.has(message.targetId) ? message.targetId : null;
  broadcast(player.roomId, {
    type: 'emote',
    fromId: player.id,
    targetId,
    kind,
    at: Date.now(),
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    const players = [...rooms.values()].reduce((total, room) => total + room.size, 0);
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size, players }));
    return;
  }
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Breakglass: After Hours multiplayer server\n');
});

const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.player = null;
  socket.on('pong', () => {
    socket.isAlive = true;
  });
  socket.on('message', (buffer) => {
    if (buffer.length > MAX_MESSAGE_BYTES) {
      socket.close(1009, 'message too large');
      return;
    }
    let message;
    try {
      message = JSON.parse(buffer.toString('utf8'));
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;
    if (socket.player) socket.player.lastMessageAt = Date.now();
    if (message.type === 'join') join(socket, message);
    else if (message.type === 'state') updateState(socket, message);
    else if (message.type === 'emote') emote(socket, message);
  });
  socket.on('close', () => leave(socket));
  socket.on('error', () => leave(socket));
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, HEARTBEAT_MS);
heartbeat.unref?.();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Breakglass multiplayer listening on :${PORT}`);
});

function shutdown() {
  clearInterval(heartbeat);
  for (const socket of wss.clients) socket.close(1001, 'server restart');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
