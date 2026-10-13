import { AnimationClip, AnimationMixer, Box3, Group, LoopRepeat, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const DEFAULT_IMPORTED_HUMAN_URL = 'https://three.ws/avatars/michelle.glb';

const AUTHORED_CLIP_SETS = {
  feminine: {
    idle: 'https://three.ws/animations/clips/idle.json',
    walk: 'https://three.ws/animations/clips/av-walk-feminine.json',
    dance: 'https://three.ws/animations/clips/michelle-samba-dance.json',
  },
  neutral: {
    idle: 'https://three.ws/animations/clips/idle.json',
    walk: 'https://three.ws/animations/clips/walk.json',
    dance: 'https://three.ws/animations/clips/av-dance-shuffle.json',
  },
};

const SOURCE_CLIP_PROMISES = new Map();

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

const SOURCE_REST = {
  head: [-0.11706881878098431, 9.438845082943482e-9, 3.72654613409334e-8, 0.993123804804428],
  hips: [0.0010741148761599644, 6.537898515070053e-8, 7.022659074474357e-11, 0.9999994231384476],
  leftarm: [-0.003089573263103852, 0.08018148459223169, -0.025041829737156785, 0.9964608827384491],
  leftfoot: [0.5523737034239063, 0.0002518875693487157, 0.0036538113016644914, 0.8335885543726441],
  leftforearm: [
    -2.6826767953574183e-7, 1.2816740072681333e-7, 0.012369379808617674, 0.9999234962951223,
  ],
  lefthand: [
    -0.0012910117424963744, 0.002537815819541244, 0.010116448936771993, 0.9999447735952517,
  ],
  leftleg: [
    -0.022987686472704008, -0.0006608912898930547, 0.00007960712093047862, 0.9997355266049326,
  ],
  leftshoulder: [0.5181706903502131, 0.5134387363832796, -0.48299308003518876, 0.4843526489955184],
  leftupleg: [
    -0.00004952055077835167, 0.0032567616062252223, 0.9999946186652781, -0.00039203576089550014,
  ],
  neck: [0.2225107795455935, -2.3352293238692193e-7, -1.9647139012020554e-8, 0.974930229804142],
  rightarm: [-0.003089570938390283, -0.08018164882954634, 0.025041835809991725, 0.9964608693782484],
  rightfoot: [
    0.5523737112340288, -0.00025188760500252676, -0.0036538107149212758, 0.8335885491999105,
  ],
  rightforearm: [
    -2.706717415294191e-7, 6.0675494372234465e-9, -0.012369382961452784, 0.9999234962561284,
  ],
  righthand: [
    -0.0012910114923260908, -0.002537815924782367, -0.010116450486313036, 0.9999447735796301,
  ],
  rightleg: [
    -0.022987685898989207, 0.0006609402907891899, -0.00007960698692017099, 0.9997355265857409,
  ],
  rightshoulder: [0.5181706006117709, -0.5134387953473804, 0.4829931766210871, 0.4843525890882128],
  rightupleg: [
    0.000049438593286575395, 0.003256759408127677, 0.9999946186765544, 0.0003920356017771739,
  ],
  spine: [
    -0.018332562694809717, -1.4544833124647894e-7, 2.6976261645093277e-10, 0.9998319444511763,
  ],
  spine1: [-0.03815628571181615, 2.0010687323521798e-8, 5.34807122500512e-9, 0.9992717837809081],
  spine2: [
    -0.056998031890724846, 1.3546308636882866e-7, -8.861325315468363e-10, 0.9983742907149431,
  ],
};

const SOURCE_WORLD_REST = {
  head: [-0.005402766806732544, -1.5440620455356296e-7, 8.34223242528311e-10, 0.9999854049488961],
  hips: [0.0010741148761599644, 6.537898515070053e-8, 7.022659074474357e-11, 0.9999994231384476],
  leftarm: [0.4889318420664182, 0.5108287295941205, -0.5108290884863605, 0.48893078190839623],
  leftfoot: [
    -0.00007112359875637768, 0.5349085331963127, 0.8448985998862468, -0.004383145577274271,
  ],
  leftforearm: [0.49521300584988104, 0.5047420653526237, -0.5047420379230214, 0.4952120815979495],
  lefthand: [0.5009334720626235, 0.5016127781291206, -0.4977959877649929, 0.49964931327533474],
  leftleg: [
    0.0006202111480182034, -0.020805293540463354, 0.9997832430476497, -0.00047118992773536965,
  ],
  leftshoulder: [0.4605450937998788, 0.4559956590278878, -0.537559006794696, 0.5394409087622226],
  leftupleg: [
    -0.00004987623525000119, 0.0021826506059020026, 0.9999975399461294, -0.00039198262713485737,
  ],
  neck: [0.11170149382802401, -1.628868597421303e-7, -1.8309282630496044e-8, 0.9937418056399563],
  rightarm: [0.48893190585215524, -0.510828798312402, 0.5108290283825504, 0.48893071200502375],
  rightfoot: [0.00007112360405196955, 0.5349085398019146, 0.844898595705669, 0.004383145306035045],
  rightforearm: [0.4952130023257164, -0.5047420673116668, 0.5047420415306929, 0.49521208229448166],
  righthand: [0.5009334695181179, -0.5016127792807403, 0.49779599067075153, 0.49964931459617906],
  rightleg: [
    -0.0006202113471683521, -0.020805295090456907, 0.9997832430151556, 0.00047119017271936915,
  ],
  rightshoulder: [
    0.46054507521936333, -0.45599564278848104, 0.5375590232993736, 0.5394409245169026,
  ],
  rightupleg: [
    0.000049925034443819034, 0.002182648459062353, 0.9999975399486299, 0.00039198198974856475,
  ],
  spine: [-0.017258617754264162, -8.00818266828763e-8, 1.3823133775055108e-9, 0.9998510589648868],
  spine1: [-0.055396652424023016, -5.997624651397324e-8, 3.32759956947242e-9, 0.9984644264570511],
  spine2: [-0.11221710079276989, 7.513757486198981e-8, -8.485311473269302e-9, 0.9936837134066652],
};

const SOCIAL_DANCE_GESTURES = new Set(['dance', 'grind', 'circle']);

const _sourceRest = new Quaternion();
const _sourceWorldRest = new Quaternion();
const _targetRest = new Quaternion();
const _targetWorldRest = new Quaternion();
const _leftCorrection = new Quaternion();
const _rightCorrection = new Quaternion();
const _sampleQuaternion = new Quaternion();
const _groupWorldPosition = new Vector3();
const _groupWorldScale = new Vector3();
const _identityQuaternion = new Quaternion();

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

function worldRestQuaternion(node, root) {
  const out = node.quaternion.clone();
  for (let parent = node.parent; parent && parent !== root; parent = parent.parent) {
    out.premultiply(parent.quaternion);
  }
  return out;
}

export function poseImportedSkeletonsToBind(root) {
  if (!root?.traverse) return 0;

  const seen = new Set();
  root.traverse((object) => {
    const skeleton = object?.isSkinnedMesh ? object.skeleton : null;
    if (!skeleton?.bones?.length || seen.has(skeleton)) return;
    if (skeleton.boneInverses?.length !== skeleton.bones.length) return;
    seen.add(skeleton);
    skeleton.pose();
  });

  if (seen.size) root.updateMatrixWorld(true);
  return seen.size;
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
      restWorldQuaternion: worldRestQuaternion(match.object, root),
    });
  }
  return rig;
}

