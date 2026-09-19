import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { createLightweightHuman, poseLightweightHuman } from '../avatar/LightweightHuman.js';

export const LIVE_BANDS = {
  'barr-brothers-kexp-2017': {
    name: 'The Barr Brothers',
    instruments: ['drums', 'guitar', 'guitar', 'bass'],
  },
  'besnard-lakes-kexp-2017': {
    name: 'The Besnard Lakes',
    instruments: ['drums', 'guitar', 'guitar', 'bass'],
  },
  'paupiere-kexp-2017': {
    name: 'Paupière',
    instruments: ['drums', 'synth', 'vocal'],
  },
  'moon-king-natty-g-kexp-2017': {
    name: 'Moon King & Natty G',
    instruments: ['drums', 'bass', 'synth', 'vocal'],
  },
  'tess-roby-kexp-2017': {
    name: 'Tess Roby',
    instruments: ['drums', 'synth', 'vocal'],
  },
  'luyas-kexp-2017': {
    name: 'The Luyas',
    instruments: ['drums', 'guitar', 'synth', 'bass'],
  },
  'big-brave-kexp-2017': {
    name: 'Big Brave',
    instruments: ['drums', 'guitar', 'guitar'],
  },
  'fieldnote-launch-2026': {
    name: 'Fieldnote',
    instruments: ['drums', 'guitar', 'bass', 'vocal'],
  },
};

function performer(accent, index) {
  const hairStyles = ['short', 'long', 'bob', 'buzz'];
  const skinTones = [0xc59170, 0xaa785d, 0x815842, 0xd0a080];
  const model = createLightweightHuman({
    skin: skinTones[index % skinTones.length],
    outfit: [0x24262c, 0x31333a, 0x2b2631, 0x25323a][index % 4],
    trousers: [0x17191e, 0x25272d, 0x1f2530][index % 3],
    hair: [0x211917, 0x39271f, 0x171517][index % 3],
    accent,
    hairStyle: hairStyles[index % hairStyles.length],
    scale: 0.97 + (index % 3) * 0.025,
  });
  return { ...model, accent };
}

function instrument(kind, accent) {
  const material = new MeshStandardMaterial({ color: accent, roughness: 0.55, metalness: 0.08 });
  if (kind === 'drums') {
    const group = new Group();
    const kick = new Mesh(new CylinderGeometry(0.31, 0.31, 0.38, 10), material);
    kick.rotation.x = Math.PI / 2;
    kick.position.set(0, 0.52, 0.2);
    const snare = new Mesh(new CylinderGeometry(0.19, 0.19, 0.12, 10), material);
    snare.position.set(-0.35, 0.78, 0.26);
    const floorTom = new Mesh(new CylinderGeometry(0.21, 0.21, 0.25, 10), material);
    floorTom.position.set(0.39, 0.67, 0.2);
    group.add(kick, snare, floorTom);
    return group;
  }
  if (kind === 'synth') {
    const group = new Group();
    const synth = new Mesh(new BoxGeometry(0.78, 0.12, 0.3), material);
    synth.position.set(0, 0.93, 0.31);
    const stand = new Mesh(new BoxGeometry(0.68, 0.045, 0.05), material);
    stand.position.set(0, 0.58, 0.25);
    group.add(synth, stand);
    return group;
  }
  if (kind === 'vocal') {
    const group = new Group();
    const pole = new Mesh(new CylinderGeometry(0.018, 0.018, 1.25, 6), material);
    pole.position.y = 0.7;
    const mic = new Mesh(new SphereGeometry(0.06, 8, 6), material);
    mic.position.set(0, 1.35, 0);
    group.add(pole, mic);
    return group;
  }

  const guitar = new Group();
  guitar.name = `${kind}-performance-prop`;
  const wood = new MeshStandardMaterial({ color: 0x8d6844, roughness: 0.6, metalness: 0.02 });
  const metal = new MeshStandardMaterial({ color: 0xc3c7ca, roughness: 0.34, metalness: 0.72 });
  const body = new Mesh(
    new BoxGeometry(kind === 'bass' ? 0.27 : 0.31, kind === 'bass' ? 0.45 : 0.42, 0.095),
    material,
  );
  const neck = new Mesh(new BoxGeometry(0.065, kind === 'bass' ? 0.9 : 0.76, 0.055), wood);
  const headstock = new Mesh(new BoxGeometry(0.12, 0.18, 0.06), wood);
  const bridge = new Mesh(new BoxGeometry(0.15, 0.025, 0.035), metal);
  body.position.set(0.14, 0.98, 0.23);
  neck.position.set(-0.02, kind === 'bass' ? 1.46 : 1.39, 0.23);
  headstock.position.set(-0.02, kind === 'bass' ? 1.96 : 1.84, 0.23);
  bridge.position.set(0.14, 0.9, 0.285);
  guitar.rotation.z = -0.48;
  guitar.rotation.y = -0.12;
  guitar.add(body, neck, headstock, bridge);
  return guitar;
}

