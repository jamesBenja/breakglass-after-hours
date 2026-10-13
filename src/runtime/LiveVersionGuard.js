import { readActiveMusicSession } from './SessionRecovery.js';

export async function ensureCanonicalLiveBuild({
  production = false,
  buildSha = '',
  fetchRef = globalThis.fetch,
  locationRef = globalThis.location,
  documentRef = globalThis.document,
  sessionStorageRef = globalThis.sessionStorage,
  localStorageRef = globalThis.localStorage,
  now = Date.now(),
} = {}) {
  if (!production || !buildSha || !fetchRef || !locationRef)
    return { current: true, checked: false };

  let remoteSha = '';
  try {
    const versionUrl = new URL('version.json', documentRef?.baseURI || locationRef.href);
    const response = await fetchRef(versionUrl.href, { cache: 'no-store' });
    if (!response.ok) return { current: true, checked: false };
    const payload = await response.json();
    remoteSha = typeof payload?.sha === 'string' ? payload.sha : '';
  } catch {
    return { current: true, checked: false };
  }

  if (!remoteSha || remoteSha === buildSha)
    return { current: true, checked: true, remoteSha: remoteSha || null };

  const activeSession = readActiveMusicSession(localStorageRef, now);
  if (activeSession) {
    return {
      current: false,
      checked: true,
      remoteSha,
      reloadDeferred: true,
      activeSurface: activeSession.surface ?? null,
    };
  }

  const reloadKey = `breakglass.live-build-reload.${remoteSha}`;
  try {
    if (sessionStorageRef?.getItem?.(reloadKey) === '1')
      return { current: false, checked: true, remoteSha, reloadSuppressed: true };
    sessionStorageRef?.setItem?.(reloadKey, '1');
  } catch {
    // A cache-busting navigation is still safe when session storage is unavailable.
  }

  const next = new URL(locationRef.href);
  next.searchParams.set('build', remoteSha.slice(0, 12));
  locationRef.replace(next.href);
  return { current: false, checked: true, remoteSha, reloading: true };
}
