import { AnimationMixer, Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

/**
 * Mount a real skinned GLB over an existing procedural NPC rig.
 *
 * The procedural rig stays alive underneath as a zero-risk fallback. It is hidden only after the
 * imported asset has loaded, scaled and produced a valid bounding box. If loading fails, the
 * existing NPC remains visible and fully functional.
 */
export function attachImportedHumanVisual(
  model,
  { url = DEFAULT_IMPORTED_HUMAN_URL, targetHeight = 1.78, yaw = 0, poseTime = 0.25 } = {},
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
    url,
    mount,
    scene: null,
    mixer: null,
    disposed: false,
    dispose() {
      this.disposed = true;
      setVisible(fallbackMeshes, true);
      if (this.scene) disposeScene(this.scene);
      this.scene?.removeFromParent?.();
      this.scene = null;
      this.mixer?.stopAllAction?.();
      this.mixer = null;
      this.mount.removeFromParent();
      model.group.userData.importedVisualState = 'disposed';
    },
  };

  model.group.userData.importedVisualUrl = url;
  model.group.userData.importedVisualState = 'fallback';

  // Node-based unit tests intentionally exercise the fallback without making external requests.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return controller;
  }

  controller.state = 'loading';
  model.group.userData.importedVisualState = 'loading';

  const loader = new GLTFLoader();
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

      for (const object of scene.children) object.updateMatrixWorld?.(true);
      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = true;
      });

      if (gltf.animations?.length) {
        const clip = gltf.animations[0];
        const mixer = new AnimationMixer(scene);
        const action = mixer.clipAction(clip);
        action.play();
        mixer.setTime(Math.min(Math.max(0, poseTime), Math.max(0, clip.duration - 0.001)));
        mixer.update(0);
        action.paused = true;
        controller.mixer = mixer;
      }

      // Fit after applying the frozen rig pose so the visible feet, not the bind pose, sit on grade.
      if (!fitToHumanHeight(scene, targetHeight)) {
        controller.mixer?.stopAllAction?.();
        controller.mixer = null;
        disposeScene(scene);
        controller.state = 'fallback';
        model.group.userData.importedVisualState = 'fallback-invalid-bounds';
        return;
      }

      mount.add(scene);
      setVisible(fallbackMeshes, false);

      controller.scene = scene;
      controller.state = 'ready';
      model.group.userData.visualStyle = 'imported';
      model.group.userData.importedVisualState = 'ready';
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
