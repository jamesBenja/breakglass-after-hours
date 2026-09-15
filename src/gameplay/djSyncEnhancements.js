import { DJ_TRACKS } from '../dj/DjMixer.js';

const TEMPO_RANGE = 0.125;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
const trackById = (id) => DJ_TRACKS.find((track) => track.id === id) ?? DJ_TRACKS[0];

export function alignedSourcePosition(
  masterPosition,
  masterBaseBpm,
  slavePosition,
  slaveBaseBpm,
  masterBeatOffset = 0,
  slaveBeatOffset = 0,
) {
  const masterBeat = 60 / Math.max(1, masterBaseBpm);
  const slaveBeat = 60 / Math.max(1, slaveBaseBpm);
  const masterPhase = modulo((masterPosition - masterBeatOffset) / masterBeat, 1);
  const slaveBeatFloat = (slavePosition - slaveBeatOffset) / slaveBeat;
  const nearestBeat = Math.round(slaveBeatFloat - masterPhase);
  return Math.max(0, slaveBeatOffset + (nearestBeat + masterPhase) * slaveBeat);
}

/**
 * Estimate the quarter-note beat-grid phase of a decoded master.
 *
 * The catalogue already supplies BPM. What was missing was the phase offset between time zero in
 * each exported file and the actual musical beat grid. On real masters that offset is rarely
 * exactly 0 because of encoder padding, silence or pickups. We derive it from low-frequency onset
 * energy so SYNC aligns audible kicks rather than merely aligning file timestamps.
 */
export function estimateBeatOffset(buffer, bpm) {
  const sampleRate = Number(buffer?.sampleRate);
  const firstChannel = buffer?.getChannelData?.(0);
  const beatSeconds = 60 / Math.max(1, Number(bpm) || 120);
  if (!sampleRate || !firstChannel?.length || !Number.isFinite(beatSeconds)) return 0;

  const secondChannel = Number(buffer.numberOfChannels) > 1 ? buffer.getChannelData?.(1) : null;
  const analysisSamples = Math.min(firstChannel.length, Math.floor(sampleRate * 24));
  const stride = 4;
  const frameSamples = Math.max(stride, Math.round(sampleRate * 0.006));
  const frameCount = Math.max(1, Math.ceil(analysisSamples / frameSamples));
  const onset = new Float32Array(frameCount);
  const lowpassAlpha = 1 - Math.exp((-2 * Math.PI * 180 * stride) / sampleRate);

  let lowpass = 0;
  let smoothed = 0;
  let peakOnset = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSamples;
    const end = Math.min(analysisSamples, start + frameSamples);
    let lowEnergy = 0;
    let count = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += stride) {
      const sample = secondChannel
        ? (firstChannel[sampleIndex] + secondChannel[sampleIndex]) * 0.5
        : firstChannel[sampleIndex];
      lowpass += lowpassAlpha * (sample - lowpass);
      lowEnergy += lowpass * lowpass;
      count += 1;
    }
    const envelope = count ? Math.sqrt(lowEnergy / count) : 0;
    const transient = Math.max(0, envelope - smoothed);
    onset[frame] = transient;
    peakOnset = Math.max(peakOnset, transient);
    smoothed = smoothed * 0.72 + envelope * 0.28;
  }

  if (peakOnset < 1e-5) return 0;
  const frameSeconds = frameSamples / sampleRate;
  const analysisSeconds = (frameCount - 1) * frameSeconds;
  const phaseSteps = 128;
  const toleranceFrames = Math.max(1, Math.round(0.018 / frameSeconds));
  let bestPhase = 0;
  let bestScore = -1;

  for (let phaseIndex = 0; phaseIndex < phaseSteps; phaseIndex += 1) {
    const phase = (phaseIndex / phaseSteps) * beatSeconds;
    let score = 0;
    let hits = 0;
    for (let time = phase; time <= analysisSeconds; time += beatSeconds) {
      const center = Math.round(time / frameSeconds);
      let localPeak = 0;
      for (let delta = -toleranceFrames; delta <= toleranceFrames; delta += 1) {
        const index = center + delta;
        if (index >= 0 && index < onset.length) localPeak = Math.max(localPeak, onset[index]);
      }
      score += localPeak;
      hits += 1;
    }
    if (hits) score /= hits;
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  return modulo(bestPhase, beatSeconds);
}

function deckBeatOffset(deck, track) {
  return Number.isFinite(deck?.beatOffset) ? deck.beatOffset : (track.beatOffset ?? 0);
}

