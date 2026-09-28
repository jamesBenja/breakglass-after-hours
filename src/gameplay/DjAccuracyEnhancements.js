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
    track.freeTime = audited.freeTime === true;
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

function markFreeTimeControls(ui, mixer) {
  const hosts = [...(ui.buttons?.querySelectorAll?.('.dj-deck') ?? [])];
  hosts.forEach((host, index) => {
    const deckId = index === 0 ? 'A' : 'B';
    const state = mixer.snapshot?.().decks?.[deckId];
    const track = trackById(state?.trackId);
    for (const option of host.querySelectorAll?.('select option') ?? []) {
      const optionTrack = trackById(option.value);
      if (optionTrack?.freeTime) option.textContent = `${optionTrack.label} · FREE`;
    }
    if (!track?.freeTime) return;
    const tempoLabel = [...host.querySelectorAll('label')].find((candidate) =>
      candidate.textContent.trim().startsWith('Tempo'),
    );
    const tempo = tempoLabel?.querySelector('input[type="range"]');
    if (tempo) tempo.disabled = true;
    const caption = tempoLabel?.querySelector('span');
    if (caption) caption.textContent = 'Tempo: FREE · no fixed beat grid';
    const sync = [...host.querySelectorAll('button')].find(
      (button) => button.textContent.trim().toLowerCase() === 'sync',
    );
    if (sync) {
      sync.disabled = true;
      sync.title = 'Free-time recording: beat sync is intentionally unavailable.';
    }
  });

  const focusId = mixer._mobileFocusDeck ?? 'A';
  const focusTrack = trackById(mixer.snapshot?.().decks?.[focusId]?.trackId);
  for (const option of ui.buttons?.querySelectorAll?.('select option') ?? []) {
    const optionTrack = trackById(option.value);
    if (optionTrack?.freeTime) option.textContent = `${optionTrack.label} · FREE`;
  }
  if (focusTrack?.freeTime) {
    const tempo = ui.buttons?.querySelector?.('input[aria-label="TEMPO"]');
    if (tempo) {
      tempo.disabled = true;
      const caption = tempo.closest('label')?.querySelector('span');
      if (caption) caption.textContent = 'TEMPO FREE · NO FIXED GRID';
    }
    for (const button of ui.buttons?.querySelectorAll?.('button') ?? []) {
      if (button.textContent.trim().toLowerCase() !== 'sync') continue;
      button.disabled = true;
      button.title = 'Free-time recording: beat sync is intentionally unavailable.';
    }
  }
}

function patchUi(ui, mixer) {
  addDesktopMidEq(ui, mixer);
  addMobileAccuracyUi(ui, mixer);
  markFreeTimeControls(ui, mixer);
}

