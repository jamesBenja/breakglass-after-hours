import {
  DataTexture,
  LinearFilter,
  MeshStandardMaterial,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

const hash = (x, y, salt = 0) => {
  let n = Math.imul(x + 374761393 + salt, 668265263) ^ Math.imul(y + 1442695041, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

function texture(width, height, painter, repeat = [1, 1]) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = painter(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  const result = new DataTexture(data, width, height, RGBAFormat);
  result.colorSpace = SRGBColorSpace;
  result.wrapS = result.wrapT = RepeatWrapping;
  result.repeat.set(...repeat);
  result.magFilter = result.minFilter = LinearFilter;
  result.needsUpdate = true;
  return result;
}

function parquetTexture({ dark = false } = {}) {
  const width = 96;
  const height = 96;
  const plankH = 12;
  const plankW = 32;
  return texture(
    width,
    height,
    (x, y) => {
      const row = Math.floor(y / plankH);
      const offset = row % 2 ? plankW / 2 : 0;
      const px = (x + offset) % plankW;
      const py = y % plankH;
      const seam = px < 1 || py < 1;
      const grain = (hash(x, y, row) - 0.5) * 22 + Math.sin((x + row * 9) * 0.42) * 5;
      const variation = (hash(Math.floor((x + offset) / plankW), row, 91) - 0.5) * 24;
      const base = dark ? [72, 47, 34] : [132, 91, 58];
      if (seam) return dark ? [33, 24, 20, 255] : [74, 52, 37, 255];
      return base.map((value, channel) =>
        Math.max(0, Math.min(255, value + grain + variation + (channel === 0 ? 5 : 0))),
      );
    },
    dark ? [7, 4] : [6, 6],
  );
}

function paintedWallTexture({ dark = false, warm = true } = {}) {
  const base = dark ? [37, 35, 38] : warm ? [191, 184, 169] : [177, 184, 187];
  return texture(
    48,
    48,
    (x, y) => {
      const mottling = (hash(x, y, 23) - 0.5) * (dark ? 12 : 9);
      const brush = Math.sin((x + y * 0.35) * 0.45) * 1.8;
      return [...base.map((value) => Math.max(0, Math.min(255, value + mottling + brush))), 255];
    },
    [5, 5],
  );
}

function rubberTexture() {
  return texture(
    32,
    32,
    (x, y) => {
      const speck = hash(x, y, 77);
      const value = 22 + Math.floor(speck * 12);
      return [value, value, value + 2, 255];
    },
    [8, 8],
  );
}

export function studioFloorMaterial({ dark = false } = {}) {
  return new MeshStandardMaterial({
    map: parquetTexture({ dark }),
    color: 0xffffff,
    roughness: dark ? 0.72 : 0.66,
    metalness: 0.02,
  });
}

export function studioWallMaterial({ dark = false, warm = true } = {}) {
  return new MeshStandardMaterial({
    map: paintedWallTexture({ dark, warm }),
    color: 0xffffff,
    roughness: dark ? 0.96 : 0.9,
    metalness: 0,
  });
}

export function clubFloorMaterial() {
  return new MeshStandardMaterial({
    map: parquetTexture({ dark: true }),
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.03,
  });
}

export function clubWallMaterial() {
  return new MeshStandardMaterial({
    map: paintedWallTexture({ dark: true, warm: false }),
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0,
  });
}

export function darkFloorMaterial() {
  return new MeshStandardMaterial({
    map: rubberTexture(),
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.01,
  });
}
