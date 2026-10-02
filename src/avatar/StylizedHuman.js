import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const material = (color, options = {}) =>
  new MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.02,
    ...options,
  });

const cast = (mesh) => {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const sphere = (radius, mat, width = 18, height = 12) =>
  cast(new Mesh(new SphereGeometry(radius, width, height), mat));

const capsule = (radius, length, mat, segments = 10) =>
  cast(new Mesh(new CapsuleGeometry(radius, length, 5, segments), mat));

const box = (w, h, d, mat) => cast(new Mesh(new BoxGeometry(w, h, d), mat));

function mergeStaticMeshes(meshes, mat) {
  const geometries = meshes.map((mesh) => {
    mesh.updateMatrix();
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrix);
    return geometry;
  });
  const mergedGeometry = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  for (const mesh of meshes) mesh.geometry.dispose();
  return cast(new Mesh(mergedGeometry, mat));
}

function createHand(skin, side) {
  const hand = new Group();
  const pieces = [];

  const palm = sphere(0.047, skin, 12, 9);
  palm.scale.set(0.78, 1.08, 0.52);
  pieces.push(palm);

  for (let i = 0; i < 4; i++) {
    const finger = capsule(0.0075, 0.045 - i * 0.002, skin, 7);
    finger.scale.set(0.82, 1, 0.7);
    finger.position.set((i - 1.5) * 0.016, -0.05, 0.005);
    finger.rotation.z = (i - 1.5) * 0.025;
    pieces.push(finger);
  }

  const thumb = capsule(0.0095, 0.035, skin, 7);
  thumb.position.set(side * 0.039, -0.012, 0.008);
  thumb.rotation.z = side * 0.72;
  pieces.push(thumb);

  hand.add(mergeStaticMeshes(pieces, skin));
  return hand;
}

function createArm(outfit, skin, side) {
  const shoulder = new Group();

  // Rounded sleeve cap without the old spherical "ball joint" look.
  const sleeveCap = sphere(0.072, outfit, 14, 10);
  sleeveCap.scale.set(0.92, 0.72, 0.82);
  sleeveCap.position.set(0, -0.025, 0);

  const upperSleeve = capsule(0.058, 0.21, outfit, 10);
  upperSleeve.position.y = -0.16;
  upperSleeve.scale.set(0.98, 1, 0.9);

  const elbow = new Group();
  elbow.position.y = -0.315;

  const elbowSkin = sphere(0.048, skin, 12, 8);
  elbowSkin.scale.set(0.9, 0.68, 0.84);

  const forearm = capsule(0.043, 0.19, skin, 9);
  forearm.position.y = -0.13;
  forearm.scale.set(0.94, 1, 0.86);

  const wrist = capsule(0.031, 0.045, skin, 8);
  wrist.position.y = -0.255;

  const hand = createHand(skin, side);
  hand.position.y = -0.31;

  elbow.add(elbowSkin, forearm, wrist, hand);
  shoulder.add(sleeveCap, upperSleeve, elbow);

  return { shoulder, elbow, hand };
}

function createCargoLeg(trousers, shoes, accent, side, cargo = true) {
  const hip = new Group();

  const thigh = capsule(0.09, 0.29, trousers, 11);
  thigh.position.y = -0.205;
  thigh.scale.set(1.08, 1, 0.96);

  hip.add(thigh);
  if (cargo) {
    const cargoPocket = box(0.14, 0.12, 0.04, trousers);
    cargoPocket.position.set(side * 0.075, -0.19, 0.082);
    cargoPocket.rotation.z = side * 0.03;
    const cargoFlap = box(0.145, 0.026, 0.047, accent);
    cargoFlap.position.set(side * 0.075, -0.135, 0.086);
    cargoFlap.rotation.z = side * 0.03;
    hip.add(cargoPocket, cargoFlap);
  }

  const knee = new Group();
  knee.position.y = -0.405;

  const kneeShape = sphere(0.073, trousers, 12, 8);
  kneeShape.scale.set(1, 0.58, 0.9);

  const calf = capsule(0.071, 0.275, trousers, 10);
  calf.position.y = -0.18;
  calf.scale.set(1.05, 1, 0.95);

  const cuff = capsule(0.064, 0.055, trousers, 9);
  cuff.position.y = -0.355;
  cuff.scale.set(1.08, 1, 0.96);

  const foot = new Group();
  foot.position.set(0, -0.405, 0.075);

  const sole = box(0.155, 0.047, 0.265, shoes);
  sole.position.set(0, -0.024, 0.025);

  const upper = sphere(0.086, shoes, 12, 9);
  upper.scale.set(0.86, 0.42, 1.16);
  upper.position.set(0, 0.015, 0.095);

  const toe = sphere(0.078, shoes, 12, 9);
  toe.scale.set(0.92, 0.34, 1.08);
  toe.position.set(0, -0.004, 0.18);

  const outsole = box(0.165, 0.022, 0.28, accent);
  outsole.position.set(0, -0.055, 0.035);

  foot.add(mergeStaticMeshes([sole, upper, toe], shoes), outsole);
  foot.rotation.y = side * 0.018;

  knee.add(kneeShape, calf, cuff, foot);
  hip.add(knee);

  return { hip, knee, foot };
}

