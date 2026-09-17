import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';

export const TAKE_A_BREAK_SPEAKERS = Object.freeze([
  [6.38, 1.15, 1.18],
  [7.65, 2.35, 1.2],
  [8.72, 1.2, 2.55],
  [8.72, 2.28, 4.08],
  [8.68, 1.18, 5.88],
  [7.55, 2.38, 6.08],
  [6.35, 1.2, 5.62],
  [6.35, 2.28, 3.72],
]);

const SPEAKER_VOICES = Object.freeze([
  [82.41, 'sine', 0.071],
  [110, 'triangle', 0.053],
  [146.83, 'sine', 0.043],
  [164.81, 'triangle', 0.061],
  [220, 'sine', 0.037],
  [293.66, 'triangle', 0.047],
  [329.63, 'sine', 0.059],
  [440, 'triangle', 0.041],
]);

export function isTakeABreakPosition(position) {
  if (!position) return false;
  return position.x >= 6.15 && position.x <= 9.1 && position.z >= 0.75 && position.z <= 6.48;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

function starField(seed, count, size, opacity) {
  const random = seededRandom(seed);
  const positions = [];
  const colors = [];
  const palette = [0xc5e7ff, 0xf8d8ff, 0xb8a4ff, 0x7fe9ff, 0xff9adf, 0xffefb0];
  for (let i = 0; i < count; i++) {
    positions.push(2.3 + random() * 3.55, 0.12 + random() * 3.0, 3.5 + random() * 2.86);
    const color = new Color(palette[Math.floor(random() * palette.length)]);
    colors.push(color.r, color.g, color.b);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const material = new PointsMaterial({
    size,
    transparent: true,
    opacity,
    vertexColors: true,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  });
  return new Points(geometry, material);
}

function glowMaterial(color, opacity) {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}

export class TakeABreakImmersiveSystem {
  constructor(root) {
    this.root = new Group();
    this.root.name = 'take-a-break-cosmic-breach';
    root.add(this.root);
    this.elapsed = 0;
    this.audioContext = null;
    this.audioBus = null;
    this.delay = null;
    this.delayFeedback = null;
    this.delayWet = null;
    this.emitters = [];
    this.nebulae = [];
    this.rings = [];
    this.starLayers = [];
    this.buildCosmos();
  }

  buildCosmos() {
    const backdrop = new Mesh(
      new PlaneGeometry(3.35, 3.28),
      new MeshBasicMaterial({ color: 0x010008, side: DoubleSide, toneMapped: false }),
    );
    backdrop.position.set(2.18, 1.62, 4.93);
    backdrop.rotation.y = Math.PI / 2;
    backdrop.name = 'cosmic-breach-deep-field';
    this.root.add(backdrop);

    const starsFar = starField(0x20b6a55, 260, 0.035, 0.82);
    const starsNear = starField(0x9f31c2d, 130, 0.06, 0.92);
    starsFar.name = 'cosmic-stars-far';
    starsNear.name = 'cosmic-stars-near';
    this.root.add(starsFar, starsNear);
    this.starLayers.push(starsFar, starsNear);

    const nebulaData = [
      [3.2, 1.52, 4.15, 0x703cff, 1.45, 0.82, 0.92, 0.085],
      [4.25, 1.84, 5.15, 0x10b8ff, 1.75, 0.72, 1.18, 0.07],
      [5.05, 1.22, 4.7, 0xff3fbf, 1.28, 0.88, 1.42, 0.06],
      [3.72, 2.18, 5.7, 0xff8a3d, 0.95, 0.52, 0.82, 0.045],
    ];
    for (const [x, y, z, color, sx, sy, sz, opacity] of nebulaData) {
      const cloud = new Mesh(new SphereGeometry(0.72, 18, 12), glowMaterial(color, opacity));
      cloud.position.set(x, y, z);
      cloud.scale.set(sx, sy, sz);
      this.root.add(cloud);
      this.nebulae.push(cloud);
    }

    const ringData = [
      [4.5, 1.58, 4.72, 0x8b5cff, 0.48, 0.014],
      [3.62, 1.82, 5.38, 0x35e8ff, 0.32, 0.011],
      [5.18, 1.18, 4.05, 0xff52bc, 0.24, 0.01],
    ];
    for (const [x, y, z, color, radius, tube] of ringData) {
      const ring = new Mesh(
        new TorusGeometry(radius, tube, 8, 48),
        glowMaterial(color, 0.55),
      );
      ring.position.set(x, y, z);
      ring.rotation.y = Math.PI / 2;
      this.root.add(ring);
      this.rings.push(ring);
    }

    // The architectural gap remains open, but these glowing edges make it read as a deliberate
    // tear in the building rather than missing geometry.
    const edgeMaterial = glowMaterial(0xa36cff, 0.22);
    const verticalGeometry = new BoxGeometry(0.055, 3.1, 0.045);
    for (const z of [3.55, 6.31]) {
      const edge = new Mesh(verticalGeometry, edgeMaterial);
      edge.position.set(6.035, 1.55, z);
      this.root.add(edge);
    }
    const topEdge = new Mesh(new BoxGeometry(0.055, 0.045, 2.8), edgeMaterial);
    topEdge.position.set(6.035, 3.08, 4.93);
    this.root.add(topEdge);
  }

  ensureAudio(audio) {
    const context = audio?.context;
    if (!context || this.audioContext === context) return;
    this.disposeAudio();
    this.audioContext = context;
    this.audioBus = context.createGain();
    this.audioBus.gain.value = 0;
    this.audioBus.connect(context.destination);

    if (typeof context.createDelay === 'function') {
      this.delay = context.createDelay(1.4);
      this.delayFeedback = context.createGain();
      this.delayWet = context.createGain();
      this.delay.delayTime.value = 0.34;
      this.delayFeedback.gain.value = 0.24;
      this.delayWet.gain.value = 0.18;
      this.audioBus.connect(this.delay);
      this.delay.connect(this.delayWet);
      this.delayWet.connect(context.destination);
      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
    }

    TAKE_A_BREAK_SPEAKERS.forEach((position, index) => {
      const [frequency, wave, lfoRate] = SPEAKER_VOICES[index];
      const source = context.createOscillator();
      const gain = context.createGain();
      const lfo = context.createOscillator();
      const depth = context.createGain();
      const panner = typeof context.createPanner === 'function' ? context.createPanner() : null;
      source.type = wave;
      source.frequency.value = frequency;
      gain.gain.value = 0.0001;
      lfo.frequency.value = lfoRate;
      depth.gain.value = 0.0022;
      lfo.connect(depth);
      depth.connect(source.detune);
      source.connect(gain);
      if (panner) {
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 0.65;
        panner.maxDistance = 9;
        panner.rolloffFactor = 0.82;
        const [x, y, z] = position;
        if (panner.positionX) {
          panner.positionX.value = x;
          panner.positionY.value = y;
          panner.positionZ.value = z;
        } else panner.setPosition?.(x, y, z);
        gain.connect(panner);
        panner.connect(this.audioBus);
      } else gain.connect(this.audioBus);
      source.start();
      lfo.start();
      this.emitters.push({ source, gain, lfo, depth, panner, index });
    });
  }

  setParam(parameter, value, timeConstant = 0.08) {
    if (!parameter || !this.audioContext) return;
    if (typeof parameter.setTargetAtTime === 'function')
      parameter.setTargetAtTime(value, this.audioContext.currentTime, timeConstant);
    else parameter.value = value;
  }

  update(dt, audio, playerPosition) {
    this.elapsed += dt;
    const breath = 1 + Math.sin(this.elapsed * 0.42) * 0.035;
    this.root.scale.setScalar(breath);
    this.starLayers.forEach((stars, index) => {
      stars.rotation.x = Math.sin(this.elapsed * (0.035 + index * 0.008)) * 0.025;
      stars.rotation.y += dt * (index ? -0.014 : 0.009);
      stars.material.opacity = (index ? 0.9 : 0.78) + Math.sin(this.elapsed * 0.7 + index) * 0.06;
    });
    this.nebulae.forEach((cloud, index) => {
      cloud.rotation.y += dt * (0.045 + index * 0.012) * (index % 2 ? -1 : 1);
      cloud.material.opacity = 0.045 + (Math.sin(this.elapsed * 0.36 + index * 1.7) + 1) * 0.022;
    });
    this.rings.forEach((ring, index) => {
      ring.rotation.x += dt * (0.08 + index * 0.035);
      ring.rotation.z += dt * (index % 2 ? -0.11 : 0.09);
      const pulse = 1 + Math.sin(this.elapsed * (0.55 + index * 0.09) + index) * 0.12;
      ring.scale.setScalar(pulse);
    });

    this.ensureAudio(audio);
    if (!this.audioContext || !this.audioBus) return;
    const active = isTakeABreakPosition(playerPosition);
    if (active) {
      // Club sound becomes distant wall bleed. The installation bypasses AudioEngine's room gain,
      // so reducing the club does not also collapse the immersive sound field.
      audio?.setEnvironment?.({
        gain: 0.095,
        lowpassHz: 920,
        label: 'Take A Break · immersive installation · club through wall',
      });
    }
    this.setParam(this.audioBus.gain, active ? 0.68 : 0, 0.16);
    if (!active) return;

    // Energy continuously circulates around the eight fixed virtual speakers. Three overlapping
    // phase rates keep the movement from feeling like a simple clockwise pan.
    this.emitters.forEach((emitter, index) => {
      const a = (Math.sin(this.elapsed * 0.44 - index * 0.82) + 1) * 0.5;
      const b = (Math.sin(this.elapsed * 0.19 + index * 1.91) + 1) * 0.5;
      const c = (Math.sin(this.elapsed * 0.73 - index * 0.37) + 1) * 0.5;
      const movement = 0.2 + a * 0.48 + b * 0.2 + c * 0.12;
      this.setParam(emitter.gain.gain, 0.0028 + movement * 0.0075, 0.11);
      this.setParam(emitter.source.detune, Math.sin(this.elapsed * 0.13 + index) * 9, 0.18);
    });
  }

  snapshot() {
    return {
      speakers: TAKE_A_BREAK_SPEAKERS.length,
      active: this.audioBus?.gain?.value > 0.02,
      cosmicObjects: this.root.children.length,
    };
  }

  disposeAudio() {
    for (const emitter of this.emitters) {
      try {
        emitter.source.stop();
        emitter.lfo.stop();
      } catch {
        // Already stopped.
      }
      emitter.source.disconnect();
      emitter.gain.disconnect();
      emitter.lfo.disconnect();
      emitter.depth.disconnect();
      emitter.panner?.disconnect();
    }
    this.emitters = [];
    this.delayFeedback?.disconnect();
    this.delayWet?.disconnect();
    this.delay?.disconnect();
    this.audioBus?.disconnect();
    this.delayFeedback = null;
    this.delayWet = null;
    this.delay = null;
    this.audioBus = null;
    this.audioContext = null;
  }

  dispose() {
    this.disposeAudio();
    this.root.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
    this.root.removeFromParent();
  }
}
