import { Matrix4, Quaternion, Vector3 } from 'three';

const URLS = [
  'https://three.ws/avatars/michelle.glb',
  'https://three.ws/avatars/realistic-female.glb',
  'https://three.ws/avatars/realistic-male.glb',
  'https://three.ws/avatars/selfie-girl.glb',
];

function glbChunks(buffer) {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not GLB');
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (type === 0x4e4f534a) {
      const bytes = new Uint8Array(buffer, offset + 8, length);
      json = JSON.parse(new TextDecoder().decode(bytes).replace(/\u0000+$/g, '').trim());
    } else if (type === 0x004e4942) {
      bin = new Uint8Array(buffer, offset + 8, length);
    }
    offset += 8 + length;
  }
  if (!json || !bin) throw new Error('GLB chunks missing');
  return { json, bin };
}

function inverseBindMatrices(json, bin, skin) {
  const accessor = json.accessors?.[skin.inverseBindMatrices];
  const view = json.bufferViews?.[accessor?.bufferView];
  if (!accessor || !view || accessor.componentType !== 5126 || accessor.type !== 'MAT4') return null;
  const stride = view.byteStride || 64;
  const base = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  return Array.from({ length: accessor.count }, (_, index) => {
    const values = Array.from({ length: 16 }, (_, component) =>
      data.getFloat32(base + index * stride + component * 4, true),
    );
    return new Matrix4().fromArray(values);
  });
}

function quatArray(q) {
  return [q.x, q.y, q.z, q.w].map((v) => Number(v.toFixed(6)));
}

function bindSummary(json, bin) {
  const skin = [...(json.skins || [])].sort((a, b) => (b.joints?.length || 0) - (a.joints?.length || 0))[0];
  if (!skin) return {};
  const inverses = inverseBindMatrices(json, bin, skin);
  if (!inverses) return {};

  const jointToSlot = new Map((skin.joints || []).map((nodeIndex, slot) => [nodeIndex, slot]));
  const parent = new Map();
  for (let index = 0; index < (json.nodes || []).length; index++) {
    for (const child of json.nodes[index]?.children || []) parent.set(child, index);
  }

  const wanted = new Set([
    'Hips','Spine','Spine1','Spine2',
    'LeftShoulder','LeftArm','LeftForeArm','LeftHand',
    'RightShoulder','RightArm','RightForeArm','RightHand',
  ]);
  const out = {};
  for (const [nodeIndex, slot] of jointToSlot) {
    const node = json.nodes[nodeIndex];
    const clean = String(node?.name || '').replace(/^mixamorig:/, '');
    if (!wanted.has(clean)) continue;

    const bindWorld = inverses[slot].clone().invert();
    const parentIndex = parent.get(nodeIndex);
    let bindLocal = bindWorld.clone();
    if (jointToSlot.has(parentIndex)) {
      const parentWorld = inverses[jointToSlot.get(parentIndex)].clone().invert();
      bindLocal = parentWorld.clone().invert().multiply(bindWorld);
    }
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    bindLocal.decompose(position, quaternion, scale);
    out[clean] = {
      loaded: (node.rotation || [0,0,0,1]).map((v) => Number(v.toFixed(6))),
      bind: quatArray(quaternion),
      angleDeg: Number(
        (2 * Math.acos(Math.min(1, Math.abs(
          new Quaternion(...(node.rotation || [0,0,0,1])).dot(quaternion),
        ))) * 180 / Math.PI).toFixed(2),
      ),
    };
  }
  return out;
}

for (const url of URLS) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const { json, bin } = glbChunks(await response.arrayBuffer());
  console.log('\n===', url.split('/').pop(), '===');
  console.log(JSON.stringify({
    generator: json.asset?.generator,
    skins: json.skins?.length,
    animations: (json.animations || []).map((a) => a.name || '(unnamed)'),
    bind: bindSummary(json, bin),
  }, null, 2));
}
