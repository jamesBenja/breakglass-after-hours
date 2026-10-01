export const DANCE_CIRCLE_RADIUS = 4.6;

export const SOCIAL_GESTURE_DURATIONS = {
  wave: 1.35,
  dance: 1.8,
  highfive: 1.05,
  handsup: 2.5,
  shake: 2.4,
  grind: 2.2,
  circle: 3.2,
};

export function socialGestureDuration(kind) {
  return SOCIAL_GESTURE_DURATIONS[kind] ?? 0;
}

const coordinate = (position, key, index) => {
  if (!position) return Number.NaN;
  const value = position[key] ?? position[index];
  return Number(value);
};

export function isDanceFloorPosition(definition, position) {
  if (definition?.id !== 'downstairs') return false;
  const x = coordinate(position, 'x', 0);
  const z = coordinate(position, 'z', 2);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  return (definition.crowd?.zones ?? []).some(
    (zone) => zone.kind === 'dance' && x >= zone.x1 && x <= zone.x2 && z >= zone.z1 && z <= zone.z2,
  );
}

export function withinDanceCircle(center, position, radius = DANCE_CIRCLE_RADIUS) {
  const centerX = coordinate(center, 'x', 0);
  const centerZ = coordinate(center, 'z', 2);
  const x = coordinate(position, 'x', 0);
  const z = coordinate(position, 'z', 2);
  if (![centerX, centerZ, x, z].every(Number.isFinite)) return false;
  return Math.hypot(x - centerX, z - centerZ) <= radius;
}


export function applyLightweightSocialGesture(model, kind, progress) {
  if (!model || !kind) return false;
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const ease = Math.sin(p * Math.PI);

  if (kind === 'wave') {
    const wave = Math.sin(p * Math.PI * 7.5);
    model.rightArm.rotation.x = -0.42;
    model.rightArm.rotation.z = -1.05 - ease * 0.24;
    model.rightForearm.rotation.x = -1.02 + wave * 0.11;
    model.rightForearm.rotation.z = -0.18 + wave * 0.42;
    model.head.rotation.y -= 0.08 * ease;
    return true;
  }

  if (kind === 'highfive') {
    const reach = Math.sin(p * Math.PI);
    const hold = p > 0.34 && p < 0.7 ? 1 : reach;
    model.rightArm.rotation.x = -0.92 - hold * 0.22;
    model.rightArm.rotation.z = -0.72 - hold * 0.34;
    model.rightForearm.rotation.x = -0.45 - hold * 0.55;
    model.rightForearm.rotation.z = -0.06 - hold * 0.08;
    model.body.rotation.x = -0.045 * hold;
    model.head.rotation.y -= 0.065 * hold;
    return true;
  }

  if (kind === 'grind') {
    const hip = Math.sin(p * Math.PI * 8);
    const dip = Math.abs(Math.sin(p * Math.PI * 4));
    model.body.rotation.y += hip * 0.2;
    model.body.rotation.z += hip * 0.045;
    model.body.position.y -= dip * 0.035;
    model.leftKnee.rotation.x += 0.12 + dip * 0.18;
    model.rightKnee.rotation.x += 0.12 + dip * 0.18;
    model.leftArm.rotation.x = -0.2 + hip * 0.08;
    model.rightArm.rotation.x = -0.2 - hip * 0.08;
    model.leftForearm.rotation.x = -0.34;
    model.rightForearm.rotation.x = -0.34;
    return true;
  }

  if (kind === 'circle') {
    const pulse = Math.sin(p * Math.PI * 10);
    const bounce = Math.abs(Math.sin(p * Math.PI * 7));
    model.leftArm.rotation.z = 1.08 + pulse * 0.28;
    model.rightArm.rotation.z = -1.08 + pulse * 0.28;
    model.leftForearm.rotation.x = -0.6 - Math.max(0, pulse) * 0.25;
    model.rightForearm.rotation.x = -0.6 - Math.max(0, -pulse) * 0.25;
    model.body.rotation.y += pulse * 0.12;
    model.body.rotation.z += pulse * 0.045;
    model.body.position.y += bounce * 0.03;
    model.leftKnee.rotation.x += Math.max(0, pulse) * 0.16;
    model.rightKnee.rotation.x += Math.max(0, -pulse) * 0.16;
    return true;
  }

  return kind === 'dance';
}
