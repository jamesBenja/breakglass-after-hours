import { MIXING_CHALLENGE_IDS } from '../studio/MixingChallenge.js';
import {
  CANONICAL_MULTIPLAYER_SERVER,
  liveVerificationServer,
} from '../runtime/LiveBackendPolicy.js';

export const GOD_MODE_SAVE_KEY = 'breakglass.after-hours.god.v1';
const TOKEN_STORAGE_KEY = 'breakglass.god.token';
const DEFAULT_SERVER = CANONICAL_MULTIPLAYER_SERVER;

function tokenFromLocation() {
  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  return hash.get('god') || search.get('god') || null;
}

function accessTokenFreeUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('god');
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  hash.delete('god');
  const nextHash = hash.toString();
  url.hash = nextHash ? `#${nextHash}` : '';
  return url;
}

function stripAccessTokenFromLocation() {
  const url = accessTokenFreeUrl();
  history.replaceState(history.state, document.title, url.href);
}

function storedToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberToken(token) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // God Mode still works for this visit when storage is unavailable.
  }
}

function forgetToken(token) {
  try {
    if (!token || localStorage.getItem(TOKEN_STORAGE_KEY) === token)
      localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to clear in restricted storage environments.
  }
}

function verificationServer() {
  const configured = liveVerificationServer({
    search: location.search,
    production: import.meta.env?.PROD === true,
  });
  try {
    const url = new URL(configured, location.href);
    if (url.protocol === 'wss:') url.protocol = 'https:';
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_SERVER;
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return DEFAULT_SERVER;
  }
}

export async function resolveGodModeAccess() {
  const linkToken = tokenFromLocation();
  const token = linkToken || storedToken();
  if (!token) return { enabled: false, reason: 'none' };

  try {
    const response = await fetch(`${verificationServer()}/god-mode/verify`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      forgetToken(token);
      if (linkToken) stripAccessTokenFromLocation();
      return { enabled: false, reason: 'invalid' };
    }
    const payload = await response.json().catch(() => ({}));
    if (payload?.ok !== true) {
      forgetToken(token);
      if (linkToken) stripAccessTokenFromLocation();
      return { enabled: false, reason: 'invalid' };
    }
    rememberToken(token);
    if (linkToken) stripAccessTokenFromLocation();
    return { enabled: true };
  } catch {
    // Fail closed, but retain a previously valid token so a temporary server outage does not
    // permanently revoke the browser. The next successful load will verify it again.
    if (linkToken) stripAccessTokenFromLocation();
    return { enabled: false, reason: 'unavailable' };
  }
}

export function exitGodMode() {
  forgetToken();
  const url = accessTokenFreeUrl();
  location.replace(url.href);
}

const TELEPORT_KIND_ORDER = { room: 0, anchor: 1, spawn: 2 };
const SKIPPED_TELEPORT_ACTIONS = new Set(['progressionDoor']);

