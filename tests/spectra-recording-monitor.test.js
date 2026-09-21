import test from 'node:test';
import assert from 'node:assert/strict';
import { DrumMachineSystem } from '../src/gameplay/DrumMachineSystem.js';
import {
  ModularSynthSystem,
  normalizeModularPatchState,
} from '../src/gameplay/ModularSynthSystem.js';
import { InstrumentSync } from '../src/multiplayer/InstrumentSync.js';
import { connectKeyboardPerformanceToSpectra } from '../src/gameplay/StudioLoopEnhancements.js';
import { KeyboardPerformance } from '../src/studio/KeyboardPerformance.js';
import { SpectraRecorder } from '../src/studio/SpectraRecorder.js';
import { StudioSession } from '../src/studio/StudioSession.js';

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

test('drum-machine record button creates an eventful Spectra stem in the full console mix', async () => {
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
  assert.equal(play[3], undefined);
});

test('modular record button creates an eventful Spectra stem in the full console mix', async () => {
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
  assert.equal(play[3], undefined);
});

test('local keyboard and touch performance feeds an armed Spectra recorder without multiplayer', () => {
  const captured = [];
  const keyboard = new KeyboardPerformance(
    {
      tone: () => {},
      kick: () => {},
      hat: () => {},
    },
    null,
    null,
  );
  const game = {
    keyboardPerformance: keyboard,
    spectraRecorder: {
      armed: true,
      captureLocal: (...args) => {
        captured.push(args);
        return true;
      },
    },
  };

  assert.equal(connectKeyboardPerformanceToSpectra(game), true);
  keyboard.start({
    mode: 'synth',
    stemKind: 'synth',
    label: 'Mobile synth',
    wave: 'triangle',
    volume: 0.06,
    duration: 0.4,
  });

  assert.equal(keyboard.recordingActive, true);
  assert.equal(keyboard.playMidi(60), true);
  assert.equal(captured.length, 1);
  assert.equal(captured[0][0].label, 'Mobile synth');
  assert.deepEqual(captured[0][1], { type: 'midi', midi: 60 });
  assert.match(captured[0][2].resourceId, /^local:synth:/);

  keyboard.stop(false);
});

test('master console record captures a normally played monitored instrument into its armed channel', () => {
  const keyboard = new KeyboardPerformance(
    {
      tone: () => {},
      kick: () => {},
      hat: () => {},
    },
    null,
    null,
  );
  const studio = new StudioSession();
  const synth = studio.stems.find((stem) => stem.inputKey === 'synth');
  studio.toggleRecordArm(synth.id);

  const game = {
    keyboardPerformance: keyboard,
    studio,
    studioPlayback: {
      playing: false,
      position: () => 0,
      updateMix: () => {},
      monitorLiveEvent: () => true,
    },
    state: { data: { avatar: { displayName: 'James' } } },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: { localId: 'local-1', remotePlayers: new Map() },
    save: () => {},
  };
  game.spectraRecorder = new SpectraRecorder(game, {});

  assert.equal(connectKeyboardPerformanceToSpectra(game), true);
  assert.ok(game.spectraRecorder.arm());

  keyboard.start({
    mode: 'synth',
    stemKind: 'synth',
    label: 'Synth',
    wave: 'triangle',
    volume: 0.06,
    duration: 0.4,
  });
  assert.equal(keyboard.playMidi(60), true);
  assert.equal(keyboard.playMidi(64), true);
  keyboard.stop(false);

  const committed = game.spectraRecorder.stop({ commit: true });
  assert.equal(committed.length, 1);
  assert.equal(committed[0].id, synth.id);
  assert.deepEqual(
    synth.performance.events.map((event) => event.midi),
    [60, 64],
  );
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
