import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';

const material = (color, options = {}) =>
  new MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.01,
    ...options,
  });

const cast = (mesh) => {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const sphere = (radius, mat, width = 20, height = 14) =>
  cast(new Mesh(new SphereGeometry(radius, width, height), mat));
const capsule = (radius, length, mat, segments = 12) =>
  cast(new Mesh(new CapsuleGeometry(radius, length, 6, segments), mat));
const box = (w, h, d, mat) => cast(new Mesh(new BoxGeometry(w, h, d), mat));

function armRig(clothing, skin, side) {
  const shoulder = new Group();

  const shoulderCap = sphere(0.092, clothing, 14, 10);
  shoulderCap.scale.set(1.05, 0.9, 0.95);
  shoulderCap.position.y = -0.015;

  const upper = capsule(0.07, 0.23, clothing, 12);
  upper.position.y = -0.17;
  upper.scale.z = 0.92;

  const elbow = new Group();
  elbow.position.y = -0.335;

  const elbowJoint = sphere(0.061, skin, 14, 10);
  elbowJoint.scale.set(0.92, 0.74, 0.88);

  const forearm = capsule(0.054, 0.205, skin, 12);
  forearm.position.y = -0.145;
  forearm.scale.set(0.95, 1, 0.9);

  const wrist = capsule(0.039, 0.045, skin, 10);
  wrist.position.y = -0.285;

  const hand = new Group();
  hand.position.y = -0.34;

  const palm = sphere(0.062, skin, 14, 10);
  palm.scale.set(0.82, 1.05, 0.58);
  hand.add(palm);

  for (let i = 0; i < 4; i++) {
    const finger = capsule(0.011, 0.052 - i * 0.004, skin, 7);
    finger.scale.set(0.8, 1, 0.72);
    finger.position.set((i - 1.5) * 0.021, -0.056, 0.004 + Math.abs(i - 1.5) * 0.002);
    hand.add(finger);
  }

  const thumb = capsule(0.014, 0.043, skin, 7);
  thumb.position.set(side * 0.051, -0.018, 0.012);
  thumb.rotation.z = side * 0.82;
  hand.add(thumb);

  elbow.add(elbowJoint, forearm, wrist, hand);
  shoulder.add(shoulderCap, upper, elbow);

  return { shoulder, elbow, hand };
}

function legRig(trousers, shoes, side) {
  const hip = new Group();

  const thigh = capsule(0.095, 0.31, trousers, 14);
  thigh.position.y = -0.215;
  thigh.scale.set(1.03, 1, 0.92);

  const knee = new Group();
  knee.position.y = -0.425;

  const kneeJoint = sphere(0.081, trousers, 14, 10);
  kneeJoint.scale.set(0.96, 0.72, 0.9);

  const calf = capsule(0.071, 0.285, trousers, 13);
  calf.position.y = -0.19;
  calf.scale.set(0.94, 1, 0.88);

  const ankle = capsule(0.049, 0.075, trousers, 10);
  ankle.position.y = -0.36;

  const foot = new Group();
  foot.position.set(0, -0.42, 0.075);

  const sole = box(0.165, 0.052, 0.29, shoes);
  sole.position.y = -0.026;

  const upper = sphere(0.093, shoes, 14, 10);
  upper.scale.set(0.9, 0.48, 1.15);
  upper.position.set(0, 0.025, 0.095);

  const toe = sphere(0.087, shoes, 14, 10);
  toe.scale.set(0.92, 0.4, 1.06);
  toe.position.set(0, 0.0, 0.18);

  foot.add(sole, upper, toe);
  foot.rotation.y = side * 0.018;

  knee.add(kneeJoint, calf, ankle, foot);
  hip.add(thigh, knee);

  return { hip, knee, foot };
}

function hairRig(mat, style) {
  const root = new Group();
  if (style === 'bald') return root;

  const cap = sphere(0.232, mat, 24, 16);
  cap.scale.set(0.94, style === 'buzz' ? 0.34 : 0.54, 0.94);
  cap.position.set(0, 0.17, -0.01);
  root.add(cap);

  if (style === 'short' || style === 'buzz') {
    for (const [x, y, z, sx, sy, rot] of [
      [-0.12, 0.13, 0.06, 0.78, 0.62, -0.18],
      [0, 0.16, 0.07, 0.9, 0.72, 0],
      [0.12, 0.13, 0.06, 0.78, 0.62, 0.18],
      [-0.17, 0.06, -0.01, 0.58, 0.74, -0.25],
      [0.17, 0.06, -0.01, 0.58, 0.74, 0.25],
    ]) {
      const lock = sphere(0.105, mat, 14, 10);
      lock.scale.set(sx, sy, 0.62);
      lock.position.set(x, y, z);
      lock.rotation.z = rot;
      root.add(lock);
    }
  }

  if (style === 'long' || style === 'bob') {
    const back = capsule(0.145, style === 'long' ? 0.54 : 0.27, mat, 10);
    back.scale.set(1.28, 1, 0.5);
    back.position.set(0, style === 'long' ? -0.19 : -0.06, -0.13);
    root.add(back);

    for (const side of [-1, 1]) {
      const sideHair = capsule(0.055, style === 'long' ? 0.42 : 0.24, mat, 9);
      sideHair.position.set(side * 0.19, style === 'long' ? -0.14 : -0.05, 0.005);
      sideHair.rotation.z = side * 0.05;
      root.add(sideHair);
    }
  }

  return root;
}

export function createReferenceHuman({
  skin = 0xb98264,
  outfit = 0x202329,
  trousers = 0x16191e,
  shoes = 0x111216,
  hair = 0x241b18,
  accent = 0x704e45,
  hairStyle = 'short',
  scale = 1,
} = {}) {
  const group = new Group();
  group.userData.visualStyle = 'reference';
  group.userData.highFidelity = true;

  const skinMaterial = material(skin, { roughness: 0.58, metalness: 0.0 });
  const skinSoft = material(skin, { roughness: 0.66, metalness: 0.0 });
  const outfitMaterial = material(outfit, { roughness: 0.82, metalness: 0.015 });
  const trouserMaterial = material(trousers, { roughness: 0.88, metalness: 0.01 });
  const shoeMaterial = material(shoes, { roughness: 0.56, metalness: 0.03 });
  const hairMaterial = material(hair, { roughness: 0.9, metalness: 0.0 });
  const accentMaterial = material(accent, { roughness: 0.6, metalness: 0.0 });
  const eyeWhite = material(0xece8df, { roughness: 0.34, metalness: 0.0 });
  const irisMaterial = material(0x5d493b, { roughness: 0.28, metalness: 0.0 });
  const pupilMaterial = material(0x0d0d10, { roughness: 0.24, metalness: 0.0 });
  const lipMaterial = material(0x925f58, { roughness: 0.62, metalness: 0.0 });
  const detailMaterial = material(0x2c2422, { roughness: 0.76, metalness: 0.0 });

  const body = new Group();
  body.position.y = 1.05;

  const pelvis = sphere(0.225, trouserMaterial, 20, 14);
  pelvis.position.y = -0.25;
  pelvis.scale.set(1.08, 0.69, 0.82);

  const waist = capsule(0.185, 0.11, outfitMaterial, 14);
  waist.position.y = -0.075;
  waist.scale.set(1.0, 1, 0.74);

  const chest = new Group();
  chest.position.y = 0.12;

  const chestMass = capsule(0.235, 0.205, outfitMaterial, 16);
  chestMass.scale.set(1.08, 1.0, 0.76);

  const leftShoulder = sphere(0.11, outfitMaterial, 16, 12);
  leftShoulder.position.set(-0.22, 0.095, 0);
  leftShoulder.scale.set(1.15, 0.72, 0.82);

  const rightShoulder = leftShoulder.clone();
  rightShoulder.position.x = 0.22;

  const collar = box(0.24, 0.04, 0.028, accentMaterial);
  collar.position.set(0, 0.18, 0.17);
  collar.rotation.x = -0.12;

  chest.add(chestMass, leftShoulder, rightShoulder, collar);
  body.add(pelvis, waist, chest);

  const neck = capsule(0.073, 0.085, skinMaterial, 14);
  neck.position.y = 1.47;
  neck.scale.set(0.96, 1, 0.9);

  const head = new Group();
  head.position.y = 1.69;

  const cranium = sphere(0.224, skinMaterial, 28, 20);
  cranium.name = 'cranium';
  cranium.scale.set(0.91, 1.04, 0.9);

  const jaw = sphere(0.177, skinSoft, 26, 18);
  jaw.name = 'jaw';
  jaw.position.set(0, -0.132, 0.006);
  jaw.scale.set(0.89, 0.72, 0.82);

  const chin = sphere(0.082, skinSoft, 18, 12);
  chin.position.set(0, -0.21, 0.055);
  chin.scale.set(0.82, 0.54, 0.7);

  head.add(cranium, jaw, chin);

  for (const [side, x] of [
    ['left', -0.215],
    ['right', 0.215],
  ]) {
    const ear = sphere(0.048, skinSoft, 16, 12);
    ear.name = `ear-${side}`;
    ear.scale.set(0.46, 1.0, 0.36);
    ear.position.set(x, -0.008, -0.004);
    head.add(ear);
  }

  for (const x of [-0.071, 0.071]) {
    const eyeSocket = sphere(0.04, skinSoft, 16, 10);
    eyeSocket.scale.set(1.2, 0.72, 0.24);
    eyeSocket.position.set(x, 0.028, 0.185);

    const white = sphere(0.032, eyeWhite, 18, 12);
    white.scale.set(1.1, 0.58, 0.34);
    white.position.set(x, 0.028, 0.204);

    const iris = sphere(0.0165, irisMaterial, 16, 10);
    iris.name = x < 0 ? 'iris-left' : 'iris-right';
    iris.scale.set(1, 0.88, 0.42);
    iris.position.set(x, 0.028, 0.225);

    const pupil = sphere(0.0075, pupilMaterial, 14, 9);
    pupil.name = x < 0 ? 'pupil-left' : 'pupil-right';
    pupil.scale.z = 0.36;
    pupil.position.set(x, 0.028, 0.234);

    const brow = capsule(0.009, 0.056, hairMaterial, 8);
    brow.position.set(x, 0.087, 0.205);
    brow.rotation.z = Math.PI / 2 + (x < 0 ? -0.08 : 0.08);

    head.add(eyeSocket, white, iris, pupil, brow);
  }

  const noseBridge = capsule(0.018, 0.065, skinSoft, 10);
  noseBridge.name = 'nose-bridge';
  noseBridge.position.set(0, -0.008, 0.211);
  noseBridge.rotation.x = Math.PI / 2;

  const noseTip = sphere(0.031, skinSoft, 16, 12);
  noseTip.name = 'nose-tip';
  noseTip.scale.set(0.78, 0.68, 0.98);
  noseTip.position.set(0, -0.052, 0.231);

  const nostrilLeft = sphere(0.007, detailMaterial, 10, 7);
  nostrilLeft.scale.set(1, 0.5, 0.42);
  nostrilLeft.position.set(-0.017, -0.061, 0.244);
  const nostrilRight = nostrilLeft.clone();
  nostrilRight.position.x = 0.017;

  const upperLip = sphere(0.045, lipMaterial, 16, 10);
  upperLip.scale.set(1, 0.23, 0.22);
  upperLip.position.set(0, -0.116, 0.202);
  const lowerLip = sphere(0.048, lipMaterial, 16, 10);
  lowerLip.scale.set(1, 0.27, 0.24);
  lowerLip.position.set(0, -0.132, 0.2);

  head.add(noseBridge, noseTip, nostrilLeft, nostrilRight, upperLip, lowerLip);

  const hairModel = hairRig(hairMaterial, hairStyle);
  head.add(hairModel);

  const left = armRig(outfitMaterial, skinMaterial, -1);
  const right = armRig(outfitMaterial, skinMaterial, 1);
  left.shoulder.position.set(-0.32, 1.33, 0);
  right.shoulder.position.set(0.32, 1.33, 0);
  left.shoulder.rotation.z = -0.045;
  right.shoulder.rotation.z = 0.045;

  const leftLeg = legRig(trouserMaterial, shoeMaterial, -1);
  const rightLeg = legRig(trouserMaterial, shoeMaterial, 1);
  leftLeg.hip.position.set(-0.13, 0.78, 0);
  rightLeg.hip.position.set(0.13, 0.78, 0);

  group.add(body, neck, head, left.shoulder, right.shoulder, leftLeg.hip, rightLeg.hip);
  group.scale.setScalar(scale);

  return {
    group,
    body,
    chest,
    neck,
    head,
    hair: hairModel,
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
      hair: hairMaterial,
      accent: accentMaterial,
    },
  };
}
