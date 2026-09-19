import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/AudioEngine.js';
import { LightingControlSystem } from '../src/gameplay/LightingControlSystem.js';
import { dialogues } from '../src/npcs/dialogues.js';
import { levels } from '../src/world/levels.js';

test('Killy is present beside separately named lighting and VJ controls', () => {
  const downstairs = levels.downstairs;
  assert.equal(downstairs.anchors.lightingDesk.name, 'Lighting desk controls');
  assert.equal(downstairs.anchors.ledWallDesk.name, 'Visuals / VJ controls');
  assert.ok(downstairs.npcs.some((npc) => npc.id === 'killy'));
  assert.equal(
    dialogues.killy.text,
    '“I love lasers and especially haze. Hope I don’t set off another fire alarm…”',
  );
});

test('Killy rides party lighting automatically but yields to manual desk control', () => {
  const state = {
    preset: 'warmup',
    palette: 'breakglass',
    haze: 0.2,
    lasers: false,
  };
  const palettes = ['breakglass', 'redroom', 'ultraviolet', 'cyanAmber', 'acid'];
  const rig = {
    snapshot: () => ({ ...state }),
    applyPreset: (preset) => {
      state.preset = preset;
    },
    cyclePalette: () => {
      const index = Math.max(0, palettes.indexOf(state.palette));
      state.palette = palettes[(index + 1) % palettes.length];
      return state.palette;
    },
    setLasers: (enabled) => {
      state.lasers = !!enabled;
    },
    setHaze: (value) => {
      state.haze = value;
    },
    toggleLasers: () => {
      state.lasers = !state.lasers;
    },
    adjustHaze: (delta) => {
      state.haze += delta;
    },
  };
  const audio = {
    metrics: () => ({
      playing: true,
      energy: 0.94,
      vibe: 0.9,
      bass: 0.82,
      mixQuality: 0.92,
    }),
  };
  const system = new LightingControlSystem({
    ui: { panel() {} },
    sceneManager: { current: { definition: { id: 'downstairs' }, lighting: rig } },
    audio,
  });

  system.update(0.1);
  assert.equal(state.preset, 'peak');
  assert.notEqual(state.palette, 'breakglass');
  assert.ok(state.haze > 0.5);

  const manualSnapshot = { ...state };
  system.claimManualControl();
  system.update(0.2);
  assert.deepEqual(state, manualSnapshot, 'automatic cues must not overwrite the manual desk');

  system.releaseToKilly();
  system.autoClock = 8.1;
  system.laserCountdown = 0;
  system.update(0.1);
  assert.equal(state.lasers, true, 'Killy should bring lasers back during a high-energy phase');
});

test('background audio preserves native playback intent and retries after Safari blocks resume', async () => {
  const context = {
    state: 'running',
    currentTime: 0,
    async suspend() {
      this.state = 'suspended';
    },
    async resume() {
      this.state = 'running';
    },
  };
  const audio = new AudioEngine({ contextFactory: () => context });
  audio.context = context;

  let playCalls = 0;
  const element = {
    paused: false,
    volume: 0.8,
    pause() {
      this.paused = true;
    },
    async play() {
      playCalls += 1;
      if (playCalls === 1) throw new Error('gesture required');
      this.paused = false;
    },
  };
  audio.nativeMedia.set('club', {
    element,
    baseVolume: 0.8,
    owner: 'club',
    resumeAfterSuspend: false,
  });

  await audio.suspend();
  assert.equal(context.state, 'suspended');
  assert.equal(element.paused, true);
  assert.equal(audio.nativeMedia.get('club').resumeAfterSuspend, true);

  assert.equal(await audio.resume(), false);
  assert.equal(audio._nativeMediaResumePending, true);
  assert.equal(element.paused, true);

  assert.equal(await audio.resume(), true);
  assert.equal(audio._nativeMediaResumePending, false);
  assert.equal(element.paused, false);
  assert.equal(element.volume, 0.8);
});
