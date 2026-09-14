import { rectangle } from '../../collision/shapes.js';

export function wallPiece(id, a, b, thickness, y1, y2, kind = 'wall') {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const nx = ((-dz / length) * thickness) / 2,
    nz = ((dx / length) * thickness) / 2;
  return {
    id,
    kind,
    y1,
    y2,
    points: [
      [a[0] + nx, a[1] + nz],
      [b[0] + nx, b[1] + nz],
      [b[0] - nx, b[1] - nz],
      [a[0] - nx, a[1] - nz],
    ],
  };
}

export function compileWalls(runs) {
  const solids = [],
    doors = [];
  for (const run of runs) {
    const length = Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1]);
    const interpolate = (d) => run.a.map((value, i) => value + ((run.b[i] - value) * d) / length);
    let previous = 0;
    for (const opening of [...run.openings].sort((a, b) => a.at - b.at)) {
      const start = opening.at * length - opening.width / 2,
        end = start + opening.width;
      if (start > previous)
        solids.push(
          wallPiece(
            `${run.id}:${previous}`,
            interpolate(previous),
            interpolate(start),
            run.thickness,
            0,
            run.height,
          ),
        );
      solids.push(
        wallPiece(
          `${opening.id}:lintel`,
          interpolate(start),
          interpolate(end),
          run.thickness,
          2.5,
          run.height + 0.1,
          'lintel',
        ),
      );
      doors.push({
        ...opening,
        a: interpolate(start),
        b: interpolate(end),
        center: interpolate((start + end) / 2),
        normal: [-(run.b[1] - run.a[1]) / length, (run.b[0] - run.a[0]) / length],
      });
      previous = end;
    }
    if (previous < length)
      solids.push(
        wallPiece(
          `${run.id}:${previous}`,
          interpolate(previous),
          run.b,
          run.thickness,
          0,
          run.height,
        ),
      );
  }
  return { solids, doors };
}

export function platform(id, x, z, width, depth, height, color, extra = {}) {
  return {
    id,
    name: id,
    kind: 'platform',
    x1: x - width / 2,
    x2: x + width / 2,
    z1: z - depth / 2,
    z2: z + depth / 2,
    points: rectangle(x - width / 2, x + width / 2, z - depth / 2, z + depth / 2),
    y1: 0,
    y2: height,
    color,
    ...extra,
  };
}
