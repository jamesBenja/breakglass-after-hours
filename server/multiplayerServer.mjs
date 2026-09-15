import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const MAX_PLAYERS_PER_ROOM = Number(process.env.MAX_PLAYERS_PER_ROOM || 24);
const MAX_MESSAGE_BYTES = 280_000;
const HEARTBEAT_MS = 20_000;
const WORLD_TICK_MS = 250;
const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9-_]{0,47}$/i;
const RESOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,95}$/i;
const OBJECT_ID_PATTERN = RESOURCE_ID_PATTERN;
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
const POLICE_MODES = {
  relaxed: { complaintThreshold: 0.84, complaintSeconds: 32, responseSeconds: 52 },
  normal: { complaintThreshold: 0.78, complaintSeconds: 22, responseSeconds: 40 },
  strict: { complaintThreshold: 0.7, complaintSeconds: 12, responseSeconds: 28 },
};

const rooms = new Map();

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
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

function defaultPartyState() {
  return {
    policeStrictness: 'normal',
    occupancy: 3,
    conversationLevel: 0.16,
    rowdyLevel: 0.08,
    disturbance: 0.18,
    spillOutPressure: 0.08,
    clubAttendance: 72,
    clubCapacity: 110,
    clubDanceShare: 0.68,
    clubMixQuality: 0.76,
    highNoiseTime: 0,
    staffWarningLevel: 0,
    policePresent: false,
    policeVisits: 0,
    policeResponseTime: 0,
    policeCooldown: 0,
    evacuationRequired: false,
    evacuationStarted: false,
    lastPoliceOutcome: null,
    revision: 0,
    updatedAt: Date.now(),
  };
}

function createRoom(id) {
  return {
    id,
    players: new Map(),
    resources: new Map(),
    objects: new Map(),
    chat: [],
    dj: null,
    lighting: null,
    party: defaultPartyState(),
    lastPartyBroadcastAt: 0,
  };
}

function roomFor(id, create = false) {
  if (!rooms.has(id) && create) rooms.set(id, createRoom(id));
  return rooms.get(id) ?? null;
}

function publicPlayer(player) {
  return {
    id: player.id,
    avatar: player.avatar,
    state: player.state,
    media: player.media,
  };
}

function publicResource(resource) {
  return {
    id: resource.id,
    ownerId: resource.ownerId,
    ownerName: resource.ownerName,
    sceneId: resource.sceneId,
    claimedAt: resource.claimedAt,
  };
}

function publicWorld(room) {
  return {
    resources: [...room.resources.values()].map(publicResource),
    objects: Object.fromEntries([...room.objects.entries()].map(([id, entry]) => [id, entry.data])),
    dj: room.dj,
    lighting: room.lighting,
    party: room.party,
    chat: room.chat,
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
  for (const player of room.players.values()) {
    if (player.socket === except) continue;
    send(player.socket, payload);
  }
}

function sanitizeJson(value, depth = 0) {
  if (depth > 4) return null;
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return sanitizeText(value, 500);
  if (Array.isArray(value)) return value.slice(0, 64).map((item) => sanitizeJson(item, depth + 1));
  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 64)) {
      const safeKey = sanitizeText(key, 64).replace(/[^a-z0-9_.:-]/gi, '');
      if (safeKey) output[safeKey] = sanitizeJson(item, depth + 1);
    }
    return output;
  }
  return null;
}

function releaseResource(room, resourceId, ownerId = null) {
  const existing = room.resources.get(resourceId);
  if (!existing || (ownerId && existing.ownerId !== ownerId)) return false;
  room.resources.delete(resourceId);
  broadcast(room.id, { type: 'resource', resource: { id: resourceId, ownerId: null } });
  return true;
}

function releasePlayerResources(room, playerId) {
  for (const resource of [...room.resources.values()]) {
    if (resource.ownerId === playerId) releaseResource(room, resource.id, playerId);
  }
}

