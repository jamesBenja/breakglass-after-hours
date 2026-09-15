import { PerspectiveCamera, Vector3 } from 'three';

const DEFAULTS = {
  mode: 'follow',
  fov: 54,
  distance: 14,
  minDistance: 7,
  maxDistance: 16,
  pitch: 0.8,
  targetHeight: 1.05,
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
  }

  configure(offset, position, collision, options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.preferredMode = MODES.includes(this.config.mode) ? this.config.mode : 'follow';
    this.mode = this.preferredMode;
    this.homeYaw = Math.atan2(offset[0], offset[2]);
    this.yaw = this.yawTarget = this.homeYaw;
    this.cameraYawOffset = 0;
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

  bestObstructionOffset(collision, pitch) {
    if (!collision) return { offset: 0, hit: { fraction: 1, target: null }, score: 2 };
    const offsets =
      this.mode === 'close'
        ? [0, 0.24, -0.24, 0.48, -0.48, 0.76, -0.76, 1.05, -1.05, 1.35, -1.35]
        : [
            0,
            0.22,
            -0.22,
            0.45,
            -0.45,
            0.7,
            -0.7,
            0.96,
            -0.96,
            1.22,
            -1.22,
            1.5,
            -1.5,
            1.82,
            -1.82,
            2.15,
            -2.15,
            2.5,
            -2.5,
          ];
    let best = null;
    for (const offset of offsets) {
      this.boomAt(this.yaw + offset, pitch, this.distance, this.candidate);
      const hit = collision.cameraCast(this.target, this.candidate, 0.34);
      const clear = hit.fraction >= 0.999;
      // Any clear line wins over a partially obstructed one; among clear lines choose the
      // smallest horizontal shift. This keeps pitch stable through studio doorways.
      const score = (clear ? 2 : hit.fraction) - Math.abs(offset) * 0.075;
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
    // Do not interpolate the camera through an obstructing wall. The old implementation solved
    // this by changing pitch at doorways; now we keep the chosen pitch and pick the nearest clear
    // horizontal shoulder angle instead.
    this.cameraYawOffset = best.offset;
    this.boom(this.pitch, this.desired);

    const hit = collision?.cameraCast(this.target, this.desired, 0.34) ?? {
      fraction: 1,
      target: null,
    };
    this.collisionTarget = hit.target;
    const distance = this.target.distanceTo(this.desired);
    const safety = 0.42 / Math.max(distance, 0.01);
    const fraction = hit.fraction < 1 ? Math.max(0.035, hit.fraction - safety) : 1;
    this.camera.position.lerpVectors(this.target, this.desired, fraction);
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