function ensureBeatGrid(mixer, deck) {
  if (!deck) return 0;
  const track = trackById(deck.trackId);
  mixer._beatOffsetCache ??= new Map();
  if (mixer._beatOffsetCache.has(track.id)) {
    deck.beatOffset = mixer._beatOffsetCache.get(track.id);
    return deck.beatOffset;
  }

  const buffer = deck.source?.buffer;
  const offset = buffer
    ? estimateBeatOffset(buffer, track.bpm)
    : Number.isFinite(track.beatOffset)
      ? track.beatOffset
      : 0;
  deck.beatOffset = offset;
  if (buffer || Number.isFinite(track.beatOffset)) mixer._beatOffsetCache.set(track.id, offset);
  return offset;
}

function deckPosition(mixer, deckId) {
  if (typeof mixer.deckPosition === 'function') return mixer.deckPosition(deckId);
  const deck = mixer.decks[deckId];
  if (!deck) return 0;
  if (deck.media) return Math.max(0, Number(deck.media.currentTime) || 0);
  const track = trackById(deck.trackId);
  const beat = 60 / Math.max(1, track.bpm);
  return Math.max(0, (deck.step || 0) * beat * 0.25);
}

function beatPhase(mixer, deckId) {
  const deck = mixer.decks[deckId];
  if (!deck?.playing) return 0;
  const track = trackById(deck.trackId);
  const beat = 60 / Math.max(1, track.bpm);
  return modulo((deckPosition(mixer, deckId) - deckBeatOffset(deck, track)) / beat, 1);
}

function setWideBpm(mixer, deckId, bpm) {
  const deck = mixer.decks[deckId];
  if (!deck) return null;
  const track = trackById(deck.trackId);
  const base = track.bpm;
  const next = clamp(Number(bpm) || base, base * (1 - TEMPO_RANGE), base * (1 + TEMPO_RANGE));
  deck.bpm = next;
  deck.baseBpm = base;
  if (deck.source?.playbackRate) deck.source.playbackRate.value = next / base;
  if (deck.media) deck.media.playbackRate = next / base;
  mixer.updateVibe?.();
  return next;
}

function alignDeck(mixer, slaveId, masterId) {
  const slave = mixer.decks[slaveId];
  const master = mixer.decks[masterId];
  if (!slave || !master?.playing) return false;

  if (!slave.playing) {
    slave._syncMaster = masterId;
    return true;
  }

  const masterTrack = trackById(master.trackId);
  const slaveTrack = trackById(slave.trackId);
  ensureBeatGrid(mixer, master);
  ensureBeatGrid(mixer, slave);
  const target = alignedSourcePosition(
    deckPosition(mixer, masterId),
    masterTrack.bpm,
    deckPosition(mixer, slaveId),
    slaveTrack.bpm,
    deckBeatOffset(master, masterTrack),
    deckBeatOffset(slave, slaveTrack),
  );

  let aligned = false;
  if (typeof mixer.restartDeckAt === 'function') aligned = mixer.restartDeckAt(slaveId, target);
  if (!aligned && slave.media) {
    const duration = Number(slave.media.duration);
    slave.media.currentTime =
      Number.isFinite(duration) && duration > 0 ? target % duration : target;
    aligned = true;
  }
  if (!aligned && !slave.source && !slave.media) {
    slave.step = master.step;
    slave.nextTime = master.nextTime;
    aligned = true;
  }
  slave._syncMaster = masterId;
  slave._lastSyncAt = mixer.context?.currentTime ?? 0;
  return aligned;
}

function patchTempoControls(ui, mixer, tracks) {
  const trackFor = (deckId) => {
    const state = mixer.snapshot().decks[deckId];
    return tracks.find((track) => track.id === state?.trackId) ?? tracks[0];
  };

  const mobileTempo = ui.buttons?.querySelector?.('input[aria-label="TEMPO"]');
  if (mobileTempo) {
    const deckId = mixer._mobileFocusDeck ?? 'A';
    const state = mixer.snapshot().decks[deckId];
    const track = trackFor(deckId);
    if (state && track) {
      mobileTempo.min = String(track.bpm * (1 - TEMPO_RANGE));
      mobileTempo.max = String(track.bpm * (1 + TEMPO_RANGE));
      mobileTempo.value = String(state.bpm);
      const caption = mobileTempo.closest('label')?.querySelector('span');
      if (caption) caption.textContent = `TEMPO ${state.bpm.toFixed(1)} BPM`;
    }
    return;
  }

  const decks = ui.buttons?.querySelectorAll?.('.dj-deck') ?? [];
  [...decks].forEach((host, index) => {
    const deckId = index === 0 ? 'A' : 'B';
    const state = mixer.snapshot().decks[deckId];
    const track = trackFor(deckId);
    const label = [...host.querySelectorAll('label')].find((candidate) =>
      candidate.textContent.trim().startsWith('Tempo'),
    );
    const input = label?.querySelector('input[type="range"]');
    if (!state || !track || !input) return;
    input.min = String(track.bpm * (1 - TEMPO_RANGE));
    input.max = String(track.bpm * (1 + TEMPO_RANGE));
    input.value = String(state.bpm);
    const caption = label.querySelector('span');
    if (caption) caption.textContent = `Tempo: ${state.bpm.toFixed(1)}`;
  });
}

