import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import { NpcSystem } from '../npcs/NpcSystem.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let patched = false;

const asVector = (value) => {
  if (value?.isVector3) return value.clone();
  if (Array.isArray(value)) return new Vector3().fromArray(value);
  return new Vector3(value?.x ?? 0, value?.y ?? 0, value?.z ?? 0);
};

const face = (group, target) => {
  const dx = target.x - group.position.x;
  const dz = target.z - group.position.z;
  if (Math.hypot(dx, dz) > 0.02) group.rotation.y = Math.atan2(dx, dz);
};

export function patchNpcPhotography() {
  if (patched) return;
  patched = true;
  const baseTrigger = NpcSystem.prototype.triggerPhoto;
  const baseUpdate = NpcSystem.prototype.update;

  NpcSystem.prototype.triggerPhoto = function directedPhoto(
    id = 'nora',
    target = null,
    duration = 1.8,
  ) {
    const result = baseTrigger.call(this, id);
    const npc = this.get(id);
    if (!npc) return false;
    npc.photoPulse = Math.max(npc.photoPulse, duration);
    npc.photoTarget = target ? asVector(target) : null;
    npc.photoJoinTarget = null;
    npc.photoJoinCamera = null;
    return result;
  };

  NpcSystem.prototype.gatherForPhoto = function gatherForPhoto(
    photographerId,
    subjectPosition,
    duration = 1.8,
  ) {
    const photographer = this.get(photographerId);
    if (!photographer) return [];
    const subject = asVector(subjectPosition);
    const camera = photographer.group.position.clone();
    const offsets = [
      [-0.72, 0.1],
      [0.72, 0.1],
      [-1.05, 0.42],
      [1.05, 0.42],
    ];
    const nearby = this.npcs
      .filter((npc) => npc.id !== photographerId && npc.interactive)
      .map((npc) => ({
        npc,
        distance: Math.hypot(npc.group.position.x - subject.x, npc.group.position.z - subject.z),
      }))
      .filter(({ distance }) => distance <= 3.4)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, offsets.length);

    nearby.forEach(({ npc }, index) => {
      const [x, z] = offsets[index];
      npc.photoPulse = Math.max(npc.photoPulse, duration);
      npc.photoJoinTarget = subject.clone().add(new Vector3(x, 0, z));
      npc.photoJoinCamera = camera.clone();
    });
    return nearby.map(({ npc }) => npc.id);
  };

  NpcSystem.prototype.update = function updatePhotography(dt, audioState) {
    baseUpdate.call(this, dt, audioState);
    for (const npc of this.npcs) {
      if (npc.photoPulse > 0 && npc.photoJoinTarget) {
        const dx = npc.photoJoinTarget.x - npc.group.position.x;
        const dz = npc.photoJoinTarget.z - npc.group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.12) {
          const amount = Math.min(distance, dt * 3.2);
          npc.group.position.x += (dx / distance) * amount;
          npc.group.position.z += (dz / distance) * amount;
        }
        if (npc.photoJoinCamera) face(npc.group, npc.photoJoinCamera);
      } else if (npc.photoPulse > 0 && npc.photoTarget) {
        face(npc.group, npc.photoTarget);
      } else if (npc.photoPulse <= 0) {
        npc.photoTarget = null;
        npc.photoJoinTarget = null;
        npc.photoJoinCamera = null;
      }
    }
  };
}

function setSlots(slots, photos, loader) {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const photo = photos[photos.length - 1 - i];
    if (slot.photoId === photo?.id) continue;
    slot.material.map?.dispose();
    slot.material.map = null;
    slot.photoId = photo?.id ?? null;
    slot.material.color.setHex(photo ? 0xffffff : 0x242027);
    if (!photo?.dataUrl) {
      slot.material.needsUpdate = true;
      continue;
    }
    loader.load(
      photo.dataUrl,
      (texture) => {
        texture.colorSpace = SRGBColorSpace;
        if (slot.photoId !== photo.id) {
          texture.dispose();
          return;
        }
        slot.material.map?.dispose();
        slot.material.map = texture;
        slot.material.color.setHex(0xffffff);
        slot.material.needsUpdate = true;
      },
      undefined,
      () => {
        slot.material.color.setHex(0x3a3038);
        slot.material.needsUpdate = true;
      },
    );
  }
}

