export const CANONICAL_MULTIPLAYER_SERVER =
  'https://multiplayer-phase2-webrtc-production.up.railway.app';
export const CANONICAL_MULTIPLAYER_ROOM = 'breakglass-main';

export function liveBackendSelection({
  search = '',
  production = true,
  globalServer = null,
  envServer = null,
  storedServer = null,
} = {}) {
  if (production) {
    return {
      server: CANONICAL_MULTIPLAYER_SERVER,
      room: CANONICAL_MULTIPLAYER_ROOM,
      offline: false,
      queryServer: null,
    };
  }

  const params = new URLSearchParams(search);
  const offline = params.get('offline') === '1';
  const room =
    (params.get('room') || CANONICAL_MULTIPLAYER_ROOM).replace(/[^a-z0-9-_]/gi, '').slice(0, 48) ||
    CANONICAL_MULTIPLAYER_ROOM;
  const queryServer = params.get('server');
  return {
    server:
      queryServer || globalServer || envServer || storedServer || CANONICAL_MULTIPLAYER_SERVER,
    room,
    offline,
    queryServer,
  };
}

export function liveVerificationServer({ search = '', production = true } = {}) {
  const selection = liveBackendSelection({ search, production });
  return selection.server;
}

/**
 * Railway Free may wake a sleeping auth server on the first request. Its proxy
 * can briefly return 502/503 or fail a CORS preflight during the cold start.
 * Retry only transient failures; a real 401 is authoritative and must not retry.
 */
export async function fetchAccessWithRetry(
  url,
  options = {},
  fetchRef = globalThis.fetch,
  retryDelaysMs = [450, 1000, 2000, 3200, 4800],
) {
  let lastError = new Error('Breakglass access verification temporarily unavailable.');
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const response = await fetchRef(url, options);
      if (
        response.status !== 0 &&
        response.status !== 408 &&
        response.status !== 429 &&
        !(response.status >= 500 && response.status <= 599)
      ) {
        return response;
      }
      lastError = new Error(`Verification backend unavailable (HTTP ${response.status}).`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retryDelaysMs.length) {
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
    }
  }
  throw lastError;
}