export class LiveBandSystem {
  constructor(game) {
    this.game = game;
    this.group = null;
    this.performers = [];
    this.currentId = null;
    this.center = null;
    this.elapsed = 0;
  }

  attach() {
    const level = this.game.scenes.get('upstairs');
    if (!level || this.group) return;
    this.group = new Group();
    this.group.name = 'live-from-breakglass-band';
    level.gameplay.add(this.group);
    this.sync(true);
  }

  clear() {
    if (!this.group) return;
    for (const child of [...this.group.children]) child.removeFromParent();
    this.performers = [];
    this.center = null;
  }

  sync(force = false) {
    const id = this.game.state.data.liveRoomArchive;
    if (!force && id === this.currentId) return;
    this.currentId = id;
    this.clear();
    if (!id || !this.group) return;
    const config = LIVE_BANDS[id];
    if (!config) return;
    const level = this.game.scenes.get('upstairs');
    const drums = level.definition.anchors.drums.position;
    this.center = new Vector3().fromArray(drums).add(new Vector3(0.2, 0, 0.65));
    const places = [
      [0, 0],
      [-1.25, 0.72],
      [1.25, 0.68],
      [-0.48, 1.5],
      [0.72, 1.55],
    ];
    config.instruments.forEach((kind, index) => {
      const accent = [0xffa45f, 0x6bc9ff, 0xd98cff, 0x79df9f, 0xf3d56b][index % 5];
      const model = performer(accent, index);
      const [x, z] = places[index] ?? [index - 2, 1.2];
      model.group.position.copy(this.center).add(new Vector3(x, 0, z));
      model.group.rotation.y = Math.PI;
      const prop = instrument(kind, accent);
      model.group.add(prop);
      this.group.add(model.group);
      this.performers.push({ ...model, kind, instrument: prop });
    });
  }

  update(dt) {
    this.elapsed += dt;
    this.sync();
    if (!this.currentId) return;
    this.performers.forEach((model, index) => {
      const beat = Math.sin(this.elapsed * 4.5 + index * 1.4);
      poseLightweightHuman(model, {
        time: this.elapsed,
        phase: index * 1.4,
        dancing: true,
        energy: 0.54,
      });

      if (model.kind === 'drums') {
        model.leftArm.rotation.x = -0.68 + beat * 0.42;
        model.rightArm.rotation.x = -0.68 - beat * 0.42;
        model.leftForearm.rotation.x = -0.52 - Math.max(0, -beat) * 0.58;
        model.rightForearm.rotation.x = -0.52 - Math.max(0, beat) * 0.58;
        model.body.rotation.y = beat * 0.035;
      } else if (model.kind === 'synth') {
        model.leftArm.rotation.x = -0.76 + beat * 0.08;
        model.rightArm.rotation.x = -0.76 - beat * 0.08;
        model.leftForearm.rotation.x = -0.62 + beat * 0.12;
        model.rightForearm.rotation.x = -0.62 - beat * 0.12;
      } else if (model.kind === 'vocal') {
        model.leftArm.rotation.x = -0.16 + beat * 0.06;
        model.rightArm.rotation.x = -0.52;
        model.rightForearm.rotation.x = -0.78;
        model.head.rotation.x = -0.05 + Math.abs(beat) * 0.035;
      } else {
        const bass = model.kind === 'bass';
        // Shoulder + elbow poses place the hands near the neck/body of the instrument. The strum
        // happens mostly below the elbow, which looks much closer to an actual guitarist.
        model.leftArm.rotation.x = -0.72 + beat * 0.045;
        model.leftArm.rotation.z = -0.24;
        model.leftForearm.rotation.x = -0.9 + beat * 0.08;
        model.leftForearm.rotation.z = -0.16;
        model.rightArm.rotation.x = -0.57;
        model.rightArm.rotation.z = 0.2;
        model.rightForearm.rotation.x = -0.62 + beat * (bass ? 0.2 : 0.44);
        model.rightForearm.rotation.z = 0.08;
        if (model.instrument) {
          model.instrument.rotation.z = -0.48 + Math.sin(this.elapsed * 1.3 + index) * 0.025;
          model.instrument.rotation.x = beat * 0.018;
        }
      }
    });
  }

  dispose() {
    this.clear();
    this.group?.removeFromParent();
    this.group = null;
  }
}