function humanizeTeleportKey(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function centreOfPoints(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const valid = points.filter(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(Number(point[0])) &&
      Number.isFinite(Number(point[1])),
  );
  if (!valid.length) return null;
  const sum = valid.reduce(
    (result, point) => {
      result.x += Number(point[0]);
      result.z += Number(point[1]);
      return result;
    },
    { x: 0, z: 0 },
  );
  return [sum.x / valid.length, 0, sum.z / valid.length];
}

function surfaceTeleportPosition(surface) {
  if (!surface) return null;
  const polygonCentre = centreOfPoints(surface.points);
  if (polygonCentre) {
    polygonCentre[1] = Number(surface.y) || 0;
    return polygonCentre;
  }

  const x1 = Number(surface.x1);
  const x2 = Number(surface.x2);
  const z1 = Number(surface.z1);
  const z2 = Number(surface.z2);
  if (![x1, x2, z1, z2].every(Number.isFinite)) return null;
  return [(x1 + x2) / 2, Number(surface.y) || 0, (z1 + z2) / 2];
}

export function collectGodModeTeleportDestinations(game) {
  const destinations = [];

  for (const [sceneId, level] of game?.scenes ?? []) {
    const definition = level?.definition;
    if (!definition) continue;
    const sceneLabel = definition.title ?? humanizeTeleportKey(sceneId);

    const rooms = Array.isArray(definition.rooms) ? definition.rooms : [];
    if (rooms.length) {
      for (const room of rooms) {
        const position = surfaceTeleportPosition(room);
        if (!position || !room?.name) continue;
        destinations.push({
          id: `${sceneId}:room:${room.id ?? room.name}`,
          sceneId,
          sceneLabel,
          kind: 'room',
          label: room.name,
          position,
          radius: 2,
        });
      }
    } else {
      for (const surface of definition.navigation?.surfaces ?? []) {
        const position = surfaceTeleportPosition(surface);
        if (!position || !surface?.name) continue;
        destinations.push({
          id: `${sceneId}:room:${surface.id ?? surface.name}`,
          sceneId,
          sceneLabel,
          kind: 'room',
          label: surface.name,
          position,
          radius: 2,
        });
      }
    }

    for (const [key, anchor] of Object.entries(definition.anchors ?? {})) {
      if (!Array.isArray(anchor?.position) || anchor.position.length < 3) continue;
      if (SKIPPED_TELEPORT_ACTIONS.has(anchor.action)) continue;
      destinations.push({
        id: `${sceneId}:anchor:${key}`,
        sceneId,
        sceneLabel,
        kind: 'anchor',
        label: anchor.name ?? humanizeTeleportKey(key),
        position: [...anchor.position],
        radius: Number(anchor.radius) || 1.25,
        featured: sceneId === 'upstairs' && key === 'console',
      });
    }

    for (const [key, position] of Object.entries(definition.spawns ?? {})) {
      if (!Array.isArray(position) || position.length < 3) continue;
      destinations.push({
        id: `${sceneId}:spawn:${key}`,
        sceneId,
        sceneLabel,
        kind: 'spawn',
        label: humanizeTeleportKey(key),
        position: [...position],
        radius: 1.25,
      });
    }
  }

  return destinations.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    const sceneOrder = a.sceneLabel.localeCompare(b.sceneLabel);
    if (sceneOrder) return sceneOrder;
    const kindOrder = TELEPORT_KIND_ORDER[a.kind] - TELEPORT_KIND_ORDER[b.kind];
    if (kindOrder) return kindOrder;
    return a.label.localeCompare(b.label);
  });
}

function validTeleportLanding(level, position) {
  if (!Array.isArray(position) || position.length < 3) return null;
  const x = Number(position[0]);
  const requestedY = Number(position[1]);
  const z = Number(position[2]);
  if (![x, requestedY, z].every(Number.isFinite)) return null;

  const collision = level?.collision;
  if (!collision) return [x, requestedY, z];
  const ground = collision.surfaceAt?.(x, z, requestedY + 0.6);
  if (!ground) return null;

  const candidate = { x, y: ground.height, z };
  return collision.isValidPosition?.(candidate) ? [candidate.x, candidate.y, candidate.z] : null;
}

function resolveTeleportLanding(level, destination) {
  const exact = validTeleportLanding(level, destination.position);
  if (exact) return exact;

  const base = Math.max(0.65, Math.min(1.8, (Number(destination.radius) || 1.25) * 0.7));
  const uniqueDistances = new Set(
    [base, 1, 1.5, 2, 2.75, 3.5].map((value) => value.toFixed(2)),
  );
  const distances = [...uniqueDistances].map(Number);
  const [targetX, targetY, targetZ] = destination.position;

  for (const distance of distances) {
    for (let step = 0; step < 12; step += 1) {
      const angle = (step / 12) * Math.PI * 2;
      const candidate = [
        targetX + Math.cos(angle) * distance,
        targetY,
        targetZ + Math.sin(angle) * distance,
      ];
      const valid = validTeleportLanding(level, candidate);
      if (valid) return valid;
    }
  }
  return null;
}

export function teleportGodMode(game, destinationId, ui) {
  if (!game?.godMode || !destinationId) return null;
  const destination = collectGodModeTeleportDestinations(game).find(
    (candidate) => candidate.id === destinationId,
  );
  if (!destination) return null;

  const level = game.scenes?.get?.(destination.sceneId);
  const landing = resolveTeleportLanding(level, destination);
  if (!level || !landing) {
    ui?.warning?.(`GOD MODE · no clear landing near ${destination.label}`);
    return null;
  }

  const sceneManager = game.sceneManager;
  if (!sceneManager) return null;
  ui?.closePanel?.();
  game.input?.clear?.();

  if (sceneManager.changing) {
    sceneManager.pending = null;
    sceneManager.phase = 'idle';
    sceneManager.remaining = 0;
    sceneManager.onFade?.(false);
  }

  if (sceneManager.current?.definition?.id === destination.sceneId) {
    game.player?.spawn?.(landing, level.collision);
    game.camera?.configure?.(
      level.definition.cameraOffset,
      game.player.position,
      level.collision,
      level.definition.camera,
    );
    game.interactions?.setLevel?.(level);
    game.syncMaddoxPresence?.(level);
    game.save?.();
  } else {
    sceneManager.enter(destination.sceneId, 'start', landing);
  }

  ui?.warning?.(`GOD MODE · teleported to ${destination.label}`);
  return { ...destination, position: landing };
}

