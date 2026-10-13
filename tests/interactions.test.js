import test from 'node:test';
import assert from 'node:assert/strict';
import { InteractionSystem } from '../src/interactions/InteractionSystem.js';
import { createActions } from '../src/interactions/createActions.js';
import { InputController } from '../src/player/InputController.js';
import { interactionVerb } from '../src/ui/Hud.js';
import { levels } from '../src/world/levels.js';
import { StudioSession } from '../src/studio/StudioSession.js';

test('only in-range interactions on the active floor are offered', () => {
  const dispatched = [];
  const interactions = new InteractionSystem((target) => dispatched.push(target.id));
  interactions.setLevel(levels.upstairs);
  const [x, y, z] = levels.upstairs.anchors.stairs.position;
  assert.equal(interactions.interact({ x, y, z }), true);
  assert.deepEqual(dispatched, ['stairs']);
  interactions.setLevel(levels.downstairs);
  assert.equal(interactions.nearest({ x: -7.8, y: 0, z: -2.5 }), null);
  assert.equal(interactions.interact({ x: 1.5, y: 0, z: -2.15 }), true);
  assert.equal(dispatched.at(-1), 'dj');
});

test('a nearer out-of-range target does not mask an eligible larger interaction radius', () => {
  const interactions = new InteractionSystem(() => {});
  interactions.setLevel({
    anchors: {
      small: { position: [1, 0, 0], radius: 0.1 },
      large: { position: [2, 0, 0], radius: 3 },
    },
  });
  assert.equal(interactions.nearest({ x: 0, y: 0, z: 0 }).id, 'large');
});

test('instrument, console and DJ actions survive extraction; stale panel actions cannot act across floors', () => {
  const calls = [];
  const audio = Object.fromEntries(
    ['kick', 'hat', 'chord', 'tone', 'play', 'stop'].map((name) => [
      name,
      (...args) => calls.push([name, ...args]),
    ]),
  );
  const sceneManager = {
    current: { definition: levels.upstairs },
    request: (id) => calls.push(['travel', id]),
  };
  let panelActions;
  const dispatch = createActions({
    audio,
    sceneManager,
    ui: {
      panel: (title, text, actions) => {
        panelActions = actions;
      },
    },
    canAct: () => true,
  });
  for (const id of ['drums', 'piano', 'synth']) dispatch(levels.upstairs.anchors[id]);
  assert.equal(calls.filter(([name]) => name === 'tone').length, 2);
  assert.ok(calls.some(([name, delay]) => name === 'hat' && delay === 0.11));
  dispatch(levels.upstairs.anchors.console);
  panelActions[0][1]();
  assert.deepEqual(calls.at(-1), ['play', 'night-bus']);
  const stalePlay = panelActions[0][1];
  sceneManager.current.definition = levels.downstairs;
  dispatch(levels.downstairs.anchors.dj);
  panelActions[0][1]();
  assert.deepEqual(calls.at(-1), ['play', 'glass-floor']);
  stalePlay();
  assert.deepEqual(calls.at(-1), ['play', 'glass-floor']);
  panelActions[1][1]();
  assert.deepEqual(calls.at(-1), ['play', '3am-tool']);
  panelActions[2][1]();
  assert.deepEqual(calls.at(-1), ['stop']);
});

test('Spectra Vocal station records the native browser mic into the default Vocal track', async () => {
  const studio = new StudioSession();
  const vocal = studio.stems.find((stem) => stem.inputKey === 'vocal');
  assert.ok(vocal);

  let panelActions = [];
  let started = 0;
  let stopped = 0;
  const blob = new Blob(['real microphone audio'], { type: 'audio/mp4' });
  const dispatch = createActions({
    audio: {
      async recoverAfterMicrophoneCapture() {
        return true;
      },
    },
    sceneManager: {
      current: { definition: levels.upstairs },
    },
    ui: {
      panel(title, text, actions) {
        panelActions = actions;
      },
      warning() {},
    },
    studio,
    studioPlayback: {
      updateMix() {},
    },
    micRecorder: {
      supported: true,
      async start() {
        started += 1;
        return true;
      },
      async stop() {
        stopped += 1;
        return {
          blob,
          type: 'audio/mp4',
          timelineStart: 0,
        };
      },
      cancel() {},
    },
    state: { data: {} },
    saveState() {},
    canAct: () => true,
  });

  dispatch(levels.upstairs.anchors.vocalMic);
  assert.match(String(panelActions[0][0]), /Record to Vocal/i);

  await panelActions[0][1]();
  assert.equal(started, 1);
  assert.match(String(panelActions[0][0]), /Stop \+ commit to Vocal/i);

  await panelActions[0][1]();
  assert.equal(stopped, 1);
  assert.equal(studio.recordingBlobs.get(vocal.id), blob);
  assert.equal(vocal.source, 'browser-microphone');
  assert.equal(vocal.inputKey, 'vocal');
});

test('mobile primary action label explains what the nearby interaction will do', () => {
  assert.equal(interactionVerb(null), 'ACTION');
  assert.equal(interactionVerb({ action: 'dialogue', name: 'Nora' }), 'TALK');
  assert.equal(
    interactionVerb({ action: 'travel', name: 'Club entrance', target: 'downstairs@alley' }),
    'ENTER',
  );
  assert.equal(
    interactionVerb({ action: 'travel', name: 'Emergency exit', target: 'alley@clubDoor' }),
    'EXIT',
  );
  assert.equal(interactionVerb({ action: 'photoWall', name: 'Nora photo wall' }), 'VIEW');
  assert.equal(
    interactionVerb({ action: 'installation', name: 'Immersive installation' }),
    'CONTROL',
  );
  assert.equal(interactionVerb({ action: 'dj', name: 'DJ booth' }), 'USE');
});

test('input is gated, normalizes diagonals, clears on blur, and ignores repeat actions', () => {
  const target = new EventTarget();
  const input = new InputController(target);
  const key = (type, key, repeat = false) =>
    target.dispatchEvent(Object.assign(new Event(type), { key, repeat }));
  key('keydown', 'w');
  assert.deepEqual(input.movement(), { x: 0, z: 0 });
  input.setEnabled(true);
  key('keydown', 'w');
  key('keydown', 'd');
  assert.ok(Math.abs(Math.hypot(...Object.values(input.movement())) - 1) < 1e-9);
  key('keydown', 'e');
  key('keydown', 'e', true);
  assert.equal(input.consume('interact'), true);
  assert.equal(input.consume('interact'), false);
  target.dispatchEvent(new Event('blur'));
  assert.deepEqual(input.movement(), { x: 0, z: 0 });
  input.dispose();
  key('keydown', 'w');
  assert.deepEqual(input.movement(), { x: 0, z: 0 });
});
