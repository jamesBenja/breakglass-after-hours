import { PerspectiveCamera, PointLight, SRGBColorSpace, Vector3, WebGLRenderTarget } from 'three';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

/**
 * Local single-player photography. A bounded render target keeps captures independent of the
 * gameplay camera and avoids requiring preserveDrawingBuffer on the main renderer.
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
    this.saveState();
    return { saved: true, photo };
  }
}
