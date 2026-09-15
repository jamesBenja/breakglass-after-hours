import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

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

function performer(accent) {
  const group = new Group();
  const outfit = new MeshStandardMaterial({ color: 0x24262c, roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: 0xaa785d, roughness: 0.85 });
  const body = new Mesh(new CapsuleGeometry(0.23, 0.5, 5, 8), outfit);
  const head = new Mesh(new SphereGeometry(0.2, 12, 9), skin);
  const leftArm = new Mesh(new CapsuleGeometry(0.065, 0.36, 4, 6), outfit);
  const rightArm = leftArm.clone();
  body.position.y = 1.03;
  head.position.y = 1.67;
  leftArm.position.set(-0.31, 1.08, 0);
  rightArm.position.set(0.31, 1.08, 0);
  group.add(body, head, leftArm, rightArm);
  return { group, body, head, leftArm, rightArm, accent };
}

function instrument(kind, accent) {
  const material = new MeshStandardMaterial({ color: accent, roughness: 0.55, metalness: 0.08 });
  if (kind === 'drums') {
    const group = new Group();
    const kick = new Mesh(new CylinderGeometry(0.31, 0.31, 0.38, 10), material);
    kick.rotation.x = Math.PI / 2;
    kick.position.set(0, 0.52, 0.2);
    group.add(kick);
    return group;
  }
  if (kind === 'synth') {
    const synth = new Mesh(new BoxGeometry(0.75, 0.12, 0.28), material);
    synth.position.set(0, 0.92, 0.3);
    return synth;
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
  const body = new Mesh(new BoxGeometry(kind === 'bass' ? 0.22 : 0.25, 0.4, 0.09), material);
  const neck = new Mesh(new BoxGeometry(0.065, kind === 'bass' ? 0.82 : 0.7, 0.055), material);
  body.position.set(0.23, 0.95, 0.2);
  neck.position.set(0.04, 1.33, 0.2);
  body.rotation.z = neck.rotation.z = -0.28;
  guitar.add(body, neck);
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
      const model = performer(accent);
      const [x, z] = places[index] ?? [index - 2, 1.2];
      model.group.position.copy(this.center).add(new Vector3(x, 0, z));
      model.group.rotation.y = Math.PI;
      model.group.add(instrument(kind, accent));
      this.group.add(model.group);
      this.performers.push({ ...model, kind });
    });
  }

  update(dt) {
    this.elapsed += dt;
    this.sync();
    if (!this.currentId) return;
    const phase = this.elapsed * 4.5;
    this.performers.forEach((model, index) => {
      const beat = Math.sin(phase + index * 1.4);
      model.body.position.y = 1.03 + Math.abs(beat) * 0.04;
      model.head.rotation.y = Math.sin(this.elapsed * 1.5 + index) * 0.1;
      if (model.kind === 'drums') {
        model.leftArm.rotation.x = -0.7 + beat * 0.65;
        model.rightArm.rotation.x = -0.7 - beat * 0.65;
      } else if (model.kind === 'synth') {
        model.leftArm.rotation.x = -0.82 + beat * 0.12;
        model.rightArm.rotation.x = -0.82 - beat * 0.12;
      } else if (model.kind === 'vocal') {
        model.leftArm.rotation.x = -0.12 + beat * 0.08;
        model.rightArm.rotation.x = -0.35;
      } else {
        model.leftArm.rotation.x = -0.42;
        model.rightArm.rotation.x = -0.62 + beat * 0.32;
      }
    });
  }

  dispose() {
    this.clear();
    this.group?.removeFromParent();
    this.group = null;
  }
}
