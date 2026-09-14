import * as THREE from 'three';

export function createPrimitives() {
  const mat = (c, rough = 0.8, metal = 0.08) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
  const MAT = {
    floor: mat(0x2a2724),
    wall: mat(0x343434),
    dark: mat(0x101010),
    wood: mat(0x5a3d2a),
    red: mat(0x7a1f25),
    metal: mat(0x55585b, 0.45, 0.25),
    white: mat(0xdddddd),
    blue: mat(0x273a56),
    speaker: mat(0x090909),
    pink: mat(0x7a365f),
    gold: mat(0xb38b45),
    glass: new THREE.MeshStandardMaterial({
      color: 0x24303a,
      transparent: true,
      opacity: 0.3,
      roughness: 0.15,
    }),
  };

  function box(s, w, h, d, m, x, y, z) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    s.add(o);
    return o;
  }
  function cyl(s, r, h, m, x, y, z) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    s.add(o);
    return o;
  }
  function label(s, text, x, y, z, scale = 0.65, color = '#eeeeee') {
    const cv = document.createElement('canvas');
    cv.width = 640;
    cv.height = 140;
    const c = cv.getContext('2d');
    c.fillStyle = color;
    c.font = 'bold 42px system-ui';
    c.fillText(text, 12, 68);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
    );
    sp.position.set(x, y, z);
    sp.scale.set(6 * scale, 1.3 * scale, 1);
    s.add(sp);
    return sp;
  }
  function floor(s, x, z, w, d, m = MAT.floor) {
    return box(s, w, 0.22, d, m, x, -0.11, z);
  }
  function wall(s, x, z, w, d, h = 3.2) {
    return box(s, w, h, d, MAT.wall, x, h / 2, z);
  }
  function doorwayFrame(s, x, z, orientation, text) {
    const glow = mat(0xb58ba8, 0.6, 0.05);
    if (orientation === 'vertical') {
      box(s, 0.18, 2.8, 0.25, MAT.wood, x, 1.4, z - 0.72);
      box(s, 0.18, 2.8, 0.25, MAT.wood, x, 1.4, z + 0.72);
      box(s, 0.18, 0.18, 1.7, MAT.wood, x, 2.75, z);
      box(s, 0.05, 0.04, 1.5, glow, x - 0.06, 0.03, z);
      label(s, text, x - 0.15, 3.15, z, 0.34, '#e7c8de');
    } else {
      box(s, 0.25, 2.8, 0.18, MAT.wood, x - 0.72, 1.4, z);
      box(s, 0.25, 2.8, 0.18, MAT.wood, x + 0.72, 1.4, z);
      box(s, 1.7, 0.18, 0.18, MAT.wood, x, 2.75, z);
      box(s, 1.5, 0.04, 0.05, glow, x, 0.03, z - 0.06);
      label(s, text, x, 3.15, z - 0.15, 0.34, '#e7c8de');
    }
  }

  return { mat, MAT, box, cyl, label, floor, wall, doorwayFrame };
}
