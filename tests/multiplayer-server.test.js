import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { WebSocket } from 'ws';

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('multiplayer server did not start')), 5000);
    const onData = (chunk) => {
      if (!String(chunk).includes('Breakglass multiplayer listening')) return;
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      resolve();
    };
    child.stdout.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`multiplayer server exited early (${code})`));
    });
  });
}

function client(url) {
  const socket = new WebSocket(url);
  const queue = [];
  const waiters = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    const index = waiters.findIndex((waiter) => waiter.type === message.type);
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      waiter.resolve(message);
    } else queue.push(message);
  });
  const opened = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return {
    socket,
    opened,
    send(message) {
      socket.send(JSON.stringify(message));
    },
    next(type, timeoutMs = 2500) {
      const index = queue.findIndex((message) => message.type === type);
      if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { type, resolve, reject };
        waiters.push(waiter);
        setTimeout(() => {
          const waiterIndex = waiters.indexOf(waiter);
          if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
          reject(new Error(`timed out waiting for ${type}`));
        }, timeoutMs).unref?.();
      });
    },
  };
}

const avatar = (displayName) => ({
  displayName,
  identity: 'neutral',
  body: 'regular',
  hair: 'short',
  outfit: 'black',
  role: 'explorer',
  skinTone: 'warm',
  photoConsent: true,
});

const state = (x = 0) => ({
  sceneId: 'alley',
  position: [x, 0, 2],
  rotationY: 0.4,
  moving: true,
  dancing: false,
  seated: false,
  grounded: true,
});

test('multiplayer server owns shared resources, world state, chat and media signaling', async (t) => {
  const port = await freePort();
  const child = spawn(process.execPath, ['server/multiplayerServer.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill('SIGTERM'));
  await waitForServer(child);

  const url = `ws://127.0.0.1:${port}`;
  const a = client(url);
  const b = client(url);
  t.after(() => {
    a.socket.close();
    b.socket.close();
  });
  await Promise.all([a.opened, b.opened]);

  a.send({ type: 'join', room: 'test-room', avatar: avatar('James'), state: state(1) });
  const welcomeA = await a.next('welcome');
  assert.equal(welcomeA.players.length, 0);
  assert.deepEqual(welcomeA.world.resources, []);
  assert.equal(welcomeA.world.party.policeStrictness, 'normal');

  b.send({ type: 'join', room: 'test-room', avatar: avatar('Nora'), state: state(2) });
  const [welcomeB, joined] = await Promise.all([b.next('welcome'), a.next('player_joined')]);
  assert.equal(welcomeB.players.length, 1);
  assert.equal(welcomeB.players[0].avatar.displayName, 'James');
  assert.equal(joined.player.avatar.displayName, 'Nora');

  b.send({ type: 'state', state: { ...state(6), sceneId: 'downstairs', dancing: true } });
  const movement = await a.next('state');
  assert.equal(movement.id, welcomeB.id);
  assert.equal(movement.state.sceneId, 'downstairs');
  assert.equal(movement.state.position[0], 6);
  assert.equal(movement.state.dancing, true);

  b.send({ type: 'emote', kind: 'highfive', targetId: welcomeA.id });
  const emote = await a.next('emote');
  assert.equal(emote.fromId, welcomeB.id);
  assert.equal(emote.targetId, welcomeA.id);
  assert.equal(emote.kind, 'highfive');

  a.send({
    type: 'resource_claim',
    requestId: 'claim-a',
    resourceId: 'dj-booth',
    sceneId: 'downstairs',
  });
  const claimA = await a.next('resource_result');
  const resourceOnB = await b.next('resource');
  assert.equal(claimA.ok, true);
  assert.equal(claimA.resource.ownerId, welcomeA.id);
  assert.equal(resourceOnB.resource.id, 'dj-booth');

  b.send({
    type: 'resource_claim',
    requestId: 'claim-b',
    resourceId: 'dj-booth',
    sceneId: 'downstairs',
  });
  const claimB = await b.next('resource_result');
  assert.equal(claimB.ok, false);
  assert.equal(claimB.resource.ownerId, welcomeA.id);

  a.send({
    type: 'dj_update',
    state: {
      crossfader: 0.25,
      metrics: { playing: true, vibe: 0.8, mixQuality: 0.91, energy: 0.74 },
      decks: {
        A: { trackId: 'got-you-dancin', playing: true, bpm: 124, level: 0.9, position: 12.4 },
        B: { trackId: 'atrakar', playing: false, bpm: 124, level: 0.85, position: 0 },
      },
    },
  });
  const djState = await b.next('dj_state');
  assert.equal(djState.state.ownerId, welcomeA.id);
  assert.equal(djState.state.decks.A.trackId, 'got-you-dancin');
  assert.equal(djState.state.metrics.mixQuality, 0.91);

  b.send({
    type: 'object_update',
    objectId: 'take-a-break-installation',
    data: { enabled: true, mix: { low: 0.4, texture: 0.8 } },
  });
  const objectState = await a.next('object_state');
  assert.equal(objectState.objectId, 'take-a-break-installation');
  assert.equal(objectState.data.mix.texture, 0.8);

  b.send({ type: 'chat', text: 'meet me in Below' });
  const chat = await a.next('chat');
  assert.equal(chat.message.name, 'Nora');
  assert.equal(chat.message.text, 'meet me in Below');

  b.send({ type: 'media_status', audio: true, video: false });
  const media = await a.next('media_status');
  assert.equal(media.id, welcomeB.id);
  assert.deepEqual(media.media, { audio: true, video: false });

  b.send({ type: 'signal', targetId: welcomeA.id, data: { candidate: { candidate: 'test' } } });
  const signal = await a.next('signal');
  assert.equal(signal.fromId, welcomeB.id);
  assert.equal(signal.data.candidate.candidate, 'test');

  const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
  assert.deepEqual(health, { ok: true, rooms: 1, players: 2 });

  b.socket.close(1000, 'test departure');
  const left = await a.next('player_left');
  assert.equal(left.id, welcomeB.id);
});
