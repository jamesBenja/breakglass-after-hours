// Development-only integration runner. Uses the real renderer, controls, scenes,
// audio, actions, and UI, with isolated memory storage and a deterministic clock.
import markup from '../index.html?raw';
import '../src/ui/styles.css';
import { Game } from '../src/core/Game.js';
import { Hud } from '../src/ui/Hud.js';
import { mainRoute, loopRoute, waypoints } from '../src/world/upstairs/plan.js';
import { overlookRoute, secondaryRoute } from './spatial-routes.js';
import { GameState } from '../src/state/GameState.js';

if (!import.meta.env.DEV) throw new Error('Browser regression is development-only');

const source = new DOMParser().parseFromString(markup, 'text/html');
source.querySelectorAll('script').forEach((script) => script.remove());
document.body.replaceChildren(...source.body.childNodes);
const results = document.createElement('pre');
results.id = 'test-results';
results.setAttribute('aria-label', 'Browser regression results');
Object.assign(results.style, {
  position: 'fixed',
  right: '14px',
  bottom: '16px',
  zIndex: 12,
  padding: '12px',
  maxHeight: '52vh',
  overflow: 'auto',
  background: '#101410ed',
  color: '#c1e8bf',
  fontSize: '11px',
});
results.textContent = 'Browser regression ready. Saves are isolated from your game.';
document.body.appendChild(results);
const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key),
  setItem: (key, value) => memory.set(key, value),
};
const ui = new Hud(document);
const game = new Game(ui, {
  storage,
  spatialPass: new URLSearchParams(location.search).get('pass') ?? undefined,
});
await game.initialize();
game.renderer.setAnimationLoop(null);
let now = 0;
const frame = (movement = null) => {
  now += 1000 / 60;
  game.update(now, movement);
};
frame();

function assert(condition, message) {
  if (!condition) throw new Error(message);
  results.textContent += `\nPASS ${message}`;
}

function press(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  frame();
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

async function walkTo(x, z) {
  for (let i = 0; i < 900; i++) {
    if (i % 15 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    const dx = x - game.player.position.x,
      dz = z - game.player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.14) return;
    const strength = Math.min(1, distance / 0.55);
    frame({ x: (dx / distance) * strength, z: (dz / distance) * strength });
    const cameraHit = game.sceneManager.current.collision.cameraCast(
      game.camera.target,
      game.camera.camera.position,
      0.2,
    );
    if (cameraHit.target) throw new Error(`Camera clips ${cameraHit.target}`);
  }
  throw new Error(`Route blocked before ${x}, ${z}: ${game.player.collisionTarget}`);
}

async function route(ids) {
  for (const id of ids) {
    const [x, , z] = waypoints[id];
    await walkTo(x, z);
    assert(true, `Reached ${id}`);
  }
}

async function clickAction(label) {
  const button = [...ui.buttons.children].find((button) => button.textContent === label);
  if (!button) throw new Error(`Missing action button: ${label}`);
  button.click();
  // UI actions and optional asset requests each cross a microtask boundary.
  await new Promise((resolve) => setTimeout(resolve, 40));
  frame();
}

function travel(target) {
  press('e');
  for (let i = 0; i < 24; i++) frame();
  assert(game.sceneManager.current.definition.id === target, `stairs arrive ${target}`);
  assert(
    [...game.scenes.values()].filter((level) => level.scene.children.includes(game.player.object))
      .length === 1,
    `one player scene after arriving ${target}`,
  );
}

ui.enter.textContent = 'Run browser regression';
ui.ready(async () => {
  ui.gate.hidden = true;
  results.textContent = 'Running browser regression…';
  try {
    await game.audio.init();
    game.started = true;
    game.input.setEnabled(true);
    game.renderer.domElement.focus();
    press('F3');
    assert(!ui.debug.hidden, 'F3 debug overlay');
    const initialZ = game.player.position.z;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    for (let i = 0; i < 6; i++) frame();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }));
    assert(game.player.position.z > initialZ, 'WASD input moves player');
    await route(mainRoute.slice(0, 10));
    // Visit each original instrument; no extra quests or interactions were added.
    for (const id of ['drums', 'piano', 'synth']) {
      await route(['live', ...(id === 'synth' ? ['synthApproach'] : [])]);
      const [x, , z] = game.sceneManager.current.definition.anchors[id].position;
      await walkTo(x, z);
      press('e');
      assert(game.interactions.nearest(game.player.position)?.id === id, `${id} reachable`);
    }
    assert(game.audio.voices.size > 0, 'instruments create Web Audio voices');
    await route(['synthApproach', 'live']);
    press('f');
    assert(game.player.danceRemaining > 0, 'F dances');
    press(' ');
    assert(game.player.verticalVelocity > 0, 'Space jumps');
    for (let i = 0; i < 90; i++) frame();
    assert(game.player.grounded, 'jump lands');
    await route(['live', ...mainRoute.slice(10, 16)]);
    const [consoleX, , consoleZ] = game.sceneManager.current.definition.anchors.console.position;
    await walkTo(consoleX, consoleZ);
    press('e');
    await clickAction('Play Night Bus');
    assert(game.audio.trackId === 'night-bus', 'Spectra console plays Night Bus');
    const context = game.audio.context;
    await route([
      'mixing',
      'mixingAisleSouth',
      'gallerySW',
      'galleryS',
      'gallerySE',
      'eastJunction',
      'belowStairsBottom',
    ]);
    travel('downstairs');
    assert(
      game.audio.context === context && game.audio.trackId === 'night-bus',
      'music continues across floors',
    );
    await walkTo(1.5, -2.15);
    press('e');
    await clickAction('Glass Floor');
    assert(game.audio.trackId === 'glass-floor', 'DJ Glass Floor');
    const npc = game.sceneManager.current.npcs.npcs[0];
    assert(npc.group.position.y > 0, 'crowd reacts to music');
    await clickAction('3AM Tool');
    assert(game.audio.trackId === '3am-tool', 'DJ 3AM Tool');
    await clickAction('Stop decks');
    assert(!game.audio.playing && game.audio.voices.size === 0, 'Stop decks clears transport');
    await clickAction('Glass Floor');
    await walkTo(-0.7, 0.6);
    press('e');
    assert(ui.title.textContent === 'JASHIM', 'Jashim dialogue');
    await clickAction('Dance');
    assert(game.player.danceRemaining > 0, 'dialogue dance action');
    await walkTo(-2.5, 1.3);
    press('e');
    assert(ui.title.textContent === 'NORA', 'Nora dialogue');
    game.save();
    const saved = new GameState(storage).data;
    assert(
      saved.sceneId === 'downstairs' &&
        saved.contacts.length === 2 &&
        saved.lastTrack === 'glass-floor',
      'save retains floor, NPC contacts, and track choice',
    );
    await walkTo(-2.5, -2.25);
    await walkTo(-5.9, -2.25);
    travel('upstairs');
    await route(['eastJunction', ...loopRoute, 'entryPassage', 'entry']);

    await route(secondaryRoute);
    if (game.sceneManager.current.definition.pass === 'B') {
      await route(['eastJunction', 'southLiveDoor', 'liveSouthAisle', 'live']);
      await testOverlook();
      await route(['galleryS', 'gallerySE', 'eastJunction', 'entry']);
    }
    press('m');
    assert(game.audio.voices.size === 0 && !game.audio.playing, 'M stops all music');
    frame();
    const gl = game.renderer.getContext();
    assert(gl.getError() === gl.NO_ERROR, 'WebGL renders without errors');
    results.textContent += '\n\nALL BROWSER CHECKS PASSED';
    addInspectionControls();
  } catch (error) {
    results.textContent += `\nFAIL ${error.stack}`;
    console.error(error);
  } finally {
    game.input.clear();
    game.lastTime = null;
    game.renderer.setAnimationLoop(game.frame);
  }
});

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    void game.dispose();
  });

