import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { createLightweightHuman, poseLightweightHuman } from '../avatar/LightweightHuman.js';

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
  const model = createLightweightHuman({
    skin: 0xaa785d,
    outfit: 0x202329,
    trousers: 0x181a20,
    hair: 0x211a18,
    accent,
    hairStyle: 'short',
  });

  // Headphones follow the head rather than floating at a fixed world-space height.
  const detail = new MeshStandardMaterial({ color: accent, roughness: 0.55 });
  const band = new Mesh(new BoxGeometry(0.4, 0.045, 0.07), detail);
  band.position.set(0, 0.17, 0);
  const leftCup = new Mesh(new BoxGeometry(0.055, 0.12, 0.085), detail);
  const rightCup = leftCup.clone();
  leftCup.position.set(-0.205, 0.02, 0);
  rightCup.position.set(0.205, 0.02, 0);
  model.head.add(band, leftCup, rightCup);
  model.headphones = { band, leftCup, rightCup };
  model.detail = detail;
  return model;
}

function safePosition(value, fallback = [0, 0, 0]) {
  if (Array.isArray(value) && value.length >= 3 && value.every(Number.isFinite)) return value;
  return fallback;
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

    const booth = safePosition(downstairs.definition.anchors?.dj?.position, [1.5, 0, -2.15]);
    const model = person(this.selected.accent);
    model.group.name = 'house-dj';
    model.group.position.set(booth[0], booth[1], booth[2] - 0.38);
    model.group.rotation.y = Math.PI;
    downstairs.gameplay.add(model.group);
    this.performer = model;

    const consolePosition = safePosition(upstairs.definition.anchors?.console?.position, [0, 0, 0]);
    const anchor = safePosition(upstairs.definition.anchors?.houseDjDesk?.position, [
      consolePosition[0] + 1.8,
      consolePosition[1],
      consolePosition[2] + 0.9,
    ]);
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
    if (wasPlaying || this.game.sceneManager.current?.definition?.id === 'downstairs')
      await this.start();
  }

  applyLook() {
    if (this.performer) {
      this.performer.detail.color.setHex(this.selected.accent);
      this.performer.materials.accent.color.setHex(this.selected.accent);
    }
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
      const metrics = this.game.dj.metrics?.() ?? {};
      const energy = Math.max(0.25, Number(metrics.energy) || 0.62);
      poseLightweightHuman(this.performer, {
        time: this.elapsed,
        phase: 0.7,
        dancing: true,
        energy,
        reach: 0.5,
      });
      // A DJ alternates between mixer work and a deck reach. Elbows make this read as hand work
      // rather than the old full-arm windmill motion.
      const phrase = Math.sin(this.elapsed * 1.7);
      this.performer.leftArm.rotation.x = -0.58 + phrase * 0.11;
      this.performer.rightArm.rotation.x = -0.72 - phrase * 0.15;
      this.performer.leftForearm.rotation.x = -0.62 - Math.max(0, phrase) * 0.2;
      this.performer.rightForearm.rotation.x = -0.76 - Math.max(0, -phrase) * 0.24;
      this.performer.head.rotation.y += Math.sin(this.elapsed * 0.8) * 0.055;
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
