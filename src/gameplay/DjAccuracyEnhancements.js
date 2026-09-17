import { DJ_TRACKS } from '../dj/DjMixer.js';
import { AUDITED_DJ_METADATA } from '../dj/djAuditMetadata.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const trackById = (id) => DJ_TRACKS.find((track) => track.id === id) ?? DJ_TRACKS[0];

const eqDb = (value) => {
  const safe = clamp(value, -1, 1);
  return safe >= 0 ? safe * 6 : safe * 26;
};

function applyAuditedMetadata(mixer) {
  for (const track of DJ_TRACKS) {
    const audited = AUDITED_DJ_METADATA[track.id];
    if (!audited) continue;
    track.bpm = audited.bpm;
    track.beatOffset = audited.beatOffset;
    track.bpmAuditConfidence = audited.confidence;
    track.bpmAudited = true;
  }
  for (const deck of Object.values(mixer.decks ?? {})) {
    const track = trackById(deck.trackId);
    if (!track?.bpmAudited || deck.playing) continue;
    deck.bpm = track.bpm;
    deck.baseBpm = track.bpm;
    deck.beatOffset = track.beatOffset;
  }
  mixer._beatOffsetCache?.clear?.();
}

function directPlaybackRate(deck) {
  const track = trackById(deck.trackId);
  const nominal = deck.bpm / Math.max(1, track.bpm);
  const rpmMultiplier = deck.deviceMode === 'vinyl' ? (deck.vinylRpm ?? 33.333) / 33.333 : 1;
  const bend = 1 + clamp(deck._jogBend ?? 0, -0.06, 0.06);
  return Math.max(0.001, nominal * rpmMultiplier * bend);
}

function applyDirectPlaybackRate(deck) {
  const rate = directPlaybackRate(deck);
  if (deck.source?.playbackRate) deck.source.playbackRate.value = rate;
  if (deck.media) deck.media.playbackRate = rate;
}

function configureRealTrackEnd(mixer, deck) {
  const source = deck?.source;
  if (source?.buffer) {
    const hasLoop = Number(deck.loopBeats) > 0 && deck.loopEnd > deck.loopStart;
    source.loop = hasLoop;
    if (hasLoop) {
      source.loopStart = Math.max(0, deck.loopStart);
      source.loopEnd = Math.min(source.buffer.duration, deck.loopEnd);
    }
    source.onended = () => {
      try {
        source.disconnect();
      } catch {
        // Already disconnected during disposal.
      }
      if (deck.source !== source) return;
      deck.source = null;
      if (!source.loop && deck.playing) {
        deck.playing = false;
        deck.transportOffset = source.buffer.duration;
        deck.transportStartedAt = 0;
        mixer.updateVibe?.();
      }
    };
  }

  const media = deck?.media;
  if (media) {
    const hasLoop = Number(deck.loopBeats) > 0;
    media.loop = hasLoop;
    if (!media._breakglassAccurateEnd) {
      media._breakglassAccurateEnd = true;
      media.addEventListener?.('ended', () => {
        if (deck.media !== media || media.loop) return;
        deck.playing = false;
        deck.transportOffset = Number(media.duration) || Number(media.currentTime) || 0;
        deck.transportStartedAt = 0;
        mixer.updateVibe?.();
      });
    }
  }
}

function addDesktopMidEq(ui, mixer) {
  const hosts = [...(ui.buttons?.querySelectorAll?.('.dj-deck') ?? [])];
  hosts.forEach((host, index) => {
    if (host.querySelector('input[aria-label="Mid EQ"]')) return;
    const deckId = index === 0 ? 'A' : 'B';
    const state = mixer.snapshot?.().decks?.[deckId];
    if (!state) return;
    const row = host.querySelector('.row');
    const label = ui.document.createElement('label');
    const caption = ui.document.createElement('span');
    caption.textContent = `Mid EQ: ${Number(state.mid ?? 0).toFixed(2)}`;
    const range = ui.document.createElement('input');
    range.type = 'range';
    range.min = '-1';
    range.max = '1';
    range.step = '0.01';
    range.value = String(state.mid ?? 0);
    range.setAttribute('aria-label', 'Mid EQ');
    range.oninput = () => {
      caption.textContent = `Mid EQ: ${Number(range.value).toFixed(2)}`;
      mixer.setEq(deckId, 'mid', Number(range.value));
    };
    label.append(caption, range);
    if (row) host.insertBefore(label, row);
    else host.appendChild(label);
  });
}

