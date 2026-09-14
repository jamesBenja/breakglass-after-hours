import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { SceneManager } from '../src/scenes/SceneManager.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { CollisionWorld } from '../src/collision/CollisionWorld.js';
import { levels } from '../src/world/levels.js';
import { GameState, validateSave, SAVE_KEY } from '../src/state/GameState.js';

function setup() {
  const player = new PlayerController();
  const scenes = new Map(
    Object.values(levels).map((definition) => [
      definition.id,
      {
        definition,
        scene: new Scene(),
        collision: new CollisionWorld(definition.navigation),
        dispose() {
          this.scene.clear();
        },
      },
    ]),
  );
  const entered = [];
  const manager = new SceneManager({
    scenes,
    player,
    onEnter: (level) => entered.push(level.definition.id),
  });
  manager.start('upstairs');
  return { manager, player, scenes, entered };
}

test('repeated floor trips keep one player and independent scene trees; duplicate transitions are rejected', () => {
  const { manager, player, scenes, entered } = setup();
  for (let i = 0; i < 40; i++) {
    const target = i % 2 === 0 ? 'downstairs' : 'upstairs';
    const previous = manager.current;
    assert.equal(manager.request(target), true);
    assert.equal(manager.request(target), false);
    manager.update(0.29);
    assert.equal(manager.current, previous);
    manager.update(0.01);
    assert.equal(manager.current.definition.id, target);
    assert.equal(player.object.parent, scenes.get(target).scene);
    assert.equal(previous.scene.children.includes(player.object), false);
    assert.deepEqual(player.position.toArray(), levels[target].spawns.stairs);
    manager.update(0.06);
    assert.equal(manager.changing, false);
    assert.equal(manager.request('missing'), false);
  }
  assert.equal(entered.length, 41);
  player.dispose();
  manager.dispose();
});

test('valid saves restore floor and position; invalid positions safely use the named spawn', () => {
  const { manager, player } = setup();
  manager.start('downstairs', [0, 0, 0]);
  assert.deepEqual(player.position.toArray(), [0, 0, 0]);
  manager.start('upstairs', [100, 0, 100]);
  assert.deepEqual(player.position.toArray(), levels.upstairs.spawns.start);
  manager.request('downstairs');
  manager.dispose();
  manager.update(10);
  assert.equal(player.object.parent, null);
  player.dispose();
});

test('save/reload retains contacts, visited floors and selected music without an autoplay flag', () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key),
    setItem: (key, value) => memory.set(key, value),
  };
  const state = new GameState(storage);
  state.meet('nora');
  state.meet('nora');
  state.data.lastTrack = 'glass-floor';
  state.save('downstairs', { x: 1, y: 0, z: 2 });
  const loaded = new GameState(storage);
  assert.equal(loaded.data.sceneId, 'downstairs');
  assert.deepEqual(loaded.data.position, [1, 0, 2]);
  assert.deepEqual(loaded.data.contacts, ['nora']);
  assert.deepEqual(loaded.data.visited, ['upstairs', 'downstairs']);
  assert.equal(loaded.data.lastTrack, 'glass-floor');
  assert.equal('playing' in loaded.data, false);
  assert.ok(memory.has(SAVE_KEY));
});

test('corrupt, future and partial saves are validated; blocked storage never prevents play', () => {
  const messages = [];
  const broken = new GameState(
    {
      getItem() {
        return '{bad json';
      },
      setItem() {
        throw new Error('denied');
      },
    },
    (message) => messages.push(message),
  );
  assert.equal(broken.data.sceneId, 'upstairs');
  assert.equal(broken.save(), false);
  assert.equal(messages.length, 1);
  assert.equal(validateSave({ version: 99, sceneId: 'downstairs' }).sceneId, 'upstairs');
  const partial = validateSave({
    version: 1,
    sceneId: 'missing',
    position: [0, 0, 0],
    visited: [null, 'downstairs', 'downstairs'],
    contacts: [true, 'jashim'],
    lastTrack: 'unknown',
  });
  assert.equal(partial.position, null);
  assert.deepEqual(partial.visited, ['downstairs']);
  assert.deepEqual(partial.contacts, ['jashim']);
  assert.equal(partial.lastTrack, null);
});
