import { DJ_TRACKS } from '../dj/DjMixer.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
const trackById = (id) => DJ_TRACKS.find((track) => track.id === id) ?? DJ_TRACKS[0];
const LOOP_LENGTHS = [1, 2, 4, 8, 16, 32];

function sourceBeatSeconds(deck) {
  return 60 / Math.max(1, Number(deck?.baseBpm) || trackById(deck?.trackId).bpm || 120);
}

function beatOffset(deck) {
  return Number.isFinite(deck?.beatOffset) ? deck.beatOffset : 0;
}

function sourceGridPosition(deck, position, resolution = 1) {
  const beat = sourceBeatSeconds(deck);
  const grid = beat * Math.max(0.0625, Number(resolution) || 1);
  const offset = beatOffset(deck);
  return Math.max(0, offset + Math.round((position - offset) / grid) * grid);
}

function sourceBeatIndex(deck, position) {
  return (position - beatOffset(deck)) / sourceBeatSeconds(deck);
}

function ensureState(deck) {
  if (!deck) return;
  deck.deviceMode ??= 'cdj';
  deck.vinylRpm ??= 33.333;
  deck.motorOn ??= true;
  deck.platterHeld ??= false;
  deck.cuePoints ??= [null, null, null, null, null, null, null, null];
  deck.quantize ??= true;
  deck.loopBeats ??= 0;
  deck.loopStart ??= 0;
  deck.loopEnd ??= 0;
  deck._jogBend ??= 0;
  deck._phaseErrorMs ??= 0;
  deck._transportFrozenAt ??= null;
}

function applyPlaybackRate(mixer, deck) {
  if (!deck) return;
  ensureState(deck);
  const track = trackById(deck.trackId);
  const nominal = deck.bpm / Math.max(1, track.bpm);
  const rpmMultiplier = deck.deviceMode === 'vinyl' ? deck.vinylRpm / 33.333 : 1;
  const bend = 1 + clamp(deck._jogBend, -0.06, 0.06);
  const rate = Math.max(0.001, nominal * rpmMultiplier * bend);
  if (deck.source?.playbackRate)
    deck.source.playbackRate.value = deck.platterHeld || !deck.motorOn ? 0.001 : rate;
  if (deck.media) {
    deck.media.playbackRate = rate;
    if (deck.platterHeld || !deck.motorOn) deck.media.pause();
    else if (deck.playing && deck.media.paused) void deck.media.play().catch(() => {});
  }
}

function scrubClock(mixer) {
  if (Number.isFinite(mixer.context?.currentTime)) return mixer.context.currentTime;
  const now = globalThis.performance?.now?.() ?? Date.now();
  return now / 1000;
}

function stopVinylScrubVoice(mixer, deck) {
  const voice = deck?._vinylScrubVoice;
  if (!voice) return;
  deck._vinylScrubVoice = null;
  const now = scrubClock(mixer);
  try {
    voice.gain?.gain?.cancelScheduledValues?.(now);
    const current = Math.max(0.0001, Number(voice.gain?.gain?.value) || 0.0001);
    voice.gain?.gain?.setValueAtTime?.(current, now);
    voice.gain?.gain?.exponentialRampToValueAtTime?.(0.0001, now + 0.012);
    voice.source?.stop?.(now + 0.014);
  } catch {
    try {
      voice.source?.stop?.();
    } catch {
      // The grain may already have ended.
    }
  }
}