function retargetQuaternionClip(sourceClip, rig, name) {
  const tracks = [];

  for (const track of sourceClip.tracks) {
    const dot = track.name.indexOf('.');
    if (dot < 0) continue;
    const property = track.name.slice(dot + 1);
    if (property !== 'quaternion') continue;

    const key = normalizeBoneName(track.name.slice(0, dot));
    const entry = rig.get(key);
    const sourceRest = SOURCE_REST[key];
    const sourceWorldRest = SOURCE_WORLD_REST[key];
    if (!entry || !sourceRest || !sourceWorldRest) continue;

    _sourceRest.fromArray(sourceRest);
    _sourceWorldRest.fromArray(sourceWorldRest);
    _targetRest.copy(entry.restQuaternion);
    _targetWorldRest.copy(entry.restWorldQuaternion);

    // World-delta preserving bind correction:
    // q' = L * q * R
    // L = Rt * WT^-1 * WS * Rs^-1
    // R = WS^-1 * WT
    _leftCorrection
      .copy(_targetRest)
      .multiply(_targetWorldRest.clone().invert())
      .multiply(_sourceWorldRest)
      .multiply(_sourceRest.clone().invert());
    _rightCorrection.copy(_sourceWorldRest).invert().multiply(_targetWorldRest);

    const next = track.clone();
    next.name = `${entry.node.name}.quaternion`;
    for (let index = 0; index < next.values.length; index += 4) {
      _sampleQuaternion.set(
        next.values[index],
        next.values[index + 1],
        next.values[index + 2],
        next.values[index + 3],
      );
      _sampleQuaternion.premultiply(_leftCorrection).multiply(_rightCorrection).normalize();
      next.values[index] = _sampleQuaternion.x;
      next.values[index + 1] = _sampleQuaternion.y;
      next.values[index + 2] = _sampleQuaternion.z;
      next.values[index + 3] = _sampleQuaternion.w;
    }
    tracks.push(next);
  }

  if (tracks.length < 10) {
    throw new Error(`Animation ${name} matched only ${tracks.length} humanoid bones`);
  }

  const clip = sourceClip.clone();
  clip.name = name;
  clip.tracks = tracks;
  return clip;
}