function leave(socket) {
  const player = socket.player;
  if (!player) return;
  const room = roomFor(player.roomId);
  if (room) {
    releasePlayerResources(room, player.id);
    room.players.delete(player.id);
    broadcast(player.roomId, { type: 'player_left', id: player.id });
    if (room.players.size === 0) rooms.delete(player.roomId);
  }
  socket.player = null;
}

function join(socket, message) {
  if (socket.player) return;
  const roomId = ROOM_ID_PATTERN.test(message.room) ? message.room : 'breakglass-main';
  const room = roomFor(roomId, true);
  if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
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
    media: { audio: false, video: false },
    lastStateAt: 0,
    lastChatAt: 0,
    lastMessageAt: Date.now(),
  };
  socket.player = player;
  room.players.set(player.id, player);

  send(socket, {
    type: 'welcome',
    id: player.id,
    room: roomId,
    players: [...room.players.values()].filter((other) => other !== player).map(publicPlayer),
    world: publicWorld(room),
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
  const room = roomFor(player.roomId);
  for (const resource of room?.resources.values() ?? []) {
    if (resource.ownerId === player.id) resource.expiresAt = now + 90_000;
  }
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
    typeof message.targetId === 'string' && room?.players.has(message.targetId)
      ? message.targetId
      : null;
  broadcast(player.roomId, {
    type: 'emote',
    fromId: player.id,
    targetId,
    kind,
    at: Date.now(),
  });
}

function claimResource(socket, message) {
  const player = socket.player;
  if (!player) return;
  const resourceId = RESOURCE_ID_PATTERN.test(message.resourceId) ? message.resourceId : null;
  if (!resourceId) return;
  const room = roomFor(player.roomId);
  const now = Date.now();
  const existing = room.resources.get(resourceId);
  const expired = existing && existing.expiresAt <= now;
  if (expired) room.resources.delete(resourceId);
  const current = room.resources.get(resourceId);
  if (current && current.ownerId !== player.id) {
    send(socket, {
      type: 'resource_result',
      requestId: sanitizeText(message.requestId, 64),
      ok: false,
      resource: publicResource(current),
    });
    return;
  }
  const resource = {
    id: resourceId,
    ownerId: player.id,
    ownerName: player.avatar.displayName,
    sceneId: SCENE_IDS.has(message.sceneId) ? message.sceneId : player.state.sceneId,
    claimedAt: current?.claimedAt ?? now,
    expiresAt: now + 90_000,
  };
  room.resources.set(resourceId, resource);
  send(socket, {
    type: 'resource_result',
    requestId: sanitizeText(message.requestId, 64),
    ok: true,
    resource: publicResource(resource),
  });
  broadcast(player.roomId, { type: 'resource', resource: publicResource(resource) }, socket);
}

function releaseResourceMessage(socket, message) {
  const player = socket.player;
  if (!player) return;
  const resourceId = RESOURCE_ID_PATTERN.test(message.resourceId) ? message.resourceId : null;
  const room = roomFor(player.roomId);
  if (resourceId && room) releaseResource(room, resourceId, player.id);
}

function updateObject(socket, message) {
  const player = socket.player;
  if (!player) return;
  const objectId = OBJECT_ID_PATTERN.test(message.objectId) ? message.objectId : null;
  if (!objectId) return;
  const room = roomFor(player.roomId);
  const data = sanitizeJson(message.data);
  const serialized = JSON.stringify(data);
  if (serialized.length > 16_000) return;
  const entry = { data, by: player.id, updatedAt: Date.now() };
  room.objects.set(objectId, entry);
  broadcast(player.roomId, { type: 'object_state', objectId, data, by: player.id });
}

function sanitizeDjState(value = {}) {
  const output = {
    crossfader: clamp(value.crossfader, -1, 1),
    metrics: {
      playing: value.metrics?.playing === true,
      vibe: clamp(value.metrics?.vibe),
      mixQuality: clamp(value.metrics?.mixQuality),
      energy: clamp(value.metrics?.energy),
    },
    decks: {},
  };
  for (const deckId of ['A', 'B']) {
    const deck = value.decks?.[deckId] ?? {};
    output.decks[deckId] = {
      trackId: sanitizeText(deck.trackId, 64),
      playing: deck.playing === true,
      level: clamp(deck.level),
      low: clamp(deck.low, -1, 1),
      high: clamp(deck.high, -1, 1),
      bpm: clamp(deck.bpm, 60, 200),
      filter: clamp(deck.filter, -1, 1),
      reverb: clamp(deck.reverb),
      echo: clamp(deck.echo),
      loopBeats: [0, 4, 8, 16].includes(Number(deck.loopBeats)) ? Number(deck.loopBeats) : 0,
      position: clamp(deck.position, 0, 60 * 60 * 4),
    };
  }
  return output;
}

function updateDj(socket, message) {
  const player = socket.player;
  if (!player) return;
  const room = roomFor(player.roomId);
  if (room.resources.get('dj-booth')?.ownerId !== player.id) return;
  room.dj = {
    ...sanitizeDjState(message.state),
    ownerId: player.id,
    ownerName: player.avatar.displayName,
    updatedAt: Date.now(),
  };
  broadcast(player.roomId, { type: 'dj_state', state: room.dj }, socket);
}

function sanitizeLighting(value = {}) {
  return {
    preset: ['work', 'warmup', 'party', 'peak', 'blackout'].includes(value.preset)
      ? value.preset
      : 'warmup',
    palette: ['breakglass', 'redroom', 'ultraviolet', 'cyanAmber', 'acid'].includes(value.palette)
      ? value.palette
      : 'breakglass',
    haze: clamp(value.haze),
    lasers: value.lasers === true,
  };
}

function updateLighting(socket, message) {
  const player = socket.player;
  if (!player) return;
  const room = roomFor(player.roomId);
  if (room.resources.get('lighting-desk')?.ownerId !== player.id) return;
  room.lighting = {
    ...sanitizeLighting(message.state),
    ownerId: player.id,
    ownerName: player.avatar.displayName,
    updatedAt: Date.now(),
  };
  broadcast(player.roomId, { type: 'lighting_state', state: room.lighting }, socket);
}

function chat(socket, message) {
  const player = socket.player;
  if (!player) return;
  const now = Date.now();
  if (now - player.lastChatAt < 550) return;
  const text = sanitizeText(message.text, 240);
  if (!text) return;
  player.lastChatAt = now;
  const room = roomFor(player.roomId);
  const entry = {
    id: crypto.randomUUID(),
    fromId: player.id,
    name: player.avatar.displayName,
    text,
    at: now,
  };
  room.chat.push(entry);
  if (room.chat.length > 40) room.chat.splice(0, room.chat.length - 40);
  broadcast(player.roomId, { type: 'chat', message: entry });
}

function mediaStatus(socket, message) {
  const player = socket.player;
  if (!player) return;
  player.media = { audio: message.audio === true, video: message.video === true };
  broadcast(player.roomId, { type: 'media_status', id: player.id, media: player.media });
}

function signal(socket, message) {
  const player = socket.player;
  if (!player || typeof message.targetId !== 'string') return;
  const room = roomFor(player.roomId);
  const target = room?.players.get(message.targetId);
  if (!target) return;
  const source = message.data;
  if (!source || typeof source !== 'object') return;
  let data = null;
  if (source.description && typeof source.description === 'object') {
    const type = source.description.type;
    const sdp = source.description.sdp;
    if (!['offer', 'answer'].includes(type) || typeof sdp !== 'string' || sdp.length > 28_000)
      return;
    data = {
      description: {
        type,
        sdp: sdp.replace(/\u0000/g, ''),
      },
    };
  } else if (source.candidate && typeof source.candidate === 'object') {
    const candidate = source.candidate;
    if (typeof candidate.candidate !== 'string' || candidate.candidate.length > 4096) return;
    data = {
      candidate: {
        candidate: candidate.candidate.replace(/\u0000/g, ''),
        sdpMid: typeof candidate.sdpMid === 'string' ? candidate.sdpMid.slice(0, 128) : null,
        sdpMLineIndex: Number.isInteger(candidate.sdpMLineIndex)
          ? Math.max(0, Math.min(256, candidate.sdpMLineIndex))
          : null,
        usernameFragment:
          typeof candidate.usernameFragment === 'string'
            ? candidate.usernameFragment.slice(0, 256)
            : null,
      },
    };
  } else return;
  if (JSON.stringify(data).length > 32_000) return;
  send(target.socket, { type: 'signal', fromId: player.id, data });
}

function applyPartyAction(room, player, message) {
  const party = room.party;
  const action = sanitizeText(message.action, 40);
  if (action === 'rowdy') {
    party.rowdyLevel = clamp(party.rowdyLevel + 0.28);
    party.conversationLevel = clamp(party.conversationLevel + 0.12);
  } else if (action === 'quiet') {
    party.rowdyLevel = clamp(party.rowdyLevel - 0.34);
    party.conversationLevel = clamp(party.conversationLevel - 0.14);
    party.highNoiseTime = Math.max(0, party.highNoiseTime - 7);
  } else if (action === 'smoke') {
    party.conversationLevel = clamp(party.conversationLevel + 0.025);
  } else if (action === 'police-cooperate' && party.policePresent) {
    party.policePresent = false;
    party.policeResponseTime = 0;
    party.highNoiseTime = 0;
    party.rowdyLevel *= 0.42;
    party.conversationLevel *= 0.55;
    party.policeCooldown = 36;
    party.lastPoliceOutcome = 'cooperated';
  } else if (action === 'police-brushOff' && party.policePresent) {
    party.policePresent = false;
    party.policeResponseTime = 0;
    party.highNoiseTime = 0;
    party.policeCooldown = 18;
    party.lastPoliceOutcome = 'brushOff';
  } else if (action === 'police-argue' && party.policePresent) {
    party.lastPoliceOutcome = 'argued';
    party.evacuationRequired = true;
  } else if (action === 'set-strictness') {
    const mode = sanitizeText(message.value, 16);
    if (POLICE_MODES[mode]) party.policeStrictness = mode;
  } else if (action === 'reset-party') {
    room.party = defaultPartyState();
    room.party.policeStrictness = POLICE_MODES[party.policeStrictness]
      ? party.policeStrictness
      : 'normal';
  }
  room.party.revision += 1;
  room.party.updatedAt = Date.now();
  broadcast(room.id, { type: 'party_state', state: room.party, by: player.id });
}

function partyAction(socket, message) {
  const player = socket.player;
  if (!player) return;
  const room = roomFor(player.roomId);
  if (room) applyPartyAction(room, player, message);
}

function tickParty(room, dt, now) {
  const party = room.party;
  const dj = room.dj;
  const playing = !!dj?.metrics?.playing;
  const vibe = playing ? clamp(dj.metrics.vibe) : 0.2;
  const mixQuality = playing ? clamp(dj.metrics.mixQuality) : 0.55;
  party.clubMixQuality += (mixQuality - party.clubMixQuality) * (1 - Math.exp(-0.45 * dt));
  const danceTarget = playing ? clamp(0.4 + vibe * 0.36 + mixQuality * 0.2, 0.25, 0.9) : 0.23;
  party.clubDanceShare += (danceTarget - party.clubDanceShare) * (1 - Math.exp(-0.18 * dt));
  const lostFloor = clamp((0.55 - party.clubDanceShare) / 0.45);
  const badBlend = clamp((0.58 - party.clubMixQuality) / 0.48);
  party.spillOutPressure +=
    (clamp(lostFloor * 0.72 + badBlend * 0.22) - party.spillOutPressure) *
    (1 - Math.exp(-0.2 * dt));

  if (party.evacuationRequired) {
    party.evacuationStarted = true;
    party.occupancy += (42 - party.occupancy) * (1 - Math.exp(-0.42 * dt));
    party.conversationLevel += (0.82 - party.conversationLevel) * (1 - Math.exp(-0.35 * dt));
    party.staffWarningLevel = 2;
  } else {
    const targetOccupancy = clamp(3 + party.spillOutPressure * 22 + party.rowdyLevel * 6, 2, 50);
    party.occupancy += (targetOccupancy - party.occupancy) * (1 - Math.exp(-0.09 * dt));
    const occupancyPressure = clamp(party.occupancy / 18);
    const targetConversation = clamp(
      0.1 + occupancyPressure * 0.43 + party.rowdyLevel * 0.42 + party.spillOutPressure * 0.14,
    );
    party.conversationLevel +=
      (targetConversation - party.conversationLevel) * (1 - Math.exp(-0.12 * dt));
    party.rowdyLevel = Math.max(0, party.rowdyLevel - dt * 0.014);
    const targetDisturbance = clamp(
      occupancyPressure * 0.36 +
        party.conversationLevel * 0.58 +
        party.rowdyLevel * 0.48 +
        party.spillOutPressure * 0.18 -
        0.12,
    );
    party.disturbance += (targetDisturbance - party.disturbance) * (1 - Math.exp(-0.24 * dt));

    const tuning = POLICE_MODES[party.policeStrictness] ?? POLICE_MODES.normal;
    party.staffWarningLevel =
      party.disturbance > tuning.complaintThreshold - 0.04
        ? 2
        : party.disturbance > tuning.complaintThreshold - 0.2
          ? 1
          : 0;
    const outsideActuallyNoisy = party.occupancy >= 6 || party.rowdyLevel >= 0.42;
    if (outsideActuallyNoisy && party.disturbance > tuning.complaintThreshold)
      party.highNoiseTime += dt;
    else party.highNoiseTime = Math.max(0, party.highNoiseTime - dt * 1.15);

    party.policeCooldown = Math.max(0, party.policeCooldown - dt);
    if (
      !party.policePresent &&
      party.policeCooldown <= 0 &&
      party.highNoiseTime >= tuning.complaintSeconds
    ) {
      party.policePresent = true;
      party.policeVisits += 1;
      party.policeResponseTime = 0;
      party.lastPoliceOutcome = 'arrived';
    }
    if (party.policePresent) {
      party.policeResponseTime += dt;
      const returnMultiplier =
        party.policeVisits <= 1 ? 1 : Math.max(0.55, 1 - (party.policeVisits - 1) * 0.18);
      if (party.policeResponseTime >= tuning.responseSeconds * returnMultiplier) {
        party.lastPoliceOutcome = 'ignored';
        party.evacuationRequired = true;
      }
    }
  }

  party.updatedAt = now;
  party.revision += 1;
  if (now - room.lastPartyBroadcastAt >= 500) {
    room.lastPartyBroadcastAt = now;
    broadcast(room.id, { type: 'party_state', state: party });
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    const players = [...rooms.values()].reduce((total, room) => total + room.players.size, 0);
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
    else if (message.type === 'resource_claim') claimResource(socket, message);
    else if (message.type === 'resource_release') releaseResourceMessage(socket, message);
    else if (message.type === 'object_update') updateObject(socket, message);
    else if (message.type === 'dj_update') updateDj(socket, message);
    else if (message.type === 'lighting_update') updateLighting(socket, message);
    else if (message.type === 'party_action') partyAction(socket, message);
    else if (message.type === 'chat') chat(socket, message);
    else if (message.type === 'media_status') mediaStatus(socket, message);
    else if (message.type === 'signal') signal(socket, message);
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

let lastWorldTick = Date.now();
const worldTick = setInterval(() => {
  const now = Date.now();
  const dt = Math.min(1, Math.max(0, (now - lastWorldTick) / 1000));
  lastWorldTick = now;
  for (const room of rooms.values()) {
    for (const resource of [...room.resources.values()]) {
      if (resource.expiresAt <= now) releaseResource(room, resource.id);
    }
    tickParty(room, dt, now);
  }
}, WORLD_TICK_MS);
worldTick.unref?.();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Breakglass multiplayer listening on :${PORT}`);
});

function shutdown() {
  clearInterval(heartbeat);
  clearInterval(worldTick);
  for (const socket of wss.clients) socket.close(1001, 'server restart');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);