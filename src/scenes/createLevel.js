import { Scene, Group, Color, Fog, HemisphereLight, DirectionalLight, PointLight } from 'three';
import { CollisionWorld } from '../collision/CollisionWorld.js';
import {
  constrainCrowdPositions,
  constrainNpcPositions,
  snapshotCrowdPositions,
  snapshotNpcPositions,
} from '../collision/CharacterCollisionGuard.js';
import { NpcSystem } from '../npcs/NpcSystem.js';
import { CrowdSystem } from '../crowd/CrowdSystem.js';
import { LightingRig } from '../lighting/LightingRig.js';
import { AlleySystem } from '../alley/AlleySystem.js';
import { RoofSystem } from '../roof/RoofSystem.js';
import { CompanionMaddoxSystem } from '../pets/CompanionMaddoxSystem.js';
import { ProgressionGateSystem } from '../gameplay/ProgressionGateSystem.js';
import { disposeObject } from './disposeObject.js';

export async function createLevel(definition, builders, assets) {
  const scene = new Scene();
  scene.name = definition.id;
  scene.background = new Color(definition.background);
  scene.fog = new Fog(definition.background, ...definition.fog);
  const ambient = new HemisphereLight(0xbec5d0, 0x16120e, 1.45);
  const key = new DirectionalLight(0xffffff, 2);
  key.position.set(8, 18, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -24;
  key.shadow.camera.right = key.shadow.camera.top = 24;
  key.shadow.camera.far = 65;
  key.shadow.normalBias = 0.035;
  scene.add(ambient, key);
  for (const light of definition.lights ?? []) {
    const point = new PointLight(light.color, light.intensity, light.distance, 2);
    point.position.fromArray(light.position);
    scene.add(point);
  }

  const architecture = new Group();
  architecture.name = `${definition.id}:architecture`;
  const gameplay = new Group();
  gameplay.name = `${definition.id}:gameplay`;
  const fixtures = new Group();
  fixtures.name = `${definition.id}:fixtures`;
  scene.add(architecture, fixtures, gameplay);
  const model = await assets.model(definition.model);
  if (model) architecture.add(model);
  else builders.architecture(architecture, definition);
  if (!model || !assets.manifest[definition.model].includesFixtures)
    builders.fixtures(fixtures, definition);

  const collision = new CollisionWorld(definition.navigation);
  const progressionGates = definition.progressionGates?.length
    ? new ProgressionGateSystem(gameplay, collision, definition.progressionGates)
    : null;
  const npcs = new NpcSystem(gameplay, definition);
  const crowd = definition.crowd ? new CrowdSystem(gameplay, definition.crowd) : null;
  const lighting = definition.lightingRig ? new LightingRig(scene, definition.lightingRig) : null;
  const alley = definition.alleySystem ? new AlleySystem(gameplay, definition.alleySystem) : null;
  const roof = definition.roofSystem ? new RoofSystem(gameplay, definition.roofSystem) : null;
  const maddox = definition.maddox ? new CompanionMaddoxSystem(gameplay, definition.maddox) : null;
  const tapeReels = [];
  fixtures.traverse((object) => {
    if (object.userData?.tapeReel === true) tapeReels.push(object);
  });

  return {
    scene,
    definition,
    architecture,
    fixtures,
    gameplay,
    collision,
    progressionGates,
    npcs,
    crowd,
    lighting,
    alley,
    roof,
    maddox,
    geometrySource: model ? 'model' : 'blockout',
    update(dt, audio, playerPosition = null) {
      const metrics =
        typeof audio?.metrics === 'function'
          ? audio.metrics()
          : {
              playing: !!audio?.playing,
              energy: audio?.playing ? 0.5 : 0,
              bass: audio?.playing ? 0.5 : 0,
              beat: 0,
            };

      const npcPositions = snapshotNpcPositions(npcs);
      const crowdPositions = crowd ? snapshotCrowdPositions(crowd) : null;
      npcs.update(dt, metrics);
      constrainNpcPositions(collision, npcs, npcPositions);
      crowd?.update(dt, metrics);
      if (crowd && constrainCrowdPositions(collision, crowd, crowdPositions)) {
        // Rebuild the instanced silhouettes at their resolved positions without advancing the
        // simulation a second time. This prevents even a one-frame visual poke through a wall.
        crowd.update(0, metrics);
      }
      lighting?.update(dt, metrics);
      alley?.update(dt, metrics);
      roof?.update(dt, metrics);
      maddox?.update(dt, metrics, playerPosition);

      const tapePlaying = audio?.externalTransports?.has?.('archive') === true;
      if (tapePlaying) {
        for (const reel of tapeReels) {
          const direction = Number(reel.userData.tapeDirection) || 1;
          const speed = Number(reel.userData.tapeSpeed) || 6.4;
          reel.rotation.z += dt * speed * direction;
        }
      }
    },
    dispose() {
      maddox?.dispose();
      progressionGates?.dispose();
      roof?.dispose();
      alley?.dispose();
      lighting?.dispose();
      crowd?.dispose();
      npcs.dispose();
      disposeObject(scene);
    },
  };
}
