import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { poseLightweightHuman } from '../avatar/LightweightHuman.js';
import { NPC_DJ_PROGRAMS } from '../audio/musicLibrary.js';
import { createNpcCharacter } from '../npcs/NpcSystem.js';

export const HOUSE_DJS = [
  { id: 'lunice', name: 'Lunice', trackId: 'atrakar', accent: 0x53b7ff },
  { id: 'kaytranada', name: 'Kaytranada', trackId: 'got-you-dancin', accent: 0xffa85a },
  {
    id: 'james-benjamin',
    characterId: 'james',
    name: 'James Benjamin',
    trackId: 'in-flux-break',
    programId: 'james-benjamin',
    accent: 0xff5e91,
  },
  {
    id: 'malaika',
    characterId: 'malaika',
    name: 'DJ FLLEUR',
    trackId: 'atrakar',
    accent: 0xff587e,
  },
  { id: 'siren-mars', name: 'Siren Mars', trackId: 'bhab', accent: 0xc888ff },
  { id: 'monib', name: 'Monib', trackId: 'paharpur', accent: 0x72e0b5 },
  { id: 'hydra', name: 'Hydra', trackId: 'in-flux-breath', accent: 0x7d8cff },
  { id: 'bootyspoon', name: 'Bootyspoon', trackId: 'fakir', accent: 0xff725f },
  { id: 'marie-davidson', name: 'Marie Davidson', trackId: 'in-flux-gingele', accent: 0xf4d45e },
  { id: 'frankie-teardrop', name: 'Frankie Teardrop', trackId: 'dubki', accent: 0x9fe46d },
];

export const HOUSE_DJ_IDS = HOUSE_DJS.map((dj) => dj.id);

function person(dj) {
  const model = createNpcCharacter({
    id: dj.characterId ?? dj.id,
    name: dj.name,
    appearance: { accent: dj.accent, prop: null },
  });

  // Headphones follow the head rather than floating at a fixed world-space height.
  const detail = new MeshStandardMaterial({ color: dj.accent, roughness: 0.55 });
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
    this.programIndex = 0;
    this.programRunning = false;
  }

  get selected() {
    return HOUSE_DJS.find((dj) => dj.id === this.selectedId) ?? HOUSE_DJS[0];
  }

  get programDefinition() {
    return NPC_DJ_PROGRAMS[this.selected.programId ?? this.selected.id] ?? null;
  }

  get fallbackProgram() {
    const configured = this.programDefinition?.fallback;
    if (Array.isArray(configured) && configured.length) return configured;
    return [{ id: this.selected.trackId, label: 'Breakglass selection' }];
  }

  get currentProgramItem() {
    const program = this.fallbackProgram;
    return program[this.programIndex % program.length] ?? program[0];
  }

  availableLongformId() {
    const ids = this.programDefinition?.preferredLongformIds ?? [];
    return (
      ids.find((id) => {
        const entry = this.game.audio.assets?.entry?.(id);
        return Boolean(entry?.url);
      }) ?? null
    );
  }

  attach() {
    const downstairs = this.game.scenes.get('downstairs');
    const upstairs = this.game.scenes.get('upstairs');
    if (!downstairs || !upstairs || this.performer) return;

    const booth = safePosition(downstairs.definition.anchors?.dj?.position, [1.5, 0, -2.15]);
    const model = person(this.selected);
    model.group.name = 'house-dj';
    model.group.position.set(booth[0], booth[1], booth[2] - 0.38);
    // The performer stands north of the controls and faces +Z into the booth and dance floor.
    model.group.rotation.y = 0;
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
    this.starting = true;
    try {
      const dj = this.selected;
      const longformId = this.availableLongformId();
      const item = longformId
        ? { id: longformId, label: 'continuous archived set', continuous: true }
        : this.currentProgramItem;
      const sequential = !item.continuous && this.fallbackProgram.length > 1;
      const started = await this.game.audio.playAsset(item.id, {
        owner: 'house-dj',
        label: `House DJ · ${dj.name} · ${item.label}`,
        loop: !sequential,
        vibe: 0.78,
        baseVolume: 0.88,
      });
      this.programRunning = Boolean(started && sequential);
    } finally {
      this.starting = false;
    }
  }

  stopHouseAudio() {
    this.programRunning = false;
    this.game.audio.stopAsset?.('house-dj');
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
    this.programIndex = 0;
    this.programRunning = false;
    this.game.dj.stop();
    if (wasPlaying) this.stopHouseAudio();
    this.rotationTimer = 160 + Math.random() * 100;
    this.applyLook();
    this.game.save();
    if (wasPlaying || this.game.sceneManager.current?.definition?.id === 'downstairs')
      await this.start();
  }

  applyLook() {
    const downstairs = this.game.scenes.get('downstairs');
    if (!downstairs || !this.performer) return;
    const position = this.performer.group.position.clone();
    const rotation = this.performer.group.rotation.y;
    this.performer.group.removeFromParent();
    const model = person(this.selected);
    model.group.name = 'house-dj';
    model.group.position.copy(position);
    model.group.rotation.y = rotation;
    downstairs.gameplay.add(model.group);
    this.performer = model;
  }

  next() {
    const index = HOUSE_DJS.findIndex((dj) => dj.id === this.selectedId);
    return HOUSE_DJS[(index + 1) % HOUSE_DJS.length].id;
  }

  advanceProgram() {
    const program = this.fallbackProgram;
    if (!this.programRunning || this.starting || program.length < 2) return false;
    this.programIndex = (this.programIndex + 1) % program.length;
    this.programRunning = false;
    void this.start();
    return true;
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
    const studioPlaybackDownstairs =
      downstairs && this.game.audio.activeExternalTransport?.owner === 'studio';
    if (this.game.evacuationStarted) {
      this.stopHouseAudio();
      if (this.performer) this.performer.group.visible = false;
      return;
    }
    if (this.performer) {
      this.performer.group.visible = !playerDj && !studioPlaybackDownstairs;
      const malaika = this.game.scenes.get('downstairs')?.npcs?.get?.('malaika');
      if (malaika?.group)
        malaika.group.visible = !(this.selectedId === 'malaika' && this.performer.group.visible);
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
    if (playerDj || studioPlaybackDownstairs) {
      this.playerHold = 8;
      return;
    }
    this.playerHold = Math.max(0, this.playerHold - dt);
    if (this.playerHold > 0) return;

    // A programmed NPC set is building-wide transport: leaving Below must not reset it or create
    // silence when a song ends. Advance even while the player is elsewhere in the building.
    if (this.programRunning && !this.isHouseAudio()) {
      this.advanceProgram();
      return;
    }

    if (!downstairs) return;
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