function createHair(mat, style) {
  const root = new Group();
  if (style === 'bald') return root;

  const pieces = [];
  const cap = sphere(0.184, mat, 18, 12);
  cap.scale.set(0.98, style === 'buzz' ? 0.26 : 0.46, 0.96);
  cap.position.set(0, 0.145, -0.018);
  pieces.push(cap);

  if (style === 'short' || style === 'textured') {
    for (const [x, y, z, curlScale] of [
      [-0.12, 0.14, 0.01, 0.95],
      [-0.055, 0.17, 0.025, 1.05],
      [0.02, 0.18, 0.03, 1.06],
      [0.095, 0.15, 0.015, 0.98],
      [-0.14, 0.09, 0.025, 0.88],
      [-0.07, 0.11, 0.075, 0.92],
      [0.005, 0.12, 0.085, 0.92],
      [0.08, 0.11, 0.07, 0.9],
      [0.145, 0.08, 0.02, 0.84],
    ]) {
      const curl = sphere(0.058 * curlScale, mat, 10, 7);
      curl.scale.set(1, 0.88, 0.95);
      curl.position.set(x, y, z);
      pieces.push(curl);
    }
  }

  if (style === 'long' || style === 'bob') {
    const back = capsule(0.115, style === 'long' ? 0.46 : 0.245, mat, 10);
    back.scale.set(1.22, 1, 0.5);
    back.position.set(0, style === 'long' ? -0.16 : -0.06, -0.105);
    pieces.push(back);

    for (const side of [-1, 1]) {
      const sideHair = capsule(0.044, style === 'long' ? 0.36 : 0.21, mat, 8);
      sideHair.position.set(side * 0.158, style === 'long' ? -0.12 : -0.045, 0.008);
      pieces.push(sideHair);
    }
  }

  root.add(mergeStaticMeshes(pieces, mat));
  return root;
}

