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

test('master console record captures guitar into the standing Guitar channel', () => {
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
  const guitar = studio.stems.find((stem) => stem.inputKey === 'guitar');
  studio.toggleRecordArm(guitar.id);

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
    mode: 'guitar',
    stemKind: 'guitar',
    inputKey: 'guitar',
    label: 'Electric guitar',
    wave: 'sawtooth',
    volume: 0.06,
    duration: 0.5,
  });
  assert.equal(keyboard.playMidi(43), true);
  assert.equal(keyboard.playMidi(50), true);
  keyboard.stop(false);

  const committed = game.spectraRecorder.stop({ commit: true });
  assert.equal(committed.length, 1);
  assert.equal(committed[0].id, guitar.id);
  assert.deepEqual(
    guitar.performance.events.map((event) => event.midi),
    [43, 50],
  );
});

test('bass performance shares the fixed Guitar-family Spectra input', () => {
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
  const guitar = studio.stems.find((stem) => stem.inputKey === 'guitar');
  studio.toggleRecordArm(guitar.id);

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

  connectKeyboardPerformanceToSpectra(game);
  assert.ok(game.spectraRecorder.arm());

  keyboard.start({
    mode: 'bass',
    stemKind: 'bass',
    inputKey: 'guitar',
    label: 'Bass',
    wave: 'sawtooth',
    volume: 0.08,
    duration: 0.4,
  });
  keyboard.playMidi(31);
  keyboard.stop(false);

  const committed = game.spectraRecorder.stop({ commit: true });
  assert.equal(committed.length, 1);
  assert.equal(committed[0].id, guitar.id);
  assert.equal(guitar.performance.events[0].midi, 31);
});

test('Drum Kit, Synth and Piano all record into their fixed armed Spectra channels', () => {
  const cases = [
    {
      inputKey: 'drum-kit',
      mode: 'drums',
      stemKind: 'drums',
      label: 'Drum Kit',
      play: (keyboard) => keyboard.triggerDrum('kick'),
      expected: (stem) => stem.performance.events[0].drum === 'kick',
    },
    {
      inputKey: 'synth',
      mode: 'synth',
      stemKind: 'synth',
      label: 'Synth',
      play: (keyboard) => keyboard.playMidi(60),
      expected: (stem) => stem.performance.events[0].midi === 60,
    },
    {
      inputKey: 'piano',
      mode: 'piano',
      stemKind: 'keys',
      label: 'Piano',
      play: (keyboard) => keyboard.playMidi(64),
      expected: (stem) => stem.performance.events[0].midi === 64,
    },
  ];

  for (const entry of cases) {
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
    const target = studio.stems.find((stem) => stem.inputKey === entry.inputKey);
    studio.toggleRecordArm(target.id);
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

    connectKeyboardPerformanceToSpectra(game);
    assert.ok(game.spectraRecorder.arm(), `${entry.label} recorder should arm`);
    keyboard.start({
      mode: entry.mode,
      stemKind: entry.stemKind,
      inputKey: entry.inputKey,
      label: entry.label,
      wave: 'triangle',
      volume: 0.06,
      duration: 0.4,
    });
    assert.equal(entry.play(keyboard), true, `${entry.label} should perform`);
    keyboard.stop(false);

    const committed = game.spectraRecorder.stop({ commit: true });
    assert.equal(committed.length, 1, `${entry.label} should commit one track`);
    assert.equal(committed[0].id, target.id);
    assert.equal(entry.expected(target), true, `${entry.label} should contain the played event`);
  }
});