class StudioFridgeGallery {
  constructor(system) {
    this.system = system;
    this.group = null;
    this.slots = [];
    this.revision = '';
    this.loader = new TextureLoader();
  }

  attach() {
    const level = this.system.game.scenes.get('upstairs');
    const anchor = level?.definition?.anchors?.photoFridge;
    if (!level || !anchor || this.group) return;
    const group = new Group();
    group.name = 'studio-photo-fridge';
    group.position.fromArray(anchor.position);
    const body = new MeshStandardMaterial({ color: 0xd8d7d2, roughness: 0.72, metalness: 0.12 });
    const fridge = new Mesh(new BoxGeometry(1.3, 2.05, 0.74), body);
    fridge.position.y = 1.02;
    group.add(fridge);
    const positions = [
      [-0.38, 1.55],
      [0.2, 1.48],
      [-0.32, 1.02],
      [0.3, 0.96],
      [-0.37, 0.5],
      [0.24, 0.45],
    ];
    for (const [x, y] of positions) {
      const material = new MeshBasicMaterial({ color: 0x242027, toneMapped: false });
      const plane = new Mesh(new PlaneGeometry(0.48, 0.36), material);
      plane.position.set(x, y, -0.378);
      plane.rotation.y = Math.PI;
      group.add(plane);
      this.slots.push({ plane, material, photoId: null });
    }
    level.gameplay.add(group);
    this.group = group;
    this.sync(true);
  }

  sync(force = false) {
    if (!this.group) return;
    const photos = (this.system.game.state.data.photos ?? [])
      .filter((photo) => photo.tags?.includes('upstairs'))
      .slice(-this.slots.length);
    const revision = photos.map((photo) => photo.id).join('|');
    if (!force && revision === this.revision) return;
    this.revision = revision;
    setSlots(this.slots, photos, this.loader);
  }

  dispose() {
    for (const slot of this.slots) {
      slot.material.map?.dispose();
      slot.material.dispose();
      slot.plane.geometry.dispose();
    }
    this.group?.removeFromParent();
    this.group = null;
    this.slots = [];
  }
}

