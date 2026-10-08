import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAccessWithRetry } from '../src/runtime/LiveBackendPolicy.js';

test('cold-start 502 and failed preflight retry before accepting valid access', async () => {
  let calls = 0;
  const verified = { status: 200, ok: true };
  const fetchRef = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('Failed to fetch');
    if (calls === 2) return { status: 502, ok: false };
    return verified;
  };
  const result = await fetchAccessWithRetry('/invite/verify', {}, fetchRef, [0, 0, 0]);
  assert.equal(result, verified);
  assert.equal(calls, 3);
});

test('an invalid invitation (401) never retries or becomes a temporary outage', async () => {
  let calls = 0;
  const result = await fetchAccessWithRetry(
    '/invite/verify',
    {},
    async () => {
      calls += 1;
      return { status: 401, ok: false };
    },
    [0, 0],
  );
  assert.equal(result.status, 401);
  assert.equal(calls, 1);
});

test('exhausted 503 retries reject rather than marking a valid token invalid', async () => {
  let calls = 0;
  await assert.rejects(
    fetchAccessWithRetry(
      '/god-mode/verify',
      {},
      async () => {
        calls += 1;
        return { status: 503, ok: false };
      },
      [0, 0],
    ),
    /Verification backend unavailable/,
  );
  assert.equal(calls, 3);
});
