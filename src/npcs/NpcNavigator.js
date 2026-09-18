const planarDistance = (a, b) => Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.z ?? 0) - (a?.z ?? 0));

const key = (ix, iz) => `${ix},${iz}`;

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= item.priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    if (!this.items.length) return null;
    const root = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child =
          right < this.items.length && this.items[right].priority < this.items[left].priority
            ? right
            : left;
        if (this.items[child].priority >= last.priority) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return root;
  }

  get size() {
    return this.items.length;
  }
}

function boundsFromCollision(collision) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const surface of collision?.surfaces ?? []) {
    if (Array.isArray(surface.points) && surface.points.length) {
      for (const [x, z] of surface.points) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
      continue;
    }
    if ([surface.x1, surface.x2, surface.z1, surface.z2].every(Number.isFinite)) {
      minX = Math.min(minX, surface.x1, surface.x2);
      maxX = Math.max(maxX, surface.x1, surface.x2);
      minZ = Math.min(minZ, surface.z1, surface.z2);
      maxZ = Math.max(maxZ, surface.z1, surface.z2);
    }
  }

  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) {
    return { minX: -32, maxX: 32, minZ: -32, maxZ: 32 };
  }
  return { minX, maxX, minZ, maxZ };
}

export class NpcNavigator {
  constructor(collision, { resolution = 0.55, maxVisited = 9000 } = {}) {
    this.collision = collision;
    this.resolution = resolution;
    this.maxVisited = maxVisited;
    this.bounds = boundsFromCollision(collision);
    this.walkableCache = new Map();
  }

  clearCache() {
    this.walkableCache.clear();
  }

  cellFor(position) {
    return {
      ix: Math.round((position.x - this.bounds.minX) / this.resolution),
      iz: Math.round((position.z - this.bounds.minZ) / this.resolution),
    };
  }

  pointFor(ix, iz, y = 0) {
    return {
      x: this.bounds.minX + ix * this.resolution,
      y,
      z: this.bounds.minZ + iz * this.resolution,
    };
  }

  walkable(point, y = 0) {
    const cacheKey = `${Math.round(point.x * 100)},${Math.round(point.z * 100)},${Math.round(y * 100)}`;
    if (this.walkableCache.has(cacheKey)) return this.walkableCache.get(cacheKey);

    const position = { x: point.x, y, z: point.z };
    const valid = this.collision?.isValidPosition?.(position) === true;
    this.walkableCache.set(cacheKey, valid);
    return valid;
  }

  lineClear(from, to) {
    if (!this.collision) return true;
    const probe = { x: from.x, y: from.y ?? 0, z: from.z };
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    this.collision.move(probe, dx, dz, { grounded: true });
    return Math.hypot(probe.x - to.x, probe.z - to.z) <= 0.09;
  }

