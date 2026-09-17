import { MIXING_CHALLENGE_IDS } from '../studio/MixingChallenge.js';

export const GOD_MODE_SAVE_KEY = 'breakglass.after-hours.god.v1';
const TOKEN_STORAGE_KEY = 'breakglass.god.token';
const DEFAULT_SERVER = 'https://multiplayer-phase2-webrtc-production.up.railway.app';

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
  const params = new URLSearchParams(location.search);
  const configured = params.get('server') || DEFAULT_SERVER;
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

export function mountGodModeControls(documentRef = document) {
  if (!documentRef?.body) return null;
  const existing = documentRef.getElementById('godModeIndicator');
  if (existing) return existing;

  const container = documentRef.createElement('div');
  container.id = 'godModeIndicator';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-label', 'God Mode is active');

  const label = documentRef.createElement('span');
  label.className = 'god-mode-label';
  label.textContent = 'GOD MODE';

  const exit = documentRef.createElement('button');
  exit.type = 'button';
  exit.className = 'god-mode-exit';
  exit.textContent = 'EXIT';
  exit.title = 'Return to your normal save';
  exit.setAttribute('aria-label', 'Exit God Mode and return to normal save');
  exit.onclick = () => exitGodMode();

  container.append(label, exit);
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
