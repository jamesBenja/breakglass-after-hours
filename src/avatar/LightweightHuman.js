import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';

const material = (color, options = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.025, ...options });

const cast = (mesh) => {
  mesh.castShadow = true;
  return mesh;
};

const sphere = (radius, mat, width = 11, height = 8) =>
  cast(new Mesh(new SphereGeometry(radius, width, height), mat));
const capsule = (radius, length, mat, segments = 7) =>
  cast(new Mesh(new CapsuleGeometry(radius, length, 4, segments), mat));
const box = (w, h, d, mat) => cast(new Mesh(new BoxGeometry(w, h, d), mat));

function armRig(clothing, skin, side) {
  const shoulder = new Group();
  const upper = capsule(0.064, 0.235, clothing);
  upper.position.y = -0.16;
  const elbow = new Group();
  elbow.position.y = -0.33;
  const elbowJoint = sphere(0.058, skin, 8, 6);
  elbowJoint.scale.y = 0.72;
  const forearm = capsule(0.052, 0.21, skin);
  forearm.position.y = -0.14;
  const hand = sphere(0.062, skin, 8, 6);
  hand.scale.set(0.78, 1.05, 0.62);
  hand.position.y = -0.31;
  const thumb = capsule(0.017, 0.045, skin, 5);
  thumb.position.set(side * 0.047, -0.3, 0.01);
  thumb.rotation.z = side * 0.7;
  elbow.add(elbowJoint, forearm, hand, thumb);
  shoulder.add(upper, elbow);
  return { shoulder, elbow, hand };
}

function legRig(trousers, shoes, side) {
  const hip = new Group();
  const upper = capsule(0.085, 0.31, trousers);
  upper.position.y = -0.21;
  const knee = new Group();
  knee.position.y = -0.42;
  const joint = sphere(0.078, trousers, 8, 6);
  joint.scale.y = 0.68;
  const lower = capsule(0.069, 0.28, trousers);
  lower.position.y = -0.18;
  const foot = new Group();
  foot.position.set(0, -0.395, 0.075);
  const sole = box(0.16, 0.065, 0.27, shoes);
  const toe = sphere(0.087, shoes, 8, 6);
  toe.scale.set(0.9, 0.38, 1.02);
  toe.position.set(0, 0, 0.135);
  foot.add(sole, toe);
  foot.rotation.y = side * 0.015;
  knee.add(joint, lower, foot);
  hip.add(upper, knee);
  return { hip, knee, foot };
}

function hairRig(mat, style) {
  const root = new Group();
  if (style === 'bald') return root;
  const cap = sphere(0.235, mat, 10, 7);
  cap.scale.set(0.96, style === 'buzz' ? 0.25 : 0.5, 0.96);
  cap.position.y = 0.17;
  root.add(cap);
  if (style === 'long' || style === 'bob') {
    const back = capsule(0.15, style === 'long' ? 0.55 : 0.27, mat, 6);
    back.scale.set(1.3, 1, 0.54);
    back.position.set(0, style === 'long' ? -0.2 : -0.07, -0.12);
    const left = capsule(0.05, style === 'long' ? 0.42 : 0.24, mat, 5);
    const right = left.clone();
    left.position.set(-0.195, style === 'long' ? -0.15 : -0.05, 0.01);
    right.position.set(0.195, style === 'long' ? -0.15 : -0.05, 0.01);
    root.add(back, left, right);
  }
  return root;
}

