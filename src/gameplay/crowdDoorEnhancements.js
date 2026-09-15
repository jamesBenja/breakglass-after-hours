import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SpotLight,
  Vector3,
} from 'three';
import { AlleySystem } from '../alley/AlleySystem.js';
import { AlleyCrowdSystem } from '../alley/AlleyCrowdSystem.js';
import { HOUSE_DJS } from './HouseDjSystem.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function doorAccessTier(role) {
  if (['dj', 'promoter'].includes(role)) return 'direct';
  if (['producer', 'musician', 'vj', 'photographer'].includes(role)) return 'working';
  return 'guest';
}

let alleyPressurePatched = false;
function patchExpandedAlleyPressure() {
  if (alleyPressurePatched) return;
  alleyPressurePatched = true;
  const baseUpdate = AlleySystem.prototype.update;
  const baseBeginEvacuation = AlleySystem.prototype.beginEvacuation;

  AlleySystem.prototype.beginEvacuation = function expandedBeginEvacuation() {
    this._normalOccupancy ??= this.occupancy;
    const result = baseBeginEvacuation.call(this);
    this._shutdownElapsed = 0;
    this._shutdownStartOccupancy = Math.max(4, this.occupancy);
    this._shutdownCrowdPeak = clamp(
      this._shutdownStartOccupancy + Math.max(22, this.clubAttendance * 0.78),
      28,
      52,
    );
    return result;
  };

  AlleySystem.prototype.update = function expandedAlleyUpdate(dt, metrics = {}) {
    this._normalOccupancy ??= this.occupancy;
    const result = baseUpdate.call(this, dt, metrics);

    if (this.evacuationStarted) {
      this._shutdownElapsed = Math.max(0, Number(this._shutdownElapsed) || 0) + dt;
      const t = this._shutdownElapsed;
      let target;
      if (t < 8) {
        const progress = clamp(t / 8);
        target =
          this._shutdownStartOccupancy +
          (this._shutdownCrowdPeak - this._shutdownStartOccupancy) * progress;
      } else if (t < 22) target = this._shutdownCrowdPeak;
      else target = Math.max(8, this._shutdownCrowdPeak - (t - 22) * 1.15);
      this.occupancy += (target - this.occupancy) * (1 - Math.exp(-1.15 * dt));
      this.conversationLevel = Math.max(
        this.conversationLevel,
        clamp(0.32 + (this.occupancy / 52) * 0.48),
      );
      this.rowdyLevel = Math.max(this.rowdyLevel ?? 0, t < 16 ? 0.52 : 0.28);
      this.disturbance = Math.max(this.disturbance, 0.48);
      return result;
    }

    const attendance = Math.max(0, Number(this.clubAttendance) || 0);
    const danceShare = clamp(Number(this.clubDanceShare) || 0);
    const offFloor = attendance * (1 - danceShare);
    const badBlend = clamp((0.7 - (Number(this.clubMixQuality) || 0)) / 0.7);
    const target = clamp(
      3 + offFloor * 0.36 + (this.spillOutPressure ?? 0) * 7 + badBlend * 4 + (this.rowdyLevel ?? 0) * 3,
      2,
      38,
    );
    const fasterSpill = target > this.occupancy && (this.spillOutPressure ?? 0) > 0.42;
    const speed = fasterSpill ? 0.46 : target > this.occupancy ? 0.24 : 0.13;
    this.occupancy += (target - this.occupancy) * (1 - Math.exp(-speed * dt));
    return result;
  };
}

