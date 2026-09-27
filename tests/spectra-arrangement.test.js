import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioPlayback } from '../src/studio/StudioPlayback.js';
import { StudioSession } from '../src/studio/StudioSession.js';

function fakeBuffer(numberOfChannels, length, sampleRate) {
  const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  return {
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData(channel) {
      return channels[channel];
    },
  };
}

function fakeAudioContext(sampleRate = 8) {
  return {
    sampleRate,
    createBuffer(numberOfChannels, length, rate) {
      return fakeBuffer(numberOfChannels, length, rate);
    },
  };
}

test('Spectra arrangement expands with silent bars and keeps source clips non-destructive', () => {
  const session = new StudioSession({ project: true, loopEnabled: true, loopBars: 4 });
  const guitar = session.stems.find((stem) => stem.inputKey === 'guitar');

  assert.equal(session.arrangementBars, 4);
  assert.deepEqual(session.arrangementCell(guitar.id, 0), { sourceBar: 0, muted: false });
  assert.deepEqual(session.arrangementCell(guitar.id, 3), { sourceBar: 3, muted: false });

  session.setArrangementBars(8);
  assert.equal(session.arrangementBars, 8);
  assert.equal(session.arrangementCell(guitar.id, 4), null);

  const clipboard = session.copyArrangementBar(guitar.id, 0);
  assert.equal(session.pasteArrangementBar(guitar.id, 4, clipboard), true);
  assert.deepEqual(session.arrangementCell(guitar.id, 4), { sourceBar: 0, muted: false });

  assert.equal(session.toggleArrangementBarMute(guitar.id, 4), true);
  assert.deepEqual(session.arrangementCell(guitar.id, 4), { sourceBar: 0, muted: true });
  assert.equal(session.clearArrangementBar(guitar.id, 4), true);
  assert.equal(session.arrangementCell(guitar.id, 4), null);
});

test('Spectra arrangement snapshot survives save/load and source-loop changes do not erase edits', () => {
  const session = new StudioSession({ project: true, loopEnabled: true, loopBars: 4 });
  const synth = session.stems.find((stem) => stem.inputKey === 'synth');

  session.setArrangementBars(8);
  session.pasteArrangementBar(synth.id, 6, session.copyArrangementBar(synth.id, 2));
  session.toggleArrangementBarMute(synth.id, 6);

  const restored = new StudioSession(session.snapshot());
  assert.equal(restored.arrangementBars, 8);
  assert.deepEqual(restored.arrangementCell(synth.id, 6), { sourceBar: 2, muted: true });

  restored.setLoopBars(2);
  assert.equal(restored.arrangementBars, 8);
  assert.equal(restored.arrangementCell(synth.id, 6), null);

  const fresh = new StudioSession({ project: true, loopEnabled: true, loopBars: 4 });
  fresh.setLoopBars(8);
  assert.equal(fresh.arrangementBars, 8);
  assert.deepEqual(fresh.arrangementCell(synth.id, 7), { sourceBar: 7, muted: false });
});

test('Spectra arranged recording buffer copies arbitrary source bars and leaves empty bars silent', () => {
  const session = new StudioSession({
    project: true,
    loopEnabled: true,
    loopBars: 2,
    bpm: 120,
  });
  const guitar = session.stems.find((stem) => stem.inputKey === 'guitar');
  session.setArrangementBars(4);
  session.pasteArrangementBar(guitar.id, 2, session.copyArrangementBar(guitar.id, 1));
  session.pasteArrangementBar(guitar.id, 3, session.copyArrangementBar(guitar.id, 0));

  const source = fakeBuffer(1, 32, 8);
  source.getChannelData(0).fill(1, 0, 16);
  source.getChannelData(0).fill(2, 16, 32);

  const playback = new StudioPlayback({ context: fakeAudioContext(8) });
  const arranged = playback.arrangedRecordingForStem(session, guitar, source);
  const output = arranged.buffer.getChannelData(0);

  assert.equal(arranged.arranged, true);
  assert.equal(output.length, 64);
  assert.equal(output[0], 1);
  assert.equal(output[16], 2);
  assert.equal(output[32], 2);
  assert.equal(output[48], 1);
});