export function createLightweightHuman({
  skin = 0xaa785d,
  outfit = 0x24262c,
  trousers = 0x202228,
  shoes = 0x121318,
  hair = 0x201917,
  accent = 0x777777,
  hairStyle = 'short',
  scale = 1,
} = {}) {
  const group = new Group();
  const skinMaterial = material(skin, { roughness: 0.74 });
  const outfitMaterial = material(outfit);
  const trouserMaterial = material(trousers, { roughness: 0.86 });
  const shoeMaterial = material(shoes, { roughness: 0.74 });
  const hairMaterial = material(hair, { roughness: 0.9 });
  const accentMaterial = material(accent, { roughness: 0.58 });
  const eyeWhite = material(0xf2efe8, { roughness: 0.5 });
  const pupilMaterial = material(0x171419, { roughness: 0.45 });

  const body = new Group();
  body.position.y = 1.05;
  const pelvis = sphere(0.22, trouserMaterial);
  pelvis.position.y = -0.25;
  pelvis.scale.set(1.1, 0.66, 0.8);
  const waist = capsule(0.19, 0.12, outfitMaterial);
  waist.position.y = -0.08;
  waist.scale.z = 0.76;
  const chest = capsule(0.23, 0.2, outfitMaterial);
  chest.position.y = 0.14;
  chest.scale.set(1.08, 1, 0.77);
  body.add(pelvis, waist, chest);

  const neck = capsule(0.071, 0.08, skinMaterial);
  neck.position.y = 1.47;
  const head = new Group();
  head.position.y = 1.69;
  const cranium = sphere(0.225, skinMaterial, 14, 10);
  cranium.scale.set(0.93, 1.04, 0.92);
  const jaw = sphere(0.175, skinMaterial, 12, 9);
  jaw.position.y = -0.13;
  jaw.scale.set(0.9, 0.7, 0.84);
  head.add(cranium, jaw);

  for (const x of [-0.072, 0.072]) {
    const white = sphere(0.031, eyeWhite, 8, 6);
    white.scale.set(1.12, 0.62, 0.36);
    white.position.set(x, 0.03, 0.201);
    const pupil = sphere(0.011, pupilMaterial, 7, 5);
    pupil.scale.z = 0.45;
    pupil.position.set(x, 0.03, 0.225);
    head.add(white, pupil);
    const brow = box(0.071, 0.012, 0.014, hairMaterial);
    brow.position.set(x, 0.087, 0.207);
    brow.rotation.z = x < 0 ? -0.08 : 0.08;
    head.add(brow);
  }
  const nose = sphere(0.031, skinMaterial, 8, 6);
  nose.scale.set(0.75, 0.75, 0.9);
  nose.position.set(0, -0.044, 0.226);
  const mouth = box(0.077, 0.011, 0.014, accentMaterial);
  mouth.position.set(0, -0.116, 0.188);
  head.add(nose, mouth);
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

export function poseLightweightHuman(model, {
  time = 0,
  phase = 0,
  moving = false,
  dancing = false,
  energy = 0,
  reach = 0,
} = {}) {
  const gait = Math.sin(time * (moving ? 7.3 : 2.4) + phase);
  const amount = moving ? 0.48 : dancing ? 0.14 + energy * 0.24 : 0;
  const bob = moving ? Math.abs(gait) * 0.018 : dancing ? Math.abs(gait) * (0.012 + energy * 0.025) : 0;

  model.body.position.y = 1.05 + bob;
  model.neck.position.y = 1.47 + bob;
  model.head.position.y = 1.69 + bob;
  model.leftArm.position.y = model.rightArm.position.y = 1.33 + bob;
  model.leftLeg.position.y = model.rightLeg.position.y = 0.78 + bob * 0.25;

  model.leftArm.rotation.x = gait * amount;
  model.rightArm.rotation.x = -gait * amount - reach;
  model.leftForearm.rotation.x = -0.08 - Math.max(0, -gait) * amount * 0.35;
  model.rightForearm.rotation.x = -0.08 - Math.max(0, gait) * amount * 0.35 - reach * 0.35;
  model.leftLeg.rotation.x = -gait * amount * 0.9;
  model.rightLeg.rotation.x = gait * amount * 0.9;
  model.leftKnee.rotation.x = Math.max(0, gait) * amount * 0.75;
  model.rightKnee.rotation.x = Math.max(0, -gait) * amount * 0.75;
  model.body.rotation.y = moving ? -gait * 0.045 : dancing ? gait * 0.055 : 0;
  model.body.rotation.z = dancing ? Math.cos(time * 2.6 + phase) * energy * 0.055 : 0;
  model.head.rotation.y = Math.sin(time * 0.9 + phase) * (dancing ? 0.075 : 0.03);
  model.head.rotation.x = dancing ? -Math.sin(time * 1.8 + phase) * energy * 0.035 : 0;
  model.chest.scale.y = 1 + Math.sin(time * 1.5 + phase) * 0.008;
}
