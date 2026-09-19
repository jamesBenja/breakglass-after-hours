import { spatialSpeakerGains } from './SpectraSpatialLayout.js';

const NOTE = {
  C2: 65.41,
  D2: 73.42,
  E2: 82.41,
  G2: 98,
  A2: 110,
  C3: 130.81,
  A3: 220,
  C4: 261.63,
};

const MIC_COLOR = {
  'dynamic-57': { frequency: 3200, gain: 3.5, q: 1.1 },
  ribbon: { frequency: 5200, gain: -2.5, q: 0.7 },
  'fet-condenser': { frequency: 6500, gain: 2.8, q: 0.8 },
  'tube-condenser': { frequency: 900, gain: 2.4, q: 0.65 },
  'dynamic-7b': { frequency: 2200, gain: 1.2, q: 0.9 },
};

const COMP = {
  'fet-comp': { threshold: -24, ratio: 7, attack: 0.003, release: 0.12 },
  'opto-comp': { threshold: -18, ratio: 3.2, attack: 0.03, release: 0.35 },
  'vca-comp': { threshold: -20, ratio: 4.5, attack: 0.012, release: 0.18 },
  none: { threshold: 0, ratio: 1, attack: 0.003, release: 0.1 },
};

const SAMPLE_RATE = 44_100;
const MAX_EXPORT_SECONDS = 600;
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const textEncoder = new TextEncoder();

