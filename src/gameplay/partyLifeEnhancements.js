import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { HouseDjSystem } from './HouseDjSystem.js';
import { LiveBandSystem } from './LiveBandSystem.js';
import { PartyLifePhotoSystem, patchNpcPhotography } from './PartyLifePhotoSystem.js';
import { levels } from '../world/levels.js';
import { at } from '../world/upstairs/plan.js';

let prepared = false;

const offset = (position, x = 0, z = 0, y = 0) => [
  position[0] + x,
  position[1] + y,
  position[2] + z,
];

export function preparePartyLifeWorld() {
  if (prepared) return;
  prepared = true;

  const alley = levels.alley;
  if (!alley.npcs.some((npc) => npc.id === 'nora')) {
    alley.npcs.push({
      id: 'nora',
      name: 'Nora',
      role: 'photographer',
      position: [8.2, 0, -0.7],
      route: [
        [8.2, 0, -0.7],
        [6.7, 0, 0.2],
        [11.1, 0, 0.3],
        [3.8, 0, -0.5],
        [8.2, 0, -0.7],
      ],
      speed: 0.48,
    });
  }

  const upstairs = levels.upstairs;
  if (!upstairs.anchors.houseDjDesk) {
    upstairs.anchors.houseDjDesk = {
      name: 'House DJ production desk',
      position: at(325, 748),
      radius: 1.55,
      action: 'houseDjDesk',
    };
  }
  const fridge = at(785, 635);
  if (!upstairs.anchors.photoFridge) {
    upstairs.anchors.photoFridge = {
      name: 'Kitchen fridge · Nora photos',
      position: fridge,
      radius: 1.6,
      action: 'photoFridge',
    };
  }
  if (!upstairs.npcs.some((npc) => npc.id === 'nora')) {
    const live = upstairs.anchors.livePlayback.position;
    const consolePosition = upstairs.anchors.console.position;
    const synth = upstairs.anchors.synth.position;
    upstairs.npcs.push({
      id: 'nora',
      name: 'Nora',
      role: 'photographer',
      position: offset(live, -1.4, 1.0),
      route: [
        offset(live, -1.4, 1.0),
        offset(consolePosition, 1.5, 1.0),
        offset(synth, 1.2, -0.8),
        offset(fridge, -1.2, 0.3),
        offset(live, -1.4, 1.0),
      ],
      speed: 0.5,
    });
  }
}

class SmokingSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.puffs = [];
  }

  smoke() {
    const level = this.game.sceneManager.current;
    if (!level?.alley) return;
    this.game.state.data.smokesShared = Math.min(999, (this.game.state.data.smokesShared ?? 0) + 1);
    level.alley.chat(0.055);
    for (let i = 0; i < 4; i++) {
      const material = new MeshBasicMaterial({
        color: 0xdfe4e5,
        transparent: true,
        opacity: 0.3 - i * 0.04,
        depthWrite: false,
      });
      const mesh = new Mesh(new SphereGeometry(0.08 + i * 0.018, 8, 6), material);
      mesh.position.copy(this.game.player.position).add(new Vector3(0.2 + i * 0.05, 1.45, -0.08));
      level.gameplay.add(mesh);
      this.puffs.push({ mesh, life: 1.7 + i * 0.22 });
    }
    this.game.save();
    this.ui.warning?.('You hang out for a smoke with the alley group.');
  }

  update(dt) {
    for (const puff of this.puffs) {
      puff.life -= dt;
      puff.mesh.position.y += dt * 0.28;
      puff.mesh.position.x += dt * 0.035;
      puff.mesh.scale.multiplyScalar(1 + dt * 0.3);
      puff.mesh.material.opacity = Math.max(0, puff.life / 2) * 0.28;
    }
    const expired = this.puffs.filter((puff) => puff.life <= 0);
    this.puffs = this.puffs.filter((puff) => puff.life > 0);
    for (const puff of expired) {
      puff.mesh.removeFromParent();
      puff.mesh.geometry.dispose();
      puff.mesh.material.dispose();
    }
  }

  dispose() {
    for (const puff of this.puffs) {
      puff.mesh.removeFromParent();
      puff.mesh.geometry.dispose();
      puff.mesh.material.dispose();
    }
    this.puffs = [];
  }
}

export function installPartyLifeEnhancements(game, ui) {
  preparePartyLifeWorld();
  patchNpcPhotography();

  const photos = new PartyLifePhotoSystem(game, ui);
  const houseDj = new HouseDjSystem(game, ui);
  const liveBand = new LiveBandSystem(game);
  const smoking = new SmokingSystem(game, ui);
  game.partyLife = { photos, houseDj, liveBand, smoking };

  const baseInitialize = game.initialize.bind(game);
  game.initialize = async (...args) => {
    const result = await baseInitialize(...args);
    photos.attach();
    houseDj.attach();
    liveBand.attach();
    game.save();
    return result;
  };

  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (target?.action === 'dj' && houseDj.isHouseAudio()) {
      ui.panel(
        'DJ BOOTH · HANDOVER',
        `${houseDj.selected.name} is on the decks. You can take over, or leave the house set running.`,
        [
          [
            'Take over the booth',
            () => {
              houseDj.holdForPlayer(25);
              baseDispatch(target);
            },
          ],
          ['Let the house DJ play', () => {}],
        ],
      );
      return;
    }
    if (target?.action === 'houseDjDesk') {
      houseDj.panel();
      return;
    }
    if (target?.action === 'photoFridge') {
      ui.photoGallery?.(photos.studioPhotos(), 'STUDIO FRIDGE · NORA PHOTOS');
      return;
    }
    if (target?.action === 'alleySocial') {
      const alley = game.sceneManager.current?.alley;
      if (!alley) return;
      const render = () => {
        const snapshot = alley.snapshot();
        ui.panel('BREAKGLASS ALLEY', `${snapshot.occupancy} people are outside. ${snapshot.warning}`, [
          [
            'Talk quietly',
            () => {
              alley.chat(0.025);
              render();
            },
          ],
          [
            'Smoke with the group',
            () => {
              smoking.smoke();
              render();
            },
          ],
          [
            'Get the group excited',
            () => {
              alley.chat(0.22);
              render();
            },
          ],
          [
            'Remind everyone to keep it down',
            () => {
              alley.quiet(0.24);
              render();
            },
          ],
        ]);
      };
      render();
      return;
    }
    baseDispatch(target);
  };

  let lastNow = null;
  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    const dt = lastNow == null ? 0 : Math.max(0, Math.min(0.05, (now - lastNow) / 1000));
    lastNow = now;
    if (game.started && !document.hidden) {
      houseDj.update(dt);
      liveBand.update(dt);
      smoking.update(dt);
      photos.update(dt, liveBand.center);
    }
    return baseUpdate(now, movementOverride);
  };

  const baseDispose = game.dispose.bind(game);
  game.dispose = async () => {
    photos.dispose();
    houseDj.dispose();
    liveBand.dispose();
    smoking.dispose();
    return baseDispose();
  };

  return game.partyLife;
}

preparePartyLifeWorld();
patchNpcPhotography();
