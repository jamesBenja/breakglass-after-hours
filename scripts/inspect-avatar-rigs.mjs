const URLS = [
  'https://three.ws/avatars/michelle.glb',
  'https://three.ws/avatars/realistic-female.glb',
  'https://three.ws/avatars/realistic-male.glb',
  'https://three.ws/avatars/selfie-girl.glb',
];

function glbJson(buffer) {
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error('not GLB');
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (type === 0x4e4f534a) {
      const bytes = new Uint8Array(buffer, offset + 8, length);
      return JSON.parse(new TextDecoder().decode(bytes).replace(/\u0000+$/g, '').trim());
    }
    offset += 8 + length;
  }
  throw new Error('JSON chunk missing');
}

const wanted = /hips|spine|neck|head|shoulder|arm|forearm|hand|upleg|leg|foot/i;

for (const url of URLS) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const json = glbJson(await response.arrayBuffer());
  const skinJointIndices = new Set((json.skins || []).flatMap((skin) => skin.joints || []));
  const nodes = (json.nodes || [])
    .map((node, index) => ({ index, ...node }))
    .filter((node) => skinJointIndices.has(node.index) && wanted.test(node.name || ''))
    .map((node) => ({
      index: node.index,
      name: node.name,
      rotation: node.rotation ?? [0, 0, 0, 1],
      translation: node.translation ?? [0, 0, 0],
      scale: node.scale ?? [1, 1, 1],
      children: node.children ?? [],
    }));
  console.log('\n===', url.split('/').pop(), '===');
  console.log(JSON.stringify({ generator: json.asset?.generator, skins: json.skins?.length, nodes }, null, 2));
}