export class PartyLifePhotoSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.busy = false;
    this.cooldown = 8 + Math.random() * 6;
    this.fridge = new StudioFridgeGallery(this);
    this.installCapture();
  }

  installCapture() {
    const photos = this.game.photos;
    photos.syncPhotoWall = (force = false) => {
      if (!photos.wall) return;
      const collection = (this.game.state.data.photos ?? [])
        .filter((photo) => !photo.tags?.includes('upstairs'))
        .slice(-photos.wallSlots.length);
      const revision = collection.map((photo) => photo.id).join('|');
      if (!force && revision === photos.wallRevision) return;
      photos.wallRevision = revision;
      setSlots(photos.wallSlots, collection, photos.textureLoader);
    };
    photos.capture = (photographerId = 'nora') => this.capturePortrait(photographerId);
  }

  attach() {
    this.fridge.attach();
    this.game.photos.syncPhotoWall(true);
  }

  async capturePortrait(photographerId = 'nora') {
    if (this.busy) return { saved: false, reason: 'camera-busy' };
    const level = this.game.sceneManager.current;
    if (!level || !this.game.state.data.avatar.photoConsent)
      return { saved: false, reason: 'photo-consent' };
    const source = level.npcs?.positionOf?.(photographerId);
    if (!source) return { saved: false, reason: 'photographer-not-here' };
    this.busy = true;
    try {
      const target = this.game.player.position.clone();
      level.npcs.triggerPhoto?.(photographerId, target, 2.0);
      const joined = level.npcs.gatherForPhoto?.(photographerId, target, 2.0) ?? [];
      await delay(520);
      if (this.game.sceneManager.current !== level)
        return { saved: false, reason: 'scene-changed' };
      const camera = this.game.photos.cameraFor(level, photographerId);
      if (!camera) return { saved: false, reason: 'photographer-not-here' };
      return this.saveCapture(
        level,
        photographerId,
        camera,
        ['portrait', level.definition.id],
        ['player', ...joined],
      );
    } finally {
      this.busy = false;
    }
  }

  async captureTarget(target, tags = []) {
    if (this.busy || !this.game.state.data.avatar.photoConsent)
      return { saved: false, reason: 'camera-busy' };
    const level = this.game.sceneManager.current;
    const source = level?.npcs?.positionOf?.('nora');
    if (!level || !source) return { saved: false, reason: 'photographer-not-here' };
    this.busy = true;
    try {
      const lookAt = asVector(target);
      level.npcs.triggerPhoto?.('nora', lookAt, 1.5);
      await delay(170);
      if (this.game.sceneManager.current !== level)
        return { saved: false, reason: 'scene-changed' };
      const camera = this.game.photos.cameraForTarget(level, 'nora', lookAt, {
        fov: 50,
        minDistance: 3.0,
        targetHeight: 1.0,
      });
      if (!camera) return { saved: false, reason: 'photographer-not-here' };
      return this.saveCapture(level, 'nora', camera, ['autonomous', level.definition.id, ...tags]);
    } finally {
      this.busy = false;
    }
  }

  saveCapture(level, photographerId, camera, tags, avatarIds = []) {
    const dataUrl = this.game.photos.renderDataUrl(level, camera);
    if (!dataUrl) return { saved: false, reason: 'capture-failed' };
    const base = this.game.photos.metadata(level, photographerId);
    const photo = {
      ...base,
      avatarIds,
      tags: [...new Set(tags)].slice(0, 12),
      dataUrl,
    };
    const photos = Array.isArray(this.game.state.data.photos) ? this.game.state.data.photos : [];
    this.game.state.data.photos = [...photos, photo].slice(-18);
    this.game.photos.syncPhotoWall();
    this.fridge.sync();
    this.game.save();
    return { saved: true, photo };
  }

  targetFor(level, liveBandCenter = null) {
    if (level.definition.id === 'downstairs') {
      const choices = [];
      const dj = level.definition.anchors.dj?.position;
      if (dj) choices.push({ position: dj, tags: ['dj', 'party'] });
      const crowd = level.crowd?.snapshot?.();
      if ((crowd?.attendance ?? 0) > 18) {
        choices.push({ position: [0, 0, 0.4], tags: ['dancefloor', 'crowd'] });
        choices.push({ position: [7.65, 0, 3.65], tags: ['take-a-break', 'crowd'] });
      }
      for (const id of ['courtney', 'simla', 'devin']) {
        const position = level.npcs?.positionOf?.(id);
        if (position) choices.push({ position, tags: ['staff', id] });
      }
      return choices[Math.floor(Math.random() * choices.length)] ?? null;
    }
    if (level.definition.id === 'alley') {
      return {
        position: level.definition.anchors.social?.position ?? [7.5, 0, 0.2],
        tags: ['alley', 'smokers', 'outside'],
      };
    }
    if (level.definition.id === 'upstairs') {
      if (liveBandCenter)
        return { position: liveBandCenter, tags: ['live-from-breakglass', 'band'] };
      const choices = [
        { position: level.definition.anchors.console.position, tags: ['spectra', 'studio'] },
        { position: level.definition.anchors.synth.position, tags: ['live-room', 'studio'] },
      ];
      return choices[Math.floor(Math.random() * choices.length)];
    }
    return null;
  }

  activeParty(level) {
    if (!level?.npcs?.has?.('nora')) return false;
    if (level.definition.id === 'downstairs') {
      return this.game.audio.playing || (level.crowd?.snapshot?.().attendance ?? 0) > 25;
    }
    if (level.definition.id === 'alley') return (level.alley?.snapshot?.().occupancy ?? 0) >= 4;
    if (level.definition.id === 'upstairs') {
      return !!this.game.state.data.liveRoomArchive || this.game.audio.playing;
    }
    return false;
  }

  update(dt, liveBandCenter = null) {
    this.fridge.sync();
    this.cooldown -= dt;
    if (this.game.evacuationStarted || this.busy || this.cooldown > 0) return;
    const level = this.game.sceneManager.current;
    if (!this.activeParty(level)) {
      this.cooldown = 7;
      return;
    }
    const target = this.targetFor(level, liveBandCenter);
    if (!target) {
      this.cooldown = 10;
      return;
    }
    this.cooldown = 22 + Math.random() * 20;
    void this.captureTarget(target.position, target.tags);
  }

  studioPhotos() {
    return (this.game.state.data.photos ?? []).filter((photo) => photo.tags?.includes('upstairs'));
  }

  dispose() {
    this.fridge.dispose();
  }
}

export { clamp };