export function installDjAccuracyEnhancements(game, ui) {
  const mixer = game?.dj;
  if (!mixer || mixer._djAccuracyInstalled) return mixer;
  mixer._djAccuracyInstalled = true;
  applyAuditedMetadata(mixer);

  const beatFx = (mixer._beatFx ??= {
    enabled: false,
    target: 'MASTER',
    effect: 'ECHO',
    beat: 0.5,
    amount: 0.35,
    nodes: null,
    branch: [],
    modulators: [],
    impulse: null,
  });

  const fxTargetDeck = (target) =>
    ({ CH1: 'C', CH2: 'A', CH3: 'B', CH4: 'D' })[target] ?? null;

  const fxDestination = () => mixer.audio.sourceDestination?.('dj') ?? mixer.audio.master;

  const stopFxBranch = () => {
    if (!beatFx.nodes) return;
    const { input } = beatFx.nodes;
    const first = beatFx.branch[0];
    if (first) {
      try {
        input.disconnect(first);
      } catch {
        // Branch may already have been disconnected.
      }
    }
    for (const oscillator of beatFx.modulators.splice(0)) {
      try {
        oscillator.stop();
      } catch {
        // Oscillator may already be stopped.
      }
      try {
        oscillator.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    for (const node of beatFx.branch.splice(0)) {
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    }
  };

  const beatFxBpm = () => {
    const targetDeck = fxTargetDeck(beatFx.target);
    if (targetDeck && mixer.decks[targetDeck]) return mixer.decks[targetDeck].bpm;
    const active = Object.values(mixer.decks).filter((deck) => deck.playing);
    if (active.length) return active.reduce((sum, deck) => sum + deck.bpm, 0) / active.length;
    return mixer.decks.A?.bpm ?? 128;
  };

  const createImpulse = () => {
    if (beatFx.impulse || !mixer.context?.createBuffer) return beatFx.impulse;
    const sampleRate = mixer.context.sampleRate || 48000;
    const length = Math.floor(sampleRate * 1.8);
    const impulse = mixer.context.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const decay = Math.pow(1 - index / length, 2.8);
        data[index] = (Math.random() * 2 - 1) * decay;
      }
    }
    beatFx.impulse = impulse;
    return impulse;
  };

  mixer.ensureBeatFxRack = () => {
    if (beatFx.nodes) return beatFx.nodes;
    const context = mixer.context;
    if (!context?.createGain) return null;
    const input = context.createGain();
    const dry = context.createGain();
    const wet = context.createGain();
    const output = context.createGain();
    input.connect(dry);
    dry.connect(output);
    wet.connect(output);
    output.connect(fxDestination());
    beatFx.nodes = { input, dry, wet, output };
    mixer.configureBeatFx?.();
    return beatFx.nodes;
  };

  mixer.configureBeatFx = () => {
    const context = mixer.context;
    const rack = beatFx.nodes;
    if (!context || !rack) return false;
    stopFxBranch();

    const bpm = Math.max(40, beatFxBpm());
    const beatSeconds = 60 / bpm;
    const beatLength = Math.max(0.03, beatSeconds * Number(beatFx.beat || 0.5));
    const amount = clamp(beatFx.amount, 0, 1);
    const now = context.currentTime;
    rack.wet.gain.setTargetAtTime(amount, now, 0.012);
    const keepDry = ['DELAY', 'ECHO', 'PING PONG', 'SPIRAL', 'HELIX', 'REVERB'].includes(
      beatFx.effect,
    );
    rack.dry.gain.setTargetAtTime(keepDry ? 1 : 1 - amount * 0.82, now, 0.012);

    const connectBranch = (...nodes) => {
      const valid = nodes.filter(Boolean);
      if (!valid.length) return;
      rack.input.connect(valid[0]);
      for (let index = 0; index < valid.length - 1; index += 1) valid[index].connect(valid[index + 1]);
      valid[valid.length - 1].connect(rack.wet);
      beatFx.branch.push(...valid);
    };

    if (
      ['DELAY', 'ECHO', 'PING PONG', 'SPIRAL', 'HELIX', 'ROLL', 'TRIPLET ROLL'].includes(
        beatFx.effect,
      ) &&
      context.createDelay
    ) {
      const delay = context.createDelay(4);
      const feedback = context.createGain();
      const tone = context.createBiquadFilter?.();
      if (tone) {
        tone.type = beatFx.effect === 'SPIRAL' ? 'highpass' : 'lowpass';
        tone.frequency.value = beatFx.effect === 'SPIRAL' ? 420 : 12500;
      }
      let time = beatLength;
      if (beatFx.effect === 'TRIPLET ROLL') time *= 2 / 3;
      if (beatFx.effect === 'ROLL') time = Math.max(0.035, time * 0.5);
      if (beatFx.effect === 'HELIX') time = Math.min(2.4, time * 1.5);
      delay.delayTime.value = Math.min(3.8, time);
      feedback.gain.value =
        beatFx.effect === 'DELAY'
          ? 0.05
          : beatFx.effect === 'ROLL' || beatFx.effect === 'TRIPLET ROLL'
            ? 0.82
            : beatFx.effect === 'HELIX'
              ? 0.68
              : 0.46;
      delay.connect(feedback);
      feedback.connect(delay);
      connectBranch(delay, tone);
    } else if (beatFx.effect === 'REVERB' && context.createConvolver) {
      const convolver = context.createConvolver();
      convolver.buffer = createImpulse();
      connectBranch(convolver);
    } else if (
      ['FILTER', 'TRIPLET FILTER'].includes(beatFx.effect) &&
      context.createBiquadFilter
    ) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 7;
      filter.frequency.value = 1200;
      connectBranch(filter);
      if (beatFx.effect === 'TRIPLET FILTER' && context.createOscillator && context.createGain) {
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 1 / Math.max(0.08, beatSeconds * 3);
        depth.gain.value = 5200;
        lfo.connect(depth);
        depth.connect(filter.frequency);
        lfo.start();
        beatFx.modulators.push(lfo);
        beatFx.branch.push(depth);
      }
    } else if (beatFx.effect === 'FLANGER' && context.createDelay) {
      const delay = context.createDelay(0.05);
      delay.delayTime.value = 0.008;
      connectBranch(delay);
      if (context.createOscillator && context.createGain) {
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.frequency.value = 1 / Math.max(0.08, beatSeconds * 2);
        depth.gain.value = 0.006;
        lfo.connect(depth);
        depth.connect(delay.delayTime);
        lfo.start();
        beatFx.modulators.push(lfo);
        beatFx.branch.push(depth);
      }
    } else if (beatFx.effect === 'PHASER' && context.createBiquadFilter) {
      const first = context.createBiquadFilter();
      const second = context.createBiquadFilter();
      first.type = 'allpass';
      second.type = 'allpass';
      first.frequency.value = 700;
      second.frequency.value = 1400;
      first.Q.value = 4;
      second.Q.value = 5;
      connectBranch(first, second);
      if (context.createOscillator && context.createGain) {
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.frequency.value = 1 / Math.max(0.08, beatSeconds * 2);
        depth.gain.value = 600;
        lfo.connect(depth);
        depth.connect(first.frequency);
        depth.connect(second.frequency);
        lfo.start();
        beatFx.modulators.push(lfo);
        beatFx.branch.push(depth);
      }
    } else if (beatFx.effect === 'TRANS' && context.createGain) {
      const gate = context.createGain();
      gate.gain.value = 0.5;
      connectBranch(gate);
      if (context.createOscillator && context.createGain) {
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.type = 'square';
        lfo.frequency.value = 1 / Math.max(0.04, beatLength);
        depth.gain.value = 0.5;
        lfo.connect(depth);
        depth.connect(gate.gain);
        lfo.start();
        beatFx.modulators.push(lfo);
        beatFx.branch.push(depth);
      }
    } else if (beatFx.effect === 'MOBIUS' && context.createOscillator && context.createGain) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(80, now);
      oscillator.frequency.exponentialRampToValueAtTime(1760, now + Math.max(1, beatSeconds * 8));
      gain.gain.value = 0.11;
      oscillator.connect(gain);
      gain.connect(rack.wet);
      oscillator.start();
      beatFx.modulators.push(oscillator);
      beatFx.branch.push(gain);
    } else {
      const pass = context.createGain();
      connectBranch(pass);
    }
    return true;
  };

  mixer.routeBeatFx = () => {
    const destination = fxDestination();
    const rack = beatFx.enabled ? mixer.ensureBeatFxRack?.() : null;
    const selectedDeck = fxTargetDeck(beatFx.target);
    for (const deck of Object.values(mixer.decks)) {
      const cross = deck.nodes?.cross;
      if (!cross) continue;
      try {
        cross.disconnect();
      } catch {
        // Already disconnected during a routing change.
      }
      const effected =
        beatFx.enabled && rack && (beatFx.target === 'MASTER' || deck.id === selectedDeck);
      cross.connect(effected ? rack.input : destination);
    }
    return true;
  };

  mixer.setBeatFxTarget = (target) => {
    if (!['CH1', 'CH2', 'CH3', 'CH4', 'MASTER'].includes(target)) return false;
    beatFx.target = target;
    mixer.routeBeatFx();
    mixer.configureBeatFx?.();
    return beatFx.target;
  };

  mixer.setBeatFxEffect = (effect) => {
    const allowed = [
      'DELAY',
      'ECHO',
      'PING PONG',
      'SPIRAL',
      'HELIX',
      'REVERB',
      'FLANGER',
      'PHASER',
      'FILTER',
      'TRIPLET FILTER',
      'TRANS',
      'ROLL',
      'TRIPLET ROLL',
      'MOBIUS',
    ];
    if (!allowed.includes(effect)) return false;
    beatFx.effect = effect;
    mixer.configureBeatFx?.();
    return beatFx.effect;
  };

  mixer.setBeatFxBeat = (beat) => {
    beatFx.beat = clamp(beat, 0.125, 4);
    mixer.configureBeatFx?.();
    return beatFx.beat;
  };

  mixer.setBeatFxAmount = (amount) => {
    beatFx.amount = clamp(amount, 0, 1);
    mixer.configureBeatFx?.();
    return beatFx.amount;
  };

  mixer.setBeatFxEnabled = (enabled) => {
    beatFx.enabled = enabled === true;
    if (beatFx.enabled) mixer.ensureBeatFxRack?.();
    mixer.routeBeatFx();
    return beatFx.enabled;
  };

  mixer.ensureDeckNodes = (deck) => {
    if (deck.nodes || !mixer.context) return deck.nodes;
    const input = mixer.context.createGain();
    const low = mixer.context.createBiquadFilter();
    const mid = mixer.context.createBiquadFilter();
    const high = mixer.context.createBiquadFilter();
    const colorFilter = mixer.context.createBiquadFilter();
    const level = mixer.context.createGain();
    const cross = mixer.context.createGain();
    low.type = 'lowshelf';
    low.frequency.value = 100;
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 0.72;
    high.type = 'highshelf';
    high.frequency.value = 10000;
    colorFilter.type = 'lowpass';
    colorFilter.frequency.value = 20000;
    colorFilter.Q.value = 0.82;
    input.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(colorFilter);
    colorFilter.connect(level);
    level.connect(cross);
    cross.connect(fxDestination());
    deck.mid ??= 0;
    deck.filter ??= 0;
    deck.nodes = { input, low, mid, high, colorFilter, level, cross };
    mixer.updateDeckNodes(deck);
    mixer.updateCrossfader();
    if (beatFx.enabled) mixer.routeBeatFx?.();
    return deck.nodes;
  };

  mixer.updateDeckNodes = (deck) => {
    deck.mid ??= 0;
    deck.filter ??= 0;
    if (deck.nodes && mixer.context) {
      const now = mixer.context.currentTime;
      deck.nodes.level.gain.setTargetAtTime(clamp(deck.level, 0, 1), now, 0.015);
      deck.nodes.low.gain.setTargetAtTime(eqDb(deck.low), now, 0.02);
      deck.nodes.mid.gain.setTargetAtTime(eqDb(deck.mid), now, 0.02);
      deck.nodes.high.gain.setTargetAtTime(eqDb(deck.high), now, 0.02);
      if (deck.nodes.colorFilter) {
        const amount = clamp(deck.filter, -1, 1);
        if (amount < -0.015) {
          deck.nodes.colorFilter.type = 'lowpass';
          const frequency = 20000 * Math.pow(120 / 20000, Math.abs(amount));
          deck.nodes.colorFilter.frequency.setTargetAtTime(frequency, now, 0.018);
        } else if (amount > 0.015) {
          deck.nodes.colorFilter.type = 'highpass';
          const frequency = 20 * Math.pow(8500 / 20, amount);
          deck.nodes.colorFilter.frequency.setTargetAtTime(frequency, now, 0.018);
        } else {
          deck.nodes.colorFilter.type = 'lowpass';
          deck.nodes.colorFilter.frequency.setTargetAtTime(20000, now, 0.018);
        }
      }
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

  mixer.setFilter = (deckId, value) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    deck.filter = clamp(value, -1, 1);
    mixer.updateDeckNodes(deck);
    mixer.updateVibe?.();
    return deck.filter;
  };

  for (const deck of Object.values(mixer.decks)) {
    deck.mid ??= 0;
    deck.filter ??= 0;
  }

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
      deck.filter = 0;
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
    snapshot.beatFx = {
      enabled: beatFx.enabled,
      target: beatFx.target,
      effect: beatFx.effect,
      beat: beatFx.beat,
      amount: beatFx.amount,
    };
    for (const [deckId, state] of Object.entries(snapshot.decks ?? {})) {
      state.mid = mixer.decks[deckId]?.mid ?? 0;
      state.filter = mixer.decks[deckId]?.filter ?? 0;
      const track = trackById(state.trackId);
      state.baseBpm = track.bpm;
      state.bpmAudited = track.bpmAudited === true;
      state.bpmAuditConfidence = track.bpmAuditConfidence ?? null;
      state.freeTime = track.freeTime === true;
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
