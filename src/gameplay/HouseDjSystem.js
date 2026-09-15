import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';

export const HOUSE_DJS = [
  { id: 'lunice', name: 'Lunice', trackId: 'atrakar', accent: 0x53b7ff },
  { id: 'kaytranada', name: 'Kaytranada', trackId: 'got-you-dancin', accent: 0xffa85a },
  { id: 'james-benjamin', name: 'James Benjamin', trackId: 'in-flux-break', accent: 0xff5e91 },
  { id: 'siren-mars', name: 'Siren Mars', trackId: 'bhab', accent: 0xc888ff },
  { id: 'monib', name: 'Monib', trackId: 'paharpur', accent: 0x72e0b5 },
  { id: 'hydra', name: 'Hydra', trackId: 'in-flux-breath', accent: 0x7d8cff },
  { id: 'bootyspoon', name: 'Bootyspoon', trackId: 'fakir', accent: 0xff725f },
  { id: 'marie-davidson', name: 'Marie Davidson', trackId: 'in-flux-gingele', accent: 0xf4d45e },
  { id: 'frankie-teardrop', name: 'Frankie Teardrop', trackId: 'dubki', accent: 0x9fe46d },
];

export const HOUSE_DJ_IDS = HOUSE_DJS.map((dj) => dj.id);

function person(accent) {
  const group = new Group();
  const outfit = new MeshStandardMaterial({ color: 0x202329, roughness: 0.78 });
  const skin = new MeshStandardMaterial({ color: 0xaa785d, roughness: 0.85 });
  const detail = new MeshStandardMaterial({ color: accent, roughness: 0.55 });
  const body = new Mesh(new CapsuleGeometry(0.24, 0.52, 5, 8), outfit);
  const head = new Mesh(new SphereGeometry(0.21, 12, 9), skin);
  const leftArm = new Mesh(new CapsuleGeometry(0.065, 0.36, 4, 6), outfit);
  const rightArm = leftArm.clone();
  body.position.y = 1.03;
  head.position.y = 1.68;
  leftArm.position.set(-0.31, 1.08, 0);
  rightArm.position.set(0.31, 1.08, 0);
  const headphones = new Mesh(new BoxGeometry(0.43, 0.055, 0.09), detail);
  headphones.position.set(0, 1.83, 0.01);
  group.add(body, head, leftArm, rightArm, headphones);
  return { group, body, head, leftArm, rightArm, detail };
}

