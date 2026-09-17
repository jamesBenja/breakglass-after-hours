import { DJ_TRACKS } from '../dj/DjMixer.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const trackById = (id) => DJ_TRACKS.find((track) => track.id === id) ?? DJ_TRACKS[0];

// DJM-style EQ behavior: approximately +6 dB boost and deep cut rather than the previous
// symmetric +/-15 dB shelves. This is deliberately musically useful, not a mastering EQ.
const eqDb = (value) => {
  const safe = clamp(value, -1, 1);
  return safe >= 0 ? safe * 6 : safe * 26;
};

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

function addMidEqUi(ui, mixer) {
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

export function installDjAccuracyEnhancements(game, ui) {
  const mixer = game?.dj;
  if (!mixer || mixer._djAccuracyInstalled) return mixer;
  mixer._djAccuracyInstalled = true;

  // Replace the pre-audio deck graph before any AudioContext nodes are created. The frequencies
  // and cut/boost behavior approximate a club DJ mixer much more closely than the old two-shelf EQ.
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

  // Preserve source position when the pitch fader changes. The previous enhanced setter changed
  // playbackRate without rebasing the transport clock, which made the computed playhead jump.
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

  // A jog-wheel nudge is a momentary pitch bend, not a seek. This lets the player genuinely pull
  // an incoming beat into phase by ear without producing the hard edit/glitch of restartDeckAt().
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
    }
    return result;
  };

  const baseSnapshot = mixer.snapshot.bind(mixer);
  mixer.snapshot = () => {
    const snapshot = baseSnapshot();
    for (const [deckId, state] of Object.entries(snapshot.decks ?? {})) {
      state.mid = mixer.decks[deckId]?.mid ?? 0;
    }
    return snapshot;
  };

  if (ui && !ui._djAccuracyUiInstalled) {
    const baseDjMixer = ui.djMixer.bind(ui);
    ui.djMixer = (activeMixer, tracks, options = {}) => {
      const result = baseDjMixer(activeMixer, tracks, options);
      addMidEqUi(ui, activeMixer);
      return result;
    };
    ui._djAccuracyUiInstalled = true;
  }

  return mixer;
}