test('new duplicate-input tracks are real record destinations, not cosmetic strips', () => {
  const studio = new StudioSession();
  const original = studio.stems.find((stem) => stem.inputKey === 'synth');
  const added = studio.addInputTrack('synth');

  assert.ok(added);
  assert.equal(added.label, 'Synth 2');
  assert.equal(added.inputKey, 'synth');
  assert.equal(added.monitor, true);
  assert.equal(added.recordArm, false);

  studio.toggleRecordArm(added.id);
  const game = {
    studio,
    studioPlayback: { playing: false, position: () => 0, updateMix: () => {} },
    state: { data: { avatar: { displayName: 'James' } } },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: { localId: 'local-1', remotePlayers: new Map() },
    save: () => {},
  };
  const recorder = new SpectraRecorder(game, {});

  assert.ok(recorder.arm());
  assert.equal(
    recorder.captureLocal(
      { mode: 'synth', stemKind: 'synth', inputKey: 'synth', label: 'Synth' },
      { type: 'midi', midi: 67 },
      { resourceId: 'local:synth' },
    ),
    true,
  );

  const committed = recorder.stop({ commit: true });
  assert.equal(committed.length, 1);
  assert.equal(committed[0].id, added.id);
  assert.equal(added.performance.events[0].midi, 67);
  assert.equal(original.performance, null);
});

test('multiple armed tracks sharing one input capture the same performance independently', () => {
  const studio = new StudioSession();
  const original = studio.stems.find((stem) => stem.inputKey === 'piano');
  const added = studio.addInputTrack('piano');
  studio.toggleRecordArm(original.id);
  studio.toggleRecordArm(added.id);

  const game = {
    studio,
    studioPlayback: { playing: false, position: () => 0, updateMix: () => {} },
    state: { data: { avatar: { displayName: 'James' } } },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: { localId: 'local-1', remotePlayers: new Map() },
    save: () => {},
  };
  const recorder = new SpectraRecorder(game, {});

  assert.ok(recorder.arm());
  recorder.captureLocal(
    { mode: 'piano', stemKind: 'keys', inputKey: 'piano', label: 'Piano' },
    { type: 'midi', midi: 72 },
    { resourceId: 'local:piano' },
  );

  const committed = recorder.stop({ commit: true });
  assert.deepEqual(committed.map((stem) => stem.id).sort(), [original.id, added.id].sort());
  assert.equal(original.performance.events[0].midi, 72);
  assert.equal(added.performance.events[0].midi, 72);
});

test('Drum Machine and Modular publish explicit fixed Spectra input keys', () => {
  const drumCaptured = [];
  const drumGame = {
    state: { data: {} },
    studio: { bpm: 120, swing: 0, loopEnabled: true, loopBars: 1 },
    studioPlayback: { monitorLiveEvent: () => true },
    spectraRecorder: {
      captureLocal: (...args) => {
        drumCaptured.push(args);
        return true;
      },
    },
    multiplayer: null,
    save: () => {},
  };
  const drumMachine = new DrumMachineSystem(drumGame, { panel: () => {}, warning: () => {} });
  const pattern = drumMachine.state.patterns[drumMachine.state.selectedPattern];
  for (const lane of Object.values(pattern)) lane.fill(0);
  pattern.kick[0] = 1;

  assert.equal(drumMachine.triggerStep(0), 1);
  assert.equal(drumCaptured.length, 1);
  assert.equal(drumCaptured[0][0].inputKey, 'drum-machine');

  const modularCaptured = [];
  const modularGame = {
    state: { data: { modularSynth: normalizeModularPatchState() } },
    studio: { bpm: 120, swing: 0, loopEnabled: true, loopBars: 1 },
    studioPlayback: { monitorLiveEvent: () => true },
    spectraRecorder: {
      captureLocal: (...args) => {
        modularCaptured.push(args);
        return true;
      },
    },
    multiplayer: null,
    save: () => {},
  };
  const modular = new ModularSynthSystem(modularGame, { panel: () => {}, warning: () => {} });

  assert.equal(modular.triggerStep(0), true);
  assert.equal(modularCaptured.length, 1);
  assert.equal(modularCaptured[0][0].inputKey, 'modular');
});

