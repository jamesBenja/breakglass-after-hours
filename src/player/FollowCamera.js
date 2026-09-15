import { PerspectiveCamera, Vector3 } from 'three';

const DEFAULTS = {
  mode: 'follow',
  fov: 54,
  distance: 14,
  minDistance: 7,
  maxDistance: 16,
  pitch: 0.8,
  targetHeight: 1.05,
  cameraRadius: 0.34,
  shoulderSpeed: 7,
  pullInSpeed: 18,
  releaseSpeed: 5,
};

const MODES = ['follow', 'close', 'first'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Player-controlled camera with obstruction-aware third-person framing. */
export class FollowCamera {
  constructor(aspect) {
    this.camera = new PerspectiveCamera(DEFAULTS.fov, aspect, 0.08, 160);
    this.target = new Vector3();
    this.desired = new Vector3();
    this.candidate = new Vector3();
    this.resolved = new Vector3();
    this.look = new Vector3();
    this.yaw = this.yawTarget = this.homeYaw = 0.55;
    this.pitch = DEFAULTS.pitch;
    this.distance = this.distanceTarget = DEFAULTS.distance;
    this.collisionTarget = null;
    this.clearance = 12;
    this.initialized = false;
    this.config = { ...DEFAULTS };
    this.mode = this.preferredMode = 'follow';
    this.cameraYawOffset = 0;
    this.cameraYawOffsetTarget = 0;
  }

  configure(offset, position, collision, options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.preferredMode = MODES.includes(this.config.mode) ? this.config.mode : 'follow';
    this.mode = this.preferredMode;
    this.homeYaw = Math.atan2(offset[0], offset[2]);
    this.yaw = this.yawTarget = this.homeYaw;
    this.cameraYawOffset = 0;
    this.cameraYawOffsetTarget = 0;
    this.applyMode(this.mode, { instant: true });
    this.target.copy(position).add(new Vector3(0, this.config.targetHeight, 0));
    this.initialized = false;
    this.update(1 / 60, position, collision);
  }

  get isFirstPerson() {
    return this.mode === 'first';
  }

  modeSettings(mode = this.mode) {
    if (mode === 'first') {
      return {
        fov: Math.max(70, this.config.fov),
        distance: 0,
        pitch: 0,
      };
    }
    if (mode === 'close') {
      return {
        fov: Math.max(62, this.config.fov),
        distance: clamp(
          this.config.closeDistance ?? Math.min(4.4, this.config.distance * 0.58),
          Math.min(1.35, this.config.minDistance),
          this.config.maxDistance,
        ),
        pitch: this.config.closePitch ?? clamp(this.config.pitch * 0.72, 0.3, 0.72),
      };
    }
    return {
      fov: this.config.fov,
      distance: this.config.distance,
      pitch: this.config.pitch,
    };
  }

  applyMode(mode, { instant = false } = {}) {
    this.mode = MODES.includes(mode) ? mode : 'follow';
    const settings = this.modeSettings(this.mode);
    this.camera.fov = settings.fov;
    if (!this.isFirstPerson) {
      this.distanceTarget = clamp(
        settings.distance,
        Math.min(1.35, this.config.minDistance),
        this.config.maxDistance,
      );
      if (instant) {
        this.distance = this.distanceTarget;
        this.pitch = settings.pitch;
      }
    }
    this.camera.updateProjectionMatrix();
    this.cameraYawOffsetTarget = 0;
    this.initialized = false;
    return this.mode;
  }

  setMode(mode) {
    return this.applyMode(mode);
  }

  toggleMode() {
    const index = Math.max(0, MODES.indexOf(this.mode));
    return this.applyMode(MODES[(index + 1) % MODES.length]);
  }

  orbit(amount) {
    this.yawTarget += amount;
  }

  recenter() {
    this.yawTarget = this.homeYaw;
    this.cameraYawOffset = 0;
    this.cameraYawOffsetTarget = 0;
  }

  zoom(amount) {
    if (this.isFirstPerson) return;
    this.distanceTarget = clamp(
      this.distanceTarget + amount,
      Math.min(1.35, this.config.minDistance),
      this.config.maxDistance,
    );
  }

  worldMovement(movement) {
    const viewYaw = this.yaw + this.cameraYawOffset;
    return {
      x: movement.x * Math.cos(viewYaw) + movement.z * Math.sin(viewYaw),
      z: -movement.x * Math.sin(viewYaw) + movement.z * Math.cos(viewYaw),
    };
  }

  boomAt(yaw, pitch, distance, out) {
    const horizontal = Math.cos(pitch) * distance;
    return out.set(
      this.target.x + Math.sin(yaw) * horizontal,
      this.target.y + Math.sin(pitch) * distance,
      this.target.z + Math.cos(yaw) * horizontal,
    );
  }

  boom(pitch, out) {
    return this.boomAt(this.yaw + this.cameraYawOffset, pitch, this.distance, out);
  }

  cameraRadius() {
    const base = this.config.cameraRadius ?? DEFAULTS.cameraRadius;
    return this.mode === 'close' ? Math.min(base, 0.2) : base;
  }

  bestObstructionOffset(collision, pitch) {
    if (!collision) return { offset: 0, hit: { fraction: 1, target: null }, score: 2 };
    const baseOffsets =
      this.mode === 'close'
        ? [0, 0.24, -0.24, 0.48, -0.48, 0.76, -0.76, 1.05, -1.05, 1.35, -1.35]
        : [
            0, 0.22, -0.22, 0.45, -0.45, 0.7, -0.7, 0.96, -0.96, 1.22, -1.22, 1.5, -1.5, 1.82,
            -1.82, 2.15, -2.15, 2.5, -2.5,
          ];
    const offsets = [this.cameraYawOffsetTarget, this.cameraYawOffset, ...baseOffsets].filter(
      (offset, index, values) =>
        values.findIndex((candidate) => Math.abs(candidate - offset) < 0.001) === index,
    );
    const radius = this.cameraRadius();
    let best = null;
    for (const offset of offsets) {
      this.boomAt(this.yaw + offset, pitch, this.distance, this.candidate);
      const hit = collision.cameraCast(this.target, this.candidate, radius);
      const clear = hit.fraction >= 0.999;
      const change = Math.abs(offset - this.cameraYawOffsetTarget);
      // Prefer a clear line, then a view close to the normal centreline. A small hysteresis
      // penalty keeps the shoulder angle from flipping left/right on successive door-frame edges.
      const score =
        (clear ? 2 : hit.fraction) - Math.abs(offset) * 0.075 - Math.min(0.12, change * 0.06);
      if (!best || score > best.score) best = { offset, hit, score };
    }
    return best;
  }

  update(dt, position, collision) {
    const damp = (speed) => 1 - Math.exp(-speed * dt);
    this.yaw += (this.yawTarget - this.yaw) * damp(12);

    if (this.isFirstPerson) {
      this.target.set(position.x, position.y + 1.55, position.z);
      this.camera.position.copy(this.target);
      this.look.set(
        this.camera.position.x - Math.sin(this.yaw) * 5,
        this.camera.position.y - 0.06,
        this.camera.position.z - Math.cos(this.yaw) * 5,
      );
      this.camera.lookAt(this.look);
      this.collisionTarget = null;
      this.clearance = 0;
      this.initialized = true;
      return;
    }

    const settings = this.modeSettings();
    this.distance += (this.distanceTarget - this.distance) * damp(5);
    this.pitch += (settings.pitch - this.pitch) * damp(7);
    this.target.x = position.x;
    this.target.z = position.z;
    this.target.y += (position.y + this.config.targetHeight - this.target.y) * damp(12);
    this.target.y = Math.max(position.y + 0.78, this.target.y);

    const best = this.bestObstructionOffset(collision, this.pitch);
    this.cameraYawOffsetTarget = best.offset;

    // Ease toward the chosen shoulder angle instead of snapping every time a door jamb becomes
    // the closest obstruction. If that interpolated angle itself crosses a wall, jump only to the
    // already-tested clear shoulder angle so the camera stays outside geometry without zooming in.
    const nextOffset =
      this.cameraYawOffset +
      (this.cameraYawOffsetTarget - this.cameraYawOffset) * damp(this.config.shoulderSpeed);
    this.boomAt(this.yaw + nextOffset, this.pitch, this.distance, this.candidate);
    const nextHit = collision?.cameraCast(this.target, this.candidate, this.cameraRadius()) ?? {
      fraction: 1,
      target: null,
    };
    if (nextHit.fraction >= 0.999 || best.hit.fraction < 0.999) {
      this.cameraYawOffset = nextOffset;
    } else {
      this.cameraYawOffset = best.offset;
    }

    this.boom(this.pitch, this.desired);
    const radius = this.cameraRadius();
    const hit = collision?.cameraCast(this.target, this.desired, radius) ?? {
      fraction: 1,
      target: null,
    };
    this.collisionTarget = hit.target;
    const distance = this.target.distanceTo(this.desired);
    const safetyDistance = Math.max(0.42, radius + 0.08);
    const safety = safetyDistance / Math.max(distance, 0.01);
    const fraction = hit.fraction < 1 ? Math.max(0.035, hit.fraction - safety) : 1;
    this.resolved.lerpVectors(this.target, this.desired, fraction);

    if (!this.initialized) {
      this.camera.position.copy(this.resolved);
    } else {
      const currentDistance = this.camera.position.distanceTo(this.target);
      const resolvedDistance = this.resolved.distanceTo(this.target);
      const speed =
        resolvedDistance < currentDistance ? this.config.pullInSpeed : this.config.releaseSpeed;
      this.camera.position.lerp(this.resolved, damp(speed));

      // The eased position is checked again before rendering. Recovery can be slow and cinematic,
      // but wall avoidance remains immediate and authoritative.
      const guard = collision?.cameraCast(this.target, this.camera.position, radius) ?? {
        fraction: 1,
        target: null,
      };
      if (guard.fraction < 1) {
        const guardDistance = this.target.distanceTo(this.camera.position);
        const guardSafety = safetyDistance / Math.max(guardDistance, 0.01);
        const guardFraction = Math.max(0.035, guard.fraction - guardSafety);
        this.camera.position.lerpVectors(this.target, this.camera.position, guardFraction);
        this.collisionTarget = guard.target;
      }
    }

    this.clearance = this.camera.position.distanceTo(this.target);
    this.look.copy(this.target);
    const anticipation =
      this.mode === 'close'
        ? Math.min(0.7, this.clearance * 0.1)
        : Math.min(1.9, this.clearance * 0.14);
    const viewYaw = this.yaw + this.cameraYawOffset;
    this.look.x -= Math.sin(viewYaw) * anticipation;
    this.look.z -= Math.cos(viewYaw) * anticipation;
    this.camera.lookAt(this.look);
    this.initialized = true;
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