function safeName(value, fallback = 'breakglass-track') {
  const clean = String(value || fallback)
    .normalize('NFKD')
    .replace(/[^a-z0-9 _.-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return clean || fallback;
}

function loopSeconds(session) {
  return (
    (Math.max(1, Number(session.loopBars) || 4) * 4 * 60) / Math.max(1, Number(session.bpm) || 118)
  );
}

export function studioExportDuration(session, buffers = new Map()) {
  if (session?.loopEnabled) return clamp(loopSeconds(session), 0.25, MAX_EXPORT_SECONDS);
  let duration = 0;
  for (const stem of session?.stems ?? []) {
    const buffer = buffers.get(stem.id) ?? session?.recordings?.get?.(stem.id);
    if (Number.isFinite(buffer?.duration)) duration = Math.max(duration, buffer.duration);
    const performance = stem.performance;
    if (performance?.events?.length) {
      const noteDuration = Math.max(0.06, Number(performance.noteDuration) || 0.42);
      const latest = performance.events.reduce(
        (max, event) => Math.max(max, Number(event.time) || 0),
        0,
      );
      duration = Math.max(duration, Number(performance.duration) || 0, latest + noteDuration);
    }
  }
  if (!(duration > 0)) duration = loopSeconds({ ...session, loopBars: 4 });
  return clamp(duration, 0.25, MAX_EXPORT_SECONDS);
}

function writeString(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function encodeWav(audioBuffer) {
  const channels = Math.max(1, Math.min(8, Number(audioBuffer.numberOfChannels) || 1));
  const frames = Math.max(0, Number(audioBuffer.length) || 0);
  const sampleRate = Math.max(8_000, Number(audioBuffer.sampleRate) || SAMPLE_RATE);
  const samples = Array.from({ length: channels }, (_, channel) =>
    audioBuffer.getChannelData(channel),
  );

  let peak = 0;
  for (const channel of samples) {
    for (let index = 0; index < channel.length; index += 1) {
      peak = Math.max(peak, Math.abs(channel[index]));
    }
  }
  const scale = peak > 0.98 ? 0.98 / peak : 1;
  const bytesPerSample = 2;
  const dataSize = frames * channels * bytesPerSample;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = clamp(samples[channel][frame] * scale, -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return bytes;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function dosTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export function createStoredZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const now = dosTime(new Date());

  for (const entry of entries) {
    const name = textEncoder.encode(entry.name);
    const data =
      typeof entry.data === 'string' ? textEncoder.encode(entry.data) : new Uint8Array(entry.data);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, now.time, true);
    localView.setUint16(12, now.day, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    locals.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, now.time, true);
    centralView.setUint16(14, now.day, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }

  const centralDirectory = concatBytes(centrals);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...locals, centralDirectory, end]);
}

function createChannel(
  context,
  stem,
  destination,
  level = stem.level ?? 0.68,
  { panEnabled = true } = {},
) {
  const input = context.createGain();
  const color = context.createBiquadFilter();
  const low = context.createBiquadFilter();
  const high = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  const fader = context.createGain();
  const pan =
    panEnabled && typeof context.createStereoPanner === 'function'
      ? context.createStereoPanner()
      : null;
  const fxGain = context.createGain();
  const fxDelay = context.createDelay(0.5);

  const processing = stem.processing ?? {};
  const mic = MIC_COLOR[processing.mic] ?? { frequency: 1800, gain: 0, q: 0.8 };
  let colorGain = mic.gain;
  if (processing.eq === 'spectra-eq') colorGain += 1.4;
  if (processing.eq === 'broad-musical') colorGain += 2.2;

  color.type = 'peaking';
  color.frequency.value = mic.frequency;
  color.Q.value = mic.q;
  color.gain.value = colorGain;
  low.type = 'lowshelf';
  low.frequency.value = 180;
  low.gain.value = (stem.low ?? 0) * 15;
  high.type = 'highshelf';
  high.frequency.value = 4200;
  high.gain.value = (stem.high ?? 0) * 15;

  const comp = COMP[processing.compressor] ?? COMP.none;
  compressor.threshold.value = comp.threshold;
  compressor.ratio.value = comp.ratio;
  compressor.attack.value = comp.attack;
  compressor.release.value = comp.release;

  fader.gain.value = clamp(level, 0, 1);
  if (pan) pan.pan.value = clamp(stem.pan ?? 0, -1, 1);
  fxGain.gain.value = clamp(stem.fx ?? 0, 0, 1) * 0.38;
  fxDelay.delayTime.value = 0.18;

  input.connect(color);
  color.connect(low);
  low.connect(high);
  high.connect(compressor);
  compressor.connect(fader);
  fader.connect(pan ?? destination);
  pan?.connect(destination);
  fader.connect(fxGain);
  fxGain.connect(fxDelay);
  fxDelay.connect(destination);

  return input;
}

function oscillator(context, destination, frequency, duration, options = {}) {
  const source = context.createOscillator();
  const gain = context.createGain();
  const when = Math.max(0, Number(options.when) || 0);
  const length = Math.max(0.02, Number(duration) || 0.18);
  const volume = Math.max(0.0002, Number(options.volume) || 0.08);
  source.type = options.type || 'triangle';
  source.frequency.value = Math.max(20, Number(frequency) || 440);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  source.connect(gain);
  gain.connect(destination);
  source.start(when);
  source.stop(when + length + 0.04);
}

function noise(context, destination, when, duration = 0.05, volume = 0.05) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / length);
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = 'highpass';
  filter.frequency.value = 3200;
  gain.gain.value = volume;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(Math.max(0, when));
}

function sweptOscillator(
  context,
  destination,
  startFrequency,
  endFrequency,
  duration,
  options = {},
) {
  const source = context.createOscillator();
  const gain = context.createGain();
  const when = Math.max(0, Number(options.when) || 0);
  const length = Math.max(0.03, Number(duration) || 0.18);
  const volume = Math.max(0.0002, Number(options.volume) || 0.12);
  source.type = options.type || 'sine';
  source.frequency.setValueAtTime(Math.max(20, startFrequency), when);
  source.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), when + length);
  gain.gain.setValueAtTime(volume, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + length);
  source.connect(gain);
  gain.connect(destination);
  source.start(when);
  source.stop(when + length + 0.04);
}

