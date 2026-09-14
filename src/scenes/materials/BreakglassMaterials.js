import {
  DataTexture,
  LinearFilter,
  MeshPhysicalMaterial,
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

const clampByte = (value) => Math.max(0, Math.min(255, value));

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

function plankTexture({ base = [132, 91, 58], dark = false, worn = 0.5, narrow = false } = {}) {
  const width = 128;
  const height = 128;
  const plankH = narrow ? 10 : 14;
  const plankW = narrow ? 42 : 36;
  return texture(
    width,
    height,
    (x, y) => {
      const row = Math.floor(y / plankH);
      const offset = row % 2 ? plankW / 2 : 0;
      const px = (x + offset) % plankW;
      const py = y % plankH;
      const seam = px < 1 || py < 1;
      if (seam) return dark ? [29, 24, 22, 255] : [72, 52, 38, 255];
      const grain = (hash(x, y, row) - 0.5) * 18 + Math.sin((x + row * 11) * 0.34) * 5;
      const board = (hash(Math.floor((x + offset) / plankW), row, 91) - 0.5) * 18;
      const scuff = hash(x >> 2, y >> 2, 171) > 0.91 ? -18 * worn : 0;
      return [
        clampByte(base[0] + grain + board + scuff + 4),
        clampByte(base[1] + grain * 0.72 + board + scuff),
        clampByte(base[2] + grain * 0.46 + board * 0.72 + scuff),
        255,
      ];
    },
    [6, 6],
  );
}

function paintedWallTexture({ base = [191, 184, 169], dark = false, aged = 0.5 } = {}) {
  return texture(
    64,
    64,
    (x, y) => {
      const mottling = (hash(x, y, 23) - 0.5) * (dark ? 13 : 9);
      const brush = Math.sin((x + y * 0.35) * 0.45) * 1.7;
      const age = hash(x >> 2, y >> 2, 412) > 0.94 ? -10 * aged : 0;
      return [
        clampByte(base[0] + mottling + brush + age),
        clampByte(base[1] + mottling + brush + age),
        clampByte(base[2] + mottling + brush + age),
        255,
      ];
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

function tileTexture({ base = [166, 158, 143] } = {}) {
  return texture(
    64,
    64,
    (x, y) => {
      const tile = 16;
      const grout = x % tile < 1 || y % tile < 1;
      if (grout) return [88, 84, 78, 255];
      const speck = (hash(x, y, 301) - 0.5) * 12;
      return base.map((value) => clampByte(value + speck));
    },
    [7, 7],
  );
}

function fabricTexture(base = [58, 72, 77]) {
  return texture(
    48,
    48,
    (x, y) => {
      const weave = ((x + y) % 3 === 0 ? -8 : 3) + (hash(x, y, 502) - 0.5) * 8;
      return base.map((value) => clampByte(value + weave));
    },
    [6, 6],
  );
}

export function studioFloorMaterial({ dark = false } = {}) {
  return new MeshStandardMaterial({
    map: plankTexture({ base: dark ? [76, 51, 38] : [135, 93, 58], dark, worn: 0.55 }),
    color: 0xffffff,
    roughness: dark ? 0.76 : 0.68,
    metalness: 0.01,
  });
}

export function liveRoomFloorMaterial() {
  return new MeshStandardMaterial({
    map: plankTexture({ base: [151, 104, 63], worn: 0.7, narrow: true }),
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.01,
  });
}

export function controlRoomFloorMaterial() {
  return new MeshStandardMaterial({
    map: plankTexture({ base: [91, 62, 47], dark: true, worn: 0.8 }),
    color: 0xffffff,
    roughness: 0.75,
    metalness: 0.01,
  });
}

export function deadRoomFloorMaterial() {
  return new MeshStandardMaterial({
    map: plankTexture({ base: [82, 67, 55], dark: true, worn: 0.72, narrow: true }),
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0,
  });
}

export function corridorFloorMaterial() {
  return new MeshStandardMaterial({
    map: plankTexture({ base: [99, 75, 58], dark: true, worn: 1 }),
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0,
  });
}

export function kitchenFloorMaterial() {
  return new MeshStandardMaterial({
    map: tileTexture({ base: [156, 151, 140] }),
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.01,
  });
}

export function studioWallMaterial({ dark = false, warm = true } = {}) {
  const base = dark ? [42, 40, 42] : warm ? [190, 181, 163] : [170, 180, 183];
  return new MeshStandardMaterial({
    map: paintedWallTexture({ base, dark, aged: 0.65 }),
    color: 0xffffff,
    roughness: dark ? 0.97 : 0.91,
    metalness: 0,
  });
}

export function controlRoomWallMaterial() {
  return new MeshStandardMaterial({
    map: paintedWallTexture({ base: [83, 97, 101], dark: true, aged: 0.45 }),
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0,
  });
}

export function acousticFabricMaterial(color = [58, 72, 77]) {
  return new MeshStandardMaterial({
    map: fabricTexture(color),
    color: 0xffffff,
    roughness: 0.99,
    metalness: 0,
  });
}

export function woodSlatMaterial() {
  return new MeshStandardMaterial({
    map: plankTexture({ base: [117, 78, 48], worn: 0.32, narrow: true }),
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
  });
}

export function studioGlassMaterial() {
  return new MeshPhysicalMaterial({
    color: 0x9eb2b5,
    roughness: 0.14,
    metalness: 0.02,
    transmission: 0.28,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
}

export function clubFloorMaterial() {
  return new MeshStandardMaterial({
    map: plankTexture({ base: [72, 47, 34], dark: true, worn: 0.8 }),
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.03,
  });
}

export function clubWallMaterial() {
  return new MeshStandardMaterial({
    map: paintedWallTexture({ base: [37, 35, 38], dark: true, aged: 0.75 }),
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
