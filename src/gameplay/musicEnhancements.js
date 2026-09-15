import { AudioEngine } from '../audio/AudioEngine.js';
import { DjMixer } from '../dj/DjMixer.js';
import { StudioPlayback } from '../studio/StudioPlayback.js';
import { StudioSession } from '../studio/StudioSession.js';
import { KeyboardPerformance } from '../studio/KeyboardPerformance.js';
import { TouchPerformanceSurface } from '../ui/TouchPerformanceSurface.js';
import { Hud } from '../ui/Hud.js';
import '../ui/mobileMixerEnhancements.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const midiToFrequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const impulseCache = new WeakMap();

function createImpulse(context, seconds = 1.55, decay = 2.8) {
  let cached = impulseCache.get(context);
  if (cached) return cached;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const envelope = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
  }
  impulseCache.set(context, buffer);
  return buffer;
}

function driveCurve(amount = 0) {
  const safe = clamp(amount, 0, 1);
  if (safe <= 0.001) return null;
  const curve = new Float32Array(512);
  const k = 1 + safe * 45;
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function guitarProfile(mode, voice, amp) {
  const bass = mode === 'bass';
  const profile = {
    brightness: bass ? 0.42 : 0.68,
    damping: bass ? 0.9983 : 0.9962,
    duration: bass ? 1.65 : 1.25,
    bodyHz: bass ? 150 : 340,
    bodyGain: bass ? 2.5 : 2.2,
    cabinetHz: bass ? 4800 : 7200,
    drive: 0.08,
    pickNoise: bass ? 0.22 : 0.42,
  };

  if (voice === 'bright') {
    profile.brightness = 0.9;
    profile.cabinetHz = 9800;
    profile.pickNoise = 0.58;
    profile.damping = 0.9955;
  } else if (voice === 'warm') {
    profile.brightness = 0.48;
    profile.bodyHz = 280;
    profile.bodyGain = 4.1;
    profile.cabinetHz = 5900;
    profile.damping = 0.9972;
  } else if (voice === 'focused') {
    profile.brightness = 0.66;
    profile.bodyHz = 720;
    profile.bodyGain = 2.8;
    profile.cabinetHz = 7600;
    profile.damping = 0.9958;
  } else if (voice === 'acoustic') {
    profile.brightness = 0.78;
    profile.bodyHz = 205;
    profile.bodyGain = 5.4;
    profile.cabinetHz = 12800;
    profile.drive = 0;
    profile.pickNoise = 0.7;
    profile.damping = 0.9966;
    profile.duration = 1.45;
  } else if (voice === 'round') {
    profile.brightness = 0.32;
    profile.bodyHz = 120;
    profile.bodyGain = 4.2;
    profile.cabinetHz = 3900;
    profile.damping = 0.9988;
  } else if (voice === 'defined') {
    profile.brightness = 0.56;
    profile.bodyHz = 220;
    profile.cabinetHz = 5900;
    profile.pickNoise = 0.36;
  } else if (voice === 'woody') {
    profile.brightness = 0.38;
    profile.bodyHz = 175;
    profile.bodyGain = 5.1;
    profile.cabinetHz = 4300;
    profile.damping = 0.9987;
  }

  if (amp === 'crunch') {
    profile.drive = Math.max(profile.drive, 0.74);
    profile.bodyHz = bass ? 260 : 1050;
    profile.bodyGain += 2.2;
    profile.cabinetHz = bass ? 4300 : 5600;
  } else if (amp === 'mid-forward') {
    profile.drive = Math.max(profile.drive, 0.34);
    profile.bodyHz = bass ? 220 : 860;
    profile.bodyGain += 2.4;
    profile.cabinetHz = bass ? 5200 : 6500;
  } else if (amp === 'wide-clean') {
    profile.drive *= 0.25;
    profile.cabinetHz = Math.max(profile.cabinetHz, bass ? 6200 : 10500);
    profile.bodyGain *= 0.78;
  } else if (amp === 'deep') {
    profile.drive = Math.max(profile.drive, 0.14);
    profile.bodyHz = 105;
    profile.bodyGain += 2.6;
    profile.cabinetHz = 4200;
  }
  return profile;
}

function inferInstrumentProfile(config = {}) {
  const label = String(config.label ?? '').toLowerCase();
  let voice = config.mode === 'bass' ? 'round' : 'focused';
  let amp = config.mode === 'bass' ? 'deep' : 'wide-clean';
  if (label.includes('offset')) voice = 'bright';
  else if (label.includes('semi-hollow')) voice = 'warm';
  else if (label.includes('solidbody')) voice = 'focused';
  else if (label.includes('acoustic')) voice = 'acoustic';
  else if (label.includes('p-style')) voice = 'round';
  else if (label.includes('j-style')) voice = 'defined';
  else if (label.includes('short-scale')) voice = 'woody';

  if (label.includes('tweed')) amp = 'mid-forward';
  else if (label.includes('large clean')) amp = 'wide-clean';
  else if (label.includes('british')) amp = 'crunch';
  else if (label.includes('bass head')) amp = 'deep';
  if (voice === 'acoustic') amp = 'acoustic';
  return { voice, amp };
}

let audioPatched = false;
function patchAudioEngine() {
  if (audioPatched) return;
  audioPatched = true;

  AudioEngine.prototype.pluckedString = function pluckedString(
    frequency,
    {
      mode = 'guitar',
      voice = mode === 'bass' ? 'round' : 'focused',
      amp = mode === 'bass' ? 'deep' : 'wide-clean',
      volume = mode === 'bass' ? 0.11 : 0.085,
      duration,
      when = 0,
      destination = this.master,
    } = {},
  ) {
    const context = this.context;
    if (!context || !destination) return false;
    const profile = guitarProfile(mode, voice, amp);
    const safeFrequency = clamp(Number(frequency) || 110, 35, 1400);
    const seconds = clamp(Number(duration) || profile.duration, 0.3, 2.4);
    const length = Math.max(2, Math.floor(context.sampleRate * seconds));
    const period = Math.max(2, Math.round(context.sampleRate / safeFrequency));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    const excitationLength = Math.min(period, length);
    for (let i = 0; i < excitationLength; i += 1) {
      const pickPosition = i / Math.max(1, excitationLength - 1);
      const shaped = (Math.random() * 2 - 1) * (0.62 + profile.pickNoise * (1 - pickPosition));
      data[i] = shaped;
    }
    for (let i = period; i < length; i += 1) {
      const previous = data[i - period];
      const neighbor = data[Math.max(0, i - period - 1)];
      const brightTerm = previous * (0.46 + profile.brightness * 0.16);
      const smoothTerm = neighbor * (0.54 - profile.brightness * 0.16);
      data[i] = (brightTerm + smoothTerm) * profile.damping;
    }

    const source = context.createBufferSource();
    const pickHighpass = context.createBiquadFilter();
    const body = context.createBiquadFilter();
    const drive = context.createWaveShaper();
    const cabinet = context.createBiquadFilter();
    const gain = context.createGain();
    const start = context.currentTime + Math.max(0, Number(when) || 0);

    source.buffer = buffer;
    pickHighpass.type = 'highpass';
    pickHighpass.frequency.value = mode === 'bass' ? 32 : voice === 'acoustic' ? 72 : 58;
    pickHighpass.Q.value = 0.7;
    body.type = 'peaking';
    body.frequency.value = profile.bodyHz;
    body.Q.value = voice === 'acoustic' ? 1.2 : 0.82;
    body.gain.value = profile.bodyGain;
    drive.curve = driveCurve(profile.drive);
    drive.oversample = '2x';
    cabinet.type = 'lowpass';
    cabinet.frequency.value = profile.cabinetHz;
    cabinet.Q.value = amp === 'crunch' ? 0.95 : 0.52;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(clamp(volume, 0.01, 0.22), start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

    source.connect(pickHighpass);
    pickHighpass.connect(body);
    body.connect(drive);
    drive.connect(cabinet);
    cabinet.connect(gain);
    gain.connect(destination);
    this.voice(source, pickHighpass, body, drive, cabinet, gain);
    source.start(start);
    source.stop(start + seconds + 0.04);
    return true;
  };
}

let performancePatched = false;
function patchInstrumentPerformance() {
  if (performancePatched) return;
  performancePatched = true;

  const baseStart = KeyboardPerformance.prototype.start;
  const basePlayMidi = KeyboardPerformance.prototype.playMidi;
  const baseStop = KeyboardPerformance.prototype.stop;
  const baseRenderFretboard = TouchPerformanceSurface.prototype.renderFretboard;
  const baseAttachPerformance = StudioSession.prototype.attachPerformance;
  const baseRenderPerformance = StudioPlayback.prototype.renderPerformance;

  KeyboardPerformance.prototype.start = function enhancedStart(config = {}, options = {}) {
    const result = baseStart.call(this, config, options);
    if (this.config && (this.config.mode === 'guitar' || this.config.mode === 'bass')) {
      const profile = inferInstrumentProfile(this.config);
      this.config.instrumentVoice = profile.voice;
      this.config.ampCharacter = profile.amp;
    }
    return result;
  };

  KeyboardPerformance.prototype.playMidi = function enhancedPlayMidi(midi) {
    if (!this.active || !this.config || this.config.mode === 'drums') return false;
    if (this.config.mode !== 'guitar' && this.config.mode !== 'bass') {
      return basePlayMidi.call(this, midi);
    }
    const safeMidi = clamp(Math.round(Number(midi) || this.config.baseMidi), 24, 96);
    const frequency = midiToFrequency(safeMidi);
    this.audio.pluckedString?.(frequency, {
      mode: this.config.mode,
      voice: this.config.instrumentVoice,
      amp: this.config.ampCharacter,
      volume:
        this.config.mode === 'bass'
          ? Math.max(0.085, this.config.volume)
          : Math.max(0.065, this.config.volume),
      duration: this.config.mode === 'bass' ? 1.55 : 1.22,
    });
    this.record({ midi: safeMidi, frequency });
    return true;
  };

  KeyboardPerformance.prototype.strumChord = function strumChord(midis, direction = 'down') {
    if (!this.active || !this.config || !Array.isArray(midis) || !midis.length) return false;
    if (this.config.mode !== 'guitar' && this.config.mode !== 'bass') return false;
    const notes = direction === 'up' ? [...midis].reverse() : [...midis];
    const started = this.eventTime();
    notes.forEach((midi, index) => {
      const safeMidi = clamp(Math.round(Number(midi) || this.config.baseMidi), 24, 96);
      const frequency = midiToFrequency(safeMidi);
      const offset = index * (this.config.mode === 'bass' ? 0.032 : 0.021);
      this.audio.pluckedString?.(frequency, {
        mode: this.config.mode,
        voice: this.config.instrumentVoice,
        amp: this.config.ampCharacter,
        volume: this.config.mode === 'bass' ? 0.088 : 0.062,
        duration: this.config.mode === 'bass' ? 1.55 : 1.28,
        when: offset,
      });
      this.record({ midi: safeMidi, frequency, time: started + offset });
    });
    return true;
  };

  KeyboardPerformance.prototype.stop = function enhancedStop(returnTake = true) {
    const profile = this.config
      ? {
          instrumentVoice: this.config.instrumentVoice,
          ampCharacter: this.config.ampCharacter,
        }
      : null;
    const take = baseStop.call(this, returnTake);
    if (take && profile) Object.assign(take, profile);
    return take;
  };

  StudioSession.prototype.attachPerformance = function enhancedAttachPerformance(
    stemId,
    performance,
  ) {
    const attached = baseAttachPerformance.call(this, stemId, performance);
    if (!attached) return false;
    const stem = this.stems.find((candidate) => candidate.id === stemId);
    if (stem?.performance) {
      if (performance?.instrumentVoice)
        stem.performance.instrumentVoice = performance.instrumentVoice;
      if (performance?.ampCharacter) stem.performance.ampCharacter = performance.ampCharacter;
    }
    return true;
  };

  StudioPlayback.prototype.renderPerformance = function enhancedRenderPerformance(
    stem,
    step,
    when,
  ) {
    const performance = stem.performance;
    if (!performance?.events?.length || !['guitar', 'bass'].includes(performance.mode)) {
      return baseRenderPerformance.call(this, stem, step, when);
    }
    const bus = this.ensureBus(stem).input;
    const sourceBpm = performance.bpm || this.bpm;
    const stepDuration = 60 / sourceBpm / 4;
    const loopSteps = Math.max(
      16,
      Math.min(256, Math.ceil((performance.duration || 4) / stepDuration)),
    );
    const current = step % loopSteps;
    for (const event of performance.events) {
      const eventStep = Math.round((event.time || 0) / stepDuration) % loopSteps;
      if (eventStep !== current || event.drum) continue;
      this.audio.pluckedString?.(event.frequency || 110, {
        mode: performance.mode,
        voice: performance.instrumentVoice ?? (performance.mode === 'bass' ? 'round' : 'focused'),
        amp: performance.ampCharacter ?? (performance.mode === 'bass' ? 'deep' : 'wide-clean'),
        volume: performance.mode === 'bass' ? 0.088 : 0.063,
        duration: performance.mode === 'bass' ? 1.45 : 1.18,
        when,
        destination: bus,
      });
    }
    return true;
  };

  TouchPerformanceSurface.prototype.renderFretboard = function enhancedFretboard(
    surface,
    performance,
    mode,
  ) {
    baseRenderFretboard.call(this, surface, performance, mode);
    const row = this.document.createElement('div');
    row.className = 'touch-strum-row';
    const presets =
      mode === 'bass'
        ? [
            ['E', [28, 40]],
            ['A', [33, 45]],
            ['D', [38, 50]],
            ['G', [43, 55]],
          ]
        : [
            ['Em', [40, 47, 52, 55, 59, 64]],
            ['G', [43, 47, 50, 55, 59, 67]],
            ['C', [48, 52, 55, 60, 64]],
            ['D', [50, 57, 62, 66]],
            ['Am', [45, 52, 57, 60, 64]],
          ];
    for (const [label, notes] of presets) {
      row.appendChild(
        this.makeButton(
          label,
          'touch-strum-button',
          () => performance.strumChord(notes),
          `${label} strum`,
        ),
      );
    }
    surface.appendChild(row);
  };
}

function ensureDeckState(deck) {
  deck.filter = clamp(Number(deck.filter) || 0, -1, 1);
  deck.reverb = clamp(Number(deck.reverb) || 0);
  deck.echo = clamp(Number(deck.echo) || 0);
  deck.loopBeats = [0, 4, 8, 16].includes(deck.loopBeats) ? deck.loopBeats : 0;
  deck.loopStart = Math.max(0, Number(deck.loopStart) || 0);
  deck.loopEnd = Math.max(0, Number(deck.loopEnd) || 0);
  if (!Array.isArray(deck.hotCues)) deck.hotCues = [null, null, null, null];
}

function setAudioParam(context, parameter, value, timeConstant = 0.025) {
  if (!parameter) return;
  if (context && typeof parameter.setTargetAtTime === 'function') {
    parameter.setTargetAtTime(value, context.currentTime, timeConstant);
  } else parameter.value = value;
}

function applyDeckFx(mixer, deck) {
  ensureDeckState(deck);
  if (!deck.fxNodes || !mixer.context) return;
  const { filter, delay, feedback, delayWet, reverbWet } = deck.fxNodes;
  const value = deck.filter;
  if (value < -0.015) {
    filter.type = 'lowpass';
    const amount = Math.abs(value);
    const frequency = 280 * Math.pow(20000 / 280, 1 - amount);
    setAudioParam(mixer.context, filter.frequency, frequency);
    setAudioParam(mixer.context, filter.Q, 0.7 + amount * 3.4);
  } else if (value > 0.015) {
    filter.type = 'highpass';
    const frequency = 20 * Math.pow(5200 / 20, value);
    setAudioParam(mixer.context, filter.frequency, frequency);
    setAudioParam(mixer.context, filter.Q, 0.7 + value * 2.8);
  } else {
    filter.type = 'lowpass';
    setAudioParam(mixer.context, filter.frequency, 20000);
    setAudioParam(mixer.context, filter.Q, 0.7);
  }
  const echoSeconds = clamp(60 / Math.max(60, deck.bpm) / 2, 0.12, 0.48);
  setAudioParam(mixer.context, delay.delayTime, echoSeconds, 0.015);
  setAudioParam(mixer.context, feedback.gain, deck.echo * 0.58);
  setAudioParam(mixer.context, delayWet.gain, deck.echo * 0.68);
  setAudioParam(mixer.context, reverbWet.gain, deck.reverb * 0.55);
}

let djPatched = false;
function patchDjMixer() {
  if (djPatched) return;
  djPatched = true;
  const baseEnsureDeckNodes = DjMixer.prototype.ensureDeckNodes;
  const basePlayDeck = DjMixer.prototype.playDeck;
  const baseLoad = DjMixer.prototype.load;
  const baseUpdate = DjMixer.prototype.update;
  const baseSnapshot = DjMixer.prototype.snapshot;

  DjMixer.prototype.ensureDeckNodes = function enhancedEnsureDeckNodes(deck) {
    const nodes = baseEnsureDeckNodes.call(this, deck);
    if (!nodes || !this.context) return nodes;
    ensureDeckState(deck);
    if (!deck.fxNodes) {
      try {
        nodes.high.disconnect(nodes.level);
      } catch {
        try {
          nodes.high.disconnect();
        } catch {
          // Already rewired.
        }
      }
      const filter = this.context.createBiquadFilter();
      const delay = this.context.createDelay(1.5);
      const feedback = this.context.createGain();
      const delayWet = this.context.createGain();
      const reverb = this.context.createConvolver();
      const reverbWet = this.context.createGain();
      reverb.buffer = createImpulse(this.context);
      feedback.gain.value = 0;
      delayWet.gain.value = 0;
      reverbWet.gain.value = 0;
      nodes.high.connect(filter);
      filter.connect(nodes.level);
      filter.connect(delay);
      delay.connect(delayWet);
      delayWet.connect(nodes.level);
      delay.connect(feedback);
      feedback.connect(delay);
      filter.connect(reverb);
      reverb.connect(reverbWet);
      reverbWet.connect(nodes.level);
      deck.fxNodes = { filter, delay, feedback, delayWet, reverb, reverbWet };
      Object.assign(nodes, deck.fxNodes);
    }
    applyDeckFx(this, deck);
    return nodes;
  };

  DjMixer.prototype.setFilter = function setFilter(deckId, value) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    ensureDeckState(deck);
    deck.filter = clamp(Number(value) || 0, -1, 1);
    this.ensureDeckNodes(deck);
    applyDeckFx(this, deck);
    return deck.filter;
  };

  DjMixer.prototype.setReverb = function setReverb(deckId, value) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    ensureDeckState(deck);
    deck.reverb = clamp(Number(value) || 0);
    this.ensureDeckNodes(deck);
    applyDeckFx(this, deck);
    return deck.reverb;
  };

  DjMixer.prototype.setEcho = function setEcho(deckId, value) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    ensureDeckState(deck);
    deck.echo = clamp(Number(value) || 0);
    this.ensureDeckNodes(deck);
    applyDeckFx(this, deck);
    return deck.echo;
  };

  DjMixer.prototype.deckPosition = function deckPosition(deckId) {
    const deck = this.decks[deckId];
    if (!deck) return 0;
    if (deck.media) return Math.max(0, Number(deck.media.currentTime) || 0);
    if (deck.source?.buffer && this.context && Number.isFinite(deck.startedAt)) {
      const rate = deck.bpm / Math.max(1, deck.baseBpm || deck.bpm);
      const elapsed = Math.max(0, this.context.currentTime - deck.startedAt) * rate;
      const duration = deck.source.buffer.duration || 1;
      return (Math.max(0, deck.startOffset || 0) + elapsed) % duration;
    }
    const beat = 60 / Math.max(1, deck.bpm);
    return Math.max(0, deck.step * beat * 0.25);
  };

  DjMixer.prototype.restartDeckAt = function restartDeckAt(deckId, seconds) {
    const deck = this.decks[deckId];
    if (!deck || !deck.playing) return false;
    const position = Math.max(0, Number(seconds) || 0);
    if (deck.media) {
      const duration = Number(deck.media.duration);
      deck.media.currentTime =
        Number.isFinite(duration) && duration > 0 ? position % duration : position;
      return true;
    }
    if (!deck.source?.buffer || !this.context) return false;
    const buffer = deck.source.buffer;
    const old = deck.source;
    old.onended = null;
    try {
      old.stop();
    } catch {
      // Already stopped.
    }
    try {
      old.disconnect();
    } catch {
      // Already disconnected.
    }
    const source = this.context.createBufferSource();
    const baseBpm = deck.baseBpm || deck.bpm;
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = deck.bpm / Math.max(1, baseBpm);
    if (deck.loopBeats > 0 && deck.loopEnd > deck.loopStart) {
      source.loopStart = deck.loopStart;
      source.loopEnd = Math.min(buffer.duration, deck.loopEnd);
    }
    source.connect(deck.nodes.input);
    source.onended = () => {
      source.disconnect();
      if (deck.source === source) deck.source = null;
    };
    const offset = buffer.duration > 0 ? position % buffer.duration : position;
    deck.source = source;
    deck.startedAt = this.context.currentTime;
    deck.startOffset = offset;
    source.start(0, offset);
    return true;
  };

  DjMixer.prototype.hotCue = function hotCue(deckId, index) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    ensureDeckState(deck);
    const slot = clamp(Math.round(index), 0, 3);
    if (deck.hotCues[slot] == null) {
      const beat = 60 / Math.max(1, deck.bpm);
      deck.hotCues[slot] = slot * beat * 16;
    }
    return this.restartDeckAt(deckId, deck.hotCues[slot]);
  };

  DjMixer.prototype.setLoop = function setLoop(deckId, beats) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    ensureDeckState(deck);
    const safeBeats = [4, 8, 16].includes(Number(beats)) ? Number(beats) : 0;
    if (safeBeats > 0 && deck.loopBeats === safeBeats) {
      deck.loopBeats = 0;
      deck.loopStart = 0;
      deck.loopEnd = 0;
      if (deck.source?.buffer) {
        deck.source.loopStart = 0;
        deck.source.loopEnd = deck.source.buffer.duration;
      }
      return 0;
    }
    if (!safeBeats) {
      deck.loopBeats = 0;
      deck.loopStart = 0;
      deck.loopEnd = 0;
      return 0;
    }
    const beatSeconds = 60 / Math.max(1, deck.bpm);
    const current = this.deckPosition(deckId);
    deck.loopBeats = safeBeats;
    deck.loopStart = Math.floor(current / beatSeconds) * beatSeconds;
    deck.loopEnd = deck.loopStart + safeBeats * beatSeconds;
    this.restartDeckAt(deckId, deck.loopStart);
    return safeBeats;
  };

  DjMixer.prototype.load = function enhancedLoad(deckId, trackId) {
    const result = baseLoad.call(this, deckId, trackId);
    const deck = this.decks[deckId];
    if (deck) {
      deck.hotCues = [null, null, null, null];
      deck.loopBeats = 0;
      deck.loopStart = 0;
      deck.loopEnd = 0;
    }
    return result;
  };

  DjMixer.prototype.playDeck = async function enhancedPlayDeck(deckId) {
    const result = await basePlayDeck.call(this, deckId);
    const deck = this.decks[deckId];
    if (result && deck) {
      ensureDeckState(deck);
      const playbackRate = deck.source?.playbackRate?.value ?? deck.media?.playbackRate ?? 1;
      deck.baseBpm = deck.bpm / Math.max(0.01, playbackRate);
      if (deck.source?.buffer && this.context) {
        deck.startedAt = this.context.currentTime;
        deck.startOffset = 0;
      }
      applyDeckFx(this, deck);
    }
    return result;
  };

  DjMixer.prototype.update = function enhancedDjUpdate(dt) {
    const result = baseUpdate.call(this, dt);
    for (const deck of Object.values(this.decks)) {
      ensureDeckState(deck);
      applyDeckFx(this, deck);
      if (deck.media && deck.loopBeats > 0 && deck.loopEnd > deck.loopStart) {
        if (
          deck.media.currentTime >= deck.loopEnd ||
          deck.media.currentTime < deck.loopStart - 0.25
        ) {
          deck.media.currentTime = deck.loopStart;
        }
      }
    }
    return result;
  };

  DjMixer.prototype.snapshot = function enhancedDjSnapshot() {
    const snapshot = baseSnapshot.call(this);
    for (const [deckId, state] of Object.entries(snapshot.decks)) {
      const deck = this.decks[deckId];
      ensureDeckState(deck);
      Object.assign(state, {
        filter: deck.filter,
        reverb: deck.reverb,
        echo: deck.echo,
        loopBeats: deck.loopBeats,
        hotCues: [...deck.hotCues],
      });
    }
    return snapshot;
  };
}