function addMobileAccuracyUi(ui, mixer) {
  const eq = ui.buttons?.querySelector?.('.mobile-dj-eq');
  if (eq && !eq.querySelector('input[aria-label="MID"]')) {
    const deckId = mixer._mobileFocusDeck ?? 'A';
    const state = mixer.snapshot?.().decks?.[deckId];
    const label = ui.document.createElement('label');
    label.className = 'mobile-mixer-range';
    const caption = ui.document.createElement('span');
    const range = ui.document.createElement('input');
    range.type = 'range';
    range.min = '-1';
    range.max = '1';
    range.step = '0.01';
    range.value = String(state?.mid ?? 0);
    range.setAttribute('aria-label', 'MID');
    const refresh = () => {
      caption.textContent = `MID ${Number(range.value).toFixed(2)}`;
    };
    range.oninput = () => {
      refresh();
      mixer.setEq(deckId, 'mid', Number(range.value));
    };
    refresh();
    label.append(caption, range);
    eq.insertBefore(label, eq.children[1] ?? null);
  }

  // The original touch NUDGE controls changed the permanent tempo fader while held. Replace their
  // listeners with true momentary jog-wheel pitch bends, matching the desktop JOG controls.
  const pads = ui.buttons?.querySelector?.('.mobile-dj-performance-pads');
  for (const original of [...(pads?.querySelectorAll?.('button') ?? [])]) {
    if (!/^NUDGE [−+]$/.test(original.textContent ?? '')) continue;
    if (original.dataset.accurateJog === '1') continue;
    const button = original.cloneNode(true);
    button.dataset.accurateJog = '1';
    const direction = button.textContent.includes('+') ? 1 : -1;
    const press = (event) => {
      event.preventDefault();
      button.classList.add('active');
      mixer.jog(mixer._mobileFocusDeck ?? 'A', direction * 0.125);
      globalThis.navigator?.vibrate?.(6);
    };
    const release = () => button.classList.remove('active');
    button.addEventListener('pointerdown', press, { passive: false });
    button.addEventListener('pointerup', release, { passive: false });
    button.addEventListener('pointercancel', release, { passive: false });
    original.replaceWith(button);
  }
}

function patchUi(ui, mixer) {
  addDesktopMidEq(ui, mixer);
  addMobileAccuracyUi(ui, mixer);
}

