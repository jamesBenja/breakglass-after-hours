import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCanonicalLiveBuild } from '../src/runtime/LiveVersionGuard.js';

test('matching live build continues without navigation', async () => {
  const replacements = [];
  const result = await ensureCanonicalLiveBuild({
    production: true,
    buildSha: 'abc123',
    fetchRef: async () => ({ ok: true, json: async () => ({ sha: 'abc123' }) }),
    locationRef: {
      href: 'https://example.test/game/?invite=token',
      replace(url) {
        replacements.push(url);
      },
    },
    documentRef: { baseURI: 'https://example.test/game/' },
    sessionStorageRef: new MapStorage(),
  });

  assert.equal(result.current, true);
  assert.deepEqual(replacements, []);
});

test('stale live build cache-busts while preserving entry parameters', async () => {
  const replacements = [];
  const storage = new MapStorage();
  const result = await ensureCanonicalLiveBuild({
    production: true,
    buildSha: 'old111',
    fetchRef: async () => ({ ok: true, json: async () => ({ sha: 'new222abcdef' }) }),
    locationRef: {
      href: 'https://example.test/game/?invite=token#god=secret',
      replace(url) {
        replacements.push(url);
      },
    },
    documentRef: { baseURI: 'https://example.test/game/' },
    sessionStorageRef: storage,
  });

  assert.equal(result.reloading, true);
  assert.equal(replacements.length, 1);
  const next = new URL(replacements[0]);
  assert.equal(next.searchParams.get('invite'), 'token');
  assert.equal(next.searchParams.get('build'), 'new222abcdef'.slice(0, 12));
  assert.equal(next.hash, '#god=secret');
});

test('stale build defers reload while an active music session checkpoint is fresh', async () => {
  const replacements = [];
  const sessionStorage = new MapStorage();
  const localStorage = new MapStorage();
  localStorage.setItem(
    'breakglass.active-music-session.v1',
    JSON.stringify({
      active: true,
      savedAt: 1000,
      saveKey: 'breakglass.after-hours.v1',
      surface: 'spectra',
    }),
  );

  const result = await ensureCanonicalLiveBuild({
    production: true,
    buildSha: 'old111',
    fetchRef: async () => ({ ok: true, json: async () => ({ sha: 'new222abcdef' }) }),
    locationRef: {
      href: 'https://example.test/game/?invite=token',
      replace(url) {
        replacements.push(url);
      },
    },
    documentRef: { baseURI: 'https://example.test/game/' },
    sessionStorageRef: sessionStorage,
    localStorageRef: localStorage,
    now: 1500,
  });

  assert.equal(result.reloadDeferred, true);
  assert.equal(result.activeSurface, 'spectra');
  assert.deepEqual(replacements, []);
});

test('development never performs live version navigation', async () => {
  let fetched = false;
  const result = await ensureCanonicalLiveBuild({
    production: false,
    buildSha: 'old',
    fetchRef: async () => {
      fetched = true;
      throw new Error('should not fetch');
    },
    locationRef: { href: 'http://127.0.0.1:5173/', replace() {} },
  });
  assert.equal(result.checked, false);
  assert.equal(fetched, false);
});

class MapStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}
