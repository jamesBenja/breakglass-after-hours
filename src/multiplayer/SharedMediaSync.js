import { liveArchiveById } from '../archive/liveArchive.js';
import { showLiveArchivePlayer } from '../archive/LiveArchivePlayer.js';
import { StudioSession } from '../studio/StudioSession.js';

const STUDIO_OBJECT = 'shared-studio-playback';
const ARCHIVE_AUDIO_OBJECT = 'shared-archive-audio';
const LIVE_ARCHIVE_OBJECT = 'shared-live-archive';

const nowEvent = (detail) =>
  typeof CustomEvent === 'function' ? new CustomEvent('breakglass:noop', { detail }) : null;

function sessionSignature(session) {
  try {
    return JSON.stringify(session?.snapshot?.() ?? session ?? null);
  } catch {
    return '';
  }
}

function loopDuration(session) {
  if (!session?.loopEnabled) return 0;
  const bars = Math.max(1, Number(session.loopBars) || 4);
  const bpm = Math.max(1, Number(session.bpm) || 118);
  return (60 / bpm) * 4 * bars;
}

export class SharedMediaSync {
  constructor(client) {
    this.client = client;
    this.game = client.game;
    this.ui = client.ui;
    this.applyingStudio = false;
    this.applyingArchiveAudio = false;
    this.applyingVideo = false;
    this.activeVideoSessionId = null;
    this.lastStudioSignature = '';
    this.studioPublishTimer = null;
    this.boundArchiveAudio = (event) => this.handleLocalArchiveAudio(event?.detail);
    this.boundLiveArchive = (event) => this.handleLocalLiveArchive(event?.detail);
    this.patchWorld();
    this.patchStudioPlayback();
    globalThis.addEventListener?.('breakglass:archive-audio', this.boundArchiveAudio);
    globalThis.addEventListener?.('breakglass:live-archive', this.boundLiveArchive);
  }

  serverNow() {
    return this.client.serverNow?.() ?? Date.now();
  }

  sendObject(objectId, data) {
    if (!this.client.joined) return false;
    return this.client.send({ type: 'object_update', objectId, data });
  }

  patchWorld() {
    const world = this.client.world;
    if (!world || world._sharedMediaPatched) return;
    world._sharedMediaPatched = true;
    const baseHydrate = world.hydrate.bind(world);
    world.hydrate = (state = {}) => {
      baseHydrate(state);
      this.hydrate(world.objects);
    };
    const baseHandleObjectState = world.handleObjectState.bind(world);
    world.handleObjectState = (message) => {
      baseHandleObjectState(message);
      this.handleObjectState(message.objectId, message.data);
    };
  }

  hydrate(objects) {
    if (!objects?.get) return;
    for (const id of [STUDIO_OBJECT, ARCHIVE_AUDIO_OBJECT, LIVE_ARCHIVE_OBJECT]) {
      const data = objects.get(id);
      if (data) this.handleObjectState(id, data);
    }
  }

  patchStudioPlayback() {
    const playback = this.game.studioPlayback;
    if (!playback || playback._sharedMediaPatched) return;
    playback._sharedMediaPatched = true;
    const basePlay = playback.play.bind(playback);
    const baseStop = playback.stop.bind(playback);
    const baseUpdateMix = playback.updateMix.bind(playback);

    playback.play = async (session, offset = 0) => {
      const result = await basePlay(session, offset);
      if (result && !this.applyingStudio) this.publishStudio(true);
      return result;
    };
    playback.stop = (...args) => {
      const wasPlaying = playback.playing;
      const result = baseStop(...args);
      if (wasPlaying && !this.applyingStudio)
        this.sendObject(STUDIO_OBJECT, { playing: false, sentAt: this.serverNow() });
      return result;
    };
    playback.updateMix = (session = playback.session) => {
      const result = baseUpdateMix(session);
      if (!this.applyingStudio && playback.playing) {
        const signature = sessionSignature(session);
        if (signature !== this.lastStudioSignature) this.publishStudio(false);
      }
      return result;
    };
  }

  studioPosition() {
    const playback = this.game.studioPlayback;
    if (!playback?.playing) return 0;
    if (typeof playback.transportPosition === 'function') return playback.transportPosition();
    if (typeof playback.position === 'function') return playback.position();
    return 0;
  }

  studioPayload() {
    const playback = this.game.studioPlayback;
    const session = playback?.session;
    if (!playback?.playing || !session?.snapshot) {
      return { playing: false, sentAt: this.serverNow() };
    }
    return {
      playing: true,
      session: session.snapshot(),
      position: this.studioPosition(),
      sentAt: this.serverNow(),
    };
  }

  publishStudio(immediate = false) {
    if (!this.client.joined || this.applyingStudio) return;
    const send = () => {
      this.studioPublishTimer = null;
      const payload = this.studioPayload();
      this.lastStudioSignature = sessionSignature(payload.session);
      this.sendObject(STUDIO_OBJECT, payload);
    };
    if (immediate) {
      if (this.studioPublishTimer) clearTimeout(this.studioPublishTimer);
      send();
    } else if (!this.studioPublishTimer) {
      this.studioPublishTimer = setTimeout(send, 120);
    }
  }

  expectedPosition(data, session = null) {
    const base = Math.max(0, Number(data?.position) || 0);
    if (!data?.playing) return base;
    const elapsed = Math.max(0, this.serverNow() - Number(data.sentAt || this.serverNow())) / 1000;
    let value = base + elapsed;
    const duration = loopDuration(session);
    if (duration > 0) value %= duration;
    return value;
  }