function ensureStemFx(stem) {
  stem.reverb = clamp(Number(stem.reverb) || 0);
  stem.delay = clamp(Number(stem.delay) || 0);
  stem.phaser = clamp(Number(stem.phaser) || 0);
  stem.distortion = clamp(Number(stem.distortion) || 0);
}

function applyStemFx(playback, stem, bus) {
  ensureStemFx(stem);
  if (!bus?._fx || !playback.audio.context) return;
  const context = playback.audio.context;
  const { drive, phaser, delay, feedback, delayWet, reverbWet } = bus._fx;
  drive.curve = driveCurve(stem.distortion * 0.82);
  drive.oversample = '2x';
  const phaseHz =
    520 + Math.sin(context.currentTime * (1.1 + stem.phaser * 1.7)) * stem.phaser * 470;
  setAudioParam(context, phaser.frequency, Math.max(80, phaseHz));
  setAudioParam(context, phaser.Q, 0.3 + stem.phaser * 7.2);
  const delaySeconds = clamp(60 / Math.max(50, playback.bpm || 118) / 2, 0.13, 0.55);
  setAudioParam(context, delay.delayTime, delaySeconds, 0.018);
  setAudioParam(context, feedback.gain, stem.delay * 0.5);
  setAudioParam(context, delayWet.gain, stem.delay * 0.6);
  setAudioParam(context, reverbWet.gain, stem.reverb * 0.54);
}

