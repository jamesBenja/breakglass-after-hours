import { Box3, Euler, Group, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const DEFAULT_IMPORTED_HUMAN_URL = 'https://three.ws/avatars/michelle.glb';

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
];

const RIG_KEYS = [
  'hips',
  'spine',
  'spine1',
  'spine2',
  'neck',
  'head',
  'leftshoulder',
  'leftarm',
  'leftforearm',
  'lefthand',
  'rightshoulder',
  'rightarm',
  'rightforearm',
  'righthand',
  'leftupleg',
  'leftleg',
  'leftfoot',
  'rightupleg',
  'rightleg',
  'rightfoot',
];

const SOCIAL_DANCE_GESTURES = new Set(['dance', 'grind', 'circle']);
const _euler = new Euler();
const _offsetQuat = new Quaternion();
const _targetQuat = new Quaternion();

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function setVisible(objects, visible) {
  for (const object of objects) object.visible = visible;
}

function disposeScene(root) {
  root?.traverse?.((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const key of TEXTURE_KEYS) material[key]?.dispose?.();
      material.dispose?.();
    }
  });
}

function fitToHumanHeight(root, targetHeight) {
  root.updateMatrixWorld(true);
  const initialBox = new Box3().setFromObject(root, true);
  const initialSize = initialBox.getSize(new Vector3());
  if (!Number.isFinite(initialSize.y) || initialSize.y <= 0.001) return false;

  const scale = targetHeight / initialSize.y;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);

  const box = new Box3().setFromObject(root, true);
  const center = box.getCenter(new Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  return true;
}

function normalizeBoneName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/^mixamorig[:_]?/, '')
    .replace(/[^a-z0-9]/g, '');
}

function captureRig(root) {
  const candidates = [];
  root.traverse((object) => {
    if (!object.isBone) return;
    candidates.push({ object, normalized: normalizeBoneName(object.name) });
  });

  const rig = new Map();
  for (const key of RIG_KEYS) {
    const exact = candidates.find((candidate) => candidate.normalized === key);
    const suffix = candidates.find((candidate) => candidate.normalized.endsWith(key));
    const match = exact ?? suffix;
    if (!match) continue;
    rig.set(key, {
      node: match.object,
      restQuaternion: match.object.quaternion.clone(),
      restPosition: match.object.position.clone(),
    });
  }
  return rig;
}

function setBoneTarget(entry, x = 0, y = 0, z = 0, alpha = 1) {
  if (!entry) return;
  _euler.set(x, y, z, 'XYZ');
  _offsetQuat.setFromEuler(_euler);
  _targetQuat.copy(entry.restQuaternion).multiply(_offsetQuat);
  entry.node.quaternion.slerp(_targetQuat, alpha);
}

function idlePose(time) {
  const breath = Math.sin(time * 1.65);
  const glance = Math.sin(time * 0.47);
  return {
    bob: Math.abs(breath) * 0.006,
    bones: {
      hips: [0, breath * 0.018, 0],
      spine: [breath * 0.012, -glance * 0.018, 0],
      spine1: [breath * 0.018, glance * 0.022, 0],
      spine2: [breath * 0.016, 0, glance * 0.012],
      neck: [0, glance * 0.035, 0],
      head: [breath * 0.012, glance * 0.055, 0],
      leftarm: [0.03 + breath * 0.015, 0, -1.08],
      rightarm: [-0.03 - breath * 0.015, 0, 1.08],
      leftforearm: [-0.12, 0, -0.03],
      rightforearm: [-0.12, 0, 0.03],
      leftupleg: [0, 0, 0.025],
      rightupleg: [0, 0, -0.025],
      leftleg: [0.035, 0, 0],
      rightleg: [0.01, 0, 0],
    },
  };
}