export function installDjSyncEnhancements(game, ui) {
  const mixer = game.dj;
  if (!mixer || mixer._realBeatSyncInstalled) return mixer;
  mixer._realBeatSyncInstalled = true;

  const basePlayDeck = mixer.playDeck.bind(mixer);
  const baseLoad = mixer.load.bind(mixer);
  const baseUpdate = mixer.update.bind(mixer);
  const baseSnapshot = mixer.snapshot.bind(mixer);

  mixer.setBpm = (deckId, bpm) => setWideBpm(mixer, deckId, bpm);

  mixer.phase = (deck) => beatPhase(mixer, deck?.id);

  mixer.sync = (deckId) => {
    const slave = mixer.decks[deckId];
    const masterId = deckId === 'A' ? 'B' : 'A';
    const master = mixer.decks[masterId];
    if (!slave || !master) return false;

    const slaveTrack = trackById(slave.trackId);
    const min = slaveTrack.bpm * (1 - TEMPO_RANGE);
    const max = slaveTrack.bpm * (1 + TEMPO_RANGE);
    let sharedTempo = clamp(master.bpm, min, max);

    // If a future track falls outside the slave range, move both decks to the closest shared
    // tempo instead of leaving the UI saying SYNC while the BPMs are still different.
    if (Math.abs(sharedTempo - master.bpm) > 0.001) {
      const masterTrack = trackById(master.trackId);
      sharedTempo = clamp(
        sharedTempo,
        masterTrack.bpm * (1 - TEMPO_RANGE),
        masterTrack.bpm * (1 + TEMPO_RANGE),
      );
      setWideBpm(mixer, masterId, sharedTempo);
    }
    setWideBpm(mixer, deckId, sharedTempo);
    slave._syncMaster = masterId;

    const aligned = master.playing ? alignDeck(mixer, deckId, masterId) : false;
    mixer.updateVibe?.();
    ui?.warning?.(
      master.playing
        ? `Deck ${deckId} synced to ${masterId} at ${sharedTempo.toFixed(1)} BPM · beat grid locked.`
        : `Deck ${deckId} matched to ${masterId} at ${sharedTempo.toFixed(1)} BPM. Start the master to phase-sync.`,
    );
    return aligned || true;
  };

  mixer.playDeck = async (deckId) => {
    const result = await basePlayDeck(deckId);
    const deck = mixer.decks[deckId];
    if (result && deck) ensureBeatGrid(mixer, deck);
    const masterId = deck?._syncMaster;
    const master = masterId ? mixer.decks[masterId] : null;
    if (result && deck && master?.playing) {
      ensureBeatGrid(mixer, master);
      setWideBpm(mixer, deckId, master.bpm);
      alignDeck(mixer, deckId, masterId);
      mixer.updateVibe?.();
    }
    return result;
  };

  mixer.load = (deckId, trackId) => {
    const deck = mixer.decks[deckId];
    if (deck) deck.beatOffset = null;
    const result = baseLoad(deckId, trackId);
    const updatedDeck = mixer.decks[deckId];
    const master = updatedDeck?._syncMaster ? mixer.decks[updatedDeck._syncMaster] : null;
    if (updatedDeck && master?.playing) setWideBpm(mixer, deckId, master.bpm);
    return result;
  };

  mixer.update = (dt) => {
    const result = baseUpdate(dt);
    return result;
  };

  mixer.snapshot = () => {
    const snapshot = baseSnapshot();
    for (const [deckId, state] of Object.entries(snapshot.decks)) {
      const deck = mixer.decks[deckId];
      state.syncedTo = deck?._syncMaster ?? null;
      state.beatPhase = beatPhase(mixer, deckId);
      state.beatOffset = Number.isFinite(deck?.beatOffset) ? deck.beatOffset : null;
    }
    return snapshot;
  };

  if (ui && !ui._realBeatSyncUiInstalled) {
    const baseDjMixer = ui.djMixer.bind(ui);
    ui.djMixer = (activeMixer, tracks, options = {}) => {
      const result = baseDjMixer(activeMixer, tracks, options);
      patchTempoControls(ui, activeMixer, tracks);
      return result;
    };
    ui._realBeatSyncUiInstalled = true;
  }

  return mixer;
}
