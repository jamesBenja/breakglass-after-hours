import test from 'node:test';
import assert from 'node:assert/strict';
import { DrumMachineSystem } from '../src/gameplay/DrumMachineSystem.js';
import {
  ModularSynthSystem,
  normalizeModularPatchState,
} from '../src/gameplay/ModularSynthSystem.js';
import { InstrumentSync } from '../src/multiplayer/InstrumentSync.js';

function recordingSession() {
  return {
    bpm: 120,
    swing: 0,
    loopEnabled: true,
    loopBars: 2,
    takeCounter: 0,
    stems: [],
    addTake(kind, label, source) {
      this.takeCounter += 1;
      const stem = {
        id: `${kind}-${this.takeCounter}`,
        kind,
        label,
        source,
        level: 0.68,
        mute: false,
        solo: false,
        clipActive: true,
        performance: null,
      };
      this.stems.push(stem);
      return stem;
    },
    attachPerformance(id, performance) {
      const stem = this.stems.find((item) => item.id === id);
      if (!stem) return false;
      stem.performance = performance;
      return true;
    },
  };
}

test('drum-machine record button creates an eventful Spectra stem and auditions it', async () => {
  const session = recordingSession();
  const calls = [];
  const game = {
    state: { data: {} },
    studio: session,
    audio: { init: async () => calls.push('audio:init') },
    spectraTransport: { restart: (position) => calls.push(['restart', position]) },
    studioPlayback: {
      play: async (activeSession, offset, options) => {
        calls.push(['play', activeSession, offset, options]);
        return true;
      },
    },
    save: () => calls.push('save'),
  };
  const ui = {
    panel: () => {},
    warning: (message) => calls.push(['warning', message]),
    document: null,
    buttons: null,
  };
  const machine = new DrumMachineSystem(game, ui);

  await machine.recordToConsole();

  assert.equal(session.stems.length, 1);
  assert.ok(session.stems[0].performance.events.length > 0);
  assert.deepEqual(
    calls.find((item) => Array.isArray(item) && item[0] === 'restart'),
    ['restart', 0],
  );
  const play = calls.find((item) => Array.isArray(item) && item[0] === 'play');
  assert.equal(play[1], session);
  assert.equal(play[2], 0);
  assert.equal(play[3].stemId, session.stems[0].id);
});

test('modular record button creates an eventful Spectra stem and auditions it', async () => {
  const session = recordingSession();
  const calls = [];
  const game = {
    state: { data: { modularSynth: normalizeModularPatchState() } },
    studio: session,
    audio: { init: async () => calls.push('audio:init') },
    spectraTransport: { restart: (position) => calls.push(['restart', position]) },
    studioPlayback: {
      play: async (activeSession, offset, options) => {
        calls.push(['play', activeSession, offset, options]);
        return true;
      },
    },
    save: () => calls.push('save'),
  };
  const ui = {
    panel: () => {},
    warning: (message) => calls.push(['warning', message]),
    document: null,
    buttons: null,
  };
  const modular = new ModularSynthSystem(game, ui);

  await modular.recordToConsole();

  assert.equal(session.stems.length, 1);
  assert.ok(session.stems[0].performance.events.length > 0);
  const play = calls.find((item) => Array.isArray(item) && item[0] === 'play');
  assert.equal(play[3].stemId, session.stems[0].id);
});

test('multiplayer instrument publishing always feeds the local Spectra recorder first', () => {
  const captured = [];
  const performance = {
    config: null,
    playMidi: () => false,
    triggerDrum: () => false,
    strumChord: () => false,
  };
  const world = {
    useTarget: async (_target, action) => action(),
    resourceForTarget: () => 'upstairs:drumMachine',
    owns: () => false,
    localClaims: new Map(),
    handleObjectState: () => {},
  };
  const game = {
    keyboardPerformance: performance,
    spectraRecorder: {
      captureLocal: (...args) => captured.push(args),
      captureRemote: () => {},
    },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    player: { position: { x: 0, y: 0, z: 0 } },
  };
  const client = {
    game,
    world,
    joined: false,
    localId: 'local',
    send: () => {
      throw new Error('network send should not occur');
    },
  };
  const sync = new InstrumentSync(client);

  const result = sync.publishExternal(
    { mode: 'drums', stemKind: 'drums', label: '909' },
    { type: 'drum', name: '909-kick' },
    { resourceId: 'upstairs:drumMachine', offsetSeconds: 0.03 },
  );

  assert.equal(result, false);
  assert.equal(captured.length, 1);
  assert.equal(captured[0][1].name, '909-kick');
  assert.equal(captured[0][2].resourceId, 'upstairs:drumMachine');
  sync.dispose();
});
