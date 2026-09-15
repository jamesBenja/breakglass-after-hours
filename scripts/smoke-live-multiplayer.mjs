import { WebSocket } from 'ws';
import assert from 'node:assert/strict';

const endpoint = process.env.MULTIPLAYER_URL || 'wss://multiplayer-live-production.up.railway.app';
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

const leftOnA = onceMessage(a, (message) => message.type === 'player_left' && message.id === welcomeB.id);
b.close(1000, 'smoke done');
await leftOnA;
a.close(1000, 'smoke done');

console.log(`Live multiplayer smoke passed: ${endpoint}`);
