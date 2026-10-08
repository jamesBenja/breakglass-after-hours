import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial } from 'three';

export const INTERACTIVE_NAME_COLOR = '#57f287';

/**
 * Camera-facing green nameplate for named characters with gameplay interactions.
 * Returns null in non-browser test environments.
 */
export function createWorldNameplate(text, { height = 2.2, width = 1.8 } = {}) {
  if (!text || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(4, 15, 8, 0.76)';
  context.fillRect(8, 20, 496, 88);
  context.strokeStyle = 'rgba(87, 242, 135, 0.95)';
  context.lineWidth = 4;
  context.strokeRect(10, 22, 492, 84);
  context.font = '700 44px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = INTERACTIVE_NAME_COLOR;
  context.shadowColor = 'rgba(0, 0, 0, 0.9)';
  context.shadowBlur = 6;
  context.fillText(String(text).toUpperCase().slice(0, 24), 256, 66);

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  sprite.name = `nameplate:${String(text).toLowerCase()}`;
  sprite.position.set(0, height, 0);
  sprite.scale.set(width, width * 0.25, 1);
  sprite.renderOrder = 20;

  return {
    sprite,
    dispose() {
      sprite.removeFromParent();
      texture.dispose();
      material.dispose();
    },
  };
}
