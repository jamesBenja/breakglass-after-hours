import { Scene, Group, Color, Fog, HemisphereLight, DirectionalLight, PointLight } from 'three';
import { CollisionWorld } from '../collision/CollisionWorld.js';
import { NpcSystem } from '../npcs/NpcSystem.js';
import { LightingRig } from '../lighting/LightingRig.js';
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
  const npcs = new NpcSystem(gameplay, definition);
  const lighting = definition.lightingRig ? new LightingRig(scene, definition.lightingRig) : null;
  return {
    scene,
    definition,
    architecture,
    fixtures,
    gameplay,
    collision,
    npcs,
    lighting,
    geometrySource: model ? 'model' : 'blockout',
    update(dt, audio) {
      const metrics =
        typeof audio?.metrics === 'function'
          ? audio.metrics()
          : { playing: !!audio?.playing, energy: audio?.playing ? 0.5 : 0, bass: audio?.playing ? 0.5 : 0, beat: 0 };
      npcs.update(dt, metrics);
      lighting?.update(dt, metrics);
    },
    dispose() {
      lighting?.dispose();
      npcs.dispose();
      disposeObject(scene);
    },
  };
}