let studioPatched = false;
function patchStudioFx() {
  if (studioPatched) return;
  studioPatched = true;

  StudioSession.prototype.setEffect = function setEffect(id, effect, value) {
    const stem = this.stems.find((item) => item.id === id);
    if (!stem || !['reverb', 'delay', 'phaser', 'distortion'].includes(effect)) return false;
    ensureStemFx(stem);
    stem[effect] = clamp(Number(value) || 0);
    return stem[effect];
  };

  const baseEnsureBus = StudioPlayback.prototype.ensureBus;
  const baseUpdateMix = StudioPlayback.prototype.updateMix;
  const baseUpdateNativeMix = StudioPlayback.prototype.updateNativeMix;

  StudioPlayback.prototype.ensureBus = function enhancedEnsureBus(stem) {
    const bus = baseEnsureBus.call(this, stem);
    if (!bus || !this.audio.context) return bus;
    ensureStemFx(stem);
    if (!bus._fx) {
      try {
        bus.compressor.disconnect(bus.fader);
      } catch {
        try {
          bus.compressor.disconnect();
        } catch {
          // Already rewired.
        }
      }
      const drive = this.audio.context.createWaveShaper();
      const phaser = this.audio.context.createBiquadFilter();
      const dry = this.audio.context.createGain();
      const delay = this.audio.context.createDelay(1.5);
      const feedback = this.audio.context.createGain();
      const delayWet = this.audio.context.createGain();
      const reverb = this.audio.context.createConvolver();
      const reverbWet = this.audio.context.createGain();
      phaser.type = 'allpass';
      phaser.frequency.value = 520;
      phaser.Q.value = 0.3;
      dry.gain.value = 1;
      feedback.gain.value = 0;
      delayWet.gain.value = 0;
      reverb.buffer = createImpulse(this.audio.context);
      reverbWet.gain.value = 0;
      bus.compressor.connect(drive);
      drive.connect(phaser);
      phaser.connect(dry);
      dry.connect(bus.fader);
      phaser.connect(delay);
      delay.connect(delayWet);
      delayWet.connect(bus.fader);
      delay.connect(feedback);
      feedback.connect(delay);
      phaser.connect(reverb);
      reverb.connect(reverbWet);
      reverbWet.connect(bus.fader);
      bus._fx = { drive, phaser, dry, delay, feedback, delayWet, reverb, reverbWet };
      Object.assign(bus, bus._fx);
    }
    applyStemFx(this, stem, bus);
    return bus;
  };

  StudioPlayback.prototype.updateMix = function enhancedUpdateMix(session = this.session) {
    const result = baseUpdateMix.call(this, session);
    if (session) {
      for (const stem of session.stems) {
        const bus = this.buses.get(stem.id);
        if (bus) applyStemFx(this, stem, bus);
      }
    }
    return result;
  };

  StudioPlayback.prototype.updateNativeMix = function enhancedNativeMix(session = this.session) {
    const result = baseUpdateNativeMix.call(this, session);
    if (session) {
      for (const stem of session.stems) {
        const bus = this.buses.get(stem.id);
        if (bus) applyStemFx(this, stem, bus);
      }
    }
    return result;
  };
}

