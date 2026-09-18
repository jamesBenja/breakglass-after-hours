const randomBetween = (min, max) => min + Math.random() * (max - min);

const ROOF_TRAFFIC_BEDS = Object.freeze([
  {
    owner: 'roof-city-traffic-west',
    position: [-18, -1.5, 7],
    baseFrequency: 54,
    secondaryFrequency: 109,
    volume: 0.012,
    pulseRate: 0.17,
  },
  {
    owner: 'roof-city-traffic-east',
    position: [21, -2, -8],
    baseFrequency: 72,
    secondaryFrequency: 143,
    volume: 0.009,
    pulseRate: 0.11,
  },
]);

export class EnvironmentalAudioSystem {
  constructor(game) {
    this.game = game;
    this.elapsed = 0;
    this.roofActive = false;
    this.honkAt = 2.5;
    this.constructionAt = 4;
    this.voicesAt = 1.8;
    this.lastPolicePresent = false;
    this.sirenUntil = 0;
    this.sirenAt = 0;
    this.sirenHigh = false;
    this.noiseBuffer = null;
    this.noiseShots = new Set();
  }

  context() {
    return this.game.audio?.context ?? null;
  }

  ensureNoiseBuffer() {
    const context = this.context();
    if (!context || this.noiseBuffer) return this.noiseBuffer;
    if (typeof context.createBuffer !== 'function' || !Number.isFinite(context.sampleRate))
      return null;
    const length = Math.max(1, Math.floor(context.sampleRate * 2.4));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < data.length; index++) {
      const white = Math.random() * 2 - 1;
      brown = brown * 0.965 + white * 0.035;
      data[index] = white * 0.34 + brown * 0.66;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  noiseBurst(
    position,
    { duration = 0.7, volume = 0.014, frequency = 650, q = 0.8, when = 0 } = {},
  ) {
    const context = this.context();
    const buffer = this.ensureNoiseBuffer();
    if (!context || !buffer || !this.game.audio?.master) return false;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = this.game.spatialAudio?.createPointPanner?.(position, {
      refDistance: 3,
      maxDistance: 70,
      rolloffFactor: 0.48,
    });
    const start = context.currentTime + Math.max(0, Number(when) || 0);
    const length = Math.max(0.06, Number(duration) || 0.7);
    source.buffer = buffer;
    source.loop = length > buffer.duration;
    filter.type = 'bandpass';
    filter.frequency.value = Math.max(90, Number(frequency) || 650);
    filter.Q.value = Math.max(0.2, Number(q) || 0.8);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

    source.connect(filter);
    filter.connect(gain);
    if (panner) {
      gain.connect(panner);
      panner.connect(this.game.audio.master);
    } else gain.connect(this.game.audio.master);

    const shot = { source, filter, gain, panner };
    this.noiseShots.add(shot);
    source.onended = () => {
      source.disconnect?.();
      filter.disconnect?.();
      gain.disconnect?.();
      panner?.disconnect?.();
      this.noiseShots.delete(shot);
    };
    source.start(start, Math.random() * Math.max(0.01, buffer.duration - 0.3));
    source.stop(start + length + 0.03);
    return true;
  }

  startRoof() {
    if (this.roofActive || !this.context()) return;
    this.roofActive = true;
    for (const bed of ROOF_TRAFFIC_BEDS) {
      this.game.spatialAudio?.setPointMachine?.(bed.owner, {
        position: bed.position,
        baseFrequency: bed.baseFrequency,
        secondaryFrequency: bed.secondaryFrequency,
        volume: bed.volume,
        pulseRate: bed.pulseRate,
        pulseDepth: 0.0025,
        wave: 'triangle',
        refDistance: 3.5,
        maxDistance: 75,
        rolloffFactor: 0.44,
      });
    }
    this.honkAt = this.elapsed + randomBetween(2.5, 6);
    this.constructionAt = this.elapsed + randomBetween(3, 7);
    this.voicesAt = this.elapsed + randomBetween(1.2, 3.5);
  }

  stopRoof() {
    if (!this.roofActive) return;
    this.roofActive = false;
    for (const bed of ROOF_TRAFFIC_BEDS) this.game.spatialAudio?.stopPointMachine?.(bed.owner, 0.8);
  }

  roofEvents() {
    if (this.elapsed >= this.honkAt) {
      const left = Math.random() < 0.5;
      const position = left ? [-15, -1, randomBetween(-10, 10)] : [18, -1, randomBetween(-10, 10)];
      this.game.spatialAudio?.pointTone?.(position, {
        frequency: randomBetween(330, 430),
        endFrequency: randomBetween(280, 360),
        duration: randomBetween(0.24, 0.42),
        volume: 0.035,
        wave: 'triangle',
        refDistance: 4,
        maxDistance: 80,
        rolloffFactor: 0.45,
      });
      if (Math.random() < 0.35) {
        this.game.spatialAudio?.pointTone?.(position, {
          frequency: randomBetween(300, 380),
          endFrequency: randomBetween(270, 330),
          duration: 0.18,
          volume: 0.024,
          wave: 'triangle',
          when: 0.32,
          refDistance: 4,
          maxDistance: 80,
          rolloffFactor: 0.45,
        });
      }
      this.honkAt = this.elapsed + randomBetween(6, 15);
    }

    if (this.elapsed >= this.constructionAt) {
      const position = [randomBetween(10, 22), randomBetween(-2, 1), randomBetween(-12, 12)];
      for (let index = 0; index < 3; index++) {
        this.noiseBurst(position, {
          duration: 0.09,
          volume: 0.025,
          frequency: randomBetween(520, 1100),
          q: 0.9,
          when: index * randomBetween(0.18, 0.32),
        });
        this.game.spatialAudio?.pointTone?.(position, {
          frequency: randomBetween(72, 118),
          endFrequency: 52,
          duration: 0.12,
          volume: 0.018,
          wave: 'triangle',
          when: index * 0.24,
          refDistance: 3,
          maxDistance: 70,
          rolloffFactor: 0.5,
        });
      }
      this.constructionAt = this.elapsed + randomBetween(7, 18);
    }

    if (this.elapsed >= this.voicesAt) {
      const position = [randomBetween(-15, 15), -0.5, Math.random() < 0.5 ? -10 : 11];
      const phrases = 2 + Math.floor(Math.random() * 3);
      for (let index = 0; index < phrases; index++) {
        this.noiseBurst(position, {
          duration: randomBetween(0.32, 0.72),
          volume: randomBetween(0.006, 0.011),
          frequency: randomBetween(420, 920),
          q: randomBetween(0.65, 1.2),
          when: index * randomBetween(0.3, 0.6),
        });
      }
      this.voicesAt = this.elapsed + randomBetween(3.5, 9);
    }
  }

  policeSiren(police) {
    const present = police?.policePresent === true;
    if (present && !this.lastPolicePresent) {
      this.sirenUntil = this.elapsed + 8;
      this.sirenAt = this.elapsed;
      this.sirenHigh = false;
    }
    this.lastPolicePresent = present;
    if (!present || this.elapsed > this.sirenUntil || this.elapsed < this.sirenAt) return;

    this.sirenHigh = !this.sirenHigh;
    const position = police?.policePosition ?? [-22.5, 0.7, 0.1];
    this.game.spatialAudio?.pointTone?.(position, {
      frequency: this.sirenHigh ? 930 : 650,
      endFrequency: this.sirenHigh ? 760 : 880,
      duration: 0.5,
      volume: 0.055,
      wave: 'sine',
      refDistance: 5,
      maxDistance: 90,
      rolloffFactor: 0.35,
    });
    this.sirenAt = this.elapsed + 0.46;
  }

  update(dt) {
    if (!this.game.started || !this.context()) return;
    this.elapsed += Math.max(0, Number(dt) || 0);
    const sceneId = this.game.sceneManager.current?.definition?.id;
    if (sceneId === 'roof') {
      this.startRoof();
      this.roofEvents();
    } else this.stopRoof();

    const alley = this.game.scenes.get('alley')?.alley;
    this.policeSiren(alley);
  }

  dispose() {
    this.stopRoof();
    for (const shot of [...this.noiseShots]) {
      try {
        shot.source.stop();
      } catch {
        // Already ended.
      }
      shot.source.disconnect?.();
      shot.filter.disconnect?.();
      shot.gain.disconnect?.();
      shot.panner?.disconnect?.();
    }
    this.noiseShots.clear();
    this.noiseBuffer = null;
  }
}

export function installEnvironmentalAudioSystem(game) {
  if (!game || game.environmentalAudio) return game?.environmentalAudio ?? null;
  const system = new EnvironmentalAudioSystem(game);
  game.environmentalAudio = system;
  let lastNow = null;
  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    const result = baseUpdate(now, movementOverride);
    const dt = lastNow == null ? 0 : Math.max(0, Math.min(0.06, (now - lastNow) / 1000));
    lastNow = now;
    system.update(dt);
    return result;
  };
  const baseDispose = game.dispose.bind(game);
  game.dispose = async () => {
    system.dispose();
    return baseDispose();
  };
  return system;
}
