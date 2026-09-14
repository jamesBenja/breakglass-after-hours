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

/** Volume-tested camera boom with scene-specific close/POV modes. */
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
  }

  configure(offset, position, collision, options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.preferredMode = this.config.mode ?? 'follow';
    this.mode = this.preferredMode;
    this.homeYaw = Math.atan2(offset[0], offset[2]);
    this.yaw = this.yawTarget = this.homeYaw;
    this.pitch = this.config.pitch;
    this.distance = this.distanceTarget = this.config.distance;
    this.camera.fov = this.config.fov;
    this.camera.updateProjectionMatrix();
    this.target.copy(position).add(new Vector3(0, this.config.targetHeight, 0));
    this.initialized = false;
    this.update(1 / 60, position, collision);
  }

  get isFirstPerson() {
    return this.mode === 'first';
  }

  toggleMode() {
    if (this.mode === 'first') {
      this.mode = this.preferredMode;
      this.distance = this.distanceTarget = this.config.distance;
      this.pitch = this.config.pitch;
      this.camera.fov = this.config.fov;
    } else {
      this.mode = 'first';
      this.camera.fov = Math.max(68, this.config.fov);
    }
    this.camera.updateProjectionMatrix();
    this.initialized = false;
    return this.mode;
  }

  orbit(amount) {
    this.yawTarget += amount;
  }
  recenter() {
    this.yawTarget = this.homeYaw;
  }
  zoom(amount) {
    if (this.isFirstPerson) return;
    this.distanceTarget = Math.max(
      this.config.minDistance,
      Math.min(this.config.maxDistance, this.distanceTarget + amount),
    );
  }

  worldMovement(movement) {
    return {
      x: movement.x * Math.cos(this.yaw) + movement.z * Math.sin(this.yaw),
      z: -movement.x * Math.sin(this.yaw) + movement.z * Math.cos(this.yaw),
    };
  }

  boom(pitch, out) {
    const horizontal = Math.cos(pitch) * this.distance;
    return out.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
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

    this.distance += (this.distanceTarget - this.distance) * damp(5);
    this.target.x = position.x;
    this.target.z = position.z;
    this.target.y += (position.y + this.config.targetHeight - this.target.y) * damp(12);
    this.target.y = Math.max(position.y + 0.78, this.target.y);

    const basePitch = this.config.pitch;
    let wantedPitch = basePitch;
    if (collision) {
      const pitches = [
        basePitch,
        Math.min(1.5, basePitch + 0.18),
        Math.min(1.5, basePitch + 0.36),
        Math.min(1.5, basePitch + 0.56),
        Math.min(1.52, basePitch + 0.78),
        1.54,
      ];
      for (const pitch of pitches) {
        wantedPitch = pitch;
        this.boom(pitch, this.candidate);
        if (collision.cameraCast(this.target, this.candidate, 0.5).fraction > 0.94) break;
      }
    }
    this.pitch = this.initialized
      ? this.pitch + (wantedPitch - this.pitch) * damp(wantedPitch > this.pitch ? 10 : 2.2)
      : wantedPitch;
    this.boom(this.pitch, this.desired);
    if (this.initialized) this.desired.lerpVectors(this.camera.position, this.desired, damp(10));
    const hit = collision?.cameraCast(this.target, this.desired, 0.28) ?? {
      fraction: 1,
      target: null,
    };
    this.collisionTarget = hit.target;
    const distance = this.target.distanceTo(this.desired);
    const fraction =
      hit.fraction < 1 ? Math.max(0, hit.fraction - 0.08 / Math.max(distance, 0.01)) : 1;
    this.camera.position.lerpVectors(this.target, this.desired, fraction);
    this.clearance = this.camera.position.distanceTo(this.target);

    this.look.copy(this.target);
    const anticipation =
      this.mode === 'close'
        ? Math.min(0.85, this.clearance * 0.12)
        : Math.min(2.4, this.clearance * 0.18);
    this.look.x -= Math.sin(this.yaw) * anticipation;
    this.look.z -= Math.cos(this.yaw) * anticipation;
    this.camera.lookAt(this.look);
    this.initialized = true;
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