export function createStylizedHuman({
  skin = 0xa97860,
  outfit = 0x25272d,
  trousers = 0x17191f,
  shoes = 0x111318,
  hair = 0x241b18,
  accent = 0x766056,
  hairStyle = 'textured',
  bag = true,
  cargo = true,
  outerwear = false,
  necklace = false,
  scale = 1,
} = {}) {
  const group = new Group();
  group.userData.visualStyle = 'stylized-v2';
  group.userData.stylizedHuman = true;

  const skinMaterial = material(skin, { roughness: 0.63, metalness: 0 });
  const skinSoft = material(skin, { roughness: 0.69, metalness: 0 });
  const outfitMaterial = material(outfit, { roughness: 0.9, metalness: 0.005 });
  const trouserMaterial = material(trousers, { roughness: 0.92, metalness: 0.005 });
  const shoeMaterial = material(shoes, { roughness: 0.58, metalness: 0.025 });
  const hairMaterial = material(hair, { roughness: 0.92, metalness: 0 });
  const accentMaterial = material(accent, { roughness: 0.54, metalness: 0.03 });
  const eyeWhite = material(0xe9e5dc, { roughness: 0.42, metalness: 0 });
  const irisMaterial = material(0x4a392e, { roughness: 0.38, metalness: 0 });
  const pupilMaterial = material(0x101014, { roughness: 0.3, metalness: 0 });
  const lipMaterial = material(0x83594f, { roughness: 0.7, metalness: 0 });

  const body = new Group();
  body.position.y = 1.05;

  // Slimmer, more human torso proportions than the old capsule stack.
  const pelvis = sphere(0.185, trouserMaterial, 16, 11);
  pelvis.position.y = -0.245;
  pelvis.scale.set(1.0, 0.62, 0.78);

  const waist = capsule(0.15, 0.105, outfitMaterial, 11);
  waist.position.y = -0.07;
  waist.scale.set(0.98, 1, 0.74);

  const chest = new Group();
  chest.position.y = 0.115;
  const lodDetails = new Group();
  lodDetails.name = 'stylized-lod-details';
  chest.add(lodDetails);

  const torso = capsule(0.185, 0.235, outfitMaterial, 13);
  torso.scale.set(1.02, 1, 0.73);

  const upperChest = sphere(0.185, outfitMaterial, 16, 11);
  upperChest.position.y = 0.12;
  upperChest.scale.set(1.08, 0.54, 0.75);

  const collar = cast(new Mesh(new TorusGeometry(0.075, 0.009, 6, 16), accentMaterial));
  collar.position.set(0, 0.19, 0.105);
  collar.rotation.x = Math.PI / 2;
  collar.scale.y = 0.78;

  const chestPatch = box(0.09, 0.025, 0.012, accentMaterial);
  chestPatch.position.set(0.055, 0.09, 0.145);

  chest.add(torso, upperChest, collar);
  lodDetails.add(chestPatch);

  if (outerwear) {
    const leftPanel = box(0.115, 0.34, 0.028, accentMaterial);
    leftPanel.position.set(-0.07, -0.015, 0.145);
    leftPanel.rotation.z = 0.035;
    const rightPanel = leftPanel.clone();
    rightPanel.position.x = 0.07;
    rightPanel.rotation.z = -0.035;

    const leftLap = box(0.055, 0.18, 0.022, outfitMaterial);
    leftLap.position.set(-0.055, 0.09, 0.168);
    leftLap.rotation.z = -0.32;
    const rightLap = leftLap.clone();
    rightLap.position.x = 0.055;
    rightLap.rotation.z = 0.32;
    lodDetails.add(leftPanel, rightPanel, leftLap, rightLap);
  }

  if (necklace) {
    const chain = cast(new Mesh(new TorusGeometry(0.083, 0.0045, 5, 18), accentMaterial));
    chain.position.set(0, 0.12, 0.16);
    chain.rotation.x = Math.PI / 2;
    chain.scale.y = 0.85;
    lodDetails.add(chain);
  }

  if (bag) {
    // A small cross-body strap adds a clubwear silhouette without increasing rig complexity.
    const strap = box(0.028, 0.42, 0.012, accentMaterial);
    strap.position.set(-0.025, 0.0, 0.155);
    strap.rotation.z = -0.36;

    const bagBody = box(0.115, 0.085, 0.045, outfitMaterial);
    bagBody.position.set(0.15, -0.16, 0.15);
    bagBody.rotation.z = -0.12;
    lodDetails.add(strap, bagBody);
  }
  body.add(pelvis, waist, chest);

  const neck = capsule(0.055, 0.075, skinMaterial, 10);
  neck.position.y = 1.455;
  neck.scale.set(0.94, 1, 0.88);

  const head = new Group();
  head.position.y = 1.665;

  // Smaller head and flatter face plane than the older NPCs.
  const cranium = sphere(0.183, skinMaterial, 22, 16);
  cranium.name = 'cranium';
  cranium.scale.set(0.9, 1.06, 0.86);

  const jaw = sphere(0.142, skinSoft, 20, 14);
  jaw.name = 'jaw';
  jaw.position.set(0, -0.11, 0.004);
  jaw.scale.set(0.84, 0.68, 0.78);

  const chin = sphere(0.063, skinSoft, 14, 10);
  chin.position.set(0, -0.17, 0.045);
  chin.scale.set(0.82, 0.5, 0.66);

  head.add(cranium, jaw, chin);

  for (const [side, x] of [
    ['left', -0.174],
    ['right', 0.174],
  ]) {
    const ear = sphere(0.034, skinSoft, 10, 7);
    ear.name = `ear-${side}`;
    ear.scale.set(0.45, 1, 0.34);
    ear.position.set(x, -0.005, -0.005);
    head.add(ear);
  }

  for (const x of [-0.058, 0.058]) {
    const white = sphere(0.024, eyeWhite, 12, 8);
    white.scale.set(1.12, 0.56, 0.34);
    white.position.set(x, 0.027, 0.165);

    const iris = sphere(0.0125, irisMaterial, 10, 7);
    iris.name = x < 0 ? 'iris-left' : 'iris-right';
    iris.scale.set(1, 0.82, 0.42);
    iris.position.set(x, 0.027, 0.181);

    const pupil = sphere(0.006, pupilMaterial, 8, 6);
    pupil.name = x < 0 ? 'pupil-left' : 'pupil-right';
    pupil.scale.z = 0.35;
    pupil.position.set(x, 0.027, 0.188);

    const brow = capsule(0.0065, 0.05, hairMaterial, 7);
    brow.position.set(x, 0.074, 0.17);
    brow.rotation.z = Math.PI / 2 + (x < 0 ? -0.06 : 0.06);

    head.add(white, iris, pupil, brow);
  }

  const noseBridge = capsule(0.013, 0.048, skinSoft, 8);
  noseBridge.position.set(0, -0.004, 0.17);
  noseBridge.rotation.x = Math.PI / 2;

  const noseTip = sphere(0.022, skinSoft, 10, 7);
  noseTip.scale.set(0.72, 0.64, 0.86);
  noseTip.position.set(0, -0.04, 0.184);

  const upperLip = sphere(0.033, lipMaterial, 12, 8);
  upperLip.scale.set(1, 0.18, 0.2);
  upperLip.position.set(0, -0.092, 0.16);

  const lowerLip = sphere(0.035, lipMaterial, 12, 8);
  lowerLip.scale.set(1, 0.22, 0.22);
  lowerLip.position.set(0, -0.104, 0.159);

  head.add(noseBridge, noseTip, upperLip, lowerLip);

  const hairModel = createHair(hairMaterial, hairStyle);
  head.add(hairModel);

  const left = createArm(outfitMaterial, skinMaterial, -1);
  const right = createArm(outfitMaterial, skinMaterial, 1);
  left.shoulder.position.set(-0.255, 1.31, 0);
  right.shoulder.position.set(0.255, 1.31, 0);
  left.shoulder.rotation.z = -0.028;
  right.shoulder.rotation.z = 0.028;

  const leftLeg = createCargoLeg(trouserMaterial, shoeMaterial, accentMaterial, -1, cargo);
  const rightLeg = createCargoLeg(trouserMaterial, shoeMaterial, accentMaterial, 1, cargo);
  leftLeg.hip.position.set(-0.105, 0.79, 0);
  rightLeg.hip.position.set(0.105, 0.79, 0);

  group.add(body, neck, head, left.shoulder, right.shoulder, leftLeg.hip, rightLeg.hip);
  group.scale.setScalar(scale);

  return {
    group,
    body,
    chest,
    neck,
    head,
    hair: hairModel,
    lodDetails,
    leftArm: left.shoulder,
    rightArm: right.shoulder,
    leftForearm: left.elbow,
    rightForearm: right.elbow,
    leftHand: left.hand,
    rightHand: right.hand,
    leftLeg: leftLeg.hip,
    rightLeg: rightLeg.hip,
    leftKnee: leftLeg.knee,
    rightKnee: rightLeg.knee,
    leftShoe: leftLeg.foot,
    rightShoe: rightLeg.foot,
    detail: accentMaterial,
    materials: {
      skin: skinMaterial,
      outfit: outfitMaterial,
      trousers: trouserMaterial,
      shoes: shoeMaterial,
      hair: hairMaterial,
      accent: accentMaterial,
    },
  };
}
