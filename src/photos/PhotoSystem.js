import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderTarget,
} from 'three';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

/**
 * Nora takes real rendered in-game photos. The six newest captures are also mounted as actual
 * textures in frames on the north wall of Take A Break, so the saved club night becomes visible
 * inside the world instead of only in a menu.
 */
export class PhotoSystem {
  constructor({ renderer, state, sceneManager, player, ui, saveState = () => {} }) {
    this.renderer = renderer;
    this.state = state;
    this.sceneManager = sceneManager;
    this.player = player;
    this.ui = ui;
    this.saveState = saveState;
    this.width = 384;
    this.height = 288;
    this.textureLoader = new TextureLoader();
    this.wall = null;
    this.wallSlots = [];
    this.wallRevision = '';
  }

  attachPhotoWall(level) {
    if (!level || level.definition.id !== 'downstairs' || this.wall) return;
    const group = new Group();
    group.name = 'nora-photo-wall';
    const frameMaterial = new MeshStandardMaterial({ color: 0x161318, roughness: 0.82 });
    const matteMaterial = new MeshStandardMaterial({ color: 0xe7ded0, roughness: 0.92 });
    const positions = [
      [-9.18, 2.28, 3.7],
      [-8.13, 2.28, 3.7],
      [-7.08, 2.28, 3.7],
      [-9.18, 1.32, 3.7],
      [-8.13, 1.32, 3.7],
      [-7.08, 1.32, 3.7],
    ];
    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      const frame = new Mesh(new BoxGeometry(0.94, 0.73, 0.055), frameMaterial);
      frame.position.set(x, y, z);
      frame.rotation.y = Math.PI;
      frame.castShadow = true;
      group.add(frame);
      const matte = new Mesh(new PlaneGeometry(0.82, 0.61), matteMaterial);
      matte.position.set(x, y, z - 0.031);
      matte.rotation.y = Math.PI;
      group.add(matte);
      const material = new MeshBasicMaterial({ color: 0x242027, toneMapped: false });
      const plane = new Mesh(new PlaneGeometry(0.76, 0.55), material);
      plane.position.set(x, y, z - 0.038);
      plane.rotation.y = Math.PI;
      plane.renderOrder = 2;
      group.add(plane);
      this.wallSlots.push({ plane, material, photoId: null });
    }
    level.gameplay.add(group);
    this.wall = group;
    this.syncPhotoWall(true);
  }

  syncPhotoWall(force = false) {
    if (!this.wall) return;
    const photos = Array.isArray(this.state.data.photos) ? this.state.data.photos.slice(-6) : [];
    const revision = photos.map((photo) => photo.id).join('|');
    if (!force && revision === this.wallRevision) return;
    this.wallRevision = revision;
    for (let i = 0; i < this.wallSlots.length; i++) {
      const slot = this.wallSlots[i];
      const photo = photos[photos.length - 1 - i];
      if (slot.photoId === photo?.id) continue;
      slot.material.map?.dispose();
      slot.material.map = null;
      slot.material.color.setHex(photo ? 0xffffff : 0x242027);
      slot.photoId = photo?.id ?? null;
      if (!photo?.dataUrl) {
        slot.material.needsUpdate = true;
        continue;
      }
      this.textureLoader.load(
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

  roomId(level, position) {
    const ground = level.collision.surfaceAt(position.x, position.z, position.y + 0.25);
    return ground?.surface?.id ?? level.definition.id;
  }

  metadata(level, photographerId) {
    const crowd = level.crowd?.snapshot?.();
    const lighting = level.lighting?.snapshot?.();
    return {
      id: `photo-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      eventId: 'bg20-local',
      timestamp: new Date().toISOString(),
      photographerId,
      roomId: this.roomId(level, this.player.position),
      avatarIds: ['player'],
      partyEnergy: clamp(crowd?.vibe ?? 0),
      attendance: crowd?.attendance ?? null,
      lightingPreset: lighting?.preset ?? null,
      haze: lighting?.haze ?? null,
      tags: ['portrait', level.definition.id],
      approvedForSharing: false,
    };
  }

  cameraFor(level, photographerId) {
    const source = level.npcs?.positionOf?.(photographerId);
    if (!source) return null;
    const camera = new PerspectiveCamera(52, this.width / this.height, 0.08, 80);
    camera.position.copy(source).add(new Vector3(0, 1.55, 0));
    const target = this.player.position.clone().add(new Vector3(0, 1.05, 0));
    const direction = target.clone().sub(camera.position);
    if (direction.lengthSq() < 0.1) camera.position.add(new Vector3(0, 0, 1.6));
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    return camera;
  }

  renderDataUrl(level, camera) {
    const target = new WebGLRenderTarget(this.width, this.height, {
      colorSpace: SRGBColorSpace,
    });
    const pixels = new Uint8Array(this.width * this.height * 4);
    const previousTarget = this.renderer.getRenderTarget();
    const previousVisible = this.player.object.visible;
    const flash = new PointLight(0xfff4df, 12, 6.5, 2);
    flash.position.copy(camera.position);
    level.scene.add(flash);
    this.player.object.visible = true;
    try {
      this.renderer.setRenderTarget(target);
      this.renderer.clear();
      this.renderer.render(level.scene, camera);
      this.renderer.readRenderTargetPixels(target, 0, 0, this.width, this.height, pixels);
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.player.object.visible = previousVisible;
      flash.removeFromParent();
      target.dispose();
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const image = context.createImageData(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      const sourceY = this.height - 1 - y;
      const sourceOffset = sourceY * this.width * 4;
      const targetOffset = y * this.width * 4;
      image.data.set(pixels.subarray(sourceOffset, sourceOffset + this.width * 4), targetOffset);
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  async capture(photographerId = 'nora') {
    const level = this.sceneManager.current;
    if (!level || !this.state?.data?.avatar?.photoConsent) {
      return { saved: false, reason: 'photo-consent' };
    }
    const camera = this.cameraFor(level, photographerId);
    if (!camera) return { saved: false, reason: 'photographer-not-here' };
    level.npcs?.triggerPhoto?.(photographerId);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const dataUrl = this.renderDataUrl(level, camera);
    if (!dataUrl) return { saved: false, reason: 'capture-failed' };
    const photo = { ...this.metadata(level, photographerId), dataUrl };
    const photos = Array.isArray(this.state.data.photos) ? this.state.data.photos : [];
    this.state.data.photos = [...photos, photo].slice(-6);
    this.syncPhotoWall();
    this.saveState();
    return { saved: true, photo };
  }

  dispose() {
    for (const slot of this.wallSlots) {
      slot.material.map?.dispose();
      slot.material.dispose();
      slot.plane?.geometry?.dispose?.();
    }
    this.wallSlots = [];
    this.wall?.removeFromParent();
    this.wall = null;
  }
}