function sourceClipForUrl(url) {
  if (!SOURCE_CLIP_PROMISES.has(url)) {
    SOURCE_CLIP_PROMISES.set(
      url,
      fetch(url, { mode: 'cors', credentials: 'omit' }).then(async (response) => {
        if (!response.ok) throw new Error(`animation HTTP ${response.status}: ${url}`);
        return AnimationClip.parse(await response.json());
      }),
    );
  }
  return SOURCE_CLIP_PROMISES.get(url);
}

async function loadAuthoredClips(rig, clipSet = 'feminine') {
  const urls = AUTHORED_CLIP_SETS[clipSet] ?? AUTHORED_CLIP_SETS.feminine;
  const results = await Promise.all(
    Object.entries(urls).map(async ([state, url]) => {
      const sourceClip = await sourceClipForUrl(url);
      return [state, retargetQuaternionClip(sourceClip, rig, state)];
    }),
  );
  return new Map(results);
}

function groundImportedVisual(controller, model, alpha = 1) {
  if (!controller.scene) return;
  controller.scene.updateMatrixWorld(true);
  controller.groundBox.setFromObject(controller.scene, true);
  if (!Number.isFinite(controller.groundBox.min.y)) return;

  model.group.getWorldPosition(_groupWorldPosition);
  model.group.getWorldScale(_groupWorldScale);
  const scaleY = Math.max(1e-5, Math.abs(_groupWorldScale.y));
  const worldError = _groupWorldPosition.y - controller.groundBox.min.y;
  const localError = clamp(worldError / scaleY, -0.1, 0.1);
  controller.mount.position.y += localError * alpha;
}

function applyRelativeBoneOffset(entry, axis, angle, weight) {
  if (!entry || weight <= 0) return;
  const offset = new Quaternion().setFromAxisAngle(axis, angle);
  const weighted = _identityQuaternion.clone().slerp(offset, clamp(weight));
  entry.node.quaternion.multiply(weighted).normalize();
}

