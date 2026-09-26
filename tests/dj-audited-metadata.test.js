import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDITED_DJ_METADATA } from '../src/dj/djAuditMetadata.js';

test('all fixed-grid audited DJ tracks have valid BPM and beat offsets', () => {
  const entries = Object.entries(AUDITED_DJ_METADATA);
  assert.equal(entries.length, 29);
  for (const [id, metadata] of entries) {
    assert.ok(Number.isFinite(metadata.bpm) && metadata.bpm > 0, `${id} must have a BPM`);
    if (metadata.freeTime) continue;
    assert.ok(
      Number.isFinite(metadata.beatOffset) && metadata.beatOffset >= 0,
      `${id} must have a beat-grid offset`,
    );
    assert.ok(metadata.confidence >= 0.95, `${id} audit confidence is unexpectedly low`);
  }
});

test('free-time Rotations outro is explicitly excluded from fake beat sync', () => {
  const outro = AUDITED_DJ_METADATA['rotations-water-is-boiling-outro'];
  assert.equal(outro.freeTime, true);
  assert.equal(outro.source, 'master-free-time-audit');
});

test('representative legacy placeholders are replaced by master-audited tempos', () => {
  assert.equal(AUDITED_DJ_METADATA['got-you-dancin'].bpm, 135);
  assert.equal(AUDITED_DJ_METADATA['in-flux-just-be'].bpm, 145);
  assert.equal(AUDITED_DJ_METADATA['in-flux-breath'].bpm, 158);
  assert.equal(AUDITED_DJ_METADATA['in-flux-break'].bpm, 135);
  assert.equal(AUDITED_DJ_METADATA['in-flux-gingele'].bpm, 120);
  assert.equal(AUDITED_DJ_METADATA.atrakar.bpm, 128);
  assert.equal(AUDITED_DJ_METADATA.dubki.bpm, 95);
  assert.equal(AUDITED_DJ_METADATA.paharpur.bpm, 111);
  assert.equal(AUDITED_DJ_METADATA.fakir.bpm, 130);
  assert.equal(AUDITED_DJ_METADATA.bhab.bpm, 166.667);
});