  nearestWalkable(position, maxRings = 8) {
    if (this.walkable(position, position.y ?? 0)) return { ...position };
    const start = this.cellFor(position);
    for (let ring = 1; ring <= maxRings; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (const dz of [-ring, ring]) {
          const point = this.pointFor(start.ix + dx, start.iz + dz, position.y ?? 0);
          if (this.walkable(point, position.y ?? 0)) return point;
        }
      }
      for (let dz = -ring + 1; dz < ring; dz++) {
        for (const dx of [-ring, ring]) {
          const point = this.pointFor(start.ix + dx, start.iz + dz, position.y ?? 0);
          if (this.walkable(point, position.y ?? 0)) return point;
        }
      }
    }
    return null;
  }

  nearestGridCell(position, maxRings = 10) {
    const origin = this.cellFor(position);
    for (let ring = 0; ring <= maxRings; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (ring > 0 && Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const ix = origin.ix + dx;
          const iz = origin.iz + dz;
          const point = this.pointFor(ix, iz, position.y ?? 0);
          if (!this.walkable(point, position.y ?? 0)) continue;
          if (this.walkable(position, position.y ?? 0) && !this.lineClear(position, point))
            continue;
          return { ix, iz, point };
        }
      }
    }
    return null;
  }

  reconstruct(cameFrom, currentKey, y) {
    const points = [];
    let cursor = currentKey;
    while (cursor) {
      const [ix, iz] = cursor.split(',').map(Number);
      points.push(this.pointFor(ix, iz, y));
      cursor = cameFrom.get(cursor) ?? null;
    }
    return points.reverse();
  }

  smooth(points, start) {
    if (points.length <= 1) return points;
    const result = [];
    let anchor = { ...start };
    let index = 0;
    while (index < points.length) {
      let best = index;
      for (let candidate = points.length - 1; candidate >= index; candidate--) {
        if (this.lineClear(anchor, points[candidate])) {
          best = candidate;
          break;
        }
      }
      result.push(points[best]);
      anchor = points[best];
      index = best + 1;
    }
    return result;
  }

  plan(startInput, goalInput) {
    if (!this.collision || !startInput || !goalInput) return [];
    const y = Number(startInput.y) || 0;
    const start = this.nearestWalkable({ x: startInput.x, y, z: startInput.z });
    const goal = this.nearestWalkable({ x: goalInput.x, y, z: goalInput.z });
    if (!start || !goal) return [];

    if (this.lineClear(start, goal)) return [{ ...goal }];

    const startGrid = this.nearestGridCell(start);
    const goalGrid = this.nearestGridCell(goal);
    if (!startGrid || !goalGrid) return [];
    const startCell = { ix: startGrid.ix, iz: startGrid.iz };
    const goalCell = { ix: goalGrid.ix, iz: goalGrid.iz };
    const startKey = key(startCell.ix, startCell.iz);
    const goalKey = key(goalCell.ix, goalCell.iz);
    const open = new MinHeap();
    const cameFrom = new Map();
    const g = new Map([[startKey, 0]]);
    const closed = new Set();
    open.push({ ...startCell, priority: planarDistance(startGrid.point, goalGrid.point) });

    const neighbours = [
      [-1, 0, 1],
      [1, 0, 1],
      [0, -1, 1],
      [0, 1, 1],
      [-1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [1, 1, Math.SQRT2],
    ];

    let visited = 0;
    while (open.size && visited < this.maxVisited) {
      const current = open.pop();
      const currentKey = key(current.ix, current.iz);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      visited += 1;

      if (currentKey === goalKey) {
        const raw = this.reconstruct(cameFrom, currentKey, y);
        raw.shift();
        const path = this.smooth(raw, start);
        if (this.lineClear(path.at(-1) ?? start, goal)) {
          if (!path.length || planarDistance(path.at(-1), goal) > 0.1) path.push(goal);
        } else if (!path.length || planarDistance(path.at(-1), goalGrid.point) > 0.1) {
          path.push(goalGrid.point);
        }
        return path;
      }

      for (const [dx, dz, cost] of neighbours) {
        const ix = current.ix + dx;
        const iz = current.iz + dz;
        const nextKey = key(ix, iz);
        if (closed.has(nextKey)) continue;
        const point = this.pointFor(ix, iz, y);
        if (!this.walkable(point, y)) continue;

        if (dx && dz) {
          const sideA = this.pointFor(current.ix + dx, current.iz, y);
          const sideB = this.pointFor(current.ix, current.iz + dz, y);
          if (!this.walkable(sideA, y) || !this.walkable(sideB, y)) continue;
        }

        const currentPoint = this.pointFor(current.ix, current.iz, y);
        if (!this.lineClear(currentPoint, point)) continue;

        const tentative = (g.get(currentKey) ?? Infinity) + cost;
        if (tentative >= (g.get(nextKey) ?? Infinity)) continue;
        cameFrom.set(nextKey, currentKey);
        g.set(nextKey, tentative);
        const heuristic = Math.hypot(goalCell.ix - ix, goalCell.iz - iz);
        open.push({ ix, iz, priority: tentative + heuristic });
      }
    }

    return [];
  }
}