function applyHighFiveOverlay(rig, progress) {
  const envelope = Math.sin(clamp(progress) * Math.PI);
  if (envelope <= 0.001) return;

  // The social high-five remains a lightweight overlay for now; the locomotion/dance body motion
  // underneath comes from authored animation. Keeping this isolated avoids reintroducing the
  // hand-authored shoulder/elbow problem into walking.
  applyRelativeBoneOffset(rig.get('rightarm'), new Vector3(0, 0, 1), -0.85, envelope);
  applyRelativeBoneOffset(rig.get('rightarm'), new Vector3(1, 0, 0), -0.5, envelope);
  applyRelativeBoneOffset(rig.get('rightforearm'), new Vector3(1, 0, 0), -0.72, envelope);
  applyRelativeBoneOffset(rig.get('righthand'), new Vector3(0, 0, 1), 0.16, envelope);
  applyRelativeBoneOffset(rig.get('spine2'), new Vector3(0, 1, 0), 0.08, envelope);
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

function setAuthoredState(controller, requestedState) {
  const authoredState = requestedState === 'highfive' ? 'idle' : requestedState;
  if (controller.activeAuthoredState === authoredState) return;

  const next = controller.actions.get(authoredState);
  if (!next) return;

  next.reset();
  next.enabled = true;
  next.setLoop(LoopRepeat, Infinity);
  next.setEffectiveWeight(1);
  next.setEffectiveTimeScale(authoredState === 'walk' ? 1.05 : 1);
  next.fadeIn(0.22);
  next.play();

  if (controller.activeAction && controller.activeAction !== next) {
    controller.activeAction.fadeOut(0.22);
  }

  controller.activeAction = next;
  controller.activeAuthoredState = authoredState;
}

/**
 * Mount a real skinned GLB over an existing procedural NPC rig.
 *
 * The old procedural NPC stays visible until BOTH the model and authored animation clips are ready.
 * If either load fails, the existing character remains in place rather than exposing a T-pose or a
 * partially-retargeted rig.
 */
export function attachImportedHumanVisual(
  model,
  {
    url = DEFAULT_IMPORTED_HUMAN_URL,
    targetHeight = 1.78,
    yaw = 0,
    demoCycle = false,
    clipSet = 'feminine',
    animationMode = 'authored',
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
    mixer: null,
    actions: new Map(),
    activeAction: null,
    activeAuthoredState: null,
    groundBox: new Box3(),
    disposed: false,
    demoCycle,
    animationMode,
    update(
      dt,
      {
        time = 0,
        moving = false,
        dancing = false,
        socialGesture = null,
        gestureProgress = null,
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
      if (this.state === 'ready-static') return 'idle';
      if (this.state !== 'ready' || !this.mixer || !this.actions.size) return resolved;

      setAuthoredState(this, resolved);
      this.mixer.update(Math.max(0, dt));

      if (resolved === 'highfive') {
        const progress =
          gestureProgress == null && this.demoCycle
            ? demoGestureProgress(time)
            : (gestureProgress ?? 0.5);
        applyHighFiveOverlay(this.rig, progress);
      }

      groundImportedVisual(this, model, 1);
      return resolved;
    },
    dispose() {
      this.disposed = true;
      setVisible(fallbackMeshes, true);
      this.mixer?.stopAllAction?.();
      this.actions.clear();
      this.activeAction = null;
      this.activeAuthoredState = null;
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
  model.group.userData.importedAnimationMode = animationMode;
  model.group.userData.importedAnimationSource =
    animationMode === 'static'
      ? 'source-pose'
      : animationMode === 'bind-authored'
        ? 'skin-bind-retarget'
        : 'authored-clips';

  // Node-based unit tests intentionally exercise the fallback without making external requests.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return controller;
  }

  controller.state = 'loading-model';
  model.group.userData.importedVisualState = 'loading-model';

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    url,
    async (gltf) => {
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

      if (animationMode === 'bind-authored') {
        const posedSkeletons = poseImportedSkeletonsToBind(scene);
        if (!posedSkeletons) {
          disposeScene(scene);
          controller.state = 'fallback';
          model.group.userData.importedVisualState = 'fallback-bind-pose-unavailable';
          return;
        }
        model.group.userData.importedBindPoseSkeletons = posedSkeletons;
      }

      const rig = captureRig(scene);
      if (rig.size < 10 || !fitToHumanHeight(scene, targetHeight)) {
        disposeScene(scene);
        controller.state = 'fallback';
        model.group.userData.importedVisualState = 'fallback-invalid-rig';
        return;
      }

      // Some otherwise-good humanoid GLBs are authored in a deliberate non-neutral pose.
      // Retargeting a canonical locomotion library onto that pose can preserve a large shoulder
      // twist as the new "rest" frame. Keep the high-quality mesh in its coherent source pose
      // instead of exposing mangled limbs or dropping all the way to the procedural fallback.
      if (animationMode === 'static') {
        mount.add(scene);
        controller.scene = scene;
        controller.rig = rig;
        controller.state = 'ready-static';
        model.group.userData.visualStyle = 'imported';
        model.group.userData.importedVisualState = 'ready-static';
        model.group.userData.importedRigBones = rig.size;
        groundImportedVisual(controller, model, 1);
        setVisible(fallbackMeshes, false);
        return;
      }

      controller.state = 'loading-animation';
      model.group.userData.importedVisualState = 'loading-animation';

      try {
        const clips = await loadAuthoredClips(rig, clipSet);
        if (controller.disposed) {
          disposeScene(scene);
          return;
        }

        mount.add(scene);
        const mixer = new AnimationMixer(scene);
        const actions = new Map();
        for (const [state, clip] of clips) {
          const action = mixer.clipAction(clip);
          action.enabled = true;
          action.clampWhenFinished = false;
          action.setLoop(LoopRepeat, Infinity);
          actions.set(state, action);
        }

        controller.scene = scene;
        controller.rig = rig;
        controller.mixer = mixer;
        controller.actions = actions;
        controller.state = 'ready';

        model.group.userData.visualStyle = 'imported';
        model.group.userData.importedVisualState = 'ready';
        model.group.userData.importedRigBones = rig.size;
        model.group.userData.importedAuthoredClips = [...clips.keys()];
        model.group.userData.importedClipSet = clipSet;

        setAuthoredState(controller, 'idle');
        mixer.update(1 / 60);
        groundImportedVisual(controller, model, 1);
        setVisible(fallbackMeshes, false);
      } catch (error) {
        disposeScene(scene);
        controller.state = 'fallback';
        model.group.userData.importedVisualState = 'fallback-animation-load-error';
        console.warn(
          'Imported human animations failed to load; keeping procedural fallback.',
          error,
        );
      }
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
