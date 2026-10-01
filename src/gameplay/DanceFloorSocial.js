export const DANCE_CIRCLE_RADIUS = 4.6;

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