function makeOfficer(root, name) {
  const group = new Group();
  group.name = name;
  const uniform = new MeshStandardMaterial({ color: 0x15202d, roughness: 0.72, metalness: 0.08 });
  const skin = new MeshStandardMaterial({ color: 0xaa775c, roughness: 0.84 });
  const body = new Mesh(new BoxGeometry(0.48, 0.92, 0.32), uniform);
  body.position.y = 0.92;
  const head = new Mesh(new SphereGeometry(0.17, 10, 7), skin);
  head.position.y = 1.58;
  const cap = new Mesh(new BoxGeometry(0.38, 0.1, 0.38), uniform);
  cap.position.y = 1.79;
  const flashlight = new Mesh(new BoxGeometry(0.08, 0.08, 0.24), uniform);
  flashlight.position.set(0.27, 1.16, 0.25);
  const target = new Group();
  target.position.set(0, 1.1, 5);
  const beam = new SpotLight(0xfff1d0, 18, 13, 0.22, 0.48, 1.5);
  beam.position.set(0.27, 1.18, 0.22);
  beam.target = target;
  group.add(body, head, cap, flashlight, target, beam);
  group.visible = false;
  root.add(group);
  return { group, target, beam, materials: [uniform, skin] };
}

function placeOnPath(model, path, progress, sideOffset = 0) {
  const scaled = clamp(progress) * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const from = path[index];
  const to = path[index + 1];
  const x = from[0] + (to[0] - from[0]) * local;
  const y = from[1] + (to[1] - from[1]) * local;
  const z = from[2] + (to[2] - from[2]) * local;
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.max(0.001, Math.hypot(dx, dz));
  model.group.position.set(x + (-dz / length) * sideOffset, y, z + (dx / length) * sideOffset);
  model.group.rotation.y = Math.atan2(dx, dz);
}

class PoliceRaidSystem {
  constructor(game, ui, alleyCrowd) {
    this.game = game;
    this.ui = ui;
    this.alleyCrowd = alleyCrowd;
    this.elapsed = 0;
    this.active = false;
    this.finished = false;
    this.soundTimer = 0;
    this.phaseWarningShown = false;
    this.onComplete = null;
    this.alleyModels = [];
    this.clubModels = [];
    const alley = game.scenes.get('alley');
    const downstairs = game.scenes.get('downstairs');
    if (!alley || !downstairs) return;
    for (let i = 0; i < 3; i++) {
      this.alleyModels.push(makeOfficer(alley.gameplay, `raid-alley-officer-${i + 1}`));
      this.clubModels.push(makeOfficer(downstairs.gameplay, `raid-club-officer-${i + 1}`));
    }
    this.alleyPath = [
      [-21.5, 0, 0],
      [-14, 0, 0.3],
      [-8, 0, -0.25],
      [-3.8, 0, -1.15],
    ];
    this.clubPath = [
      [4.55, 0.64, -4.8],
      [4.35, 0.2, -3.45],
      [3.5, 0, -2.0],
      [1.2, 0, -0.9],
      [-1.5, 0, 0.25],
      [-3.8, 0, 1.25],
    ];
  }

  sirenBurst() {
    const audio = this.game.audio;
    if (!audio?.context) return;
    audio.tone?.(760, 0.13, 'square', 0.026, 0);
    audio.tone?.(565, 0.16, 'square', 0.026, 0.14);
    this.alleyCrowd?.voice?.(audio, 'rowdy');
  }

  start(onComplete) {
    if (this.active) return;
    this.active = true;
    this.finished = false;
    this.elapsed = 0;
    this.soundTimer = 0;
    this.phaseWarningShown = false;
    this.onComplete = onComplete;
    for (const model of [...this.alleyModels, ...this.clubModels]) model.group.visible = false;
    this.sirenBurst();
  }

  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    this.soundTimer -= dt;
    if (this.soundTimer <= 0 && this.elapsed < 11.5) {
      this.sirenBurst();
      this.soundTimer = 1.25;
    }

    if (this.elapsed < 4) {
      const progress = this.elapsed / 4;
      for (const [index, model] of this.alleyModels.entries()) {
        model.group.visible = true;
        placeOnPath(model, this.alleyPath, progress, (index - 1) * 0.42);
        model.target.position.x = Math.sin(this.elapsed * 4.8 + index) * 1.9;
      }
      for (const model of this.clubModels) model.group.visible = false;
    } else {
      for (const model of this.alleyModels) model.group.visible = false;
      const progress = clamp((this.elapsed - 4) / 6.5);
      for (const [index, model] of this.clubModels.entries()) {
        model.group.visible = true;
        placeOnPath(model, this.clubPath, progress, (index - 1) * 0.44);
        model.target.position.x = Math.sin(this.elapsed * 5.6 + index * 1.4) * 2.4;
        model.target.position.y = 0.9 + Math.sin(this.elapsed * 3 + index) * 0.35;
      }
      if (!this.phaseWarningShown && this.elapsed >= 5) {
        this.phaseWarningShown = true;
        this.ui.warning?.('POLICE: MUSIC OFF. EVERYONE OUT. Officers are sweeping the club with flashlights.');
      }
    }