function playVinylScrubGrain(mixer, deck, buffer, target, secondsDelta, speed) {
  const context = mixer.context;
  if (
    !context?.createBufferSource ||
    !context?.createGain ||
    !buffer ||
    !Number.isFinite(buffer.duration) ||
    buffer.duration <= 0
  ) {
    return false;
  }

  const nodes = mixer.ensureDeckNodes?.(deck);
  if (!nodes?.input) return false;

  stopVinylScrubVoice(mixer, deck);
  const source = context.createBufferSource();
  const gain = context.createGain();
  const now = context.currentTime;
  const rate = clamp(speed, 0.18, 4);
  const realDuration = 0.085;
  const sourceDuration = Math.min(0.24, Math.max(0.035, realDuration * rate));
  const forward = secondsDelta >= 0;

  if (forward) {
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const previous = Math.max(0, target - Math.abs(secondsDelta));
    const offset = Math.min(previous, Math.max(0, buffer.duration - 0.001));
    source.start(now, offset, Math.min(sourceDuration, Math.max(0.001, buffer.duration - offset)));
  } else {
    if (!context.createBuffer) return false;
    const sampleRate = Number(buffer.sampleRate) || Number(context.sampleRate) || 48000;
    const frames = Math.max(32, Math.floor(sourceDuration * sampleRate));
    const reversed = context.createBuffer(buffer.numberOfChannels, frames, sampleRate);
    const previous = Math.min(buffer.duration, target + Math.abs(secondsDelta));
    const endFrame = Math.min(buffer.length - 1, Math.max(0, Math.floor(previous * sampleRate)));
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const sourceData = buffer.getChannelData(channel);
      const targetData = reversed.getChannelData(channel);
      for (let frame = 0; frame < frames; frame += 1) {
        const sourceFrame = endFrame - frame;
        targetData[frame] = sourceFrame >= 0 ? sourceData[sourceFrame] : 0;
      }
    }
    source.buffer = reversed;
    source.playbackRate.value = rate;
    source.start(now);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.72, now + 0.006);
  gain.gain.setValueAtTime(0.72, now + Math.max(0.012, realDuration - 0.022));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + realDuration);
  source.connect(gain);
  gain.connect(nodes.input);
  source.onended = () => {
    try {
      source.disconnect();
      gain.disconnect();
    } catch {
      // Already disconnected during a newer scrub grain or disposal.
    }
    if (deck._vinylScrubVoice?.source === source) deck._vinylScrubVoice = null;
  };
  deck._vinylScrubVoice = { source, gain };
  source.stop(now + realDuration + 0.015);
  return true;
}

function renderPhaseMeter(ui, mixer) {
  const existing = ui.buttons?.querySelector?.('.dj-phase-meter');
  const snapshot = mixer.snapshot?.();
  const a = snapshot?.decks?.A;
  const b = snapshot?.decks?.B;
  if (!a || !b) return;
  const host = existing ?? ui.document.createElement('div');
  host.className = 'dj-phase-meter';
  const delta = Number(b.phaseErrorMs) || 0;
  const normalized = clamp(delta / 120, -1, 1);
  host.innerHTML = '';
  const label = ui.document.createElement('span');
  label.textContent = `PHASE ${delta > 0 ? '+' : ''}${Math.round(delta)} ms`;
  const rail = ui.document.createElement('div');
  rail.className = 'dj-phase-rail';
  const marker = ui.document.createElement('i');
  marker.style.left = `${50 + normalized * 45}%`;
  rail.appendChild(marker);
  host.append(label, rail);
  if (!existing) ui.buttons?.prepend?.(host);
}

function button(document, label, action, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  if (className) element.className = className;
  element.onclick = () => Promise.resolve(action()).catch((error) => console.warn(error));
  return element;
}

