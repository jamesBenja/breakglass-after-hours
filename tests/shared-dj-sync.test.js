import test from 'node:test';
import assert from 'node:assert/strict';
import { SharedWorld } from '../src/multiplayer/SharedWorld.js';

function djHarness() {
  const decks = Object.fromEntries(
    ['A', 'B', 'C', 'D'].map((id) => [
      id,
      {
        id,
        trackId: 'got-you-dancin',
        bpm: 120,
        level: 0.8,
        low: 0,
        mid: 0,
        high: 0,
        playing: false,
        deviceMode: ['C', 'D'].includes(id) ? 'vinyl' : 'cdj',
      },
    ]),
  );
  const beatFx = {
    enabled: false,
    target: 'MASTER',
    effect: 'ECHO',
    beat: 0.5,
    amount: 0.35,
  };
  return {
    decks,
    _beatFx: beatFx,
    snapshot() {
      return {
        crossfader: 0,
        metrics: {},
        beatFx: { ...beatFx },
        decks: Object.fromEntries(
          Object.entries(decks).map(([id, deck]) => [id, { ...deck }]),
        ),
      };
    },
    deckPosition(id) {
      return { A: 1, B: 2, C: 3, D: 4 }[id];
    },
    setCrossfader(value) {
      this.crossfader = value;
    },
    load(id, trackId) {
      this.decks[id].trackId = trackId;
    },
    setBpm(id, value) {
      this.decks[id].bpm = value;
    },
    setLevel(id, value) {
      this.decks[id].level = value;
    },
    setEq(id, band, value) {
      this.decks[id][band] = value;
    },
    setFilter(id, value) {
      this.decks[id].filter = value;
    },
    setReverb(id, value) {
      this.decks[id].reverb = value;
    },
    setEcho(id, value) {
      this.decks[id].echo = value;
    },
    setDeviceMode(id, value) {
      this.decks[id].deviceMode = value;
    },
    setVinylRpm(id, value) {
      this.decks[id].vinylRpm = value;
    },
    toggleMotor(id) {
      this.decks[id].motorOn = !this.decks[id].motorOn;
    },
    setPlatterHeld(id, value) {
      this.decks[id].platterHeld = value;
    },
    setBeatFxTarget(value) {
      beatFx.target = value;
    },
    setBeatFxEffect(value) {
      beatFx.effect = value;
    },
    setBeatFxBeat(value) {
      beatFx.beat = value;
    },
    setBeatFxAmount(value) {
      beatFx.amount = value;
    },
    setBeatFxEnabled(value) {
      beatFx.enabled = value === true;
    },
    stopDeck(id) {
      this.decks[id].playing = false;
    },
  };
}

test('shared DJ state applies all four channels, mid EQ and A9 Beat FX', async () => {
  const dj = djHarness();
  const client = {
    game: {
      dj,
      sceneManager: { current: null },
      player: { position: {} },
    },
    ui: {},
    joined: true,
    localId: 'listener',
    room: 'test-room',
    url: 'wss://multiplayer.example',
    send() {},
    serverNow: () => 1000,
  };
  const world = new SharedWorld(client);

  await world.applyDj({
    crossfader: 0.42,
    updatedAt: 1000,
    beatFx: {
      enabled: true,
      target: 'CH4',
      effect: 'PING PONG',
      beat: 0.75,
      amount: 0.62,
    },
    decks: {
      A: { trackId: 'got-you-dancin', bpm: 121, level: 0.71, mid: 0.11 },
      B: { trackId: 'in-flux-just-be', bpm: 122, level: 0.72, mid: 0.12 },
      C: { trackId: 'atrakar', bpm: 123, level: 0.73, mid: -0.37, deviceMode: 'vinyl' },
      D: { trackId: 'dubki', bpm: 124, level: 0.74, mid: 0.14, deviceMode: 'vinyl' },
    },
  });

  assert.equal(dj.crossfader, 0.42);
  assert.equal(dj.decks.A.mid, 0.11);
  assert.equal(dj.decks.B.mid, 0.12);
  assert.equal(dj.decks.C.mid, -0.37);
  assert.equal(dj.decks.D.mid, 0.14);
  assert.deepEqual(dj._beatFx, {
    enabled: true,
    target: 'CH4',
    effect: 'PING PONG',
    beat: 0.75,
    amount: 0.62,
  });

  const snapshot = world.djSnapshot();
  assert.equal(snapshot.decks.A.position, 1);
  assert.equal(snapshot.decks.B.position, 2);
  assert.equal(snapshot.decks.C.position, 3);
  assert.equal(snapshot.decks.D.position, 4);
});