function kick(context, destination, when = 0, level = 1) {
  const source = context.createOscillator();
  const gain = context.createGain();
  const start = Math.max(0, when);
  source.frequency.setValueAtTime(125, start);
  source.frequency.exponentialRampToValueAtTime(42, start + 0.18);
  gain.gain.setValueAtTime(0.23 * clamp(level, 0, 1.5), start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
  source.connect(gain);
  gain.connect(destination);
  source.start(start);
  source.stop(start + 0.22);
}

function drum(context, destination, name, when) {
  const raw = String(name || '').toLowerCase();
  const accent = raw.endsWith('-accent');
  const normalized = accent ? raw.slice(0, -7) : raw;
  const match = normalized.match(/^(808|909|dmx|linn)-(.+)$/);
  const level = accent ? 1.2 : 1;

  if (match) {
    const kit = match[1];
    const voice = match[2];
    const profiles = {
      808: { kick: [168, 42, 0.42, 0.23], snare: [172, 0.11, 0.07, 0.075], tom: 104 },
      909: { kick: [148, 48, 0.25, 0.245], snare: [196, 0.085, 0.085, 0.095], tom: 118 },
      dmx: { kick: [122, 52, 0.18, 0.21], snare: [212, 0.075, 0.07, 0.08], tom: 126 },
      linn: { kick: [112, 54, 0.16, 0.19], snare: [188, 0.095, 0.065, 0.075], tom: 132 },
    };
    const profile = profiles[kit];

    if (voice === 'kick') {
      sweptOscillator(context, destination, profile.kick[0], profile.kick[1], profile.kick[2], {
        type: kit === 'dmx' ? 'triangle' : 'sine',
        volume: profile.kick[3] * level,
        when,
      });
      if (kit !== '808')
        noise(context, destination, when, 0.018, (kit === '909' ? 0.028 : 0.018) * level);
      return;
    }
    if (voice === 'snare') {
      oscillator(context, destination, profile.snare[0], profile.snare[1], {
        type: kit === 'dmx' ? 'square' : 'triangle',
        volume: profile.snare[2] * level,
        when,
      });
      noise(
        context,
        destination,
        when + 0.006,
        kit === '909' ? 0.11 : 0.085,
        profile.snare[3] * level,
      );
      return;
    }
    if (voice === 'clap') {
      const volume = (kit === '909' ? 0.09 : kit === 'dmx' ? 0.075 : 0.065) * level;
      for (const offset of [0, 0.013, 0.027])
        noise(context, destination, when + offset, 0.028, volume);
      noise(context, destination, when + 0.042, kit === 'linn' ? 0.07 : 0.1, volume * 0.72);
      return;
    }
    if (voice === 'closed-hat') {
      noise(
        context,
        destination,
        when,
        kit === '808' ? 0.032 : 0.042,
        (kit === '909' ? 0.075 : 0.06) * level,
      );
      return;
    }
    if (voice === 'open-hat') {
      noise(
        context,
        destination,
        when,
        kit === '909' ? 0.19 : 0.145,
        (kit === '909' ? 0.08 : 0.067) * level,
      );
      return;
    }
    if (voice === 'low-tom') {
      sweptOscillator(
        context,
        destination,
        profile.tom * 1.15,
        profile.tom,
        kit === '808' ? 0.31 : 0.2,
        {
          type: 'sine',
          volume: 0.1 * level,
          when,
        },
      );
      return;
    }
    if (voice === 'cowbell') {
      const root = kit === '808' ? 540 : kit === '909' ? 610 : kit === 'dmx' ? 585 : 515;
      oscillator(context, destination, root, 0.11, { type: 'square', volume: 0.045 * level, when });
      oscillator(context, destination, root * 1.48, 0.09, {
        type: 'square',
        volume: 0.03 * level,
        when: when + 0.002,
      });
      return;
    }
    if (voice === 'rim') {
      const frequency = kit === 'linn' ? 1420 : kit === 'dmx' ? 1760 : 1580;
      oscillator(context, destination, frequency, 0.035, {
        type: 'triangle',
        volume: 0.065 * level,
        when,
      });
      noise(context, destination, when, 0.022, 0.025 * level);
      return;
    }
  }

  if (normalized === 'kick') kick(context, destination, when, level);
  else if (normalized === 'snare') {
    oscillator(context, destination, 185, 0.09, {
      type: 'triangle',
      volume: 0.075 * level,
      when,
    });
    noise(context, destination, when + 0.008, 0.08, 0.085 * level);
  } else if (normalized === 'closed-hat') noise(context, destination, when, 0.035, 0.06 * level);
  else if (normalized === 'open-hat') noise(context, destination, when, 0.14, 0.07 * level);
  else if (normalized === 'low-tom') {
    oscillator(context, destination, 112, 0.22, { type: 'sine', volume: 0.1 * level, when });
  } else if (normalized === 'high-tom') {
    oscillator(context, destination, 176, 0.18, {
      type: 'sine',
      volume: 0.085 * level,
      when,
    });
  } else if (normalized === 'crash') {
    noise(context, destination, when, 0.42, 0.08 * level);
    oscillator(context, destination, 420, 0.34, {
      type: 'triangle',
      volume: 0.035 * level,
      when,
    });
  }
}

function schedulePerformance(context, stem, destination, duration) {
  const performance = stem.performance;
  if (!performance?.events?.length) return false;
  for (const event of performance.events) {
    const when = Math.max(0, Number(event.time) || 0);
    if (when >= duration) continue;
    if (event.drum) {
      drum(context, destination, event.drum, when);
      continue;
    }
    oscillator(context, destination, event.frequency || 440, performance.noteDuration || 0.42, {
      type: performance.wave || 'triangle',
      volume: performance.volume || 0.065,
      when,
    });
    if (performance.octaveLayer) {
      oscillator(
        context,
        destination,
        (event.frequency || 440) * 2,
        (performance.noteDuration || 0.42) * 0.72,
        {
          type: 'triangle',
          volume: (performance.volume || 0.065) * 0.22,
          when: when + 0.012,
        },
      );
    }
  }
  return true;
}

function schedulePrototype(context, session, stem, destination, duration) {
  const interval = 60 / Math.max(1, Number(session.bpm) || 118) / 4;
  const steps = Math.ceil(duration / interval);
  for (let step = 0; step < steps; step += 1) {
    const when = step * interval;
    if (stem.kind === 'drums') {
      if (step % 4 === 0) kick(context, destination, when);
      if (step % 2 === 1) noise(context, destination, when + 0.01, 0.035, 0.055);
      if (step % 8 === 4) noise(context, destination, when, 0.11, 0.095);
    } else if (stem.kind === 'bass' && step % 2 === 0) {
      const notes = [NOTE.C2, NOTE.C2, NOTE.G2, NOTE.A2, NOTE.E2, NOTE.G2, NOTE.D2, NOTE.A2];
      oscillator(context, destination, notes[(step / 2) % notes.length], 0.22, {
        type: 'sawtooth',
        volume: 0.08,
        when,
      });
    } else if (stem.kind === 'guitar' && step % 4 === 0) {
      const roots = [NOTE.C3, NOTE.A2, NOTE.G2, NOTE.E2];
      const root = roots[(step / 4) % roots.length];
      for (const ratio of [1, 1.25, 1.5]) {
        oscillator(context, destination, root * ratio, 0.34, {
          type: 'triangle',
          volume: 0.045,
          when,
        });
      }
    } else if (['synth', 'keys', 'vocal'].includes(stem.kind) && step % 8 === 0) {
      const root = step % 16 === 0 ? NOTE.C4 : NOTE.A3;
      for (const ratio of [1, 1.25, 1.5]) {
        oscillator(context, destination, root * ratio, 0.7, {
          type: stem.kind === 'vocal' ? 'sine' : 'sawtooth',
          volume: stem.kind === 'vocal' ? 0.02 : 0.035,
          when,
        });
      }
    }
  }
}

function scheduleBuffer(context, buffer, destination, duration, loop, startTime = 0) {
  const start = Math.max(0, Number(startTime) || 0);
  if (start >= duration) return;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(destination);
  if (loop) {
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = Math.max(0.01, Math.min(buffer.duration, duration));
  }
  source.start(start);
  if (loop) source.stop(duration);
}

function sessionMetadata(session, duration) {
  return {
    format: 'Breakglass Spectra Session Export v1',
    name: session.name,
    bpm: session.bpm,
    durationSeconds: duration,
    loopEnabled: session.loopEnabled === true,
    loopBars: session.loopBars,
    exportedAt: new Date().toISOString(),
    stems: session.stems.map((stem, index) => ({
      index: index + 1,
      id: stem.id,
      label: stem.label,
      kind: stem.kind,
      level: stem.level,
      pan: stem.pan,
      low: stem.low,
      high: stem.high,
      fx: stem.fx,
      mute: stem.mute,
      solo: stem.solo,
      clipActive: stem.clipActive !== false,
      source: stem.source,
      processing: stem.processing,
    })),
  };
}

export class StudioExporter {
  constructor(game, options = {}) {
    this.game = game;
    this.OfflineAudioContext =
      options.OfflineAudioContext ??
      globalThis.OfflineAudioContext ??
      globalThis.webkitOfflineAudioContext;
    this.document = options.document ?? globalThis.document;
    this.URL = options.URL ?? globalThis.URL;
  }

  async assetBuffers(session, context) {
    const result = new Map();
    for (const stem of session.stems) {
      if (!stem.assetId) continue;
      const buffer = await this.game.audio?.assets?.audio?.(stem.assetId, context);
      if (!buffer) {
        throw new Error(
          `“${stem.label}” is stream-only in this browser and cannot be rendered offline.`,
        );
      }
      result.set(stem.id, buffer);
    }
    return result;
  }

  async render(session, { stemIds = null, respectMuteSolo = true } = {}) {
    if (!this.OfflineAudioContext) {
      throw new Error('Offline audio rendering is not supported by this browser.');
    }

    const probe = new this.OfflineAudioContext(2, SAMPLE_RATE, SAMPLE_RATE);
    const buffers = await this.assetBuffers(session, probe);
    const duration = studioExportDuration(session, buffers);
    const hasFx = session.stems.some((stem) => (stem.fx ?? 0) > 0);
    const tail = hasFx ? 0.5 : 0.08;
    const frames = Math.ceil((duration + tail) * SAMPLE_RATE);
    const context = new this.OfflineAudioContext(2, frames, SAMPLE_RATE);
    const master = context.createGain();
    master.gain.value = 1;
    master.connect(context.destination);

    const selected = stemIds ? new Set(stemIds) : null;
    const anySolo = respectMuteSolo && session.stems.some((stem) => stem.solo);
    let rendered = 0;

    for (const stem of session.stems) {
      if (selected && !selected.has(stem.id)) continue;
      if (respectMuteSolo && (stem.clipActive === false || stem.mute || (anySolo && !stem.solo)))
        continue;
      const input = createChannel(context, stem, master);
      const recording = session.recordings?.get?.(stem.id);
      const buffer = recording ?? buffers.get(stem.id);
      if (buffer) {
        scheduleBuffer(
          context,
          buffer,
          input,
          duration,
          !recording && session.loopEnabled === true,
          recording ? stem.clipStart : 0,
        );
      } else if (!schedulePerformance(context, stem, input, duration)) {
        schedulePrototype(context, session, stem, input, duration);
      }
      rendered += 1;
    }

    if (!rendered) throw new Error('There are no audible Spectra tracks to export.');
    return {
      buffer: await context.startRendering(),
      duration,
    };
  }

  async renderSpatial(session) {
    if (!this.OfflineAudioContext) {
      throw new Error('Offline audio rendering is not supported by this browser.');
    }

    const probe = new this.OfflineAudioContext(2, SAMPLE_RATE, SAMPLE_RATE);
    const buffers = await this.assetBuffers(session, probe);
    const duration = studioExportDuration(session, buffers);
    const hasFx = session.stems.some((stem) => (stem.fx ?? 0) > 0);
    const tail = hasFx ? 0.5 : 0.08;
    const frames = Math.ceil((duration + tail) * SAMPLE_RATE);
    const context = new this.OfflineAudioContext(8, frames, SAMPLE_RATE);
    const merger = context.createChannelMerger(8);
    merger.connect(context.destination);

    const speakerInputs = Array.from({ length: 8 }, (_, index) => {
      const input = context.createGain();
      input.gain.value = 1;
      input.connect(merger, 0, index);
      return input;
    });

    const anySolo = session.stems.some((stem) => stem.solo);
    let rendered = 0;
    for (const stem of session.stems) {
      if (stem.clipActive === false || stem.mute || (anySolo && !stem.solo)) continue;
      const spatialOutput = context.createGain();
      const input = createChannel(context, stem, spatialOutput, stem.level ?? 0.68, {
        panEnabled: false,
      });
      const gains = spatialSpeakerGains(stem.spatial);
      for (let index = 0; index < speakerInputs.length; index += 1) {
        const gain = context.createGain();
        gain.gain.value = stem.spatial?.enabled === false ? 1 / Math.sqrt(8) : gains[index] ?? 0;
        spatialOutput.connect(gain);
        gain.connect(speakerInputs[index]);
      }

      const recording = session.recordings?.get?.(stem.id);
      const buffer = recording ?? buffers.get(stem.id);
      if (buffer) {
        scheduleBuffer(
          context,
          buffer,
          input,
          duration,
          !recording && session.loopEnabled === true,
          recording ? stem.clipStart : 0,
        );
      } else if (!schedulePerformance(context, stem, input, duration)) {
        schedulePrototype(context, session, stem, input, duration);
      }
      rendered += 1;
    }

    if (!rendered) throw new Error('There are no audible Spectra tracks to spatialize.');
    return {
      buffer: await context.startRendering(),
      duration,
      channels: 8,
    };
  }

  async renderSpatialWav(session) {
    const result = await this.renderSpatial(session);
    return {
      ...result,
      bytes: encodeWav(result.buffer),
      filename: `${safeName(session.name)}-take-a-break-8ch.wav`,
    };
  }

  download(bytes, filename, mime) {
    if (!this.document || typeof Blob === 'undefined' || !this.URL?.createObjectURL) {
      throw new Error('File downloads are not available in this browser.');
    }
    const blob = new Blob([bytes], { type: mime });
    const url = this.URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    this.document.body?.appendChild(link);
    link.click();
    link.remove?.();
    globalThis.setTimeout?.(() => this.URL.revokeObjectURL(url), 60_000);
    return filename;
  }

  async exportMix(session) {
    const { buffer, duration } = await this.render(session, { respectMuteSolo: true });
    const filename = `${safeName(session.name)}-mix.wav`;
    this.download(encodeWav(buffer), filename, 'audio/wav');
    return { filename, duration };
  }

  async exportSessionPack(session) {
    const entries = [];
    const mix = await this.render(session, { respectMuteSolo: true });
    entries.push({
      name: '00-full-mix.wav',
      data: encodeWav(mix.buffer),
    });

    for (let index = 0; index < session.stems.length; index += 1) {
      const stem = session.stems[index];
      const rendered = await this.render(session, {
        stemIds: [stem.id],
        respectMuteSolo: false,
      });
      entries.push({
        name: `${String(index + 1).padStart(2, '0')}-${safeName(stem.label, stem.id)}.wav`,
        data: encodeWav(rendered.buffer),
      });
    }

    entries.push({
      name: 'session.json',
      data: JSON.stringify(sessionMetadata(session, mix.duration), null, 2),
    });

    const filename = `${safeName(session.name)}-spectra-session.zip`;
    this.download(createStoredZip(entries), filename, 'application/zip');
    return {
      filename,
      duration: mix.duration,
      stems: session.stems.length,
    };
  }
}