function appendDetailedControls(ui, mixer) {
  if (!ui.buttons || ui.buttons.querySelector('.dj-realism-controls')) return;
  const host = ui.document.createElement('section');
  host.className = 'dj-realism-controls';

  const deckId = mixer._mobileFocusDeck ?? 'A';
  const deck = mixer.decks[deckId];
  ensureState(deck);

  const header = ui.document.createElement('div');
  header.className = 'dj-realism-header';
  const title = ui.document.createElement('strong');
  title.textContent = `DECK ${deckId} · ${deck.deviceMode === 'vinyl' ? 'SL-1200' : 'CDJ-3000'}`;
  const toggle = button(
    ui.document,
    deck.deviceMode === 'vinyl' ? 'USE CDJ' : 'USE TURNTABLE',
    () => {
      mixer.setDeviceMode(deckId, deck.deviceMode === 'vinyl' ? 'cdj' : 'vinyl');
      ui.djMixer(mixer, DJ_TRACKS, { onChange: () => mixer.updateVibe?.() });
    },
  );
  header.append(title, toggle);
  host.appendChild(header);

  const transport = ui.document.createElement('div');
  transport.className = 'dj-realism-grid';
  transport.append(
    button(ui.document, 'SET CUE 1', () => mixer.setHotCue(deckId, 0)),
    button(ui.document, 'CUE 1', () => mixer.triggerHotCue(deckId, 0)),
    button(ui.document, '−4 BEATS', () => mixer.beatJump(deckId, -4)),
    button(ui.document, '+4 BEATS', () => mixer.beatJump(deckId, 4)),
    button(ui.document, 'JOG −', () => mixer.jog(deckId, -0.125)),
    button(ui.document, 'JOG +', () => mixer.jog(deckId, 0.125)),
  );
  host.appendChild(transport);

  const loops = ui.document.createElement('div');
  loops.className = 'dj-realism-grid dj-loop-grid';
  for (const beats of LOOP_LENGTHS) {
    loops.appendChild(
      button(ui.document, `${beats} BEAT${beats === 1 ? '' : 'S'}`, () =>
        mixer.setPreciseLoop(deckId, beats),
      ),
    );
  }
  loops.appendChild(button(ui.document, 'LOOP OUT', () => mixer.setPreciseLoop(deckId, 0)));
  host.appendChild(loops);

  if (deck.deviceMode === 'vinyl') {
    const vinyl = ui.document.createElement('div');
    vinyl.className = 'dj-realism-grid';
    vinyl.append(
      button(ui.document, '33⅓', () => mixer.setVinylRpm(deckId, 33.333)),
      button(ui.document, '45', () => mixer.setVinylRpm(deckId, 45)),
      button(ui.document, deck.motorOn ? 'MOTOR STOP' : 'MOTOR START', () =>
        mixer.toggleMotor(deckId),
      ),
      button(ui.document, 'HOLD PLATTER', () => mixer.setPlatterHeld(deckId, !deck.platterHeld)),
    );
    host.appendChild(vinyl);
  }

  ui.buttons.appendChild(host);
  renderPhaseMeter(ui, mixer);
}

