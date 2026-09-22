import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioSession } from '../src/studio/StudioSession.js';
import { spectraInputKey, spectraInputStem } from '../src/studio/SpectraInputs.js';

test('Vocal is a first-class Spectra input routed to the default Vocal channel', () => {
  const session = new StudioSession();
  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');

  assert.ok(vocal);
  assert.equal(vocal.id, 'input-vocal');
  assert.equal(vocal.kind, 'vocal');
  assert.equal(spectraInputKey({ mode: 'vocal', stemKind: 'vocal', label: 'Vocal' }), 'vocal');
  assert.equal(
    spectraInputStem(session, { mode: 'vocal', stemKind: 'vocal', inputKey: 'vocal' })?.id,
    'input-vocal',
  );
});