function createRange(document, labelText, value, onInput, { min = 0, max = 1, step = 0.01 } = {}) {
  const label = document.createElement('label');
  label.className = 'music-fx-range';
  const text = document.createElement('span');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute('aria-label', labelText);
  const refresh = () => {
    const raw = Number(input.value);
    text.textContent =
      min < 0 ? `${labelText} ${raw.toFixed(2)}` : `${labelText} ${Math.round(raw * 100)}%`;
  };
  input.oninput = () => {
    refresh();
    onInput(Number(input.value));
  };
  refresh();
  label.append(text, input);
  return label;
}

function addDjExtras(document, host, mixer, deckId, onChange = () => {}) {
  if (!host || host.querySelector(':scope > .music-dj-extras')) return;
  const snapshot = mixer.snapshot().decks[deckId];
  if (!snapshot) return;
  const extras = document.createElement('section');
  extras.className = 'music-dj-extras';
  const fx = document.createElement('div');
  fx.className = 'music-fx-grid';
  fx.append(
    createRange(
      document,
      'FILTER',
      snapshot.filter ?? 0,
      (value) => {
        mixer.setFilter(deckId, value);
        onChange();
      },
      { min: -1, max: 1 },
    ),
    createRange(document, 'REVERB', snapshot.reverb ?? 0, (value) => {
      mixer.setReverb(deckId, value);
      onChange();
    }),
    createRange(document, 'ECHO', snapshot.echo ?? 0, (value) => {
      mixer.setEcho(deckId, value);
      onChange();
    }),
  );
  extras.appendChild(fx);

  const performance = document.createElement('div');
  performance.className = 'music-performance-row hot-cues';
  for (let index = 0; index < 4; index += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `CUE ${index + 1}`;
    button.onclick = () => {
      mixer.hotCue(deckId, index);
      onChange();
    };
    performance.appendChild(button);
  }
  extras.appendChild(performance);

  const loops = document.createElement('div');
  loops.className = 'music-performance-row loops';
  for (const beats of [4, 8, 16]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${beats} BEAT LOOP`;
    if (snapshot.loopBeats === beats) button.classList.add('active');
    button.onclick = () => {
      mixer.setLoop(deckId, beats);
      onChange();
      button.classList.toggle('active', mixer.snapshot().decks[deckId].loopBeats === beats);
      for (const sibling of loops.querySelectorAll('button')) {
        if (sibling !== button) sibling.classList.remove('active');
      }
    };
    loops.appendChild(button);
  }
  extras.appendChild(loops);
  host.appendChild(extras);
}

function addStudioExtras(document, host, session, stem, onMix = () => {}) {
  if (!host || !stem || host.querySelector(':scope > .music-channel-fx')) return;
  ensureStemFx(stem);
  const extras = document.createElement('section');
  extras.className = 'music-channel-fx';
  const grid = document.createElement('div');
  grid.className = 'music-fx-grid studio-fx-grid';
  for (const effect of ['reverb', 'delay', 'phaser', 'distortion']) {
    grid.appendChild(
      createRange(document, effect.toUpperCase(), stem[effect] ?? 0, (value) => {
        session.setEffect(stem.id, effect, value);
        onMix();
      }),
    );
  }
  extras.appendChild(grid);
  host.appendChild(extras);
}

let hudPatched = false;
function patchHud() {
  if (hudPatched) return;
  hudPatched = true;
  const baseDjMixer = Hud.prototype.djMixer;
  const baseStudioMixer = Hud.prototype.studioMixer;

  Hud.prototype.djMixer = function enhancedHudDjMixer(mixer, tracks, { onChange = () => {} } = {}) {
    const result = baseDjMixer.call(this, mixer, tracks, { onChange });
    const mobileBody = this.buttons.querySelector('.mobile-deck-body');
    if (mobileBody) {
      const render = () =>
        addDjExtras(this.document, mobileBody, mixer, mixer._mobileFocusDeck ?? 'A', onChange);
      render();
      const observer = new MutationObserver(() => queueMicrotask(render));
      observer.observe(mobileBody, { childList: true });
      const shell = mobileBody.closest('.mobile-mixer-shell');
      shell?._musicDjObserver?.disconnect?.();
      if (shell) shell._musicDjObserver = observer;
      return result;
    }
    const decks = [...this.buttons.querySelectorAll('.dj-deck')];
    decks.forEach((deck, index) =>
      addDjExtras(this.document, deck, mixer, index === 0 ? 'A' : 'B', onChange),
    );
    return result;
  };

  Hud.prototype.studioMixer = function enhancedHudStudioMixer(session, options = {}) {
    const result = baseStudioMixer.call(this, session, options);
    const mobileHost = this.buttons.querySelector('.mobile-stem-focus');
    if (mobileHost) {
      const render = () => {
        const stem =
          session.stems.find((candidate) => candidate.id === session._mobileFocusStem) ??
          session.stems[0];
        addStudioExtras(this.document, mobileHost, session, stem, options.onMix);
      };
      render();
      const observer = new MutationObserver(() => queueMicrotask(render));
      observer.observe(mobileHost, { childList: true });
      const shell = mobileHost.closest('.mobile-mixer-shell');
      shell?._musicStudioObserver?.disconnect?.();
      if (shell) shell._musicStudioObserver = observer;
      return result;
    }
    const strips = [...this.buttons.querySelectorAll('.mixer-strip')];
    strips.forEach((strip, index) =>
      addStudioExtras(this.document, strip, session, session.stems[index], options.onMix),
    );
    return result;
  };
}

export function installMusicEnhancements() {
  patchAudioEngine();
  patchInstrumentPerformance();
  patchDjMixer();
  patchStudioFx();
  patchHud();
}
