import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8787);
const MAX_PLAYERS_PER_ROOM = Number(process.env.MAX_PLAYERS_PER_ROOM || 24);
const MAX_MESSAGE_BYTES = 260_000;
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
const clients = new Set();

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

function sanitizeText(value, max = 32) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
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
  const position = Array.isArray(value.position) ? value.position : [0, 0, 0];
  return {
    sceneId: SCENE_IDS.has(value.sceneId) ? value.sceneId : 'alley',
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
  return { id: player.id, avatar: player.avatar, state: player.state };
}

function frame(opcode, payload = Buffer.alloc(0)) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x80 | opcode, body.length]);
  } else if (body.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  return Buffer.concat([header, body]);
}

function send(client, payload) {
  if (client.closed || client.socket.destroyed) return false;
  try {
    client.socket.write(frame(0x1, JSON.stringify(payload)));
    return true;
  } catch {
    return false;
  }
}

function broadcast(roomId, payload, except = null) {
  const room = roomFor(roomId);
  if (!room) return;
  for (const player of room.values()) {
    if (player.client === except) continue;
    send(player.client, payload);
  }
}

function leave(client) {
  if (client.closed) return;
  client.closed = true;
  clients.delete(client);
  const player = client.player;
  if (!player) return;
  const room = roomFor(player.roomId);
  room?.delete(player.id);
  if (room?.size === 0) rooms.delete(player.roomId);
  broadcast(player.roomId, { type: 'player_left', id: player.id });
  client.player = null;
}

function join(client, message) {
  if (client.player) return;
  const roomId = ROOM_ID_PATTERN.test(message.room) ? message.room : 'breakglass-main';
  const room = roomFor(roomId, true);
  if (room.size >= MAX_PLAYERS_PER_ROOM) {
    send(client, { type: 'error', code: 'ROOM_FULL', message: 'That Breakglass room is full.' });
    client.socket.end(frame(0x8));
    return;
  }
  const player = {
    id: crypto.randomUUID(),
    roomId,
    client,
    avatar: sanitizeAvatar(message.avatar),
    state: sanitizeState(message.state),
    lastStateAt: 0,
  };
  client.player = player;
  room.set(player.id, player);
  send(client, {
    type: 'welcome',
    id: player.id,
    room: roomId,
    players: [...room.values()].filter((other) => other !== player).map(publicPlayer),
    serverTime: Date.now(),
  });
  broadcast(roomId, { type: 'player_joined', player: publicPlayer(player) }, client);
}

function handleMessage(client, message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'join') {
    join(client, message);
    return;
  }
  const player = client.player;
  if (!player) return;
  if (message.type === 'state') {
    const now = Date.now();
    if (now - player.lastStateAt < 35) return;
    player.lastStateAt = now;
    player.state = sanitizeState(message.state);
    broadcast(player.roomId, { type: 'state', id: player.id, state: player.state }, client);
    return;
  }
  if (message.type === 'emote') {
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
}

function consumeFrames(client) {
  let buffer = client.buffer;
  while (buffer.length >= 2) {
    const first = buffer[0];
    const second = buffer[1];
    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (buffer.length < 4) break;
      length = buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (buffer.length < 10) break;
      const big = buffer.readBigUInt64BE(2);
      if (big > BigInt(MAX_MESSAGE_BYTES)) {
        client.socket.destroy();
        return;
      }
      length = Number(big);
      offset = 10;
    }
    if (!masked || length > MAX_MESSAGE_BYTES) {
      client.socket.destroy();
      return;
    }
    if (buffer.length < offset + 4 + length) break;
    const mask = buffer.subarray(offset, offset + 4);
    const payload = Buffer.from(buffer.subarray(offset + 4, offset + 4 + length));
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
    buffer = buffer.subarray(offset + 4 + length);

    if (opcode === 0x8) {
      client.socket.end(frame(0x8));
      leave(client);
      return;
    }
    if (opcode === 0x9) {
      client.socket.write(frame(0x0a, payload));
      continue;
    }
    if (opcode !== 0x1 || !fin) continue;
    try {
      handleMessage(client, JSON.parse(payload.toString('utf8')));
    } catch {
      // Ignore malformed messages.
    }
  }
  client.buffer = buffer;
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

server.on('upgrade', (request, socket) => {
  const key = request.headers['sec-websocket-key'];
  const upgrade = String(request.headers.upgrade || '').toLowerCase();
  if (!key || upgrade !== 'websocket') {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n',
    ].join('\r\n'),
  );
  const client = { socket, buffer: Buffer.alloc(0), player: null, closed: false };
  clients.add(client);
  socket.on('data', (chunk) => {
    if (client.closed) return;
    client.buffer = Buffer.concat([client.buffer, chunk]);
    consumeFrames(client);
  });
  socket.on('close', () => leave(client));
  socket.on('end', () => leave(client));
  socket.on('error', () => leave(client));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Breakglass multiplayer listening on :${PORT}`);
});

function shutdown() {
  for (const client of clients) {
    try {
      client.socket.end(frame(0x8));
    } catch {
      client.socket.destroy();
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
