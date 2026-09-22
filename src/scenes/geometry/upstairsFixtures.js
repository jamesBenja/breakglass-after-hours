import { Group, Vector3, CatmullRomCurve3, TubeGeometry, Mesh } from 'three';
import { createPrimitives } from './primitives.js';

/** Silhouettes from the supplied current Spectra/patch/tape photographs.
 * Placement is gameplay dressing, separated from the replaceable building shell.
 */
export function buildStudioEquipment(root, definition) {
  const { box, cyl, mat, MAT, label } = createPrimitives();
  const blue = mat(0x4e7289),
    cream = mat(0xdfc98e),
    navy = mat(0x243a49),
    silver = mat(0xa5b0b2, 0.4, 0.5);
  const lamp = mat(0xeac068),
    wood = mat(0x846244);
  const neveBlue = mat(0x344c5a),
    neveGrey = mat(0x777b78, 0.62, 0.12),
    tapeBox = mat(0xb49b73);
  for (const fixture of definition.fixtures) {
    // Mixing-suite sofas and coffee table are owned by roomFurniture.js. Rendering them here too
    // creates two slightly different couches in the exact same footprint.
    if (fixture.id?.startsWith('mix-sofa-') || fixture.id === 'mix-coffee-table') continue;

    const group = new Group();
    group.name = fixture.id;
    group.position.set((fixture.x1 + fixture.x2) / 2, 0, (fixture.z1 + fixture.z2) / 2);
    group.rotation.y = fixture.rotationY ?? 0;
    root.add(group);
    const w = fixture.x2 - fixture.x1,
      d = fixture.z2 - fixture.z1;
    if (fixture.id.startsWith('spectra-spatial-speaker-')) {
      const speakerY = Number(fixture.speakerY) || 1.4;
      const cabinet = mat(0x1d2428, 0.58, 0.14);
      const coneMat = mat(0x44535b, 0.7, 0.08);
      box(group, w, 0.58, d, cabinet, 0, speakerY, 0);
      const woofer = cyl(group, 0.13, 0.035, coneMat, 0, speakerY - 0.08, -d / 2 - 0.012);
      woofer.rotation.x = Math.PI / 2;
      const tweeter = cyl(group, 0.045, 0.03, silver, 0, speakerY + 0.13, -d / 2 - 0.015);
      tweeter.rotation.x = Math.PI / 2;
    } else if (fixture.id === 'spectra-console') {
      box(group, w, 0.75, d, wood, 0, 0.655, 0);
      const desk = box(group, w - 0.14, 0.15, d - 0.08, blue, 0, 1.1, -0.03);
      desk.rotation.x = -0.14;
      box(group, w, 0.33, 0.24, cream, 0, 1.335, d / 2 - 0.12);
      for (let i = 0; i < 24; i++) {
        const x = -1.62 + i * 0.14;
        box(group, 0.015, 0.016, 0.6, silver, x, 1.22, -0.1);
        box(group, 0.065, 0.026, 0.06, cream, x, 1.24, -0.26 + (i % 4) * 0.06);
        for (let row = 0; row < 3; row++)
          cyl(group, 0.022, 0.04, row === 0 ? lamp : MAT.dark, x, 1.235, -0.06 + row * 0.1);
      }
      for (let i = 0; i < 6; i++) {
        box(group, 0.36, 0.19, 0.015, navy, -1.12 + i * 0.45, 1.36, d / 2 - 0.245);
        box(group, 0.02, 0.12, 0.018, lamp, -1.12 + i * 0.45, 1.36, d / 2 - 0.255).rotation.z = 0.3;
      }
      label(root, 'SPECTRA', group.position.x, 2.1, group.position.z, 0.42, '#ffe5ad');
    } else if (fixture.id.startsWith('monitor-')) {
      box(group, 0.13, 1.45, 0.13, MAT.metal, 0, 0.725, 0);
      box(group, w, 0.65, d, MAT.speaker, 0, 1.775, 0);
      const cone = cyl(group, 0.21, 0.045, navy, 0, 1.73, -d / 2 - 0.008);
      cone.rotation.x = Math.PI / 2;
      const tweeter = cyl(group, 0.065, 0.045, silver, 0, 1.98, -d / 2 - 0.01);
      tweeter.rotation.x = Math.PI / 2;
    } else if (fixture.id === 'tape-bank') {
      for (const z of [-0.56, 0.56]) {
        box(group, 1, 1.8, 1.05, wood, 0, 0.9, z);
        box(group, 0.07, 1.5, 0.93, silver, 0.505, 1, z);
        for (const reelZ of [-0.25, 0.25]) {
          const reel = cyl(group, 0.235, 0.07, silver, 0.56, 1.44, z + reelZ);
          reel.rotation.z = Math.PI / 2;
          const hub = cyl(group, 0.07, 0.085, MAT.dark, 0.6, 1.44, z + reelZ);
          hub.rotation.z = Math.PI / 2;
        }
        box(group, 0.03, 0.23, 0.7, navy, 0.55, 0.75, z);
        for (const meterZ of [-0.2, 0.2])
          box(group, 0.04, 0.15, 0.23, cream, 0.57, 0.76, z + meterZ);
        for (let i = 0; i < 4; i++)
          box(group, 0.05, 0.08, 0.06, i % 2 ? lamp : MAT.red, 0.56, 0.46, z - 0.3 + i * 0.2);
      }
    } else if (fixture.id === 'patch-rack') {
      box(group, w, 2, d, wood, 0, 1, 0);
      box(group, 0.06, 1.75, d - 0.16, MAT.dark, w / 2, 1.05, 0);
      for (let i = 0; i < 9; i++)
        for (let j = 0; j < 5; j++) {
          const socket = cyl(
            group,
            0.026,
            0.04,
            silver,
            w / 2 + 0.045,
            0.45 + j * 0.27,
            -0.82 + i * 0.2,
          );
          socket.rotation.z = Math.PI / 2;
        }
      for (let i = 0; i < 10; i++) {
        const z = -0.85 + i * 0.17;
        const curve = new CatmullRomCurve3([
          new Vector3(0.3, 1.5, z),
          new Vector3(0.43, 0.55 + (i % 3) * 0.15, z + 0.12),
          new Vector3(0.3, 1.22, z + 0.28),
        ]);
        group.add(
          new Mesh(
            new TubeGeometry(curve, 10, 0.012, 4, false),
            mat([0xc07b53, 0xd2b655, 0x689eab][i % 3]),
          ),
        );
      }
      label(root, 'MODULAR', group.position.x, 2.28, group.position.z, 0.26, '#f2d5aa');
    } else if (fixture.id === 'side-rack') {
      box(group, w, 1.7, d, wood, 0, 0.85, 0);
      for (let i = 0; i < 7; i++) {
        box(group, w - 0.12, 0.18, 0.07, i % 2 ? navy : silver, 0, 0.15 + i * 0.22, -d / 2);
        for (let j = 0; j < 4; j++)
          cyl(
            group,
            0.025,
            0.045,
            cream,
            -0.23 + j * 0.15,
            0.17 + i * 0.22,
            -d / 2 - 0.04,
          ).rotation.x = Math.PI / 2;
      }
    } else if (fixture.id === 'spectra-drum-machine') {
      const machine = mat(0x303339, 0.55, 0.18);
      const face = mat(0xc2a46e, 0.42, 0.2);
      const stepOn = mat(0xe18b55, 0.5, 0.12);
      const stepOff = mat(0x4a4d50, 0.58, 0.12);
      for (const x of [-w / 2 + 0.12, w / 2 - 0.12])
        for (const z of [-d / 2 + 0.1, d / 2 - 0.1])
          box(group, 0.06, 0.78, 0.06, MAT.metal, x, 0.39, z);
      box(group, w, 0.12, d, wood, 0, 0.82, 0);
      const deck = box(group, w - 0.08, 0.15, d - 0.08, machine, 0, 0.94, 0);
      deck.rotation.x = -0.08;
      box(group, 0.34, 0.035, 0.13, face, -0.34, 1.03, -0.18);
      for (let i = 0; i < 16; i++) {
        const col = i % 8;
        const row = Math.floor(i / 8);
        box(
          group,
          0.085,
          0.035,
          0.075,
          i % 4 === 0 ? stepOn : stepOff,
          -0.4 + col * 0.115,
          1.035,
          0.01 + row * 0.115,
        );
      }
      for (let i = 0; i < 4; i++) cyl(group, 0.035, 0.04, cream, 0.19 + i * 0.12, 1.035, -0.2);
      label(root, 'RHYTHM', group.position.x, 1.55, group.position.z, 0.22, '#ffd99e');
    } else if (fixture.id === 'spectra-vocal-mic') {
      const stand = mat(0x282b2d, 0.34, 0.62);
      const chrome = mat(0xaeb4b5, 0.3, 0.72);
      const grille = mat(0x202326, 0.72, 0.18);
      const body = mat(0x5b6062, 0.46, 0.58);

      // Weighted circular stand base and upright.
      cyl(group, 0.22, 0.045, stand, 0, 0.025, 0);
      cyl(group, 0.024, 1.32, chrome, 0, 0.68, 0);

      // RCA 44-inspired yoke and broad ribbon-mic body.
      box(group, 0.34, 0.035, 0.055, chrome, 0, 1.31, 0);
      box(group, 0.035, 0.34, 0.055, chrome, -0.17, 1.47, 0);
      box(group, 0.035, 0.34, 0.055, chrome, 0.17, 1.47, 0);
      box(group, 0.29, 0.4, 0.16, body, 0, 1.5, 0);
      box(group, 0.245, 0.27, 0.012, grille, 0, 1.54, -0.086);
      for (let i = 0; i < 6; i++) {
        box(group, 0.012, 0.245, 0.014, chrome, -0.095 + i * 0.038, 1.54, -0.094);
      }
      box(group, 0.19, 0.045, 0.014, chrome, 0, 1.35, -0.094);
      label(root, 'VOCAL', group.position.x, 2.02, group.position.z, 0.2, '#e6d5b7');
    } else if (fixture.id === 'piano-body') {
      box(group, w, 0.62, d, wood, 0, 0.74, 0);
      for (const x of [-w / 2 + 0.12, w / 2 - 0.12])
        box(group, 0.14, 0.65, 0.14, MAT.dark, x, 0.325, d / 2 - 0.1);
      for (let i = 0; i < 24; i++) {
        box(group, 0.077, 0.06, 0.32, cream, -0.94 + i * 0.081, 0.91, d / 2 - 0.14);
        if (i % 7 !== 2 && i % 7 !== 6)
          box(group, 0.045, 0.035, 0.18, MAT.dark, -0.905 + i * 0.081, 0.956, d / 2 - 0.23);
      }
    } else if (fixture.id === 'synth-table') {
      box(group, w, 0.12, d, navy, 0, 0.83, 0);
      for (const x of [-0.6, 0.6]) box(group, 0.07, 0.8, 0.07, MAT.metal, x, 0.4, 0);
      for (let i = 0; i < 18; i++)
        box(group, 0.073, 0.035, 0.22, cream, -0.66 + i * 0.077, 0.915, 0.23);
      for (let i = 0; i < 8; i++) cyl(group, 0.024, 0.04, lamp, -0.61 + i * 0.17, 0.93, -0.12);
    } else if (fixture.id === 'drum-shells') {
      cyl(group, 0.48, 0.65, wood, 0, 0.61, 0).rotation.x = Math.PI / 2;
      for (const x of [-0.48, 0.48]) cyl(group, 0.27, 0.35, wood, x, 0.97, -0.12);
      for (const x of [-0.7, 0.7]) {
        cyl(group, 0.025, 0.72, silver, x, 0.64, -0.4);
        cyl(group, 0.27, 0.025, lamp, x, 1.22, -0.4);
      }
    } else if (fixture.id === 'bar-counter') {
      box(group, w, 1.03, d, wood, 0, 0.515, 0);
      box(group, w, 0.07, d, cream, 0, 1.065, 0);
      for (const z of [-1, 0, 1]) cyl(group, 0.1, 0.2, navy, 0, 1.18, z);

      // Working espresso machine in the upstairs studio kitchen.
      const espresso = mat(0xa9afb0, 0.3, 0.62);
      const espressoDark = mat(0x24282a, 0.48, 0.24);
      box(group, 0.72, 0.48, 0.4, espresso, 0, 1.34, 0.72);
      box(group, 0.66, 0.1, 0.38, espressoDark, 0, 1.61, 0.72);
      box(group, 0.62, 0.07, 0.31, MAT.metal, 0, 1.11, 0.69);
      for (const x of [-0.18, 0.18]) {
        cyl(group, 0.05, 0.11, espressoDark, x, 1.39, 0.49).rotation.x = Math.PI / 2;
        cyl(group, 0.02, 0.18, MAT.metal, x, 1.2, 0.5);
      }
      cyl(group, 0.025, 0.3, MAT.metal, 0.34, 1.25, 0.66).rotation.z = 0.25;
      for (const x of [-0.2, 0, 0.2]) cyl(group, 0.07, 0.08, cream, x, 1.76, 0.75);
      label(root, 'ESPRESSO', group.position.x, 2.0, group.position.z + 0.72, 0.18, '#f2dfc4');
    } else if (fixture.id === 'dead-gobo') {
      box(group, w, 1.5, d, navy, 0, 0.9, 0);
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) box(group, 0.12, 0.08, 0.65, wood, x, 0.04, 0);
    } else if (fixture.id === 'neve-console') {
      // Historic-console silhouette based on the supplied 2019 Breakglass Neve photo.
      // Fine dimensions and equipment placement are intentionally interpretive.
      box(group, w, 0.62, d, wood, 0, 0.55, 0);
      const desk = box(group, w - 0.12, 0.16, d - 0.1, neveBlue, 0, 0.96, -0.02);
      desk.rotation.x = -0.12;
      box(group, w - 0.08, 0.38, 0.24, neveGrey, 0, 1.23, d / 2 - 0.13);
      for (let i = 0; i < 28; i++) {
        const x = -w / 2 + 0.14 + (i * (w - 0.28)) / 27;
        box(group, 0.012, 0.018, 0.5, silver, x, 1.04, -0.08);
        box(group, 0.05, 0.028, 0.055, cream, x, 1.07, -0.25 + (i % 3) * 0.075);
        for (let row = 0; row < 4; row++)
          cyl(group, 0.018, 0.035, row % 2 ? MAT.dark : lamp, x, 1.065, -0.03 + row * 0.075);
      }
      for (let meter = 0; meter < 8; meter++) {
        box(group, 0.3, 0.18, 0.018, navy, -w / 2 + 0.34 + meter * 0.41, 1.25, d / 2 - 0.255);
        box(
          group,
          0.018,
          0.11,
          0.02,
          lamp,
          -w / 2 + 0.34 + meter * 0.41,
          1.25,
          d / 2 - 0.267,
        ).rotation.z = 0.22;
      }
      label(root, 'HISTORIC NEVE', group.position.x, 2.0, group.position.z, 0.38, '#dbe7e1');
    } else if (fixture.id.startsWith('neve-monitor-')) {
      box(group, 0.11, 1.12, 0.11, MAT.metal, 0, 0.56, 0);
      box(group, w, 0.58, d, MAT.speaker, 0, 1.5, 0);
      const cone = cyl(group, 0.19, 0.04, navy, 0, 1.45, -d / 2 - 0.008);
      cone.rotation.x = Math.PI / 2;
      const tweeter = cyl(group, 0.055, 0.04, silver, 0, 1.67, -d / 2 - 0.01);
      tweeter.rotation.x = Math.PI / 2;
    } else if (fixture.id === 'neve-side-rack') {
      box(group, w, 1.72, d, wood, 0, 0.86, 0);
      for (let i = 0; i < 8; i++) {
        box(
          group,
          w - 0.1,
          0.16,
          0.06,
          i % 3 ? neveBlue : neveGrey,
          0,
          0.17 + i * 0.19,
          -d / 2 - 0.01,
        );
        for (let k = 0; k < 3; k++)
          cyl(
            group,
            0.022,
            0.04,
            k === 0 ? lamp : cream,
            -0.19 + k * 0.19,
            0.17 + i * 0.19,
            -d / 2 - 0.05,
          ).rotation.x = Math.PI / 2;
      }
    } else if (fixture.id === 'neve-tape-machine') {
      box(group, w, 1.62, d, MAT.metal, 0, 0.81, 0);
      box(group, w - 0.08, 1.42, 0.07, neveGrey, 0, 0.88, -d / 2 - 0.01);
      for (const x of [-0.25, 0.25]) {
        const reel = cyl(group, 0.235, 0.06, silver, x, 1.27, -d / 2 - 0.065);
        reel.rotation.x = Math.PI / 2;
        const hub = cyl(group, 0.07, 0.07, MAT.dark, x, 1.27, -d / 2 - 0.105);
        hub.rotation.x = Math.PI / 2;
      }
      for (let meter = 0; meter < 2; meter++)
        box(group, 0.2, 0.13, 0.02, cream, -0.14 + meter * 0.28, 0.65, -d / 2 - 0.055);
      for (let i = 0; i < 5; i++)
        box(group, 0.07, 0.05, 0.025, i % 2 ? lamp : MAT.red, -0.2 + i * 0.1, 0.42, -d / 2 - 0.06);
      label(root, 'TAPE', group.position.x, 2.0, group.position.z, 0.3, '#e8dcc8');
    } else if (fixture.id === 'tape-archive-shelves') {
      box(group, w, 1.9, d, wood, 0, 0.95, 0);
      for (let shelf = 0; shelf < 5; shelf++) {
        const y = 0.22 + shelf * 0.36;
        box(group, w + 0.04, 0.04, d, MAT.metal, 0, y, 0);
        for (let i = 0; i < 5; i++) {
          const z = -d / 2 + 0.27 + i * ((d - 0.54) / 4);
          box(group, w - 0.12, 0.27, 0.3, tapeBox, 0, y + 0.16, z);
          box(group, w - 0.09, 0.035, 0.19, cream, -w / 2 - 0.01, y + 0.17, z);
        }
      }
      label(root, 'TAPE ARCHIVE', group.position.x - 0.3, 2.2, group.position.z, 0.34, '#f1dfbe');
    }
  }
}
