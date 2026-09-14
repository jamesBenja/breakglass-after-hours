import { Group } from 'three';
import { createPrimitives } from './primitives.js';

export function buildSelectableStudioGear(root, definition) {
  const { box, cyl, mat, MAT, label } = createPrimitives();
  const ids = new Map(definition.fixtures.map((fixture) => [fixture.id, fixture]));
  const groupAt = (id) => {
    const fixture = ids.get(id);
    if (!fixture) return null;
    const group = new Group();
    group.name = `${id}:visual`;
    group.position.set((fixture.x1 + fixture.x2) / 2, 0, (fixture.z1 + fixture.z2) / 2);
    root.add(group);
    return { group, fixture };
  };

  const grill = mat(0x202124, 0.88, 0.02);
  const tweed = mat(0x9e8054, 0.9, 0.01);
  const black = mat(0x242426, 0.86, 0.03);
  const silver = mat(0x9aa2a6, 0.45, 0.48);
  const brown = mat(0x704d36, 0.82, 0.03);

  const amp = (id, body, labelText, stack = false) => {
    const target = groupAt(id);
    if (!target) return;
    const { group, fixture } = target;
    const w = fixture.x2 - fixture.x1;
    const d = fixture.z2 - fixture.z1;
    const h = fixture.y2;
    if (stack) {
      box(group, w, h * 0.7, d, body, 0, h * 0.35, 0);
      box(group, w * 0.9, h * 0.28, d * 0.78, body, 0, h * 0.84, 0);
      box(group, w * 0.78, h * 0.48, 0.035, grill, 0, h * 0.35, -d / 2 - 0.01);
    } else {
      box(group, w, h, d, body, 0, h / 2, 0);
      box(group, w * 0.78, h * 0.62, 0.035, grill, 0, h * 0.46, -d / 2 - 0.01);
    }
    for (let i = 0; i < 5; i++)
      cyl(
        group,
        0.022,
        0.035,
        silver,
        -w * 0.28 + i * w * 0.14,
        h * 0.86,
        -d / 2 - 0.025,
      ).rotation.x = Math.PI / 2;
    label(root, labelText, group.position.x, h + 0.45, group.position.z, 0.24, '#f2dfbc');
  };

  amp('dead-amp-tweed', tweed, 'TWEED COMBO');
  amp('dead-amp-clean', mat(0x334047), 'CLEAN COMBO');
  amp('dead-amp-stack', black, 'BRITISH STACK', true);
  amp('dead-bass-stack', mat(0x17191b), 'BASS STACK', true);

  const rack = groupAt('instrument-rack');
  if (rack) {
    const { group, fixture } = rack;
    const h = fixture.y2;
    box(group, 0.1, h, 0.1, brown, -0.25, h / 2, 0);
    box(group, 0.1, h, 0.1, brown, 0.25, h / 2, 0);
    box(group, 0.62, 0.08, 1.8, brown, 0, 0.16, 0);
    for (let i = 0; i < 6; i++) {
      const z = -0.72 + i * 0.29;
      const instrumentColor = [0x7b3c37, 0xd4b36a, 0x273d54, 0xd2d0c8, 0x4c2b59, 0x374d36][i];
      const body = mat(instrumentColor, 0.62, 0.12);
      box(group, 0.24, 0.42, 0.12, body, 0, 0.5, z);
      box(group, 0.075, 0.78, 0.07, brown, 0, 1.05, z);
      box(group, 0.16, 0.17, 0.07, body, 0, 1.5, z);
    }
    label(root, 'GUITARS + BASSES', group.position.x, 2.05, group.position.z, 0.28, '#e7c6a5');
  }

  const locker = groupAt('mic-locker');
  if (locker) {
    const { group, fixture } = locker;
    const w = fixture.x2 - fixture.x1;
    const d = fixture.z2 - fixture.z1;
    const h = fixture.y2;
    box(group, w, h, d, mat(0x58636a, 0.65, 0.32), 0, h / 2, 0);
    box(group, w * 0.86, h * 0.8, 0.025, mat(0x20262a), 0, h * 0.52, -d / 2 - 0.015);
    for (let i = 0; i < 5; i++) {
      const x = -w * 0.31 + i * w * 0.155;
      cyl(group, 0.035, 0.3, silver, x, 0.68, -d / 2 - 0.04);
      cyl(
        group,
        i === 1 ? 0.06 : 0.045,
        0.09,
        i === 1 ? mat(0xb8a4a0) : MAT.dark,
        x,
        0.87,
        -d / 2 - 0.04,
      );
    }
    label(root, 'MIC LOCKER', group.position.x, 1.95, group.position.z, 0.26, '#c9dbe4');
  }
}
