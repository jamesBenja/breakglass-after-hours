import test from 'node:test';
import assert from 'node:assert/strict';

import { createActions } from '../src/interactions/createActions.js';
import { StudioSession } from '../src/studio/StudioSession.js';

function makeHarness(requestSpectraConsoleAccess) {
  const studio = new StudioSession();
  let mixerRenders = 0;
  const ui = {
    document: {
      createElement() {
        return {
          textContent: '',
          onclick: null,
          append() {},
          appendChild() {},
          classList: { add() {}, contains() { return false; } },
        };
      },
    },
    buttons: {
      appendChild() {},
    },
    studioMixer() {
      mixerRenders += 1;
    },
    panel() {},
    warning() {},
  };

  createActions({
    audio: {},
    spatialAudio: null,
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    player: null,
    ui,
    state: { data: {} },
    studio,
    studioPlayback: {
      playing: false,
      updateMix() {},
      updateStemMix() {},
      applyLiveMix() {},
      stop() {},
      play: async () => true,
    },
    micRecorder: { supported: false },
    keyboardPerformance: null,
    photos: null,
    dj: null,
    saveState() {},
    canAct: () => true,
    requestSpectraConsoleAccess,
  });

  return { ui, getMixerRenders: () => mixerRenders };
}

test('every direct Spectra mixer navigation is blocked when console access is denied', async () => {
  let checks = 0;
  const { ui, getMixerRenders } = makeHarness(async () => {
    checks += 1;
    return false;
  });

  const opened = await ui._spectraStudioNavigation.mixer();

  assert.equal(opened, false);
  assert.equal(checks, 1);
  assert.equal(getMixerRenders(), 0);
});

test('direct Spectra mixer navigation renders only after shared console access is granted', async () => {
  let checks = 0;
  const { ui, getMixerRenders } = makeHarness(async () => {
    checks += 1;
    return true;
  });

  const opened = await ui._spectraStudioNavigation.mixer();

  assert.equal(opened, true);
  assert.equal(checks, 1);
  assert.equal(getMixerRenders(), 1);
});
