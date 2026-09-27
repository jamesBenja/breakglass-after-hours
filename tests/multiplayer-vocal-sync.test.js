import test from 'node:test';
import assert from 'node:assert/strict';
import { VocalSync } from '../src/multiplayer/VocalSync.js';
import { StudioSession } from '../src/studio/StudioSession.js';

function audioContext(sampleRate = 48000) {
  return {
    state: 'running',
    sampleRate,
    createBuffer(channels, frames, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(frames));
      return {
        duration: frames / rate,
        numberOfChannels: channels,
        length: frames,
        sampleRate: rate,
        getChannelData: (channel) => data[channel],
      };
    },
  };
}

function microphoneRecorder() {
  return {
    supported: true,
    spectraTargetStemId: null,
    async start() {
      return true;
    },
    async stop() {
      return null;
    },
  };
}

function clientFor({
  studio = new StudioSession(),
  localId = 'producer',
  controllerId = localId,
  remotePlayers = new Map(),
  channel = null,
} = {}) {
  let channelHandler = null;
  const micRecorder = microphoneRecorder();
  const playback = {
    playing: false,
    stopped: [],
    stopRecordedStemPlayback(id) {
      this.stopped.push(id);
      return true;
    },
    updateMix() {
      return true;
    },
    async resyncRecordedVocalPlayback() {
      return 1;
    },
  };
  const game = {
    studio,
    studioPlayback: playback,
    micRecorder,
    audio: { context: audioContext() },
    state: { data: { avatar: { displayName: localId } } },
    saveCalls: 0,
    save() {
      this.saveCalls += 1;
    },
  };
  const media = {
    registerDataChannel(label, handler) {
      assert.equal(label, 'spectra-vocal');
      channelHandler = handler;
      return true;
    },
    dataChannel(peerId, label) {
      assert.equal(label, 'spectra-vocal');
      if (channel && channelHandler && !channel._bound) {
        channel._bound = true;
        channelHandler(peerId, channel);
      }
      return channel;
    },
  };
  const client = {
    game,
    media,
    localId,
    remotePlayers,
    world: {
      resources: new Map([
        ['upstairs:console', { id: 'upstairs:console', ownerId: controllerId }],
      ]),
    },
  };
  game.multiplayer = client;
  return { client, game, playback, micRecorder };
}

test('multiplayer Vocal PCM attaches to the exact producer Vocal track', async () => {
  const studio = new StudioSession();
  const vocalTwo = studio.addInputTrack('vocal');
  studio.toggleRecordArm(vocalTwo.id);
  const { client, game, playback } = clientFor({
    studio,
    localId: 'producer',
    controllerId: 'producer',
  });
  const sync = new VocalSync(client);

  const pcm = new Int16Array([0, 8192, -16384, 24576, -32768, 32767]);
  sync.beginIncoming('vocalist', {
    type: 'vocal-start',
    transferId: 'take-1',
    originId: 'vocalist',
    originName: 'Guest Vocalist',
    targetStemId: vocalTwo.id,
    sampleRate: 6,
    frames: pcm.length,
    duration: 1,
    timelineStart: 0.5,
    pcmPeak: 1,
    pcmRms: 0.4,
  });
  sync.appendIncoming('vocalist', new Uint8Array(pcm.buffer));
  assert.equal(
    await sync.finishIncoming('vocalist', {
      type: 'vocal-end',
      transferId: 'take-1',
      chunks: 1,
      bytes: pcm.byteLength,
    }),
    true,
  );

  const buffer = studio.recordings.get(vocalTwo.id);
  assert.ok(buffer);
  assert.equal(buffer.duration, 1);
  assert.equal(buffer.sampleRate, 6);
  assert.equal(vocalTwo.vocalCaptureMode, 'multiplayer-pcm');
  assert.equal(vocalTwo.vocalMultiplayerOriginId, 'vocalist');
  assert.equal(vocalTwo.vocalMultiplayerOriginName, 'Guest Vocalist');
  assert.equal(vocalTwo.vocalTimelineStart, 0.5);
  assert.equal(playback.stopped.at(-1), vocalTwo.id);
  assert.equal(game.saveCalls, 1);
  assert.ok(Math.abs(buffer.getChannelData(0)[1] - 0.25) < 0.001);
  assert.ok(Math.abs(buffer.getChannelData(0)[2] + 0.5) < 0.001);

  sync.dispose();
});

test('vocalist sends finished PCM to the player holding the Spectra console', async () => {
  const sent = [];
  const listeners = new Map();
  const channel = {
    readyState: 'open',
    bufferedAmount: 0,
    label: 'spectra-vocal',
    binaryType: 'blob',
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    send(payload) {
      sent.push(payload);
    },
    close() {},
  };
  const studio = new StudioSession();
  const vocalTwo = studio.addInputTrack('vocal');
  studio.toggleRecordArm(vocalTwo.id);
  const { client, micRecorder } = clientFor({
    studio,
    localId: 'vocalist',
    controllerId: 'producer',
    remotePlayers: new Map([['producer', { avatar: { displayName: 'Producer' } }]]),
    channel,
  });
  const sync = new VocalSync(client);
  micRecorder.spectraTargetStemId = vocalTwo.id;

  const samples = Float32Array.from([0, 0.25, -0.5, 0.75, -1, 1]);
  const result = {
    buffer: {
      duration: 1,
      sampleRate: 6,
      numberOfChannels: 1,
      getChannelData: () => samples,
    },
    timelineStart: 0.75,
    pcmPeak: 1,
    pcmRms: 0.5,
  };

  assert.equal(await sync.publishLocalTake(result), true);
  const start = JSON.parse(sent.find((item) => typeof item === 'string' && item.includes('vocal-start')));
  const end = JSON.parse(sent.find((item) => typeof item === 'string' && item.includes('vocal-end')));
  const binary = sent.filter((item) => item instanceof ArrayBuffer);

  assert.equal(start.targetStemId, vocalTwo.id);
  assert.equal(start.originId, 'vocalist');
  assert.equal(start.frames, samples.length);
  assert.equal(start.sampleRate, 6);
  assert.equal(start.timelineStart, 0.75);
  assert.equal(binary.length, 1);
  assert.equal(binary[0].byteLength, samples.length * 2);
  assert.equal(end.bytes, samples.length * 2);
  assert.equal(
    sync.traceEntries.some((entry) => entry.event === 'transfer:sent'),
    true,
  );

  sync.dispose();
});
