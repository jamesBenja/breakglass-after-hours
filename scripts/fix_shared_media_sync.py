from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_one(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def sub_one(path, pattern, replacement):
    text = read(path)
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, found {count}: {pattern[:100]!r}")
    write(path, text)


# --- Authoritative server clock on clients ---
client = "src/multiplayer/MultiplayerClient.js"
replace_one(
    client,
    """    this.reconnectDelay = 800;
    this.reconnectTimer = null;""",
    """    this.reconnectDelay = 800;
    this.reconnectTimer = null;
    this.clockOffsetMs = 0;""",
)
replace_one(
    client,
    """  send(payload) {
    return safeSend(this.socket, payload);
  }

  start(avatar) {""",
    """  send(payload) {
    return safeSend(this.socket, payload);
  }

  serverNow() {
    return Date.now() + this.clockOffsetMs;
  }

  start(avatar) {""",
)
replace_one(
    client,
    """    if (message.type === 'welcome') {
      this.localId = message.id;""",
    """    if (message.type === 'welcome') {
      if (Number.isFinite(Number(message.serverTime)))
        this.clockOffsetMs = Number(message.serverTime) - Date.now();
      this.localId = message.id;""",
)


# --- DJ transport must have a real shared position/seek API ---
dj = "src/dj/DjMixer.js"
replace_one(
    dj,
    """    nextTime: 0,
    timer: null,""",
    """    nextTime: 0,
    transportOffset: 0,
    transportStartedAt: 0,
    timer: null,""",
)
replace_one(
    dj,
    """    deck.bpm = track.bpm;
    deck.step = 0;""",
    """    deck.bpm = track.bpm;
    deck.step = 0;
    deck.transportOffset = 0;
    deck.transportStartedAt = this.context?.currentTime ?? 0;""",
)
replace_one(
    dj,
    """  setBpm(deckId, bpm) {
    const deck = this.decks[deckId];
    if (!deck) return;
    const base = trackById(deck.trackId).bpm;
    deck.bpm = clamp(Number(bpm) || base, base * 0.92, base * 1.08);""",
    """  setBpm(deckId, bpm) {
    const deck = this.decks[deckId];
    if (!deck) return;
    const position = this.deckPosition(deckId);
    const base = trackById(deck.trackId).bpm;
    deck.bpm = clamp(Number(bpm) || base, base * 0.92, base * 1.08);
    if (deck.playing && this.context) {
      deck.transportOffset = position;
      deck.transportStartedAt = this.context.currentTime;
    }""",
)
sub_one(
    dj,
    r"  async playNativeMedia\(deck\) \{.*?\n  phase\(deck\) \{.*?\n  \}\n\n  metrics\(\) \{",
    """  deckPosition(deckId) {
    const deck = this.decks[deckId];
    if (!deck) return 0;
    if (deck.media && Number.isFinite(deck.media.currentTime)) return Math.max(0, deck.media.currentTime);
    const offset = Math.max(0, Number(deck.transportOffset) || 0);
    if (!deck.playing || !this.context) return offset;
    const baseBpm = Math.max(1, trackById(deck.trackId).bpm);
    const rate = Math.max(0.001, deck.bpm / baseBpm);
    let position = offset + Math.max(0, this.context.currentTime - (deck.transportStartedAt || 0)) * rate;
    const duration = deck.source?.buffer?.duration;
    if (Number.isFinite(duration) && duration > 0) position %= duration;
    return Math.max(0, position);
  }

  async playNativeMedia(deck, offset = 0) {
    const url = this.audio.assets?.mediaUrl?.(deck.trackId);
    if (!url || typeof Audio === 'undefined') return false;
    const media = new Audio();
    media.preload = 'auto';
    media.loop = true;
    media.playsInline = true;
    media.src = url;
    media.playbackRate = deck.bpm / trackById(deck.trackId).bpm;
    const seek = () => {
      if (!(offset > 0)) return;
      try {
        const duration = Number(media.duration);
        media.currentTime = Number.isFinite(duration) && duration > 0 ? offset % duration : offset;
      } catch {
        // Metadata may not be seekable yet; loadedmetadata will try again.
      }
    };
    if (media.readyState >= 1) seek();
    else media.addEventListener?.('loadedmetadata', seek, { once: true });
    deck.media = media;
    this.updateNativeDeckLevels();
    try {
      await media.play();
      seek();
      return true;
    } catch {
      deck.media = null;
      media.pause();
      media.removeAttribute('src');
      media.load?.();
      return false;
    }
  }

  async playDeck(deckId, offset = 0) {
    const deck = this.decks[deckId];
    if (!deck || !this.context || deck.playing) return false;
    this.ensureDeckNodes(deck);
    const safeOffset = Math.max(0, Number(offset) || 0);
    const baseBpm = Math.max(1, trackById(deck.trackId).bpm);
    deck.playing = true;
    deck.transportOffset = safeOffset;
    deck.transportStartedAt = this.context.currentTime;
    const sourceStepSeconds = 60 / baseBpm / 4;
    deck.step = Math.floor(safeOffset / sourceStepSeconds) % 16;
    deck.nextTime = this.context.currentTime;

    const buffer = this.audio.assets
      ? await this.audio.assets.audio(deck.trackId, this.context)
      : null;
    if (!deck.playing) return false;
    if (buffer) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = deck.bpm / baseBpm;
      source.connect(deck.nodes.input);
      source.onended = () => {
        source.disconnect();
        if (deck.source === source) deck.source = null;
      };
      deck.source = source;
      const startOffset = buffer.duration > 0 ? safeOffset % buffer.duration : 0;
      source.start(0, startOffset);
    } else if (!(await this.playNativeMedia(deck, safeOffset))) {
      const schedule = () => {
        if (!deck.playing || !this.context || this.context.state !== 'running') return;
        deck.nextTime = Math.max(deck.nextTime, this.context.currentTime);
        const interval = 60 / deck.bpm / 4;
        while (deck.nextTime < this.context.currentTime + 0.1) {
          this.pattern(deck, deck.step, deck.nextTime - this.context.currentTime);
          deck.step = (deck.step + 1) % 16;
          deck.nextTime += interval;
        }
      };
      schedule();
      deck.timer = this.timers.setInterval(schedule, 25);
    }
    this.updateVibe();
    return true;
  }

  async restartDeckAt(deckId, position = 0) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    const wasPlaying = deck.playing;
    this.stopDeck(deckId);
    deck.transportOffset = Math.max(0, Number(position) || 0);
    deck.transportStartedAt = this.context?.currentTime ?? 0;
    if (!wasPlaying) return true;
    return this.playDeck(deckId, deck.transportOffset);
  }

  stopDeck(deckId) {
    const deck = this.decks[deckId];
    if (!deck) return;
    const position = this.deckPosition(deckId);
    deck.playing = false;
    deck.transportOffset = position;
    deck.transportStartedAt = 0;
    if (deck.timer !== null) this.timers.clearInterval(deck.timer);
    deck.timer = null;
    if (deck.source) {
      deck.source.onended = null;
      try {
        deck.source.stop();
      } catch {
        // Already stopped.
      }
      deck.source.disconnect();
      deck.source = null;
    }
    if (deck.media) {
      deck.media.pause();
      deck.media.removeAttribute('src');
      deck.media.load?.();
      deck.media = null;
    }
    for (const source of deck.voices) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already ended.
      }
      source.disconnect();
    }
    deck.voices.clear();
    this.updateVibe();
  }

  phase(deck) {
    if (!deck?.playing) return 0;
    const baseBpm = Math.max(1, trackById(deck.trackId).bpm);
    const beat = 60 / baseBpm;
    const position = this.deckPosition(deck.id);
    return (((position % beat) + beat) % beat) / beat;
  }

  metrics() {""",
)

# Performance-realism wrapper must preserve seek offsets.
realism = "src/gameplay/DjPerformanceRealismSystem.js"
replace_one(
    realism,
    """  mixer.playDeck = async (deckId) => {
    const result = await basePlayDeck(deckId);""",
    """  mixer.playDeck = async (deckId, offset = 0) => {
    const result = await basePlayDeck(deckId, offset);""",
)


# Shared DJ correction uses server time and awaits seek completion.
shared = "src/multiplayer/SharedWorld.js"
replace_one(
    shared,
    """          const elapsed = Math.max(0, Date.now() - Number(state.updatedAt || Date.now())) / 1000;""",
    """          const serverNow = this.client.serverNow?.() ?? Date.now();
          const elapsed = Math.max(0, serverNow - Number(state.updatedAt || serverNow)) / 1000;""",
)
replace_one(
    shared,
    """          if (Math.abs(current - expected) > 0.055) dj.restartDeckAt(deckId, expected);""",
    """          if (Math.abs(current - expected) > 0.055) await dj.restartDeckAt(deckId, expected);""",
)


# Archive audio can seek to the shared room position.
audio = "src/audio/AudioEngine.js"
replace_one(
    audio,
    """    { owner = 'archive', label = id, loop = true, vibe = 0.28, baseVolume = 0.82 } = {},""",
    """    {
      owner = 'archive',
      label = id,
      loop = true,
      vibe = 0.28,
      baseVolume = 0.82,
      offset = 0,
    } = {},""",
)
replace_one(
    audio,
    """      this.voices.set(source, []);
      source.start();
      return true;""",
    """      this.voices.set(source, []);
      const startOffset = buffer.duration > 0 ? Math.max(0, Number(offset) || 0) % buffer.duration : 0;
      source.start(0, startOffset);
      return true;""",
)
replace_one(
    audio,
    """    element.src = url;
    element.volume = clamp(baseVolume * this.environment.gain);
    try {
      await element.play();""",
    """    element.src = url;
    element.volume = clamp(baseVolume * this.environment.gain);
    const seek = () => {
      if (!(offset > 0)) return;
      try {
        const duration = Number(element.duration);
        element.currentTime =
          Number.isFinite(duration) && duration > 0 ? Number(offset) % duration : Number(offset);
      } catch {
        // Remote media may not expose seeking until metadata is available.
      }
    };
    if (element.readyState >= 1) seek();
    else element.addEventListener?.('loadedmetadata', seek, { once: true });
    try {
      await element.play();
      seek();""",
)


# Studio transport accepts a shared offset for late joiners and drift correction.
studio = "src/studio/StudioPlayback.js"
replace_one(
    studio,
    """    this.realSessionPlaying = false;
    this.bpm = 118;""",
    """    this.realSessionPlaying = false;
    this.bpm = 118;
    this.transportOffset = 0;
    this.transportStartedAt = 0;""",
)
replace_one(
    studio,
    """  get playing() {
    return this.timer !== null || this.realSessionPlaying || this.nativeStems.size > 0;
  }

  ensureBus(stem) {""",
    """  get playing() {
    return this.timer !== null || this.realSessionPlaying || this.nativeStems.size > 0;
  }

  position() {
    if (this.nativeStems.size) {
      const first = this.nativeStems.values().next().value;
      if (Number.isFinite(first?.currentTime)) return Math.max(0, first.currentTime);
    }
    const offset = Math.max(0, Number(this.transportOffset) || 0);
    if (!this.playing || !this.audio.context) return offset;
    let value = offset + Math.max(0, this.audio.context.currentTime - this.transportStartedAt);
    if (this.session?.loopEnabled) {
      const duration = (60 / Math.max(1, this.bpm)) * 4 * Math.max(1, Number(this.session.loopBars) || 4);
      if (duration > 0) value %= duration;
    }
    return value;
  }

  ensureBus(stem) {""",
)
replace_one(
    studio,
    """  startAlignedAssets(session, buffers) {
    const start = this.audio.context.currentTime + 0.06;""",
    """  startAlignedAssets(session, buffers, offset = 0) {
    const start = this.audio.context.currentTime + 0.06;
    const safeOffset = Math.max(0, Number(offset) || 0);
    this.transportOffset = safeOffset;
    this.transportStartedAt = start;""",
)
replace_one(
    studio,
    """      this.sources.add(source);
      source.start(start);""",
    """      this.sources.add(source);
      const startOffset = buffer.duration > 0 ? safeOffset % buffer.duration : 0;
      source.start(start, startOffset);""",
)
replace_one(
    studio,
    """  async startNativeAssets(session) {
    if (typeof Audio === 'undefined' || !this.audio.assets?.mediaUrl) return false;""",
    """  async startNativeAssets(session, offset = 0) {
    if (typeof Audio === 'undefined' || !this.audio.assets?.mediaUrl) return false;
    const safeOffset = Math.max(0, Number(offset) || 0);
    this.transportOffset = safeOffset;
    this.transportStartedAt = this.audio.context?.currentTime ?? 0;""",
)
replace_one(
    studio,
    """      media.src = url;
      media.volume = 0;
      created.push([stem.id, media]);""",
    """      media.src = url;
      media.volume = 0;
      const seek = () => {
        if (!(safeOffset > 0)) return;
        try {
          const duration = Number(media.duration);
          media.currentTime =
            Number.isFinite(duration) && duration > 0 ? safeOffset % duration : safeOffset;
        } catch {
          // loadedmetadata will try again when a remote source delays seekability.
        }
      };
      if (media.readyState >= 1) seek();
      else media.addEventListener?.('loadedmetadata', seek, { once: true });
      created.push([stem.id, media]);""",
)
replace_one(
    studio,
    """  async play(session) {
    if (!this.audio.context) return false;
    this.stop();
    this.session = session;
    this.bpm = session.bpm ?? 118;""",
    """  async play(session, offset = 0) {
    if (!this.audio.context) return false;
    this.stop();
    const safeOffset = Math.max(0, Number(offset) || 0);
    this.session = session;
    this.bpm = session.bpm ?? 118;
    this.transportOffset = safeOffset;
    this.transportStartedAt = this.audio.context.currentTime;""",
)
replace_one(studio, "this.startAlignedAssets(session, alignedAssets);", "this.startAlignedAssets(session, alignedAssets, safeOffset);")
replace_one(studio, "if (await this.startNativeAssets(session)) return true;", "if (await this.startNativeAssets(session, safeOffset)) return true;")
replace_one(
    studio,
    """    this.nextTime = this.audio.context.currentTime;
    this.step = 0;
    const interval = 60 / this.bpm / 4;""",
    """    const interval = 60 / this.bpm / 4;
    this.step = Math.floor(safeOffset / interval) % 256;
    const remainder = safeOffset % interval;
    this.nextTime = this.audio.context.currentTime + (remainder > 0 ? interval - remainder : 0);""",
)
replace_one(
    studio,
    """    this.nativeStems.clear();
    this.audio.clearExternalTransport?.('studio');""",
    """    this.nativeStems.clear();
    this.transportOffset = 0;
    this.transportStartedAt = 0;
    this.audio.clearExternalTransport?.('studio');""",
)

# Loop enhancement forwards offsets instead of resetting every client to zero.
loops = "src/gameplay/StudioLoopEnhancements.js"
replace_one(
    loops,
    """  playback.transportPosition = () => {
    if (!playback.audio.context || !playback.playing) return 0;
    const activeSession = playback.session ?? session;
    const elapsed = Math.max(0, playback.audio.context.currentTime - playback.transportStartedAt);
    if (!activeSession.loopEnabled) return elapsed;
    return elapsed % playback.loopDuration(activeSession);
  };""",
    """  playback.transportPosition = () => playback.position?.() ?? 0;""",
)
replace_one(
    loops,
    """  playback.startAlignedAssets = (activeSession, buffers) => {
    baseStartAlignedAssets(activeSession, buffers);
    playback.transportStartedAt = playback.audio.context.currentTime + 0.06;""",
    """  playback.startAlignedAssets = (activeSession, buffers, offset = 0) => {
    baseStartAlignedAssets(activeSession, buffers, offset);
    playback.transportOffset = Math.max(0, Number(offset) || 0);
    playback.transportStartedAt = playback.audio.context.currentTime + 0.06;""",
)
replace_one(
    loops,
    """  playback.startNativeAssets = async (activeSession) => {
    const result = await baseStartNativeAssets(activeSession);""",
    """  playback.startNativeAssets = async (activeSession, offset = 0) => {
    const result = await baseStartNativeAssets(activeSession, offset);""",
)
replace_one(
    loops,
    """    playback.transportStartedAt = playback.audio.context?.currentTime ?? 0;""",
    """    playback.transportOffset = Math.max(0, Number(offset) || 0);
    playback.transportStartedAt = playback.audio.context?.currentTime ?? 0;""",
)
replace_one(
    loops,
    """  playback.play = async (activeSession) => {
    enhanceSession(activeSession);
    const result = await basePlay(activeSession);
    playback.transportStartedAt = playback.audio.context?.currentTime ?? 0;""",
    """  playback.play = async (activeSession, offset = 0) => {
    enhanceSession(activeSession);
    const result = await basePlay(activeSession, offset);
    playback.transportOffset = Math.max(0, Number(offset) || 0);
    playback.transportStartedAt = playback.audio.context?.currentTime ?? 0;""",
)
replace_one(
    loops,
    """    playback.transportStartedAt = 0;
    return baseStop();""",
    """    playback.transportOffset = 0;
    playback.transportStartedAt = 0;
    return baseStop();""",
)


# Install shared media synchronization alongside instruments and world state.
install = "src/multiplayer/installMultiplayerEnhancements.js"
replace_one(
    install,
    """import { MultiplayerClient, resolveMultiplayerConfig } from './MultiplayerClient.js';""",
    """import { MultiplayerClient, resolveMultiplayerConfig } from './MultiplayerClient.js';
import { SharedMediaSync } from './SharedMediaSync.js';""",
)
replace_one(
    install,
    """  const instrumentSync = new InstrumentSync(multiplayer);
  multiplayer.instrumentSync = instrumentSync;""",
    """  const instrumentSync = new InstrumentSync(multiplayer);
  multiplayer.instrumentSync = instrumentSync;
  const sharedMedia = new SharedMediaSync(multiplayer);
  multiplayer.sharedMedia = sharedMedia;""",
)
replace_one(
    install,
    """    instrumentSync.update();
    multiplayer.update(now);""",
    """    instrumentSync.update();
    sharedMedia.update();
    multiplayer.update(now);""",
)
replace_one(
    install,
    """    instrumentSync.dispose();
    multiplayer.dispose();""",
    """    instrumentSync.dispose();
    sharedMedia.dispose();
    multiplayer.dispose();""",
)


# Shared Live From Breakglass screening emits one room-wide transport event.
player = "src/archive/LiveArchivePlayer.js"
write(
    player,
    """function emitSharedArchive(detail) {
  if (typeof CustomEvent !== 'function' || !globalThis.dispatchEvent) return;
  globalThis.dispatchEvent(new CustomEvent('breakglass:live-archive', { detail }));
}

export function showLiveArchivePlayer(
  ui,
  session,
  onClose = () => {},
  { remote = false, startSeconds = 0 } = {},
) {
  if (!ui?.document || !session) return false;
  ui.clearPanel(
    'LIVE ROOM · LIVE FROM BREAKGLASS',
    `${session.label} · ${session.source}. Loaded from the historic Neve archive station.`,
  );

  if (!remote) emitSharedArchive({ action: 'play', sessionId: session.id, position: startSeconds });

  if (!session.youtubeId) {
    const note = ui.document.createElement('p');
    note.textContent =
      'This archive slot is catalogued, but its playable media has not been attached yet.';
    ui.buttons.appendChild(note);
  } else {
    const frame = ui.document.createElement('iframe');
    frame.title = session.label;
    const start = Math.max(0, Math.floor(Number(startSeconds) || 0));
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(session.youtubeId)}?autoplay=1&playsinline=1&rel=0&start=${start}`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    Object.assign(frame.style, {
      width: 'min(72vw, 760px)',
      maxWidth: '100%',
      aspectRatio: '16 / 9',
      border: '1px solid rgba(255,255,255,.22)',
      borderRadius: '8px',
      background: '#09090b',
      display: 'block',
    });
    ui.buttons.appendChild(frame);
  }

  const close = ui.document.createElement('button');
  close.textContent = 'Close screening';
  close.onclick = () => {
    if (!remote) emitSharedArchive({ action: 'stop', sessionId: session.id });
    onClose();
  };
  ui.buttons.appendChild(close);
  return true;
}
""",
)


# Tape playback is room-shared, and James once again explicitly walks players through the tapes.
actions = "src/interactions/createActions.js"
replace_one(
    actions,
    """    if (played) return true;""",
    """    if (played) {
      if (typeof CustomEvent === 'function' && globalThis.dispatchEvent)
        globalThis.dispatchEvent(
          new CustomEvent('breakglass:archive-audio', {
            detail: {
              action: 'play',
              assetId: tape.assetId,
              label: `Tape · ${tape.label}`,
              loop: true,
              vibe: 0.3,
              baseVolume: 0.82,
            },
          }),
        );
      return true;
    }""",
)
replace_one(
    actions,
    """                  audio.stopAsset?.('archive');
                  audio.clearExternalTransport?.('archive');""",
    """                  audio.stopAsset?.('archive');
                  audio.clearExternalTransport?.('archive');
                  if (typeof CustomEvent === 'function' && globalThis.dispatchEvent)
                    globalThis.dispatchEvent(
                      new CustomEvent('breakglass:archive-audio', { detail: { action: 'stop' } }),
                    );""",
)
replace_one(
    actions,
    """                  state.data.threadedTape = null;
                  audio.stopAsset?.('archive');
                  saveState();""",
    """                  state.data.threadedTape = null;
                  audio.stopAsset?.('archive');
                  if (typeof CustomEvent === 'function' && globalThis.dispatchEvent)
                    globalThis.dispatchEvent(
                      new CustomEvent('breakglass:archive-audio', { detail: { action: 'stop' } }),
                    );
                  saveState();""",
)
replace_one(
    actions,
    """      if (id === 'james' && sceneManager.current.definition.id === 'upstairs')
        characterActions.push([
          state?.data?.houseDjDeskIntroduced""",
    """      if (id === 'james' && sceneManager.current.definition.id === 'upstairs') {
        characterActions.push([
          'Show me the tape archive',
          () =>
            panel(
              'JAMES · BREAKGLASS TAPES',
              '“These reels are part of the building memory. Pick one from the archive, bring it into the historic Neve room, thread it on the machine and listen there.”',
              [
                ['Browse the tape archive', tapeArchivePanel],
                ['Go to the tape machine', tapeMachinePanel],
              ],
            ),
        ]);
        characterActions.push([
          state?.data?.houseDjDeskIntroduced""",
)
replace_one(
    actions,
    """          },
        ]);
      if (id === 'zander' && sceneManager.current.definition.id === 'upstairs')""",
    """          },
        ]);
      }
      if (id === 'zander' && sceneManager.current.definition.id === 'upstairs')""",
)


# Only the canonical live multiplayer branch is allowed to replace GitHub Pages.
workflow = ".github/workflows/iphone-preview.yml"
text = read(workflow)
text, count = re.subn(
    r"    branches:\n(?:      - .*\n)+  workflow_dispatch:",
    "    branches:\n      - feat/multiplayer-phase-2-shared-world\n  workflow_dispatch:",
    text,
    count=1,
)
if count != 1:
    raise SystemExit("iphone-preview branch list not found")
write(workflow, text)

print('Shared media synchronization and deployment guard patched.')
