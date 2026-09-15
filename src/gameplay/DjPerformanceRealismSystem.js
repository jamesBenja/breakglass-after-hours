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
}

function applyPlaybackRate(mixer, deck) {
  if (!deck) return;
  ensureState(deck);
  const track = trackById(deck.trackId);
  const nominal = deck.bpm / Math.max(1, track.bpm);
  const rpmMultiplier = deck.deviceMode === 'vinyl' ? deck.vinylRpm / 33.333 : 1;
  const bend = 1 + clamp(deck._jogBend, -0.06, 0.06);
  const rate = Math.max(0.001, nominal * rpmMultiplier * bend);
  if (deck.source?.playbackRate) deck.source.playbackRate.value = deck.platterHeld ? 0.001 : rate;
  if (deck.media) {
    deck.media.playbackRate = rate;
    if (deck.platterHeld || !deck.motorOn) deck.media.pause();
    else if (deck.playing && deck.media.paused) void deck.media.play().catch(() => {});
  }
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
  const toggle = button(ui.document, deck.deviceMode === 'vinyl' ? 'USE CDJ' : 'USE TURNTABLE', () => {
    mixer.setDeviceMode(deckId, deck.deviceMode === 'vinyl' ? 'cdj' : 'vinyl');
    ui.djMixer(mixer, DJ_TRACKS, { onChange: () => mixer.updateVibe?.() });
  });
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
      button(ui.document, `${beats} BEAT${beats === 1 ? '' : 'S'}`, () => mixer.setPreciseLoop(deckId, beats)),
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
      button(ui.document, deck.motorOn ? 'MOTOR STOP' : 'MOTOR START', () => mixer.toggleMotor(deckId)),
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
    deck.motorOn = !deck.motorOn;
    if (!deck.motorOn && deck.media) deck.media.pause();
    applyPlaybackRate(mixer, deck);
    return deck.motorOn;
  };

  mixer.setPlatterHeld = (deckId, held) => {
    const deck = mixer.decks[deckId];
    if (!deck) return false;
    ensureState(deck);
    deck.platterHeld = held === true;
    applyPlaybackRate(mixer, deck);
    return deck.platterHeld;
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
    return mixer.restartDeckAt?.(deckId, target) ?? false;
  };

  mixer.jog = (deckId, beats) => {
    const deck = mixer.decks[deckId];
    if (!deck?.playing) return false;
    const current = mixer.deckPosition?.(deckId) ?? 0;
    const target = Math.max(0, current + Number(beats || 0) * sourceBeatSeconds(deck));
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
    return result;
  };

  mixer.playDeck = async (deckId) => {
    const result = await basePlayDeck(deckId);
    const deck = mixer.decks[deckId];
    if (result && deck) {
      ensureState(deck);
      applyPlaybackRate(mixer, deck);
    }
    return result;
  };

  mixer.stopDeck = (deckId) => {
    const deck = mixer.decks[deckId];
    if (deck) {
      ensureState(deck);
      deck.platterHeld = false;
      deck._jogBend = 0;
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