export class HouseDjSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.selectedId = HOUSE_DJ_IDS.includes(game.state.data.houseDjId)
      ? game.state.data.houseDjId
      : HOUSE_DJS[Math.floor(Math.random() * HOUSE_DJS.length)].id;
    this.game.state.data.houseDjId = this.selectedId;
    this.performer = null;
    this.desk = null;
    this.playerHold = 0;
    this.rotationTimer = 160 + Math.random() * 100;
    this.starting = false;
    this.elapsed = 0;
  }

  get selected() {
    return HOUSE_DJS.find((dj) => dj.id === this.selectedId) ?? HOUSE_DJS[0];
  }

  attach() {
    const downstairs = this.game.scenes.get('downstairs');
    const upstairs = this.game.scenes.get('upstairs');
    if (!downstairs || !upstairs || this.performer) return;
    const booth = downstairs.definition.anchors.dj.position;
    const model = person(this.selected.accent);
    model.group.name = 'house-dj';
    model.group.position.set(booth[0], booth[1], booth[2] - 0.38);
    model.group.rotation.y = Math.PI;
    downstairs.gameplay.add(model.group);
    this.performer = model;

    const anchor = upstairs.definition.anchors.houseDjDesk.position;
    const desk = new Group();
    desk.name = 'house-dj-production-desk';
    desk.position.fromArray(anchor);
    const shell = new MeshStandardMaterial({ color: 0x25272c, roughness: 0.68, metalness: 0.15 });
    const screen = new MeshBasicMaterial({ color: 0x65d9ff, toneMapped: false });
    const table = new Mesh(new BoxGeometry(1.45, 0.12, 0.7), shell);
    table.position.y = 0.88;
    const legA = new Mesh(new BoxGeometry(0.09, 0.85, 0.09), shell);
    const legB = legA.clone();
    legA.position.set(-0.55, 0.43, 0);
    legB.position.set(0.55, 0.43, 0);
    const display = new Mesh(new BoxGeometry(0.72, 0.42, 0.05), screen);
    display.position.set(0, 1.17, -0.18);
    display.rotation.x = -0.22;
    desk.add(table, legA, legB, display);
    upstairs.gameplay.add(desk);
    this.desk = desk;
  }

  isHouseAudio() {
    return this.game.audio.activeExternalTransport?.owner === 'house-dj';
  }

  async start() {
    if (this.starting || this.isHouseAudio()) return;
    if (!this.game.started || !this.game.audio.context || this.game.dj.metrics().playing) return;
    const external = this.game.audio.activeExternalTransport;
    if (this.game.audio.playing && external?.owner && external.owner !== 'house-dj') return;
    if (this.game.audio.playing && !external) return;
    this.starting = true;
    try {
      const dj = this.selected;
      await this.game.audio.playAsset(dj.trackId, {
        owner: 'house-dj',
        label: `House DJ · ${dj.name} · Breakglass selections`,
        loop: true,
        vibe: 0.78,
        baseVolume: 0.88,
      });
    } finally {
      this.starting = false;
    }
  }

  stopHouseAudio() {
    if (this.isHouseAudio()) this.game.audio.stop();
    else this.game.audio.stopAsset?.('house-dj');
  }

  holdForPlayer(seconds = 25) {
    this.playerHold = Math.max(this.playerHold, seconds);
    this.stopHouseAudio();
  }

  async select(id) {
    if (!HOUSE_DJ_IDS.includes(id)) return;
    const wasPlaying = this.isHouseAudio();
    this.selectedId = id;
    this.game.state.data.houseDjId = id;
    this.game.dj.stop();
    if (wasPlaying) this.stopHouseAudio();
    this.rotationTimer = 160 + Math.random() * 100;
    this.applyLook();
    this.game.save();
    if (wasPlaying || this.game.sceneManager.current?.definition?.id === 'downstairs') await this.start();
  }

  applyLook() {
    if (this.performer) this.performer.detail.color.setHex(this.selected.accent);
  }

  next() {
    const index = HOUSE_DJS.findIndex((dj) => dj.id === this.selectedId);
    return HOUSE_DJS[(index + 1) % HOUSE_DJS.length].id;
  }

  panel() {
    this.ui.panel(
      'HOUSE DJ · PRODUCTION DESK',
      `${this.selected.name} is assigned to the booth. House DJs keep Below moving whenever you are not on the decks.`,
      HOUSE_DJS.map((dj) => [
        `${dj.id === this.selectedId ? '✓ ' : ''}${dj.name}`,
        () => void this.select(dj.id),
      ]),
    );
  }

  update(dt) {
    this.elapsed += dt;
    const downstairs = this.game.sceneManager.current?.definition?.id === 'downstairs';
    const playerDj = this.game.dj.metrics().playing;
    if (this.game.evacuationStarted) {
      this.stopHouseAudio();
      if (this.performer) this.performer.group.visible = false;
      return;
    }
    if (this.performer) {
      this.performer.group.visible = !playerDj;
      const pulse = Math.sin(this.elapsed * 5.2);
      this.performer.leftArm.rotation.x = -0.48 + pulse * 0.2;
      this.performer.rightArm.rotation.x = -0.62 - pulse * 0.24;
      this.performer.head.rotation.y = Math.sin(this.elapsed * 1.7) * 0.12;
    }
    if (playerDj) {
      this.playerHold = 8;
      return;
    }
    this.playerHold = Math.max(0, this.playerHold - dt);
    if (!downstairs || this.playerHold > 0) return;
    this.rotationTimer -= dt;
    if (this.rotationTimer <= 0 && this.isHouseAudio()) {
      void this.select(this.next());
      return;
    }
    if (!this.game.audio.playing) void this.start();
  }

  dispose() {
    this.performer?.group.removeFromParent();
    this.desk?.removeFromParent();
    this.performer = null;
    this.desk = null;
  }
}
