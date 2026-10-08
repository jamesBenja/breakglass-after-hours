import test from 'node:test';
import assert from 'node:assert/strict';
import { RoofEndgameSystem } from '../src/gameplay/RoofEndgameSystem.js';

function harness({ fixed = false } = {}) {
  const machines = [];
  const stops = [];
  const tones = [];
  const data = {
    roofAcFixed: fixed,
    roofAcKicks: 0,
    roofAcRepairs: fixed ? 1 : 0,
    roofThrownItems: [],
  };
  const game = {
    state: { data },
    audio: { context: {} },
    spatialAudio: {
      setPointMachine(owner, settings) {
        machines.push({ owner, settings });
        return true;
      },
      stopPointMachine(owner) {
        stops.push(owner);
        return true;
      },
      pointTone(position, settings) {
        tones.push({ position, settings });
        return true;
      },
    },
    sceneManager: { current: { definition: { id: 'roof' } } },
    scenes: new Map(),
    save() {},
  };
  const ui = { panel() {} };
  return { game, ui, data, machines, stops, tones };
}

test('broken roof AC emits a spatial irregular machine hum from the physical unit', () => {
  const h = harness();
  const system = new RoofEndgameSystem(h.game, h.ui);
  system.syncAcAudio(true);

  const latest = h.machines.at(-1);
  assert.equal(latest.owner, 'roof-ac');
  assert.deepEqual(latest.settings.position, [5.35, 0.72, -2.55]);
  assert.equal(latest.settings.baseFrequency, 91);
  assert.equal(latest.settings.pulseRate, 7.8);
  assert.ok(latest.settings.pulseDepth > 0.005);
});

test('AC alignment audio becomes steadier as the repair reaches centre', () => {
  const h = harness();
  const system = new RoofEndgameSystem(h.game, h.ui);
  system.acStage = 1;
  system.acAlignment = 3;
  system.syncAcAudio(true);
  const rough = h.machines.at(-1).settings;

  system.acAlignment = 0;
  system.syncAcAudio(true);
  const centred = h.machines.at(-1).settings;

  assert.ok(rough.pulseRate > centred.pulseRate);
  assert.ok(rough.pulseDepth > centred.pulseDepth);
});

test('fixed AC becomes a quieter steady spatial hum and repair actions make point sounds', () => {
  const h = harness();
  const system = new RoofEndgameSystem(h.game, h.ui);

  system.kickAc();
  assert.ok(h.tones.length >= 2);
  assert.ok(h.tones.every((tone) => tone.position[0] === 5.35));

  system.acStage = 1;
  system.acAlignment = 1;
  system.acNudge(-1);
  assert.ok(h.tones.some((tone) => tone.settings.frequency === 186));

  system.acLock();
  system.finishAcRepair();
  assert.equal(h.data.roofAcFixed, true);
  const fixed = h.machines.at(-1).settings;
  assert.equal(fixed.baseFrequency, 106);
  assert.ok(fixed.volume < 0.02);
  assert.ok(fixed.pulseDepth < 0.001);
});

test('roof AC spatial source stops when the player leaves the roof', () => {
  const h = harness();
  const system = new RoofEndgameSystem(h.game, h.ui);
  system.syncAcAudio(true);
  h.game.sceneManager.current.definition.id = 'upstairs';
  system.syncAcAudio();
  assert.equal(h.stops.at(-1), 'roof-ac');
});
