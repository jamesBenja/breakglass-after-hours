import { PerspectiveCamera, Vector3 } from 'three';

/** Volume-tested camera boom. Rises in narrow halls and recovers gently in rooms. */
export class FollowCamera {
  constructor(aspect) {
    this.camera = new PerspectiveCamera(54, aspect, 0.08, 160);
    this.target = new Vector3();
    this.desired = new Vector3();
    this.candidate = new Vector3();
    this.look = new Vector3();
    this.yaw = this.yawTarget = this.homeYaw = 0.55;
    this.pitch = 0.8;
    this.distance = this.distanceTarget = 14;
    this.collisionTarget = null;
    this.clearance = 12;
    this.initialized = false;
  }

  configure(offset, position, collision) {
    this.homeYaw = Math.atan2(offset[0], offset[2]);
    this.yaw = this.yawTarget = this.homeYaw;
    this.pitch = 0.8;
    this.target.copy(position).add(new Vector3(0, 1.05, 0));
    this.initialized = false;
    this.update(1 / 60, position, collision);
  }

  orbit(amount) {
    this.yawTarget += amount;
  }
  recenter() {
    this.yawTarget = this.homeYaw;
  }
  zoom(amount) {
    this.distanceTarget = Math.max(7, Math.min(16, this.distanceTarget + amount));
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
    this.distance += (this.distanceTarget - this.distance) * damp(5);
    this.target.x = position.x;
    this.target.z = position.z;
    this.target.y += (position.y + 1.05 - this.target.y) * damp(12);
    this.target.y = Math.max(position.y + 0.8, this.target.y);
    let wantedPitch = 0.8;
    if (collision) {
      for (const pitch of [0.8, 0.95, 1.1, 1.25, 1.4, 1.51, 1.565]) {
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
    // Frame the player below centre so upcoming destinations occupy more of the view.
    // The collision boom still originates at the player, never inside a look-ahead wall.
    this.look.copy(this.target);
    const anticipation = Math.min(2.4, this.clearance * 0.18);
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
