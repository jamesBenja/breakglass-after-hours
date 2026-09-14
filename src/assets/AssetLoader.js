import { LoadingManager, TextureLoader, SRGBColorSpace } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { disposeObject } from '../scenes/disposeObject.js';

/** Owns cached source assets; each model instance owns its cloned GPU resources. */
export class AssetLoader {
  constructor(manifest, { baseUrl, onWarning = () => {}, onProgress = () => {} } = {}) {
    this.manifest = manifest;
    this.baseUrl = baseUrl;
    this.onWarning = onWarning;
    this.cache = new Map();
    this.manager = new LoadingManager();
    this.manager.onProgress = (url, loaded, total) => onProgress({ url, loaded, total });
    this.gltf = new GLTFLoader(this.manager);
    this.textures = new TextureLoader(this.manager);
  }

  async load(id, type, load) {
    const entry = this.manifest[id];
    if (!entry || entry.type !== type) throw new Error(`Unknown ${type} asset: ${id}`);
    if (!entry.url) return null;
    if (!this.cache.has(id)) {
      const url = new URL(entry.url, this.baseUrl).href;
      const request = Promise.resolve()
        .then(() => load(url))
        .catch((error) => {
          this.cache.delete(id); // A failed request may be retried.
          this.onWarning(`${id}: ${error.message}. Using the prototype fallback.`);
          return null;
        });
      this.cache.set(id, request);
    }
    return this.cache.get(id);
  }

  async model(id) {
    const gltf = await this.load(id, 'model', (url) => this.gltf.loadAsync(url));
    if (!gltf) return null;
    const instance = clone(gltf.scene);
    instance.traverse((object) => {
      if (object.geometry) object.geometry = object.geometry.clone();
      if (!object.material) return;
      const copy = (source) => {
        const material = source.clone();
        for (const [key, value] of Object.entries(material)) {
          if (value?.isTexture) material[key] = value.clone();
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(copy)
        : copy(object.material);
      object.castShadow = object.receiveShadow = true;
    });
    const { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 } = this.manifest[id];
    instance.position.fromArray(position);
    instance.rotation.set(...rotation);
    if (Array.isArray(scale)) instance.scale.fromArray(scale);
    else instance.scale.setScalar(scale);
    return instance;
  }

  async texture(id) {
    const texture = await this.load(id, 'texture', (url) => this.textures.loadAsync(url));
    if (!texture) return null;
    const instance = texture.clone();
    instance.colorSpace = SRGBColorSpace;
    return instance;
  }

  audio(id, context) {
    return this.load(id, 'audio', async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return context.decodeAudioData(await response.arrayBuffer());
    });
  }

  async dispose() {
    for (const request of this.cache.values()) {
      const asset = await request;
      if (asset?.scene) disposeObject(asset.scene);
      else if (asset?.isTexture) asset.dispose();
    }
    this.cache.clear();
  }
}
