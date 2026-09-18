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
    (params.get('room') || CANONICAL_MULTIPLAYER_ROOM)
      .replace(/[^a-z0-9-_]/gi, '')
      .slice(0, 48) || CANONICAL_MULTIPLAYER_ROOM;
  const queryServer = params.get('server');
  return {
    server:
      queryServer ||
      globalServer ||
      envServer ||
      storedServer ||
      CANONICAL_MULTIPLAYER_SERVER,
    room,
    offline,
    queryServer,
  };
}

export function liveVerificationServer({ search = '', production = true } = {}) {
  const selection = liveBackendSelection({ search, production });
  return selection.server;
}
