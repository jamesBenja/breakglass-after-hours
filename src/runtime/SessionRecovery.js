const CHECKPOINT_VERSION = 1;
export const ACTIVE_MUSIC_SESSION_KEY = 'breakglass.active-music-session.v1';
const CHECKPOINT_PREFIX = 'breakglass.session-recovery.v1:';
const RECOVERY_AUDIO_PREFIX = 'session-recovery:';
const MAX_RECOVERY_AGE_MS = 6 * 60 * 60 * 1000;
const ACTIVE_MARKER_TTL_MS = 30 * 60 * 1000;

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const safeGet = (storage, key) => {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
};

const safeSet = (storage, key, value) => {
  try {
    storage?.setItem?.(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeRemove = (storage, key) => {
  try {
    storage?.removeItem?.(key);
  } catch {
    // Restricted/private browsing can make storage unavailable.
  }
};

const positionArray = (game) => {
  const position = game?.player?.position;
  if (position && [position.x, position.y, position.z].every(Number.isFinite)) {
    return [position.x, position.y, position.z];
  }
  const saved = game?.state?.data?.position;
  return Array.isArray(saved) && saved.length === 3 ? [...saved] : null;
};

function detectSurface(game, documentRef = globalThis.document) {
  const classes = documentRef?.body?.classList;
  if (
    classes?.contains?.('spectra-console-active') ||
    classes?.contains?.('studio-mobile-active') ||
    classes?.contains?.('performance-active')
  ) {
    return 'spectra';
  }
  if (classes?.contains?.('dj-mobile-active')) return 'dj';

  const djPlaying = Object.values(game?.dj?.decks ?? {}).some((deck) => deck?.playing === true);
  if (djPlaying) return 'dj';
  if (game?.studioPlayback?.playing || game?.spectraRecorder?.armed) return 'spectra';
  if (classes?.contains?.('mixer-active')) return 'spectra';
  return null;
}

function djRecoverySnapshot(game) {
  const snapshot = game?.dj?.snapshot?.();
  if (!snapshot?.decks) return null;
  const decks = {};
  for (const [deckId, deck] of Object.entries(snapshot.decks)) {
    decks[deckId] = {
      ...deck,
      position: Math.max(0, Number(game.dj.deckPosition?.(deckId)) || 0),
    };
  }
  return {
    crossfader: Number(snapshot.crossfader) || 0,
    decks,
  };
}

export function buildSessionRecoveryCheckpoint(
  game,
  { documentRef = globalThis.document, now = Date.now() } = {},
) {
  const surface = detectSurface(game, documentRef);
  const dj = djRecoverySnapshot(game);
  const studioPlaying = game?.studioPlayback?.playing === true;
  const recorder = game?.spectraRecorder?.status?.() ?? null;
  const active =
    !!surface ||
    studioPlaying ||
    recorder?.armed === true ||
    Object.values(dj?.decks ?? {}).some((deck) => deck?.playing === true);

  return {
    version: CHECKPOINT_VERSION,
    savedAt: now,
    saveKey: game?.state?.saveKey ?? null,
    active,
    surface,
    sceneId: game?.sceneManager?.current?.definition?.id ?? game?.state?.data?.sceneId ?? null,
    layoutRevision:
      game?.sceneManager?.current?.definition?.layoutRevision ??
      game?.state?.data?.layoutRevision ??
      null,
    position: positionArray(game),
    studio: game?.studio?.snapshot?.() ?? null,
    studioPlayback: {
      playing: studioPlaying,
      position: Math.max(0, Number(game?.studioPlayback?.position?.()) || 0),
    },
    spectraTransport: game?.spectraTransport?.snapshot?.() ?? null,
    recorder: recorder
      ? {
          armed: recorder.armed === true,
          recording: recorder.recording === true,
        }
      : null,
    dj,
  };
}

export function readActiveMusicSession(
  storage = globalThis.localStorage,
  now = Date.now(),
) {
  const marker = safeJsonParse(safeGet(storage, ACTIVE_MUSIC_SESSION_KEY));
  if (!marker?.active || !Number.isFinite(Number(marker.savedAt))) return null;
  if (now - Number(marker.savedAt) > ACTIVE_MARKER_TTL_MS) return null;
  return marker;
}

async function restoreDj(game, snapshot) {
  if (!snapshot?.decks || !game?.dj) return false;
  game.dj.stop?.();

  for (const [deckId, state] of Object.entries(snapshot.decks)) {
    if (!state?.trackId || !game.dj.decks?.[deckId]) continue;
    game.dj.load?.(deckId, state.trackId);
    game.dj.setLevel?.(deckId, state.level);
    game.dj.setEq?.(deckId, 'low', state.low);
    game.dj.setEq?.(deckId, 'high', state.high);
    game.dj.setBpm?.(deckId, state.bpm);
    const deck = game.dj.decks[deckId];
    deck.transportOffset = Math.max(0, Number(state.position) || 0);
    deck.transportStartedAt = game.audio?.context?.currentTime ?? 0;
  }
  game.dj.setCrossfader?.(snapshot.crossfader);

  let resumed = false;
  for (const [deckId, state] of Object.entries(snapshot.decks)) {
    if (state?.playing !== true) continue;
    resumed =
      (await game.dj.playDeck?.(deckId, Math.max(0, Number(state.position) || 0))) || resumed;
  }
  return resumed;
}

function recordingBlobSignature(session) {
  const parts = [];
  for (const [stemId, blob] of session?.recordingBlobs ?? []) {
    parts.push(`${stemId}:${blob?.size ?? 0}:${blob?.type ?? ''}`);
  }
  return parts.sort().join('|');
}

export function installSessionRecovery(
  game,
  ui,
  {
    storage = globalThis.localStorage,
    timers = globalThis,
    documentRef = globalThis.document,
    windowRef = globalThis.window,
    now = () => Date.now(),
  } = {},
) {
  if (!game || game._sessionRecoveryInstalled) return game?._sessionRecovery ?? null;
  game._sessionRecoveryInstalled = true;

  const saveKey = game.state?.saveKey ?? 'default';
  const checkpointKey = `${CHECKPOINT_PREFIX}${saveKey}`;
  const recoveryAudioId = `${RECOVERY_AUDIO_PREFIX}${saveKey}`;
  const marker = readActiveMusicSession(storage, now());
  const stored = safeJsonParse(safeGet(storage, checkpointKey));
  const pending =
    marker?.saveKey === saveKey &&
    stored?.version === CHECKPOINT_VERSION &&
    stored?.saveKey === saveKey &&
    stored?.active === true &&
    now() - Number(stored.savedAt || 0) <= MAX_RECOVERY_AGE_MS
      ? stored
      : null;

  if (pending) {
    if (pending.sceneId) game.state.data.sceneId = pending.sceneId;
    if (Array.isArray(pending.position) && pending.position.length === 3) {
      game.state.data.position = [...pending.position];
    }
    if (pending.layoutRevision != null) game.state.data.layoutRevision = pending.layoutRevision;
    if (pending.studio) game.studio?.replace?.(pending.studio);
    game.spectraTransport?.reconfigure?.();
  }

  let checkpointPromise = null;
  let lastBlobSignature = '';
  const checkpoint = async ({ force = false } = {}) => {
    if (!game.started && !force) return false;
    const snapshot = buildSessionRecoveryCheckpoint(game, {
      documentRef,
      now: now(),
    });

    if (!snapshot.active && !force) {
      safeRemove(storage, ACTIVE_MUSIC_SESSION_KEY);
      return false;
    }

    safeSet(storage, checkpointKey, JSON.stringify(snapshot));
    if (snapshot.active) {
      safeSet(
        storage,
        ACTIVE_MUSIC_SESSION_KEY,
        JSON.stringify({
          active: true,
          savedAt: snapshot.savedAt,
          saveKey,
          surface: snapshot.surface,
        }),
      );
    } else {
      safeRemove(storage, ACTIVE_MUSIC_SESSION_KEY);
    }

    const signature = recordingBlobSignature(game.studio);
    if (
      snapshot.active &&
      signature !== lastBlobSignature &&
      game.spectraProjectStore?.saveSession
    ) {
      lastBlobSignature = signature;
      try {
        await game.spectraProjectStore.saveSession(recoveryAudioId, game.studio);
      } catch {
        // JSON/session recovery remains useful even when IndexedDB is unavailable.
      }
    }
    return true;
  };

  const queueCheckpoint = (options) => {
    if (checkpointPromise) return checkpointPromise;
    checkpointPromise = checkpoint(options).finally(() => {
      checkpointPromise = null;
    });
    return checkpointPromise;
  };

  const restoreRuntime = async () => {
    if (!pending) return false;

    try {
      await game.spectraProjectStore?.restoreSession?.(
        recoveryAudioId,
        game.studio,
        game.audio?.context,
      );
    } catch {
      // The editable session can still be restored without persisted microphone audio.
    }

    await restoreDj(game, pending.dj);

    if (pending.studioPlayback?.playing) {
      await game.studioPlayback?.play?.(
        game.studio,
        Math.max(0, Number(pending.studioPlayback.position) || 0),
      );
    } else if (pending.spectraTransport?.running) {
      game.spectraTransport?.acquire?.('session-recovery', {
        position: Math.max(0, Number(pending.spectraTransport.position) || 0),
      });
    }

    if (pending.recorder?.armed) game.spectraRecorder?.arm?.();
    game.studioPlayback?.updateMix?.(game.studio, { immediate: true });

    if (pending.surface === 'spectra') {
      timers.setTimeout?.(() => game.showSpectraMixer?.(), 0);
    }

    ui?.warning?.(
      pending.surface === 'dj'
        ? 'Recovered your DJ session after the page reloaded.'
        : 'Recovered your Spectra session after the page reloaded.',
    );
    return true;
  };

  if (typeof ui?.ready === 'function') {
    const baseReady = ui.ready.bind(ui);
    ui.ready = (start) =>
      baseReady(async (profile) => {
        await start(profile);
        await restoreRuntime();
      });
  }

  const interval = timers.setInterval?.(() => {
    void queueCheckpoint();
  }, 1000);

  const onPageHide = () => void queueCheckpoint({ force: true });
  const onVisibility = () => {
    if (documentRef?.hidden) void queueCheckpoint({ force: true });
  };
  windowRef?.addEventListener?.('pagehide', onPageHide);
  documentRef?.addEventListener?.('visibilitychange', onVisibility);

  const api = {
    checkpoint: queueCheckpoint,
    pending,
    dispose() {
      if (interval != null) timers.clearInterval?.(interval);
      windowRef?.removeEventListener?.('pagehide', onPageHide);
      documentRef?.removeEventListener?.('visibilitychange', onVisibility);
    },
  };
  game._sessionRecovery = api;
  return api;
}