function populateTeleportSelect(select, game, documentRef) {
  const destinations = collectGodModeTeleportDestinations(game);
  select.replaceChildren();

  const placeholder = documentRef.createElement('option');
  placeholder.value = '';
  placeholder.textContent = destinations.length ? 'TELEPORT…' : 'TELEPORT · LOADING…';
  placeholder.selected = true;
  select.appendChild(placeholder);

  const featured = destinations.find((destination) => destination.featured);
  if (featured) {
    const quick = documentRef.createElement('optgroup');
    quick.label = 'FAST ACCESS';
    const option = documentRef.createElement('option');
    option.value = featured.id;
    option.textContent = 'Spectra Console';
    quick.appendChild(option);
    select.appendChild(quick);
  }

  const byScene = new Map();
  for (const destination of destinations) {
    if (destination.id === featured?.id) continue;
    if (!byScene.has(destination.sceneLabel)) byScene.set(destination.sceneLabel, []);
    byScene.get(destination.sceneLabel).push(destination);
  }

  for (const [sceneLabel, sceneDestinations] of byScene) {
    const group = documentRef.createElement('optgroup');
    group.label = sceneLabel;
    for (const destination of sceneDestinations) {
      const option = documentRef.createElement('option');
      option.value = destination.id;
      const prefix =
        destination.kind === 'room'
          ? 'ROOM'
          : destination.kind === 'spawn'
            ? 'ARRIVAL'
            : 'STATION';
      option.textContent = `${prefix} · ${destination.label}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
}

export function mountGodModeControls(documentRef = document, game = null, ui = null) {
  if (!documentRef?.body) return null;
  const existing = documentRef.getElementById('godModeIndicator');
  if (existing) return existing;

  const container = documentRef.createElement('div');
  container.id = 'godModeIndicator';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'God Mode controls');

  const label = documentRef.createElement('span');
  label.className = 'god-mode-label';
  label.textContent = 'GOD MODE';

  const teleport = documentRef.createElement('select');
  teleport.className = 'god-mode-teleport';
  teleport.setAttribute('aria-label', 'Teleport anywhere in God Mode');
  teleport.title = 'Teleport to a room, station or arrival point';
  const refreshTeleportOptions = () => populateTeleportSelect(teleport, game, documentRef);
  refreshTeleportOptions();
  teleport.addEventListener('pointerdown', refreshTeleportOptions);
  teleport.addEventListener('focus', refreshTeleportOptions);
  teleport.addEventListener('change', () => {
    const destinationId = teleport.value;
    if (!destinationId) return;
    teleportGodMode(game, destinationId, ui);
    teleport.value = '';
    teleport.blur?.();
  });

  const exit = documentRef.createElement('button');
  exit.type = 'button';
  exit.className = 'god-mode-exit';
  exit.textContent = 'EXIT';
  exit.title = 'Return to your normal save';
  exit.setAttribute('aria-label', 'Exit God Mode and return to normal save');
  exit.onclick = () => exitGodMode();

  container.append(label, teleport, exit);
  documentRef.body.appendChild(container);
  documentRef.body.classList.add('god-mode-active');
  return container;
}

export function applyGodMode(game, ui) {
  if (!game?.state?.data) return false;
  const state = game.state.data;

  state.roofSecretUnlocked = true;
  state.studioAccessGranted = true;
  state.houseDjDeskIntroduced = true;
  state.storageAccessGranted = true;
  state.tapeArchiveAccessGranted = true;
  state.deadRoomAccessGranted = true;
  state.mixingChallengeCompleted = [...MIXING_CHALLENGE_IDS];
  state.mixingRewardKey = true;
  state.alleyShortcutUnlocked = true;
  // The endgame freight elevator is directly available in God Mode. This is intentionally
  // independent of missions, founder stories, the condo key, AC repair or any other completion.
  state.roofEscapeUnlocked = true;

  // Door/security progression is bypassed in God Mode. Keep the state aligned with that
  // behavior as well so no guestlist-specific wrapper can resurrect a stale pending referral.
  state.guestlistApproved = true;
  state.guestlistReferralPending = false;

  // Maddox starts as a fully unlocked companion and the existing presence system makes him
  // follow between rooms without changing any of the normal pathing/interaction architecture.
  state.roofSecretUnlocked = true;
  state.maddoxAffection = Math.max(9, Number(state.maddoxAffection) || 0);
  state.maddoxCompanion = true;

  game.godMode = true;
  game.save?.();
  ui?.warning?.('GOD MODE · all access unlocked · Maddox is with you');
  return true;
}
