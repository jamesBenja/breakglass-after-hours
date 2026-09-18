import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { multiplayerMaddoxState } from '../src/multiplayer/MultiplayerClient.js';
import { RemoteMaddox } from '../src/multiplayer/RemoteMaddox.js';

test('multiplayer only exposes a player Maddox after that player has unlocked him', () => {
  const dog = {
    root: { visible: true, position: { toArray: () => [2, 0, 3] }, rotation: { y: 0.4 } },
    snapshot: () => ({
      state: 'lead',
      position: [2, 0, 3],
      rotationY: 0.4,
      following: true,
      moving: true,
      petPulse: 0,
      bellyRubPulse: 0,
    }),
  };
  const game = {
    state: { data: { roofSecretUnlocked: false, maddoxCompanion: true } },
    sceneManager: { current: { maddox: dog } },
  };

  const locked = multiplayerMaddoxState(game);
  assert.equal(locked.unlocked, false);
  assert.equal(locked.visible, false);

  game.state.data.roofSecretUnlocked = true;
  const unlocked = multiplayerMaddoxState(game);
  assert.equal(unlocked.unlocked, true);
  assert.equal(unlocked.visible, true);
  assert.equal(unlocked.following, true);
  assert.deepEqual(unlocked.position, [2, 0, 3]);
  assert.equal(unlocked.state, 'lead');
  assert.equal(unlocked.moving, true);
});

test('God Mode style unlocked Maddox state is broadcast without any separate multiplayer flag', () => {
  const dog = {
    root: { visible: true, position: { toArray: () => [5, 0, -1] }, rotation: { y: 1.2 } },
    snapshot: () => ({
      state: 'sit',
      position: [5, 0, -1],
      rotationY: 1.2,
      following: true,
      moving: false,
      petPulse: 0,
      bellyRubPulse: 0,
    }),
  };
  const game = {
    godMode: true,
    state: { data: { roofSecretUnlocked: true, maddoxCompanion: true } },
    sceneManager: { current: { maddox: dog } },
  };
  const state = multiplayerMaddoxState(game);
  assert.equal(state.unlocked, true);
  assert.equal(state.visible, true);
  assert.equal(state.following, true);
});

test('remote Maddox renders and follows the transmitted dog state in the correct scene', () => {
  const gameplay = new Group();
  const scenes = new Map([['upstairs', { gameplay, scene: gameplay }]]);
  const remote = new RemoteMaddox({
    ownerId: 'player-2',
    ownerName: 'Nora',
    scenes,
  });

  remote.applyState(
    {
      unlocked: true,
      visible: true,
      following: true,
      position: [3, 0, 2],
      rotationY: 0.75,
      state: 'lead',
      moving: true,
      petPulse: 0,
      bellyRubPulse: 0,
    },
    'upstairs',
    { immediate: true },
  );

  assert.equal(remote.visible, true);
  assert.equal(remote.dog.root.visible, true);
  assert.equal(remote.dog.root.parent, gameplay);
  assert.deepEqual(remote.dog.root.position.toArray(), [3, 0, 2]);
  assert.match(remote.dog.name, /Maddox.*Nora/);

  remote.applyState(
    {
      unlocked: true,
      visible: true,
      following: true,
      position: [4, 0, 2],
      rotationY: 1,
      state: 'pet',
      moving: false,
      petPulse: 1,
      bellyRubPulse: 0,
    },
    'upstairs',
  );
  remote.update(1 / 30);
  assert.ok(remote.dog.root.position.x > 3);
  assert.equal(remote.dog.state, 'pet');
  assert.ok(remote.dog.petPulse > 0);

  remote.applyState({ unlocked: false, visible: false }, 'upstairs');
  assert.equal(remote.dog.root.visible, false);
  remote.dispose();
});