export function installDjAccuracyEnhancements(game, ui) {
  const mixer = game?.dj;
  if (!mixer || mixer._djAccuracyInstalled) return mixer;
  mixer._djAccuracyInstalled = true;
  applyAuditedMetadata(mixer);

  mixer.ensureDeckNodes = (deck) => {
    if (deck.nodes || !mixer.context) return deck.nodes;
    const input = mixer.context.createGain();
    const low = mixer.context.createBiquadFilter();
    const mid = mixer.context.createBiquadFilter();
    const high = mixer.context.createBiquadFilter();
    const level = mixer.context.createGain();
    const cross = mixer.context.createGain();
    low.type = 'lowshelf';
    low.frequency.value = 100;
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 0.72;
    high.type = 'highshelf';
    high.frequency.value = 10000;
    input.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(level);
    level.connect(cross);
    cross.connect(mixer.audio.master);
    deck.mid ??= 0;
    deck.nodes = { input, low, mid, high, level, cross };
    mixer.updateDeckNodes(deck);
    mixer.updateCrossfader();
    return deck.nodes;
  };

  mixer.updateDeckNodes = (deck) => {
    deck.mid ??= 0;
    if (deck.nodes && mixer.context) {
      const now = mixer.context.currentTime;
      deck.nodes.level.gain.setTargetAtTime(clamp(deck.level, 0, 1), now, 0.015);
      deck.nodes.low.gain.setTargetAtTime(eqDb(deck.low), now, 0.02);
      deck.nodes.mid.gain.setTargetAtTime(eqDb(deck.mid), now, 0.02);
      deck.nodes.high.gain.setTargetAtTime(eqDb(deck.high), now, 0.02);
    }
    mixer.updateNativeDeckLevels?.();
  };

  mixer.setEq = (deckId, band, value) => {
    const deck = mixer.decks[deckId];
    if (!deck || !['low', 'mid', 'high'].includes(band)) return false;
    deck[band] = clamp(value, -1, 1);
    mixer.updateDeckNodes(deck);
    mixer.updateVibe?.();
    return deck[band];
  };

  for (const deck of Object.values(mixer.decks)) deck.mid ??= 0;

  const baseSetBpm = mixer.setBpm.bind(mixer);
  mixer.setBpm = (deckId, bpm) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    const position = mixer.deckPosition?.(deckId) ?? 0;
    const wasPlaying = deck.playing;
    const result = baseSetBpm(deckId, bpm);
    if (wasPlaying && mixer.context && !deck.media) {
      deck.transportOffset = position;
      deck.transportStartedAt = mixer.context.currentTime;
    }
    return result;
  };

  mixer.jog = (deckId, beats = 0) => {
    const deck = mixer.decks[deckId];
    if (!deck?.playing) return false;
    const direction = Math.sign(Number(beats) || 0);
    if (!direction) return false;
    const strength = clamp(Math.abs(Number(beats)) * 0.08, 0.008, 0.045);
    deck._jogBend = direction * strength;
    applyDirectPlaybackRate(deck);
    if (deck._jogReleaseTimer != null) mixer.timers?.clearTimeout?.(deck._jogReleaseTimer);
    deck._jogReleaseTimer = mixer.timers?.setTimeout?.(() => {
      deck._jogBend = 0;
      deck._jogReleaseTimer = null;
      applyDirectPlaybackRate(deck);
    }, 170);
    return true;
  };

  const basePlayDeck = mixer.playDeck.bind(mixer);
  mixer.playDeck = async (deckId, offset = 0) => {
    const result = await basePlayDeck(deckId, offset);
    if (result) configureRealTrackEnd(mixer, mixer.decks[deckId]);
    return result;
  };

  const baseSetLoop = mixer.setPreciseLoop?.bind(mixer);
  if (baseSetLoop) {
    mixer.setPreciseLoop = (deckId, beats) => {
      const result = baseSetLoop(deckId, beats);
      configureRealTrackEnd(mixer, mixer.decks[deckId]);
      return result;
    };
    mixer.setLoop = mixer.setPreciseLoop;
  }

  const baseLoad = mixer.load.bind(mixer);
  mixer.load = (deckId, trackId) => {
    const result = baseLoad(deckId, trackId);
    const deck = mixer.decks[deckId];
    if (deck) {
      deck.mid = 0;
      deck._jogBend = 0;
      const track = trackById(deck.trackId);
      if (track?.bpmAudited) {
        deck.bpm = track.bpm;
        deck.baseBpm = track.bpm;
        deck.beatOffset = track.beatOffset;
      }
    }
    return result;
  };

  const baseSnapshot = mixer.snapshot.bind(mixer);
  mixer.snapshot = () => {
    const snapshot = baseSnapshot();
    for (const [deckId, state] of Object.entries(snapshot.decks ?? {})) {
      state.mid = mixer.decks[deckId]?.mid ?? 0;
      const track = trackById(state.trackId);
      state.baseBpm = track.bpm;
      state.bpmAudited = track.bpmAudited === true;
      state.bpmAuditConfidence = track.bpmAuditConfidence ?? null;
    }
    return snapshot;
  };

  if (ui && !ui._djAccuracyUiInstalled) {
    const baseDjMixer = ui.djMixer.bind(ui);
    ui.djMixer = (activeMixer, tracks, options = {}) => {
      const result = baseDjMixer(activeMixer, tracks, options);
      patchUi(ui, activeMixer);
      return result;
    };
    ui._djAccuracyUiInstalled = true;
  }

  return mixer;
}