function addInspectionControls() {
  const controls = document.createElement('div');
  controls.setAttribute('aria-label', 'Spatial inspection controls');
  Object.assign(controls.style, {
    position: 'fixed',
    bottom: '12px',
    right: '12px',
    zIndex: 14,
    display: 'flex',
    gap: '4px',
  });
  for (const [title, point] of [
    ['Entry', waypoints.entry],
    ['Polygon', waypoints.galleryN],
    ['Live Room', waypoints.live],
    ['Mixing A', waypoints.mixing],
    ['Clark', waypoints.clark],
  ]) {
    const button = document.createElement('button');
    button.textContent = `Inspect ${title}`;
    button.onclick = () => {
      results.hidden = true;
      game.state.data.debug = false;
      const p = [...point];
      p[1] = game.sceneManager.current.collision.surfaceAt(p[0], p[2])?.height ?? 0;
      game.player.spawn(p, game.sceneManager.current.collision);
      game.camera.configure(
        game.sceneManager.current.definition.cameraOffset,
        game.player.position,
        game.sceneManager.current.collision,
      );
      game.ui.panel(
        title,
        'Spatial inspection · WASD / Space to test movement. Q/R orbit. C recenter.',
      );
      game.renderer.domElement.focus();
    };
    controls.appendChild(button);
  }
  document.body.appendChild(controls);
}

async function testOverlook() {
  for (const [x, y, z, jump] of overlookRoute) {
    let landed = false;
    for (let i = 0; i < 300; i++) {
      if (i % 10 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      const dx = x - game.player.position.x,
        dz = z - game.player.position.z,
        d = Math.hypot(dx, dz);
      if (d < 0.1 && game.player.grounded && Math.abs(game.player.position.y - y) < 0.05) {
        landed = true;
        break;
      }
      if (jump && i === 0) window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      const strength = Math.min(1, d / 0.35);
      frame({ x: d ? (dx / d) * strength : 0, z: d ? (dz / d) * strength : 0 });
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
      if (
        game.sceneManager.current.collision.cameraCast(
          game.camera.target,
          game.camera.camera.position,
          0.2,
        ).target
      )
        throw new Error('Camera clips during jump route');
    }
    assert(landed, `Jump route landed at height ${y}`);
  }
}
