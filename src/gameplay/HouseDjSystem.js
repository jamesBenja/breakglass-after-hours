import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { poseLightweightHuman } from '../avatar/LightweightHuman.js';
import { NPC_DJ_PROGRAMS, RUNTIME_DJ_LIBRARY } from '../audio/musicLibrary.js';
import { createNpcCharacter } from '../npcs/NpcSystem.js';
import { houseDjProfile, transitionSecondsForHouseDj } from './houseDjFeeder.js';

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
    this.programVoices = new Set();
    this.currentProgramVoice = null;
    this.nextMixAt = Infinity;
    this.programTrackDuration = 0;
    this.programStartedAtMs = 0;
    this.sharedFollower = false;
    this.backgroundSnapshot = null;
  }

  get selected() {
    return HOUSE_DJS.find((dj) => dj.id === this.selectedId) ?? HOUSE_DJS[0];
  }

  get programDefinition() {
    return NPC_DJ_PROGRAMS[this.selected.programId ?? this.selected.id] ?? null;
  }

  get feederProfile() {
    return houseDjProfile(this.selected.id);
  }

  get fallbackProgram() {
    const configured = this.programDefinition?.fallback;
    if (Array.isArray(configured) && configured.length) return configured;

    const crate = RUNTIME_DJ_LIBRARY.map(({ id, label }) => ({ id, label }));
    if (!crate.length) return [{ id: this.selected.trackId, label: 'Breakglass selection' }];
    const start = Math.max(
      0,
      crate.findIndex((track) => track.id === this.selected.trackId),
    );
    return [...crate.slice(start), ...crate.slice(0, start)];
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
    const transports = this.game.audio.externalTransports;
    if (typeof transports?.has === 'function') return transports.has('house-dj');
    return this.game.audio.activeExternalTransport?.owner === 'house-dj';
  }

  currentPlaybackOffset() {
    const media = this.game.audio.nativeMedia?.get?.('house-dj')?.element;
    if (media && Number.isFinite(media.currentTime)) return Math.max(0, media.currentTime);

    const duration = Math.max(0, Number(this.programTrackDuration) || 0);
    const startedAt = Math.max(0, Number(this.programStartedAtMs) || 0);
    if (duration > 0 && startedAt > 0) {
      const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
      return elapsed % duration;
    }
    return 0;
  }

  prepareForBackground() {
    if (!this.isHouseAudio()) {
      this.backgroundSnapshot = null;
      return false;
    }

    this.backgroundSnapshot = {
      selectedId: this.selectedId,
      programIndex: this.programIndex,
      offset: this.currentPlaybackOffset(),
      duration: Math.max(0, Number(this.programTrackDuration) || 0),
      capturedAtMs: Date.now(),
    };

    // Safari can return a resumed AudioContext whose pre-background AudioBufferSourceNodes never
    // become audible again. Tear the active house set down before suspension so foreground
    // recovery creates fresh source nodes instead of trusting iOS to revive the old ones.
    this.stopHouseAudio(0.03);
    return true;
  }

  async recoverAfterBackground() {
    const snapshot = this.backgroundSnapshot;
    if (!snapshot || this.game.audio.context?.state !== 'running') return false;
    this.backgroundSnapshot = null;

    this.selectedId = snapshot.selectedId;
    this.game.state.data.houseDjId = snapshot.selectedId;
    this.programIndex =
      Math.max(0, Math.floor(Number(snapshot.programIndex) || 0)) %
      Math.max(1, this.fallbackProgram.length);
    this.programRunning = false;
    this.nextMixAt = Infinity;

    const awaySeconds = Math.max(0, (Date.now() - snapshot.capturedAtMs) / 1000);
    const duration = Math.max(0, Number(snapshot.duration) || 0);
    const offset =
      duration > 0 ? (Math.max(0, snapshot.offset) + awaySeconds) % duration : snapshot.offset;

    await this.start({ transition: true, offset });
    return this.isHouseAudio();
  }

  stopProgramVoices(fadeSeconds = 0) {
    const context = this.game.audio.context;
    const now = context?.currentTime ?? 0;
    const fade = Math.max(0, Number(fadeSeconds) || 0);
    for (const voice of [...this.programVoices]) {
      const parameter = voice.gain?.gain;
      if (parameter?.cancelScheduledValues) parameter.cancelScheduledValues(now);
      if (fade > 0 && parameter?.setValueAtTime && parameter?.exponentialRampToValueAtTime) {
        parameter.setValueAtTime(Math.max(0.0001, parameter.value || 0.0001), now);
        parameter.exponentialRampToValueAtTime(0.0001, now + fade);
      }
      try {
        voice.source.stop(now + fade + 0.03);
      } catch {
        voice.source.disconnect?.();
        voice.gain?.disconnect?.();
        this.programVoices.delete(voice);
      }
    }
    this.currentProgramVoice = null;
  }

  async start({ transition = false, offset = 0 } = {}) {
    if (this.starting || (!transition && this.isHouseAudio())) return;
    if (!this.game.started || !this.game.audio.context || this.game.dj.metrics().playing) return;
    this.starting = true;
    try {
      const dj = this.selected;
      const profile = this.feederProfile;
      const longformId = this.availableLongformId();
      const item = longformId
        ? { id: longformId, label: 'continuous archived set', continuous: true }
        : this.currentProgramItem;
      const context = this.game.audio.context;
      const buffer = await this.game.audio.assets?.audio?.(item.id, context);

      // A long-form source is already a performed DJ mix. Keep it intact. Individual runtime
      // tracks use overlapping decoded voices below so the house DJ never creates a dead-air gap.
      if (!buffer || item.continuous) {
        if (transition) this.game.audio.stopAsset?.('house-dj');
        const safeOffset = Math.max(0, Number(offset) || 0);
        const started = await this.game.audio.playAsset(item.id, {
          owner: 'house-dj',
          label: `House DJ · ${dj.name} · ${item.label}`,
          loop: item.continuous === true,
          vibe: profile.vibe,
          baseVolume: 0.88,
          offset: safeOffset,
        });
        if (started) {
          this.programTrackDuration = Math.max(0, Number(buffer?.duration) || 0);
          this.programStartedAtMs = Date.now() - safeOffset * 1000;
        }
        this.programRunning = Boolean(
          started && !item.continuous && this.fallbackProgram.length > 1,
        );
        this.nextMixAt = Infinity;
        return;
      }

      const overlap = Math.min(
        Math.max(2.5, transitionSecondsForHouseDj(dj.id)),
        Math.max(2.5, buffer.duration * 0.28),
      );
      const now = context.currentTime;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = false;
      source.connect(gain);
      gain.connect(this.game.audio.sourceDestination('house-dj'));

      const oldVoices = [...this.programVoices];
      const fadeIn = oldVoices.length ? overlap : Math.min(0.9, overlap);
      gain.gain.setValueAtTime?.(0.0001, now);
      gain.gain.exponentialRampToValueAtTime?.(0.88, now + fadeIn);
      if (!gain.gain.setValueAtTime) gain.gain.value = 0.88;

      for (const old of oldVoices) {
        const oldGain = old.gain?.gain;
        oldGain?.cancelScheduledValues?.(now);
        oldGain?.setValueAtTime?.(Math.max(0.0001, oldGain.value || 0.0001), now);
        oldGain?.exponentialRampToValueAtTime?.(0.0001, now + overlap);
        try {
          old.source.stop(now + overlap + 0.04);
        } catch {
          // An already-ended outgoing voice will clean itself up through onended.
        }
      }

      const voice = { source, gain, itemId: item.id };
      this.programVoices.add(voice);
      this.currentProgramVoice = voice;
      source.onended = () => {
        source.disconnect?.();
        gain.disconnect?.();
        this.programVoices.delete(voice);
        if (this.currentProgramVoice === voice) {
          this.currentProgramVoice = null;
          if (!this.programVoices.size && !this.starting)
            this.game.audio.clearExternalTransport?.('house-dj');
        }
      };
      const startOffset =
        buffer.duration > 0 ? Math.max(0, Number(offset) || 0) % buffer.duration : 0;
      source.start(0, startOffset);

      this.game.audio.setExternalTransport(
        'house-dj',
        `House DJ · ${dj.name} · ${item.label}`,
        0.25,
        { vibe: profile.vibe, mixQuality: profile.mixQuality },
      );
      this.programTrackDuration = buffer.duration;
      this.programStartedAtMs = Date.now() - startOffset * 1000;
      this.programRunning = this.fallbackProgram.length > 1;
      const remaining = Math.max(0, buffer.duration - startOffset);
      this.nextMixAt = now + Math.max(2, remaining - overlap);
    } finally {
      this.starting = false;
    }
  }

  stopHouseAudio(fadeSeconds = 0.12) {
    this.programRunning = false;
    this.nextMixAt = Infinity;
    this.stopProgramVoices(fadeSeconds);
    this.game.audio.stopAsset?.('house-dj');
    this.game.audio.clearExternalTransport?.('house-dj');
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
    this.nextMixAt = Infinity;
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
    void this.start({ transition: true });
    return true;
  }

  async applySharedTransport({ djId, programIndex = 0, playing = false, offset = 0 } = {}) {
    if (!HOUSE_DJ_IDS.includes(djId)) return false;
    const sameDj = this.selectedId === djId;
    const wasPlaying = this.isHouseAudio();
    const previousIndex = this.programIndex;
    this.sharedFollower = true;
    if (!sameDj || !playing) this.stopHouseAudio(0);
    this.selectedId = djId;
    this.game.state.data.houseDjId = djId;
    this.programIndex =
      Math.max(0, Math.floor(Number(programIndex) || 0)) % Math.max(1, this.fallbackProgram.length);
    this.programRunning = false;
    this.nextMixAt = Infinity;
    this.applyLook();
    this.game.save();
    if (playing) {
      const sharedTransition = sameDj && wasPlaying && previousIndex !== this.programIndex;
      await this.start({ transition: sharedTransition, offset });
    }
    return true;
  }

  setSharedFollower(active) {
    this.sharedFollower = active === true;
  }

  panel() {
    this.ui.panel(
      'HOUSE DJ · PRODUCTION DESK',
      `${this.selected.name} is assigned to the booth. ${this.feederProfile.style}. House DJs keep Below moving whenever you are not on the decks, with overlapping transitions instead of dead air.`,
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
      const malaika = this.game.scenes.get('downstairs')?.npcs?.get?.('malaika');
      if (malaika?.group)
        malaika.group.visible = !(this.selectedId === 'malaika' && this.performer.group.visible);
      const metrics = this.game.dj.metrics?.() ?? {};
      const energy = Math.max(
        0.25,
        (Number(metrics.energy) || 0.62) * this.feederProfile.animationEnergy,
      );
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
    if (this.playerHold > 0) return;

    // A programmed NPC set is building-wide transport. Begin the incoming track before the
    // outgoing track ends so the overlap is a real mix on one spatial house-dj source bus.
    if (
      !this.sharedFollower &&
      this.programRunning &&
      Number.isFinite(this.nextMixAt) &&
      this.game.audio.context?.currentTime >= this.nextMixAt
    ) {
      this.nextMixAt = Infinity;
      this.advanceProgram();
    } else if (
      !this.sharedFollower &&
      this.programRunning &&
      !Number.isFinite(this.nextMixAt) &&
      !this.isHouseAudio()
    ) {
      // Native/fallback media cannot be pre-scheduled as decoded WebAudio. Preserve the old
      // end-of-track continuation behavior as a compatibility fallback, still using the same bus.
      this.advanceProgram();
      return;
    }

    // The house set exists as a building-wide transport, not only after someone enters Below.
    // Starting it here lets a fresh alley arrival hear the intentionally filtered low-end bleed,
    // while unrelated studio/archive sources remain free to play at the same time.
    if (
      !this.sharedFollower &&
      !this.backgroundSnapshot &&
      this.game.audio.context?.state === 'running' &&
      !this.isHouseAudio()
    )
      void this.start();

    if (!downstairs) return;
    this.rotationTimer -= dt;
    if (!this.sharedFollower && this.rotationTimer <= 0 && this.isHouseAudio()) {
      void this.select(this.next());
      return;
    }
  }

  dispose() {
    this.performer?.group.removeFromParent();
    this.desk?.removeFromParent();
    this.stopHouseAudio(0);
    this.performer = null;
    this.desk = null;
  }
}
