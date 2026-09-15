export const SPATIAL_VOICE = {
  fullVolumeDistance: 2.5,
  conversationDistance: 6.5,
  maxDistance: 9,
  wallAttenuation: 0.08,
  attack: 12,
  release: 7,
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function smoothstep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function spatialVoiceGain({
  sameScene,
  distance,
  occluded = false,
  config = SPATIAL_VOICE,
}) {
  if (!sameScene || !Number.isFinite(distance) || distance >= config.maxDistance) return 0;
  let gain = 1;
  if (distance > config.fullVolumeDistance && distance <= config.conversationDistance) {
    const t =
      (distance - config.fullVolumeDistance) /
      Math.max(0.001, config.conversationDistance - config.fullVolumeDistance);
    gain = 1 - smoothstep01(t) * 0.8;
  } else if (distance > config.conversationDistance) {
    const t =
      (distance - config.conversationDistance) /
      Math.max(0.001, config.maxDistance - config.conversationDistance);
    gain = 0.2 * (1 - smoothstep01(t));
  }
  if (occluded) gain *= config.wallAttenuation;
  return clamp01(gain);
}

export function voiceOccluded(level, localPosition, remotePosition) {
  const collision = level?.collision;
  if (!collision?.cameraCast || !localPosition || !remotePosition) return false;
  const from = {
    x: Number(localPosition.x ?? localPosition[0]) || 0,
    y: (Number(localPosition.y ?? localPosition[1]) || 0) + 1.45,
    z: Number(localPosition.z ?? localPosition[2]) || 0,
  };
  const to = {
    x: Number(remotePosition.x ?? remotePosition[0]) || 0,
    y: (Number(remotePosition.y ?? remotePosition[1]) || 0) + 1.45,
    z: Number(remotePosition.z ?? remotePosition[2]) || 0,
  };
  const hit = collision.cameraCast(from, to, 0.04);
  if (!hit || hit.fraction >= 0.985) return false;
  const id = String(hit.target ?? '');
  // Furniture should not abruptly mute a conversation. Structural blockers should.
  return /wall|outside|closed|suite|partition|door|storage|room/i.test(id);
}

export class SpatialVoiceSystem {
  constructor(multiplayer) {
    this.multiplayer = multiplayer;
    this.game = multiplayer.game;
    this.gains = new Map();
    this.lastNow = null;
  }

  update(now = performance.now()) {
    const sceneId = this.game.sceneManager.current?.definition?.id;
    const level = this.game.sceneManager.current;
    const local = this.game.player?.position;
    if (!sceneId || !local) return;
    const dt =
      this.lastNow == null ? 1 / 60 : Math.min(0.1, Math.max(1 / 240, (now - this.lastNow) / 1000));
    this.lastNow = now;

    for (const [id, entry] of this.multiplayer.media?.remoteMedia ?? []) {
      const remote = this.multiplayer.remotePlayers.get(id);
      if (!remote || !entry?.audio) continue;
      const sameScene = remote.sceneId === sceneId;
      const distance = sameScene ? local.distanceTo(remote.object.position) : Infinity;
      const occluded = sameScene && voiceOccluded(level, local, remote.object.position);
      const target = spatialVoiceGain({ sameScene, distance, occluded });
      const current = this.gains.get(id) ?? target;
      const speed = target > current ? SPATIAL_VOICE.attack : SPATIAL_VOICE.release;
      const gain = current + (target - current) * (1 - Math.exp(-speed * dt));
      this.gains.set(id, gain);
      entry.audio.volume = clamp01(gain);
      entry.tile?.classList?.toggle('voice-nearby', target > 0.15);
      entry.tile?.classList?.toggle('voice-distant', target <= 0.15);
      if (entry.status && remote) {
        const media = [];
        if (remote.media?.audio) media.push(target > 0.15 ? 'nearby voice' : 'voice out of range');
        if (remote.media?.video) media.push('camera');
        if (media.length) entry.status.textContent = media.join(' + ');
      }
    }

    for (const id of [...this.gains.keys()]) {
      if (!this.multiplayer.remotePlayers.has(id)) this.gains.delete(id);
    }
  }

  dispose() {
    for (const entry of this.multiplayer.media?.remoteMedia?.values?.() ?? []) {
      if (entry?.audio) entry.audio.volume = 1;
    }
    this.gains.clear();
  }
}