function walkPose(time) {
  const gait = Math.sin(time * 7.2);
  const opposite = Math.sin(time * 7.2 + Math.PI);
  const liftLeft = Math.max(0, gait);
  const liftRight = Math.max(0, opposite);
  return {
    bob: Math.abs(Math.sin(time * 7.2)) * 0.024,
    bones: {
      hips: [0, gait * 0.055, gait * 0.018],
      spine: [0, -gait * 0.07, -gait * 0.012],
      spine1: [0, -gait * 0.045, 0],
      spine2: [0, gait * 0.035, 0],
      neck: [0, gait * 0.015, 0],
      head: [0, gait * 0.025, 0],
      leftarm: [gait * 0.48, 0, -1.03],
      rightarm: [-gait * 0.48, 0, 1.03],
      leftforearm: [-0.18 - liftRight * 0.22, 0, -0.03],
      rightforearm: [-0.18 - liftLeft * 0.22, 0, 0.03],
      leftupleg: [-gait * 0.62, 0, 0.02],
      rightupleg: [gait * 0.62, 0, -0.02],
      leftleg: [liftLeft * 0.52, 0, 0],
      rightleg: [liftRight * 0.52, 0, 0],
      leftfoot: [-liftLeft * 0.18, 0, 0],
      rightfoot: [-liftRight * 0.18, 0, 0],
    },
  };
}

function dancePose(time, energy = 0.8) {
  const e = clamp(energy, 0.35, 1);
  const pulse = Math.sin(time * (3.2 + e * 1.4));
  const counter = Math.cos(time * 2.35 + 0.7);
  const bounce = Math.abs(Math.sin(time * (4.1 + e)));
  return {
    bob: bounce * (0.018 + e * 0.03),
    bones: {
      hips: [counter * 0.045, pulse * (0.18 + e * 0.08), pulse * 0.065],
      spine: [pulse * 0.04, -counter * 0.11, counter * 0.07],
      spine1: [-pulse * 0.055, counter * 0.12, -counter * 0.055],
      spine2: [pulse * 0.04, counter * 0.08, pulse * 0.075],
      neck: [-pulse * 0.035, counter * 0.06, 0],
      head: [-pulse * 0.055, counter * 0.095, -counter * 0.035],
      leftarm: [-0.18 + counter * 0.38, pulse * 0.12, -0.62 - pulse * 0.28],
      rightarm: [0.2 - pulse * 0.42, -counter * 0.12, 0.62 + counter * 0.28],
      leftforearm: [-0.62 - Math.max(0, pulse) * 0.42, 0, -0.12],
      rightforearm: [-0.58 - Math.max(0, counter) * 0.46, 0, 0.12],
      leftupleg: [-pulse * 0.22, 0, 0.07],
      rightupleg: [pulse * 0.22, 0, -0.07],
      leftleg: [bounce * 0.18, 0, 0],
      rightleg: [(1 - bounce) * 0.14, 0, 0],
    },
  };
}

function highFivePose(time, progress = 0.5) {
  const envelope = Math.sin(clamp(progress) * Math.PI);
  const settle = Math.sin(time * 9) * 0.035 * envelope;
  return {
    bob: 0,
    bones: {
      hips: [0, -0.035 * envelope, 0],
      spine: [-0.04 * envelope, 0.06 * envelope, 0],
      spine1: [-0.03 * envelope, 0.05 * envelope, 0],
      spine2: [-0.02 * envelope, 0.04 * envelope, 0],
      neck: [-0.04 * envelope, 0.08 * envelope, 0],
      head: [-0.03 * envelope, 0.09 * envelope, 0],
      leftarm: [0.02, 0, -1.08],
      leftforearm: [-0.14, 0, -0.03],
      rightarm: [-0.48 * envelope, -0.16 * envelope, 1.08 - 1.72 * envelope],
      rightforearm: [-0.12 - 0.62 * envelope, 0, 0.06 + settle],
      righthand: [0.08 * envelope, 0, settle],
      leftupleg: [0, 0, 0.025],
      rightupleg: [0, 0, -0.025],
      leftleg: [0.02, 0, 0],
      rightleg: [0.02, 0, 0],
    },
  };
}

export function resolveImportedAnimationState({
  moving = false,
  dancing = false,
  socialGesture = null,
  demoCycle = false,
  time = 0,
} = {}) {
  if (socialGesture === 'highfive') return 'highfive';
  if (moving) return 'walk';
  if (dancing || SOCIAL_DANCE_GESTURES.has(socialGesture)) return 'dance';
  if (!demoCycle) return 'idle';

  const phase = ((time % 18) + 18) % 18;
  if (phase < 4) return 'idle';
  if (phase < 7) return 'walk';
  if (phase < 13) return 'dance';
  if (phase < 15) return 'highfive';
  return 'idle';
}

function demoGestureProgress(time) {
  const phase = ((time % 18) + 18) % 18;
  if (phase < 13 || phase >= 15) return 0.5;
  return clamp((phase - 13) / 2);
}

