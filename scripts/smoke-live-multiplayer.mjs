import { WebSocket } from 'ws';
import assert from 'node:assert/strict';

const endpoint =
  process.env.MULTIPLAYER_URL || 'wss://multiplayer-phase2-production.up.railway.app';
const healthUrl = endpoint.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:') + '/health';
const room = `smoke-${Date.now().toString(36)}`;

function onceMessage(socket, predicate, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for message from ${endpoint}`));
    }, timeout);
    const onMessage = (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('message', onMessage);
      socket.off('error', onError);
    };
    socket.on('message', onMessage);
    socket.on('error', onError);
  });
}

function openSocket() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`Timed out opening ${endpoint}`));
    }, 8000);
    socket.once('open', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function joinPayload(name, x) {
  return {
    type: 'join',
    room,
    avatar: {
      displayName: name,
      role: 'explorer',
      body: 'regular',
      hair: 'short',
      outfit: 'black',
      skinTone: 'warm',
      faceTexture: null,
      shareFaceMultiplayer: false,
    },
    state: {
      sceneId: 'alley',
      position: [x, 0, 0],
      rotationY: 0,
      moving: false,
      dancing: false,
      seated: false,
      grounded: true,
    },
  };
}

const health = await fetch(healthUrl);
assert.equal(health.status, 200);
const healthJson = await health.json();
assert.equal(healthJson.ok, true);

const a = await openSocket();
a.send(JSON.stringify(joinPayload('Smoke A', 0)));
const welcomeA = await onceMessage(a, (message) => message.type === 'welcome');
assert.ok(welcomeA.id);
assert.ok(welcomeA.world?.party, 'Phase 2 welcome includes authoritative party state');

const joinedOnA = onceMessage(a, (message) => message.type === 'player_joined');
const b = await openSocket();
b.send(JSON.stringify(joinPayload('Smoke B', 2)));
const welcomeB = await onceMessage(b, (message) => message.type === 'welcome');
const playerJoined = await joinedOnA;
assert.equal(playerJoined.player.id, welcomeB.id);
assert.ok(welcomeB.players.some((player) => player.id === welcomeA.id));

const movementOnA = onceMessage(
  a,
  (message) => message.type === 'state' && message.id === welcomeB.id,
);
b.send(
  JSON.stringify({
    type: 'state',
    state: {
      sceneId: 'alley',
      position: [4.25, 0, -1.5],
      rotationY: 1.2,
      moving: true,
      dancing: false,
      seated: false,
      grounded: true,
    },
  }),
);
const movement = await movementOnA;
assert.deepEqual(movement.state.position, [4.25, 0, -1.5]);

const resourceOnB = onceMessage(
  b,
  (message) => message.type === 'resource' && message.resource?.id === 'dj-booth',
);
a.send(
  JSON.stringify({
    type: 'resource_claim',
    requestId: 'smoke-dj-a',
    resourceId: 'dj-booth',
    sceneId: 'downstairs',
  }),
);
const claimA = await onceMessage(
  a,
  (message) => message.type === 'resource_result' && message.requestId === 'smoke-dj-a',
);
assert.equal(claimA.ok, true);
assert.equal(claimA.resource.ownerId, welcomeA.id);
await resourceOnB;

b.send(
  JSON.stringify({
    type: 'resource_claim',
    requestId: 'smoke-dj-b',
    resourceId: 'dj-booth',
    sceneId: 'downstairs',
  }),
);
const claimB = await onceMessage(
  b,
  (message) => message.type === 'resource_result' && message.requestId === 'smoke-dj-b',
);
assert.equal(claimB.ok, false);
assert.equal(claimB.resource.ownerId, welcomeA.id);

const djOnB = onceMessage(b, (message) => message.type === 'dj_state');
a.send(
  JSON.stringify({
    type: 'dj_update',
    state: {
      crossfader: 0.2,
      metrics: { playing: true, vibe: 0.81, mixQuality: 0.92, energy: 0.73 },
      decks: {
        A: {
          trackId: 'got-you-dancin',
          playing: true,
          bpm: 124,
          level: 0.9,
          low: 0,
          high: 0,
          filter: 0,
          reverb: 0.1,
          echo: 0,
          loopBeats: 0,
          position: 8.5,
        },
        B: {
          trackId: 'atrakar',
          playing: false,
          bpm: 124,
          level: 0.85,
          low: 0,
          high: 0,
          filter: 0,
          reverb: 0,
          echo: 0,
          loopBeats: 0,
          position: 0,
        },
      },
    },
  }),
);
const djState = await djOnB;
assert.equal(djState.state.ownerId, welcomeA.id);
assert.equal(djState.state.metrics.mixQuality, 0.92);
assert.equal(djState.state.decks.A.position, 8.5);

const objectOnA = onceMessage(
  a,
  (message) =>
    message.type === 'object_state' && message.objectId === 'take-a-break-installation',
);
b.send(
  JSON.stringify({
    type: 'object_update',
    objectId: 'take-a-break-installation',
    data: { enabled: true, mix: { low: 0.4, texture: 0.76, air: 0.55 } },
  }),
);
const objectState = await objectOnA;
assert.equal(objectState.data.mix.texture, 0.76);

const chatOnA = onceMessage(a, (message) => message.type === 'chat');
b.send(JSON.stringify({ type: 'chat', text: 'meet me in Below' }));
const chat = await chatOnA;
assert.equal(chat.message.name, 'Smoke B');
assert.equal(chat.message.text, 'meet me in Below');

const mediaOnA = onceMessage(
  a,
  (message) => message.type === 'media_status' && message.id === welcomeB.id,
);
b.send(JSON.stringify({ type: 'media_status', audio: true, video: false }));
const media = await mediaOnA;
assert.deepEqual(media.media, { audio: true, video: false });

const signalOnA = onceMessage(
  a,
  (message) => message.type === 'signal' && message.fromId === welcomeB.id,
);
b.send(
  JSON.stringify({
    type: 'signal',
    targetId: welcomeA.id,
    data: { candidate: { candidate: 'phase2-smoke-candidate' } },
  }),
);
const signal = await signalOnA;
assert.equal(signal.data.candidate.candidate, 'phase2-smoke-candidate');

const partyOnA = onceMessage(a, (message) => message.type === 'party_state');
b.send(JSON.stringify({ type: 'party_action', action: 'rowdy' }));
const partyState = await partyOnA;
assert.ok(partyState.state.rowdyLevel > 0.08);

const leftOnA = onceMessage(
  a,
  (message) => message.type === 'player_left' && message.id === welcomeB.id,
);
b.close(1000, 'smoke done');
await leftOnA;
a.close(1000, 'smoke done');

console.log(`Live Phase 2 multiplayer smoke passed: ${endpoint}`);
