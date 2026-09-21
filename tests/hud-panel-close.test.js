import test from 'node:test';
import assert from 'node:assert/strict';
import { Hud } from '../src/ui/Hud.js';

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add(...names) {
      for (const name of names) values.add(name);
    },
    remove(...names) {
      for (const name of names) values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
  };
}

function node(overrides = {}) {
  return {
    hidden: false,
    textContent: '',
    classList: classList(),
    appendChild() {},
    replaceChildren() {},
    setAttribute() {},
    focus() {},
    ...overrides,
  };
}

function fakeDocument() {
  const panel = node({
    classList: classList(['photo-review-open', 'spectra-console-panel']),
  });
  const canvas = node();
  const elements = new Map([
    ['panel', panel],
    ['status', node()],
    ['pTitle', node()],
    ['pText', node()],
    ['buttons', node()],
    ['floorTag', node()],
    ['transition', node()],
    ['gate', node()],
    ['enter', node()],
    ['debug', node()],
    ['notice', node()],
    ['avatarName', node()],
    ['avatarIdentity', node()],
    ['avatarBody', node()],
    ['avatarHair', node()],
    ['avatarSkin', node()],
    ['avatarOutfit', node()],
    ['avatarRole', node()],
    ['avatarPhotos', node()],
  ]);
  const body = node({
    classList: classList([
      'mixer-active',
      'mixer-collapsed',
      'dj-mobile-active',
      'studio-mobile-active',
      'spectra-console-active',
      'performance-active',
    ]),
  });
  return {
    panel,
    canvas,
    body,
    defaultView: {
      clearInterval() {},
    },
    getElementById(id) {
      return elements.get(id) ?? null;
    },
    createElement() {
      return node();
    },
    querySelector(selector) {
      if (selector === 'canvas') return canvas;
      return null;
    },
  };
}

test('closing a performance or mixer panel restores mobile gameplay UI state', () => {
  const document = fakeDocument();
  const hud = new Hud(document);
  let closed = 0;
  hud.onPanelClose = () => {
    closed += 1;
  };

  hud.closePanel();

  assert.equal(closed, 1);
  assert.equal(document.panel.hidden, true);
  assert.equal(document.panel.classList.contains('photo-review-open'), false);
  assert.equal(document.panel.classList.contains('spectra-console-panel'), false);
  for (const name of [
    'mixer-active',
    'mixer-collapsed',
    'dj-mobile-active',
    'studio-mobile-active',
    'spectra-console-active',
    'performance-active',
  ]) {
    assert.equal(document.body.classList.contains(name), false, `${name} should be cleared`);
  }
});
