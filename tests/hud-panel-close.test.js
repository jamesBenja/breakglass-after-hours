import test from 'node:test';
import assert from 'node:assert/strict';
import { Hud } from '../src/ui/Hud.js';
import { StudioSession } from '../src/studio/StudioSession.js';

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add(...names) {
      for (const name of names) values.add(name);
    },
    remove(...names) {
      for (const name of names) values.delete(name);
    },
    toggle(name, force) {
      if (force === true) {
        values.add(name);
        return true;
      }
      if (force === false) {
        values.delete(name);
        return false;
      }
      if (values.has(name)) {
        values.delete(name);
        return false;
      }
      values.add(name);
      return true;
    },
    contains(name) {
      return values.has(name);
    },
  };
}

function node(overrides = {}) {
  const children = [];
  return {
    hidden: false,
    textContent: '',
    className: '',
    classList: classList(),
    children,
    dataset: {},
    style: { setProperty() {} },
    append(...items) {
      children.push(...items);
    },
    appendChild(item) {
      children.push(item);
      return item;
    },
    replaceChildren(...items) {
      children.splice(0, children.length, ...items);
    },
    setAttribute() {},
    addEventListener() {},
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
    buttons: elements.get('buttons'),
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

function findByText(root, text) {
  if (!root) return null;
  if (root.textContent === text) return root;
  for (const child of root.children ?? []) {
    const found = findByText(child, text);
    if (found) return found;
  }
  return null;
}

test('Spectra footer survives internal mixer redraws and PFL is not rendered', () => {
  const document = fakeDocument();
  const hud = new Hud(document);
  const session = new StudioSession();
  let footerRenders = 0;

  hud.studioMixer(session, {
    renderFooter: () => {
      footerRenders += 1;
    },
    onDeleteTrack: () => true,
  });

  assert.equal(footerRenders, 1);
  assert.equal(findByText(document.buttons, 'PFL'), null);
  assert.ok(findByText(document.buttons, 'DELETE TRACK'));

  const sessionView = findByText(document.buttons, 'SESSION');
  assert.ok(sessionView);
  sessionView.onclick();

  assert.equal(footerRenders, 2);
  assert.equal(findByText(document.buttons, 'PFL'), null);
});