test('Drum Machine and Modular record through the real master recorder into their fixed channels', () => {
  const drumStudio = new StudioSession();
  const drumTarget = drumStudio.stems.find((stem) => stem.inputKey === 'drum-machine');
  drumStudio.toggleRecordArm(drumTarget.id);
  const drumGame = {
    state: { data: {} },
    studio: drumStudio,
    studioPlayback: {
      playing: false,
      position: () => 0,
      updateMix: () => {},
      monitorLiveEvent: () => true,
    },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: null,
    save: () => {},
  };
  drumGame.spectraRecorder = new SpectraRecorder(drumGame, {});
  const drumMachine = new DrumMachineSystem(drumGame, { panel: () => {}, warning: () => {} });
  const pattern = drumMachine.state.patterns[drumMachine.state.selectedPattern];
  for (const lane of Object.values(pattern)) lane.fill(0);
  pattern.kick[0] = 1;

  assert.ok(drumGame.spectraRecorder.arm());
  assert.equal(drumMachine.triggerStep(0), 1);
  const drumCommitted = drumGame.spectraRecorder.stop({ commit: true });
  assert.equal(drumCommitted.length, 1);
  assert.equal(drumCommitted[0].id, drumTarget.id);
  assert.match(drumTarget.performance.events[0].drum, /kick/);

  const modularStudio = new StudioSession();
  const synthTarget = modularStudio.stems.find((stem) => stem.inputKey === 'modular');
  modularStudio.toggleRecordArm(synthTarget.id);
  const modularGame = {
    state: { data: { modularSynth: normalizeModularPatchState() } },
    studio: modularStudio,
    studioPlayback: {
      playing: false,
      position: () => 0,
      updateMix: () => {},
      monitorLiveEvent: () => true,
    },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: null,
    save: () => {},
  };
  modularGame.spectraRecorder = new SpectraRecorder(modularGame, {});
  const modular = new ModularSynthSystem(modularGame, { panel: () => {}, warning: () => {} });

  assert.ok(modularGame.spectraRecorder.arm());
  assert.equal(modular.triggerStep(0), true);
  const modularCommitted = modularGame.spectraRecorder.stop({ commit: true });
  assert.equal(modularCommitted.length, 1);
  assert.equal(modularCommitted[0].id, synthTarget.id);
  assert.equal(typeof synthTarget.performance.events[0].midi, 'number');
});

test('guitar still records exactly once after multiplayer wraps the live instrument methods', () => {
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
  const guitar = studio.stems.find((stem) => stem.inputKey === 'guitar');
  studio.toggleRecordArm(guitar.id);

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
    player: { position: { x: 0, y: 0, z: 0 } },
    save: () => {},
  };
  game.spectraRecorder = new SpectraRecorder(game, {});
  connectKeyboardPerformanceToSpectra(game);

  const sent = [];
  const world = {
    useTarget: async (_target, action) => action(),
    resourceForTarget: () => 'upstairs:guitar',
    owns: () => true,
    localClaims: new Map(),
    handleObjectState: () => {},
  };
  const client = {
    game,
    world,
    joined: true,
    localId: 'local',
    send: (message) => {
      sent.push(message);
      return true;
    },
  };
  game.multiplayer = client;
  const sync = new InstrumentSync(client);
  sync.activeResourceId = 'upstairs:guitar';

  assert.ok(game.spectraRecorder.arm());
  keyboard.start({
    mode: 'guitar',
    stemKind: 'guitar',
    inputKey: 'guitar',
    label: 'Electric guitar',
    wave: 'sawtooth',
    volume: 0.06,
    duration: 0.5,
  });
  assert.equal(keyboard.playMidi(43), true);

  const committed = game.spectraRecorder.stop({ commit: true });
  assert.equal(committed.length, 1);
  assert.equal(committed[0].id, guitar.id);
  assert.equal(guitar.performance.events.length, 1);
  assert.equal(guitar.performance.events[0].midi, 43);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].data.config.inputKey, 'guitar');

  sync.dispose();
  keyboard.dispose();
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