  async applyStudio(data) {
    const playback = this.game.studioPlayback;
    if (!playback || !data) return;
    this.applyingStudio = true;
    try {
      if (!data.playing || !data.session) {
        if (playback.playing) playback.stop();
        this.lastStudioSignature = '';
        return;
      }
      const remoteSession = new StudioSession(data.session);
      const remoteSignature = sessionSignature(remoteSession);
      const expected = this.expectedPosition(data, remoteSession);
      const currentSignature = sessionSignature(playback.session);
      const current = this.studioPosition();
      const duration = loopDuration(remoteSession);
      let drift = Math.abs(current - expected);
      if (duration > 0) drift = Math.min(drift, Math.abs(duration - drift));

      if (!playback.playing || currentSignature !== remoteSignature || drift > 0.18) {
        await playback.play(remoteSession, expected);
      } else {
        playback.session = remoteSession;
        playback.updateMix(remoteSession);
      }
      this.lastStudioSignature = remoteSignature;
    } finally {
      this.applyingStudio = false;
    }
  }

  handleLocalArchiveAudio(detail) {
    if (!detail || this.applyingArchiveAudio || !this.client.joined) return;
    if (detail.action === 'stop') {
      this.sendObject(ARCHIVE_AUDIO_OBJECT, { playing: false, sentAt: this.serverNow() });
      return;
    }
    if (!detail.assetId) return;
    this.sendObject(ARCHIVE_AUDIO_OBJECT, {
      playing: true,
      assetId: detail.assetId,
      label: detail.label ?? detail.assetId,
      loop: detail.loop !== false,
      vibe: Number(detail.vibe) || 0.3,
      baseVolume: Number(detail.baseVolume) || 0.82,
      position: Number(detail.position) || 0,
      sentAt: this.serverNow(),
    });
  }

  async applyArchiveAudio(data) {
    if (!data) return;
    this.applyingArchiveAudio = true;
    try {
      if (!data.playing || !data.assetId) {
        this.game.audio?.stopAsset?.('archive');
        return;
      }
      const offset = this.expectedPosition(data);
      await this.game.audio?.playAsset?.(data.assetId, {
        owner: 'archive',
        label: data.label ?? data.assetId,
        loop: data.loop !== false,
        vibe: Number(data.vibe) || 0.3,
        baseVolume: Number(data.baseVolume) || 0.82,
        offset,
      });
    } finally {
      this.applyingArchiveAudio = false;
    }
  }

  handleLocalLiveArchive(detail) {
    if (!detail || this.applyingVideo || !this.client.joined) return;
    if (detail.action === 'stop') {
      this.sendObject(LIVE_ARCHIVE_OBJECT, { playing: false, sentAt: this.serverNow() });
      this.activeVideoSessionId = null;
      return;
    }
    if (!detail.sessionId) return;
    this.activeVideoSessionId = detail.sessionId;
    this.sendObject(LIVE_ARCHIVE_OBJECT, {
      playing: true,
      sessionId: detail.sessionId,
      position: Number(detail.position) || 0,
      sentAt: this.serverNow(),
    });
  }

  applyLiveArchive(data) {
    if (!data) return;
    if (!data.playing || !data.sessionId) {
      if (this.activeVideoSessionId) {
        this.activeVideoSessionId = null;
        this.ui.clearPanel?.('LIVE ROOM · LIVE FROM BREAKGLASS', 'The shared screening stopped.');
      }
      return;
    }
    if (this.game.sceneManager.current?.definition?.id !== 'upstairs') return;
    const session = liveArchiveById(data.sessionId);
    if (!session?.youtubeId) return;
    if (this.activeVideoSessionId === session.id) return;
    this.applyingVideo = true;
    try {
      this.game.studioPlayback?.stop?.();
      this.game.dj?.stop?.();
      this.game.audio?.stop?.();
      this.activeVideoSessionId = session.id;
      showLiveArchivePlayer(
        this.ui,
        session,
        () => {
          this.activeVideoSessionId = null;
        },
        { remote: true, startSeconds: this.expectedPosition(data) },
      );
    } finally {
      this.applyingVideo = false;
    }
  }

  handleObjectState(objectId, data) {
    if (objectId === STUDIO_OBJECT) void this.applyStudio(data);
    else if (objectId === ARCHIVE_AUDIO_OBJECT) void this.applyArchiveAudio(data);
    else if (objectId === LIVE_ARCHIVE_OBJECT) this.applyLiveArchive(data);
  }

  update() {
    // If a shared screening began while a player was on another floor, start it when they enter
    // the studio rather than opening the video UI over an unrelated room.
    const video = this.client.world?.objects?.get?.(LIVE_ARCHIVE_OBJECT);
    if (video?.playing && !this.activeVideoSessionId) this.applyLiveArchive(video);
  }

  dispose() {
    if (this.studioPublishTimer) clearTimeout(this.studioPublishTimer);
    globalThis.removeEventListener?.('breakglass:archive-audio', this.boundArchiveAudio);
    globalThis.removeEventListener?.('breakglass:live-archive', this.boundLiveArchive);
  }
}

export const SHARED_MEDIA_OBJECTS = {
  studio: STUDIO_OBJECT,
  archiveAudio: ARCHIVE_AUDIO_OBJECT,
  liveArchive: LIVE_ARCHIVE_OBJECT,
};
