import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_GOOD_PLUNGES,
  adjustPlungerAngle,
  createPlungeChallenge,
  plungeToilet,
} from '../src/gameplay/ClubBathroomSystem.js';
import {
  ModularSynthSystem,
  createModularPerformance,
  modularPatchIsAudible,
  modularStepEvent,
  normalizeModularPatchState,
} from '../src/gameplay/ModularSynthSystem.js';
import { levels } from '../src/world/levels.js';
import { createUpstairsDefinition } from '../src/world/upstairs/definition.js';

test('Below bathroom is a navigable room with two toilets, urinal, sink and plunger', () => {
  const downstairs = levels.downstairs;
  assert.ok(downstairs.navigation.surfaces.some((surface) => surface.id === 'bathroom'));
  assert.equal(downstairs.anchors.bathroomStall1.fixtureKind, 'toilet');
  assert.equal(downstairs.anchors.bathroomStall2.fixtureKind, 'toilet');
  assert.equal(downstairs.anchors.bathroomStall2.clogged, true);
  assert.equal(downstairs.anchors.bathroomUrinal.fixtureKind, 'urinal');
  assert.equal(downstairs.anchors.bathroomSink.fixtureKind, 'sink');
  assert.equal(downstairs.anchors.bathroomPlunger.action, 'bathroomPlunge');
});

test('plunger minigame rewards the correct angle and can flood after bad plunges', () => {
  let challenge = createPlungeChallenge(0);
  while (challenge.angle < challenge.targetAngle)
    challenge = adjustPlungerAngle(challenge, Math.min(5, challenge.targetAngle - challenge.angle));
  for (let i = 0; i < REQUIRED_GOOD_PLUNGES; i++) challenge = plungeToilet(challenge);
  assert.equal(challenge.status, 'cleared');
  assert.equal(challenge.goodPlunges, REQUIRED_GOOD_PLUNGES);

  challenge = createPlungeChallenge(0);
  while (challenge.status === 'active') challenge = plungeToilet(challenge);
  assert.equal(challenge.status, 'flooded');
});

test('the patch rack beside Spectra is an interactable modular sequencer', () => {
  const upstairs = createUpstairsDefinition('B');
  assert.equal(upstairs.anchors.modularSynth.action, 'modularSynth');
  assert.ok(upstairs.anchors.modularSynth.name.toLowerCase().includes('modular'));
  assert.ok(upstairs.fixtures.some((fixture) => fixture.id === 'patch-rack'));
});

test('modular patch creates console-compatible performance events and respects broken signal paths', () => {
  const patch = normalizeModularPatchState({
    steps: [0, null, 7, null, 3, null, 10, null, 0, null, 12, null, 7, null, 3, null],
    lfoToVco: true,
  });
  assert.equal(modularPatchIsAudible(patch), true);
  const performance = createModularPerformance(patch, 120, 2);
  assert.equal(performance.mode, 'synth');
  assert.equal(performance.bpm, 120);
  assert.equal(performance.duration, 4);
  assert.ok(performance.events.length > 8);
  assert.ok(performance.events.every((event) => Number.isFinite(event.frequency)));

  patch.vcfToVca = false;
  assert.equal(modularPatchIsAudible(patch), false);
  assert.equal(createModularPerformance(patch, 120, 1).events.length, 0);
});