export function installDjPerformanceRealism(game, ui) {
  const mixer = game.dj;
  if (!mixer || mixer._performanceRealismInstalled) return mixer;
  mixer._performanceRealismInstalled = true;
  for (const deck of Object.values(mixer.decks)) ensureState(deck);

  const baseLoad = mixer.load.bind(mixer);
  const basePlayDeck = mixer.playDeck.bind(mixer);
  const baseStopDeck = mixer.stopDeck.bind(mixer);
  const baseSetBpm = mixer.setBpm.bind(mixer);
  const baseUpdate = mixer.update.bind(mixer);
  const baseSnapshot = mixer.snapshot.bind(mixer);
  const baseDeckPosition =
    typeof mixer.deckPosition === 'function' ? mixer.deckPosition.bind(mixer) : null;

  if (baseDeckPosition) {
    mixer.deckPosition = (deckId) => {
      const deck = mixer.decks[deckId];
      if (!deck) return 0;
      ensureState(deck);
      if (Number.isFinite(deck._transportFrozenAt)) return deck._transportFrozenAt;
      return baseDeckPosition(deckId);
    };
  }

  mixer.setDeviceMode = (deckId, mode) => {
    const deck = mixer.decks[deckId];
    if (!deck || !['cdj', 'vinyl'].includes(mode)) return false;
    ensureState(deck);
    deck.deviceMode = mode;
    if (mode === 'cdj') {
      deck.vinylRpm = 33.333;
      deck.motorOn = true;
      deck.platterHeld = false;
    }
    applyPlaybackRate(mixer, deck);
    return mode;
  };

  mixer.setVinylRpm = (deckId, rpm) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    ensureState(deck);
    deck.deviceMode = 'vinyl';
    deck.vinylRpm = Math.abs(Number(rpm) - 45) < 1 ? 45 : 33.333;
    applyPlaybackRate(mixer, deck);
    return deck.vinylRpm;
  };

  mixer.toggleMotor = (deckId) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    ensureState(deck);
    if (deck.motorOn) {
      deck._transportFrozenAt = mixer.deckPosition?.(deckId) ?? 0;
      deck.motorOn = false;
    } else {
      const resumeAt = Number.isFinite(deck._transportFrozenAt)
        ? deck._transportFrozenAt
        : (mixer.deckPosition?.(deckId) ?? 0);
      deck.motorOn = true;
      deck._transportFrozenAt = null;
      if (deck.playing) mixer.restartDeckAt?.(deckId, resumeAt);
    }
    if (!deck.motorOn && deck.media) deck.media.pause();
    applyPlaybackRate(mixer, deck);
    return deck.motorOn;
  };

  mixer.setPlatterHeld = (deckId, held) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    ensureState(deck);
    const next = held === true;
    if (next && !deck.platterHeld) {
      deck._transportFrozenAt = mixer.deckPosition?.(deckId) ?? 0;
      deck._lastVinylScrubAt = scrubClock(mixer);
      void mixer.prepareVinylScrub?.(deckId);
    } else if (!next && deck.platterHeld) {
      const resumeAt = Number.isFinite(deck._transportFrozenAt)
        ? deck._transportFrozenAt
        : (mixer.deckPosition?.(deckId) ?? 0);
      deck.transportOffset = Math.max(0, resumeAt);
      deck.transportStartedAt = deck.playing ? (mixer.context?.currentTime ?? 0) : 0;
      if (deck.media && Number.isFinite(deck.media.duration) && deck.media.duration > 0) {
        deck.media.currentTime = deck.transportOffset % deck.media.duration;
      }
      deck._transportFrozenAt = null;
      stopVinylScrubVoice(mixer, deck);
      if (deck.playing && deck.motorOn) mixer.restartDeckAt?.(deckId, resumeAt);
    }
    deck.platterHeld = next;
    applyPlaybackRate(mixer, deck);
    return deck.platterHeld;
  };

  mixer.prepareVinylScrub = async (deckId) => {
    const deck = mixer.decks[deckId];
    if (!deck || !mixer.context) return null;
    ensureState(deck);
    if (deck.source?.buffer) {
      deck._vinylScrubBuffer = deck.source.buffer;
      deck._vinylScrubTrackId = deck.trackId;
      return deck._vinylScrubBuffer;
    }
    if (deck._vinylScrubBuffer && deck._vinylScrubTrackId === deck.trackId) {
      return deck._vinylScrubBuffer;
    }
    if (deck._vinylScrubPromise && deck._vinylScrubTrackId === deck.trackId) {
      return deck._vinylScrubPromise;
    }
    const trackId = deck.trackId;
    const request = mixer.audio.assets?.audio?.(trackId, mixer.context);
    if (!request) return null;
    deck._vinylScrubTrackId = trackId;
    deck._vinylScrubPromise = Promise.resolve(request)
      .then((buffer) => {
        if (deck.trackId === trackId && buffer) deck._vinylScrubBuffer = buffer;
        return buffer ?? null;
      })
      .catch(() => null)
      .finally(() => {
        if (deck._vinylScrubTrackId === trackId) deck._vinylScrubPromise = null;
      });
    return deck._vinylScrubPromise;
  };

  mixer.scrubVinyl = (deckId, secondsDelta = 0) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    ensureState(deck);
    deck.deviceMode = 'vinyl';
    const delta = Number(secondsDelta) || 0;
    const current = Number.isFinite(deck._transportFrozenAt)
      ? deck._transportFrozenAt
      : (mixer.deckPosition?.(deckId) ?? 0);
    let target = Math.max(0, current + delta);
    const duration = Number(
      deck._vinylScrubBuffer?.duration || deck.source?.buffer?.duration || deck.media?.duration || 0,
    );
    if (duration > 0) target = Math.min(target, Math.max(0, duration - 0.001));
    deck._transportFrozenAt = target;
    deck.transportOffset = target;
    if (deck.media) {
      try {
        deck.media.currentTime = duration > 0 ? target % duration : target;
      } catch {
        // Media metadata may not be ready while the platter is being moved.
      }
    }

    const now = scrubClock(mixer);
    const elapsed = Math.max(1 / 120, now - (deck._lastVinylScrubAt ?? now - 1 / 60));
    deck._lastVinylScrubAt = now;
    const speed = Math.abs(delta) / elapsed;
    const buffer = deck._vinylScrubBuffer || deck.source?.buffer || null;
    if (buffer && Math.abs(delta) > 0.0005) {
      playVinylScrubGrain(mixer, deck, buffer, target, delta, speed);
    } else if (!buffer) {
      void mixer.prepareVinylScrub?.(deckId);
    }
    return target;
  };

  mixer.setHotCue = (deckId, index) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    ensureState(deck);
    const slot = clamp(Math.round(index), 0, 7);
    const current = mixer.deckPosition?.(deckId) ?? 0;
    deck.cuePoints[slot] = deck.quantize ? sourceGridPosition(deck, current, 1) : current;
    return deck.cuePoints[slot];
  };

  mixer.triggerHotCue = (deckId, index) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    ensureState(deck);
    const slot = clamp(Math.round(index), 0, 7);
    if (!Number.isFinite(deck.cuePoints[slot])) mixer.setHotCue(deckId, slot);
    return mixer.restartDeckAt?.(deckId, deck.cuePoints[slot]) ?? false;
  };

  // Keep the old HOT CUE buttons useful while making them actual user-settable slots.
  mixer.hotCue = (deckId, index) => mixer.triggerHotCue(deckId, index);

  mixer.beatJump = (deckId, beats) => {
    const deck = mixer.decks[deckId];
    if (!deck?.playing) return false;
    const current = mixer.deckPosition?.(deckId) ?? 0;
    const target = Math.max(0, current + Number(beats || 0) * sourceBeatSeconds(deck));
    if (Number.isFinite(deck._transportFrozenAt)) {
      deck._transportFrozenAt = target;
      return true;
    }
    return mixer.restartDeckAt?.(deckId, target) ?? false;
  };

  mixer.jog = (deckId, beats) => {
    const deck = mixer.decks[deckId];
    if (!deck?.playing) return false;
    const current = mixer.deckPosition?.(deckId) ?? 0;
    const target = Math.max(0, current + Number(beats || 0) * sourceBeatSeconds(deck));
    if (Number.isFinite(deck._transportFrozenAt)) {
      deck._transportFrozenAt = target;
      return true;
    }
    return mixer.restartDeckAt?.(deckId, target) ?? false;
  };

  mixer.setPreciseLoop = (deckId, beats) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    ensureState(deck);
    const safeBeats = LOOP_LENGTHS.includes(Number(beats)) ? Number(beats) : 0;
    if (!safeBeats) {
      deck.loopBeats = 0;
      deck.loopStart = 0;
      deck.loopEnd = 0;
      if (deck.source?.buffer) {
        deck.source.loopStart = 0;
        deck.source.loopEnd = deck.source.buffer.duration;
      }
      return 0;
    }
    const current = mixer.deckPosition?.(deckId) ?? 0;
    const beat = sourceBeatSeconds(deck);
    const offset = beatOffset(deck);
    const start = Math.max(0, offset + Math.floor((current - offset) / beat) * beat);
    deck.loopBeats = safeBeats;
    deck.loopStart = start;
    deck.loopEnd = start + safeBeats * beat;
    if (deck.source?.buffer) {
      deck.source.loopStart = deck.loopStart;
      deck.source.loopEnd = Math.min(deck.source.buffer.duration, deck.loopEnd);
    }
    if (deck.playing) mixer.restartDeckAt?.(deckId, start);
    return safeBeats;
  };
  mixer.setLoop = mixer.setPreciseLoop;

  mixer.load = (deckId, trackId) => {
    const result = baseLoad(deckId, trackId);
    const deck = mixer.decks[deckId];
    ensureState(deck);
    deck.cuePoints = [null, null, null, null, null, null, null, null];
    deck.loopBeats = 0;
    deck.loopStart = 0;
    deck.loopEnd = 0;
    deck._vinylScrubBuffer = null;
    deck._vinylScrubPromise = null;
    deck._vinylScrubTrackId = deck.trackId;
    return result;
  };

  mixer.playDeck = async (deckId, offset = 0) => {
    const result = await basePlayDeck(deckId, offset);
    const deck = mixer.decks[deckId];
    if (result && deck) {
      ensureState(deck);
      if (deck.source?.buffer) {
        deck._vinylScrubBuffer = deck.source.buffer;
        deck._vinylScrubTrackId = deck.trackId;
      }
      applyPlaybackRate(mixer, deck);
    }
    return result;
  };

  mixer.stopDeck = (deckId) => {
    const deck = mixer.decks[deckId];
    if (deck) {
      ensureState(deck);
      stopVinylScrubVoice(mixer, deck);
      deck.platterHeld = false;
      deck._jogBend = 0;
      deck._transportFrozenAt = null;
    }
    return baseStopDeck(deckId);
  };

  mixer.setBpm = (deckId, bpm) => {
    const result = baseSetBpm(deckId, bpm);
    applyPlaybackRate(mixer, mixer.decks[deckId]);
    return result;
  };

  mixer.update = (dt) => {
    const result = baseUpdate(dt);
    const a = mixer.decks.A;
    const b = mixer.decks.B;
    ensureState(a);
    ensureState(b);
    applyPlaybackRate(mixer, a);
    applyPlaybackRate(mixer, b);

    if (a.playing && b.playing) {
      const phaseA = mixer.phase?.(a) ?? 0;
      const phaseB = mixer.phase?.(b) ?? 0;
      const phaseDelta = modulo(phaseB - phaseA + 0.5, 1) - 0.5;
      const beatMs = (60 / Math.max(1, (a.bpm + b.bpm) * 0.5)) * 1000;
      b._phaseErrorMs = phaseDelta * beatMs;
      a._phaseErrorMs = -b._phaseErrorMs;

      // A synced deck should remain sample-accurate enough to blend. Correct only when drift is
      // audible; WebAudio itself is stable so this is chiefly for media fallback and mobile stalls.
      for (const [slaveId, slave] of Object.entries(mixer.decks)) {
        const masterId = slave._syncMaster;
        const master = masterId ? mixer.decks[masterId] : null;
        if (!slave.playing || !master?.playing || Math.abs(slave.bpm - master.bpm) > 0.01) continue;
        const slavePhase = mixer.phase?.(slave) ?? 0;
        const masterPhase = mixer.phase?.(master) ?? 0;
        const delta = modulo(slavePhase - masterPhase + 0.5, 1) - 0.5;
        const errorSeconds = delta * (60 / Math.max(1, slave.bpm));
        slave._phaseErrorMs = errorSeconds * 1000;
        slave._phaseCorrectionElapsed = (slave._phaseCorrectionElapsed ?? 0) + dt;
        if (slave._phaseCorrectionElapsed > 0.18 && Math.abs(errorSeconds) > 0.028) {
          slave._phaseCorrectionElapsed = 0;
          const current = mixer.deckPosition?.(slaveId) ?? 0;
          mixer.restartDeckAt?.(slaveId, Math.max(0, current - errorSeconds));
        }
      }
    } else {
      a._phaseErrorMs = 0;
      b._phaseErrorMs = 0;
    }
    return result;
  };

  mixer.snapshot = () => {
    const snapshot = baseSnapshot();
    for (const [deckId, state] of Object.entries(snapshot.decks ?? {})) {
      const deck = mixer.decks[deckId];
      ensureState(deck);
      Object.assign(state, {
        deviceMode: deck.deviceMode,
        vinylRpm: deck.vinylRpm,
        motorOn: deck.motorOn,
        platterHeld: deck.platterHeld,
        cuePoints: [...deck.cuePoints],
        loopBeats: deck.loopBeats,
        loopStart: deck.loopStart,
        loopEnd: deck.loopEnd,
        beatIndex: sourceBeatIndex(deck, mixer.deckPosition?.(deckId) ?? 0),
        phaseErrorMs: deck._phaseErrorMs ?? 0,
      });
    }
    return snapshot;
  };

  if (ui && !ui._djPerformanceRealismUi) {
    const baseDjMixer = ui.djMixer.bind(ui);
    ui.djMixer = (activeMixer, tracks, options = {}) => {
      const result = baseDjMixer(activeMixer, tracks, options);
      appendDetailedControls(ui, activeMixer);
      return result;
    };
    ui._djPerformanceRealismUi = true;
  }

  return mixer;
}
