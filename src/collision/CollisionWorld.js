import { contains, circleOverlaps, rectangle, segmentPrism, EPSILON } from './shapes.js';

/** Shared authored surfaces/prisms drive player contact and camera clearance. */
export class CollisionWorld {
  constructor({ surfaces = [], obstacles = [], allowAirborne = false, boundary = null } = {}) {
    this.surfaces = surfaces;
    this.obstacles = obstacles.map((obstacle) => ({
      ...obstacle,
      points: obstacle.points ?? rectangle(obstacle.x1, obstacle.x2, obstacle.z1, obstacle.z2),
    }));
    this.allowAirborne = allowAirborne;
    this.boundary = boundary;
    this.lastTarget = null;
  }

  heightAt(surface, x, z) {
    if (!surface.ramp) return surface.y ?? 0;
    const { axis, from, to } = surface.ramp;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((axis === 'x' ? x : z) - surface[`${axis}1`]) /
          (surface[`${axis}2`] - surface[`${axis}1`]),
      ),
    );
    return from + (to - from) * t;
  }

  surfaceAt(x, z, maxHeight = Infinity, footRadius = 0) {
    let best = null;
    for (const surface of this.surfaces) {
      if (
        !contains(surface, x, z) &&
        !(
          footRadius &&
          circleOverlaps(
            surface.points ?? rectangle(surface.x1, surface.x2, surface.z1, surface.z2),
            x,
            z,
            footRadius,
          )
        )
      )
        continue;
      const height = this.heightAt(surface, x, z);
      if (
        height <= maxHeight + EPSILON &&
        (!best ||
          height > best.height + EPSILON ||
          (Math.abs(height - best.height) < EPSILON &&
            (surface.priority ?? 0) > (best.surface.priority ?? 0)))
      )
        best = { surface, height };
    }
    return best;
  }

  supportAt(x, z, maxHeight = Infinity) {
    // The foot has area: a low riser supports it as soon as its edge makes contact.
    // Legacy Below ramps keep their original centre-based height sampling.
    return this.surfaceAt(x, z, maxHeight, this.allowAirborne ? 0.32 : 0);
  }

  contact(x, y, z, radius = 0.32, height = 1.95) {
    return (
      this.obstacles.find(
        (o) =>
          o.player !== false &&
          y + height > o.y1 + EPSILON &&
          y < o.y2 - EPSILON &&
          circleOverlaps(o.points, x, z, radius),
      ) ?? null
    );
  }

  blocked(x, y, z, radius = 0.32, height = 1.95) {
    return !!this.contact(x, y, z, radius, height);
  }

  isValidPosition(position) {
    const ground = this.surfaceAt(position.x, position.z, position.y + 0.34);
    return (
      !!ground &&
      position.y >= ground.height - EPSILON &&
      position.y - ground.height <= 4 &&
      !this.blocked(position.x, position.y, position.z)
    );
  }

  move(position, dx, dz, { grounded = true, stepHeight = 0.34 } = {}) {
    this.lastTarget = null;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
    for (let i = 0; i < steps; i++) {
      for (const [axis, delta] of [
        ['x', dx / steps],
        ['z', dz / steps],
      ]) {
        if (!delta) continue;
        const x = position.x + (axis === 'x' ? delta : 0),
          z = position.z + (axis === 'z' ? delta : 0);
        const ground = this.supportAt(x, z, position.y + (grounded ? stepHeight : 0));
        if (
          (!ground && !this.allowAirborne) ||
          (this.boundary && !contains({ points: this.boundary }, x, z))
        ) {
          this.lastTarget = 'floor-boundary';
          continue;
        }
        // Only snap small rises here. Small drops use the grounded snap in the controller.
        const y =
          grounded &&
          ground &&
          ground.height >= position.y &&
          ground.height - position.y <= stepHeight + EPSILON
            ? ground.height
            : position.y;
        const obstacle = this.contact(x, y, z);
        if (obstacle) {
          this.lastTarget = obstacle.id ?? 'obstacle';
          continue;
        }
        position[axis] += delta;
        position.y = y;
      }
    }
    return position;
  }

  ceiling(position, nextY, height = 1.95) {
    let limit = nextY;
    for (const obstacle of this.obstacles) {
      if (obstacle.player === false) continue;
      if (obstacle.y1 < position.y + height - EPSILON || obstacle.y1 > nextY + height) continue;
      if (circleOverlaps(obstacle.points, position.x, position.z, 0.32)) {
        limit = Math.min(limit, obstacle.y1 - height);
        this.lastTarget = obstacle.id ?? 'ceiling';
      }
    }
    return limit;
  }

  cameraCast(from, to, radius = 0.24) {
    let fraction = 1,
      target = null;
    for (const obstacle of this.obstacles) {
      if (obstacle.camera === false) continue;
      let hit = segmentPrism(from, to, obstacle, radius);

      // When the player/camera target is simply standing within the camera's padded clearance
      // distance of a wall, the expanded volume reports an immediate hit at t=0 even if the
      // actual sightline runs away from the wall. That is not an occlusion. In that one case,
      // fall back to the centre ray so true wall crossings remain blocked while doorway/edge
      // grazing no longer makes the camera appear to clip or snap.
      if (hit !== null && hit <= EPSILON && radius > 0) {
        const centreHit = segmentPrism(from, to, obstacle, 0);
        if (centreHit === null) hit = null;
        else hit = centreHit;
      }

      if (hit !== null && hit < fraction) {
        fraction = hit;
        target = obstacle.id;
      }
    }
    return { fraction, target };
  }
}