function poseForState(state, { time, energy, gestureProgress }) {
  if (state === 'walk') return walkPose(time);
  if (state === 'dance') return dancePose(time, energy);
  if (state === 'highfive') return highFivePose(time, gestureProgress);
  return idlePose(time);
}

/**
 * Mount a real skinned GLB over an existing procedural NPC rig.
 *
 * The procedural rig stays alive underneath as a zero-risk fallback. It is hidden only after the
 * imported asset has loaded, scaled and produced a valid bounding box. If loading fails, the
 * existing NPC remains visible and fully functional.
 */
export function attachImportedHumanVisual(
  model,
  {
    url = DEFAULT_IMPORTED_HUMAN_URL,
    targetHeight = 1.78,
    yaw = 0,
    demoCycle = false,
  } = {},
) {
  const fallbackMeshes = [];
  model.group.traverse((object) => {
    if (object.isMesh) fallbackMeshes.push(object);
  });

  const mount = new Group();
  mount.name = 'imported-human-visual';
  mount.userData.importedHumanMount = true;
  model.group.add(mount);

  const controller = {
    state: 'fallback',
    animationState: 'idle',
    url,
    mount,
    scene: null,
    rig: new Map(),
    disposed: false,
    demoCycle,
    update(
      dt,
      {
        time = 0,
        moving = false,
        dancing = false,
        socialGesture = null,
        gestureProgress = null,
        energy = 0,
      } = {},
    ) {
      const resolved = resolveImportedAnimationState({
        moving,
        dancing,
        socialGesture,
        demoCycle: this.demoCycle,
        time,
      });
      this.animationState = resolved;
      model.group.userData.importedAnimationState = resolved;
      if (this.state !== 'ready' || !this.rig.size) return resolved;

      const progress =
        gestureProgress == null && this.demoCycle ? demoGestureProgress(time) : gestureProgress ?? 0.5;
      const pose = poseForState(resolved, {
        time,
        energy,
        gestureProgress: progress,
      });
      const alpha = 1 - Math.exp(-Math.max(0, dt) * 10.5);
      for (const key of RIG_KEYS) {
        const rotation = pose.bones[key] ?? [0, 0, 0];
        setBoneTarget(this.rig.get(key), rotation[0], rotation[1], rotation[2], alpha);
      }
      this.mount.position.y += (pose.bob - this.mount.position.y) * alpha;
      return resolved;
    },
    dispose() {
      this.disposed = true;
      setVisible(fallbackMeshes, true);
      if (this.scene) disposeScene(this.scene);
      this.scene?.removeFromParent?.();
      this.scene = null;
      this.rig.clear();
      this.mount.removeFromParent();
      model.group.userData.importedVisualState = 'disposed';
    },
  };

  model.group.userData.importedVisualUrl = url;
  model.group.userData.importedVisualState = 'fallback';
  model.group.userData.importedAnimationState = 'idle';

  // Node-based unit tests intentionally exercise the fallback without making external requests.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return controller;
  }

  controller.state = 'loading';
  model.group.userData.importedVisualState = 'loading';

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    url,
    (gltf) => {
      if (controller.disposed) {
        disposeScene(gltf.scene);
        return;
      }

      const scene = gltf.scene;
      scene.name = 'imported-human-model';
      scene.rotation.y = yaw;
      scene.updateMatrixWorld(true);

      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = true;
      });

      const rig = captureRig(scene);
      if (rig.size < 10 || !fitToHumanHeight(scene, targetHeight)) {
        disposeScene(scene);
        controller.state = 'fallback';
        model.group.userData.importedVisualState = 'fallback-invalid-rig';
        return;
      }

      mount.add(scene);
      controller.scene = scene;
      controller.rig = rig;
      controller.state = 'ready';
      model.group.userData.visualStyle = 'imported';
      model.group.userData.importedVisualState = 'ready';
      model.group.userData.importedRigBones = rig.size;

      // Put the model into a natural idle before revealing it, so the source GLB's bind/T-pose
      // never flashes on screen.
      controller.update(1, { time: 0, energy: 0 });
      setVisible(fallbackMeshes, false);
    },
    undefined,
    (error) => {
      if (controller.disposed) return;
      controller.state = 'fallback';
      model.group.userData.importedVisualState = 'fallback-load-error';
      console.warn('Imported human visual failed to load; keeping procedural fallback.', error);
    },
  );

  return controller;
}