    if (!this.finished && this.elapsed >= 12.5) {
      this.finished = true;
      this.active = false;
      this.onComplete?.();
    }
  }

  reset() {
    this.active = false;
    this.finished = false;
    this.elapsed = 0;
    for (const model of [...this.alleyModels, ...this.clubModels]) model.group.visible = false;
  }

  dispose() {
    for (const model of [...this.alleyModels, ...this.clubModels]) {
      model.group.removeFromParent();
      model.group.traverse((object) => object.geometry?.dispose?.());
      for (const material of model.materials) material.dispose();
      model.beam.dispose?.();
    }
    this.alleyModels = [];
    this.clubModels = [];
  }
}

class BouncerDoorSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.admitted = false;
    this.waitUntil = 0;
    this.wrongAnswers = 0;
  }

  reset() {
    this.admitted = false;
    this.waitUntil = 0;
    this.wrongAnswers = 0;
  }

  currentDj() {
    return this.game.partyLife?.houseDj?.selected?.name ?? 'James Benjamin';
  }

  enter() {
    this.admitted = true;
    this.waitUntil = 0;
    this.game.sceneManager.request('downstairs@alley');
  }

  remainingWait() {
    return Math.max(0, Math.ceil((this.waitUntil - Date.now()) / 1000));
  }

  wrongDj() {
    this.wrongAnswers += 1;
    const seconds = Math.min(45, 12 + this.wrongAnswers * 8);
    this.waitUntil = Date.now() + seconds * 1000;
    this.ui.panel(
      'DOOR · NOT YET',
      `Wrong answer. The bouncer sends you back to the alley for ${seconds} seconds before you can try again.`,
      [],
    );
  }

  djQuiz() {
    const correct = this.currentDj();
    const distractors = HOUSE_DJS.map((dj) => dj.name).filter((name) => name !== correct);
    const seed = this.wrongAnswers % Math.max(1, distractors.length);
    const choices = [correct, distractors[seed], distractors[(seed + 3) % distractors.length]].filter(Boolean);
    choices.sort((a, b) => (a.length + this.wrongAnswers) % 3 - (b.length + this.wrongAnswers) % 3);
    this.ui.panel(
      'DOOR · WHO IS PLAYING?',
      'The bouncer asks who is on the decks right now.',
      choices.map((name) => [
        name,
        () => {
          if (name === correct) {
            this.ui.warning?.(`Correct. ${correct} is playing. The bouncer lets you in.`);
            this.enter();
          } else this.wrongDj();
        },
      ]),
    );
  }

  guestPanel() {
    this.ui.panel('DOOR · GUESTLIST', 'The bouncer asks if you are on the guestlist.', [
      [
        'Yes, I am on the guestlist',
        () => {
          const name = this.game.state.data.avatar?.displayName ?? 'Guest';
          this.ui.warning?.(`The bouncer checks the list, finds ${name}, and waves you in.`);
          this.enter();
        },
      ],
      ['No / not sure', () => this.djQuiz()],
    ]);
  }

  workingPanel() {
    this.ui.panel(
      'DOOR · WORKING OR PARTYING?',
      'The bouncer recognizes that you might be here to work, but checks before letting you through.',
      [
        ['I am working tonight', () => this.enter()],
        ['I am here as a guest', () => this.guestPanel()],
      ],
    );
  }

  handle(target) {
    if (this.game.sceneManager.current?.definition?.id !== 'alley') return false;
    const isDoor = target?.id === 'clubDoor' || target?.target === 'downstairs@alley';
    const isBouncer = target?.npcId === 'bouncer' || target?.id === 'bouncer';
    if (!isDoor && !isBouncer) return false;

    if (this.admitted) {
      this.enter();
      return true;
    }
    const remaining = this.remainingWait();
    if (remaining > 0) {
      this.ui.panel(
        'DOOR · WAIT IN THE ALLEY',
        `The bouncer remembers the wrong answer. You can try again in about ${remaining} seconds.`,
        [],
      );
      return true;
    }

    const role = this.game.state.data.avatar?.role ?? 'explorer';
    const tier = doorAccessTier(role);
    if (tier === 'direct') {
      this.ui.warning?.(
        role === 'dj'
          ? 'The bouncer recognizes you as a DJ and waves you straight in.'
          : 'The bouncer recognizes you as a promoter and waves you straight in.',
      );
      this.enter();
      return true;
    }
    if (tier === 'working') this.workingPanel();
    else this.guestPanel();
    return true;
  }
}