test('live modular step reads the current patch on every pass', () => {
  const patch = normalizeModularPatchState({
    baseMidi: 48,
    steps: [
      0,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  });
  const first = modularStepEvent(patch, 0);
  patch.steps[0] = 7;
  const edited = modularStepEvent(patch, 0);
  assert.equal(first.midi, 48);
  assert.equal(edited.midi, 55);
  assert.notEqual(first.frequency, edited.frequency);

  patch.vcfToVca = false;
  assert.equal(modularStepEvent(patch, 0), null);
});

test('step grid can be edited while live playback remains running', () => {
  const tones = [];
  const game = {
    state: {
      data: {
        modularSynth: normalizeModularPatchState({
          steps: [
            0,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        }),
      },
    },
    studio: { bpm: 120, swing: 0, loopEnabled: false, loopBars: 1 },
    audio: { tone: (...args) => tones.push(args) },
    save: () => {},
  };
  const ui = { panel: () => {}, warning: () => {}, document: null, buttons: null };
  const modular = new ModularSynthSystem(game, ui);
  modular.playing = true;

  assert.equal(modular.triggerStep(0), true);
  const originalFrequency = tones.at(-1)[0];

  modular.selectedStepValue = 7;
  modular.editStep(0);
  assert.equal(modular.playing, true);
  assert.equal(modular.patch.steps[0], 7);
  assert.equal(modular.triggerStep(0), true);
  assert.notEqual(tones.at(-1)[0], originalFrequency);

  modular.editStep(0);
  assert.equal(modular.patch.steps[0], null);
  assert.equal(modular.triggerStep(0), false);

  modular.adjustTempo(5);
  assert.equal(modular.playing, true);
  assert.equal(game.studio.bpm, 125);
});

test('live modular steps publish into the shared instrument stream for Spectra capture', () => {
  const published = [];
  const game = {
    state: { data: { modularSynth: normalizeModularPatchState() } },
    studio: { bpm: 120, loopEnabled: true, loopBars: 2 },
    audio: { tone: () => {} },
    multiplayer: {
      instrumentSync: {
        activeResourceId: 'upstairs:another-instrument',
        publishExternal: (...args) => published.push(args),
      },
    },
    save: () => {},
  };
  const ui = { panel: () => {}, warning: () => {}, document: null, buttons: null };
  const modular = new ModularSynthSystem(game, ui);

  assert.equal(modular.triggerStep(0, 0.03), true);
  assert.equal(published.length, 1);
  assert.equal(published[0][0].label, 'Spectra modular sequencer');
  assert.equal(published[0][0].stemKind, 'synth');
  assert.equal(published[0][1].type, 'midi');
  assert.equal(published[0][1].midi, 48);
  assert.equal(published[0][2].resourceId, 'upstairs:modularSynth');
  assert.equal(published[0][2].offsetSeconds, 0.03);
});

test('live modular loop follows the shared Spectra transport and stops cleanly', async () => {
  const tones = [];
  let transportCallback = null;
  const acquired = [];
  const released = [];
  let globalStops = 0;
  let studioStops = 0;
  let djStops = 0;
  const audio = {
    context: { state: 'running', currentTime: 0 },
    init: async () => {},
    tone: (...args) => tones.push(args),
    stop: () => {
      globalStops += 1;
    },
  };
  const spectraTransport = {
    subscribe: (id, callback) => {
      assert.equal(id, 'modular-synth');
      transportCallback = callback;
      return () => {
        transportCallback = null;
      };
    },
    acquire: (owner) => acquired.push(owner),
    release: (owner) => released.push(owner),
  };
  const game = {
    state: { data: { modularSynth: normalizeModularPatchState() } },
    studio: { bpm: 120, loopEnabled: false, loopBars: 1 },
    spectraTransport,
    studioPlayback: {
      stop: () => {
        studioStops += 1;
      },
    },
    dj: {
      stop: () => {
        djStops += 1;
      },
    },
    audio,
    save: () => {},
  };
  const ui = { panel: () => {}, warning: () => {}, document: null, buttons: null };
  const modular = new ModularSynthSystem(game, ui);

  await modular.startLoop();
  assert.equal(modular.playing, true);
  assert.equal(typeof transportCallback, 'function');
  assert.deepEqual(acquired, ['modular-synth']);
  assert.equal(globalStops, 0);
  assert.equal(studioStops, 0);
  assert.equal(djStops, 0);

  transportCallback({ loopStep: 0, when: 0.03 });
  assert.equal(modular.currentStep, 0);
  assert.ok(tones.length >= 1);

  transportCallback({ loopStep: 3, when: 0.01 });
  assert.equal(modular.currentStep, 3);

  modular.stopLoop(false);
  assert.equal(modular.playing, false);
  assert.equal(transportCallback, null);
  assert.deepEqual(released, ['modular-synth']);
  assert.equal(globalStops, 0);
  assert.equal(studioStops, 0);
  assert.equal(djStops, 0);
});
