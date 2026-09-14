export const EPSILON = 1e-5;

export function polygonContains(points, x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[j];
    const [bx, bz] = points[i];
    const dx = bx - ax,
      dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < EPSILON) return true;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

export function contains(surface, x, z) {
  return surface.points
    ? polygonContains(surface.points, x, z)
    : x >= surface.x1 - EPSILON &&
        x <= surface.x2 + EPSILON &&
        z >= surface.z1 - EPSILON &&
        z <= surface.z2 + EPSILON;
}

export function rectangle(x1, x2, z1, z2) {
  return [
    [x1, z1],
    [x2, z1],
    [x2, z2],
    [x1, z2],
  ];
}

export function circleOverlaps(points, x, z, radius) {
  if (polygonContains(points, x, z)) return true;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < radius - EPSILON) return true;
  }
  return false;
}

/** Segment/expanded convex prism intersection for a camera volume (not a point ray). */
export function segmentPrism(from, to, prism, radius = 0) {
  const points = prism.points ?? rectangle(prism.x1, prism.x2, prism.z1, prism.z2);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const orientation = Math.sign(area) || 1;
  let enter = 0,
    leave = 1;
  const clip = (start, end) => {
    if (start < 0 && end < 0) return false;
    if (start >= 0 && end >= 0) return true;
    const t = start / (start - end);
    if (start < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    return enter <= leave;
  };
  if (
    !clip(from.y - prism.y1 + radius, to.y - prism.y1 + radius) ||
    !clip(prism.y2 + radius - from.y, prism.y2 + radius - to.y)
  )
    return null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const distance = (p) =>
      (orientation * (dx * (p.z - a[1]) - dz * (p.x - a[0]))) / length + radius;
    if (!clip(distance(from), distance(to))) return null;
  }
  return enter;
}
