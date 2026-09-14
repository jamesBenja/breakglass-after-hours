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
  for (const fixture of definition.fixtures) {
    const group = new Group();
    group.name = fixture.id;
    group.position.set((fixture.x1 + fixture.x2) / 2, 0, (fixture.z1 + fixture.z2) / 2);
    root.add(group);
    const w = fixture.x2 - fixture.x1,
      d = fixture.z2 - fixture.z1;
    if (fixture.id === 'spectra-console') {
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
    } else if (fixture.id === 'dead-gobo') {
      box(group, w, 1.5, d, navy, 0, 0.9, 0);
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) box(group, 0.12, 0.08, 0.65, wood, x, 0.04, 0);
    }
  }
}