function resetAlley(alley) {
  if (!alley) return;
  alley.occupancy = Math.max(5, Number(alley._normalOccupancy) || 7);
  alley.conversationLevel = 0.24;
  alley.disturbance = 0.12;
  alley.staffWarningLevel = 0;
  alley.highNoiseTime = 0;
  alley.policePresent = false;
  alley.policeVisits = 0;
  alley.policeCooldown = 0;
  alley.policeResponseTime = 0;
  alley.lastPoliceOutcome = null;
  alley.evacuationRequired = false;
  alley.evacuationStarted = false;
  alley.rowdyLevel = 0;
  alley.spillOutPressure = 0;
  alley._shutdownElapsed = 0;
  alley.setPoliceVisible?.(false);
}

function resetIndoorCrowd(level) {
  const crowd = level?.crowd;
  if (!crowd) return;
  crowd.min = Math.max(0, crowd.config?.min ?? 18);
  crowd.idle = Math.max(crowd.min, crowd.config?.idle ?? 28);
  crowd.attendance = clamp(crowd.config?.start ?? 72, crowd.min, crowd.max);
  crowd.targetAttendance = crowd.attendance;
  crowd.danceShare = 0.35;
  crowd.setVisibleCount?.(Math.round(crowd.attendance));
}

export function installCrowdDoorEnhancements(game, ui) {
  patchExpandedAlleyPressure();
  if (game.crowdDoor) return game.crowdDoor;

  const bouncer = new BouncerDoorSystem(game, ui);
  let alleyCrowd = null;
  let raid = null;

  const baseInitialize = game.initialize.bind(game);
  game.initialize = async (...args) => {
    const result = await baseInitialize(...args);
    const alleyLevel = game.scenes.get('alley');
    if (alleyLevel && !alleyCrowd) {
      alleyCrowd = new AlleyCrowdSystem(alleyLevel.gameplay, {
        max: 52,
        door: alleyLevel.definition.spawns.clubDoor,
      });
      const baseTargets = alleyLevel.alley.interactionTargets.bind(alleyLevel.alley);
      alleyLevel.alley.interactionTargets = () => [
        ...baseTargets(),
        ...(alleyCrowd?.interactionTargets?.() ?? []),
      ];
    }
    raid = new PoliceRaidSystem(game, ui, alleyCrowd);
    game.crowdDoor.alleyCrowd = alleyCrowd;
    game.crowdDoor.raid = raid;
    return result;
  };

  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (bouncer.handle(target)) return;
    if (target?.action === 'alleyGuest' && alleyCrowd) {
      const index = target.guestIndex;
      const member = alleyCrowd.member(index);
      if (!member) return;
      const alley = game.scenes.get('alley')?.alley;
      const render = () => {
        ui.panel(
          member.smoker ? 'ALLEY · SMOKER' : 'ALLEY · HANGING OUT',
          member.smoker
            ? 'They are hanging out by the alley crowd with a cigarette.'
            : 'They are talking with people outside the club.',
          [
            [
              'Ask them for a smoke',
              () => {
                if (alleyCrowd.askForSmoke(index)) {
                  game.partyLife?.smoking?.emit?.(game.player.position, 3);
                  game.partyLife?.smoking?.emit?.(alleyCrowd.smokePosition(index), 2);
                  game.audio.tone?.(1400, 0.035, 'square', 0.012);
                  alley?.chat?.(0.035);
                  alleyCrowd.voice(game.audio, 'talk');
                  ui.warning?.('They hand you one and light it.');
                } else {
                  alleyCrowd.react(index, 'quiet');
                  alleyCrowd.voice(game.audio, 'quiet');
                  ui.warning?.(member.smoker ? 'They are down to their last one.' : 'They are not smoking.');
                }
                render();
              },
            ],
            [
              'Offer them a smoke',
              () => {
                game.partyLife?.smoking?.emit?.(alleyCrowd.smokePosition(index), 3);
                game.audio.tone?.(1400, 0.035, 'square', 0.012);
                alley?.chat?.(0.045);
                alleyCrowd.voice(game.audio, 'talk');
                game.state.data.smokesShared = Math.min(999, (game.state.data.smokesShared ?? 0) + 1);
                game.save();
                ui.warning?.('They take it and the conversation loosens up.');
                render();
              },
            ],
            [
              'Get them rowdier',
              () => {
                alley?.chat?.(0.18);
                alleyCrowd.react(index, 'rowdy');
                alleyCrowd.voice(game.audio, 'rowdy');
                ui.warning?.('They cheer, raise their voice and pull the nearby group into it.');
                render();
              },
            ],
            [
              'Ask them to keep it down',
              () => {
                alley?.quiet?.(0.2);
                alleyCrowd.react(index, 'quiet');
                alleyCrowd.voice(game.audio, 'quiet');
                ui.warning?.('They nod and the nearby conversation drops noticeably.');
                render();
              },
            ],
          ],
        );
      };
      render();
      return;
    }
    baseDispatch(target);
  };

  const coreBeginEvacuation = game.beginEvacuation.bind(game);
  game.beginEvacuation = () => {
    if (game.evacuationStarted) return;
    coreBeginEvacuation();
    raid?.start?.(() => {
      ui.panel(
        'PARTY SHUT DOWN',
        'The club has been cleared. Police pushed the room out through the alley, so the outside is packed while people figure out where to go next.',
        [
          [
            'Try the party again',
            () => {
              game.evacuationStarted = false;
              game.lastPoliceVisits = 0;
              resetAlley(game.scenes.get('alley')?.alley);
              resetIndoorCrowd(game.scenes.get('downstairs'));
              raid?.reset?.();
              bouncer.reset();
              const alleyLevel = game.scenes.get('alley');
              if (game.sceneManager.current?.definition?.id === 'alley' && alleyLevel) {
                game.player.spawn(alleyLevel.definition.spawns.start, alleyLevel.collision);
              } else game.sceneManager.request('alley@start');
              ui.warning?.('The night resets outside Breakglass. Try the door again.');
            },
          ],
        ],
      );
    });
    ui.panel(
      'POLICE RAID',
      'Officers are moving from the alley into Below with large flashlights. The music is off and they are loudly clearing the dance floor toward the exit.',
      [],
    );
  };

  let lastNow = null;
  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    const dt = lastNow == null ? 0 : Math.max(0, Math.min(0.05, (now - lastNow) / 1000));
    lastNow = now;
    raid?.update?.(dt);
    if (game.sceneManager.current?.definition?.id === 'alley' && alleyCrowd) {
      alleyCrowd.update(dt, game.scenes.get('alley')?.alley?.snapshot?.());
    }
    return baseUpdate(now, movementOverride);
  };

  const baseDispose = game.dispose.bind(game);
  game.dispose = async () => {
    raid?.dispose?.();
    alleyCrowd?.dispose?.();
    return baseDispose();
  };

  game.crowdDoor = { bouncer, alleyCrowd, raid };
  return game.crowdDoor;
}
