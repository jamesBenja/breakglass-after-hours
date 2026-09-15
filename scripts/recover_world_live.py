from pathlib import Path


def replace_one(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    p.write_text(text.replace(old, new, 1))


below = "src/scenes/geometry/belowBlockout.js"
replace_one(
    below,
    """  doorwayFrame(downScene, -6.55, -3.45, 'horizontal', 'STUDIO ↑ · ALLEY ↓');
}""",
    """  doorwayFrame(downScene, -6.55, -3.45, 'horizontal', 'STUDIO ↑ · ALLEY ↓');
  label(downScene, 'STAIRS ↑ STUDIO', -6.55, 2.35, -3.1, 0.36, '#d8c1ff');

  // The shared west stair turns at its bottom landing and continues physically down to the alley.
  // This replaces the old abstract passage button with readable stair architecture.
  const alleyStep = mat(0x4b4039, 0.9, 0.02);
  box(downScene, 2.55, 0.12, 0.82, alleyStep, -6.72, -0.03, -0.82);
  for (let i = 0; i < 7; i++) {
    const x = -7.02 - i * 0.34;
    const top = -0.09 * (i + 1);
    box(downScene, 0.38, 0.14, 1.42, alleyStep, x, top - 0.07, -0.82);
  }
  box(downScene, 0.55, 0.14, 1.42, alleyStep, -9.28, -0.79, -0.82);
  for (const [x, y] of [
    [-7.1, 0.4],
    [-7.85, 0.2],
    [-8.6, -0.02],
  ]) {
    box(downScene, 0.06, 0.92, 0.06, studioRail, x, y, -1.52);
    box(downScene, 0.06, 0.92, 0.06, studioRail, x, y, -0.12);
  }
  doorwayFrame(downScene, -9.35, -0.82, 'vertical', 'ALLEY');
  label(downScene, 'STAIRS ↓ ALLEYWAY', -7.95, 1.45, -0.82, 0.38, '#d8c1ff');
  label(downScene, '↓ ALLEY', -9.15, 0.35, -0.82, 0.28, '#ead1f0');
}""",
)

levels = "src/world/levels.js"
replace_one(
    levels,
    """const rampSurface = (id, name, x1, x2, z1, z2, from, to) => ({
  id,
  name,
  x1,
  x2,
  z1,
  z2,
  priority: 20,
  ramp: { axis: 'z', from, to },
});""",
    """const rampSurface = (id, name, x1, x2, z1, z2, from, to, axis = 'z') => ({
  id,
  name,
  x1,
  x2,
  z1,
  z2,
  priority: 20,
  ramp: { axis, from, to },
});""",
)
replace_one(levels, "      alley: [-5.7, 0, -0.55],", "      alley: [-9.25, -0.72, -0.82],")
replace_one(
    levels,
    "The club is alive now. Push toward the booth, cross east into Take A Break, find the kitchen bar on the west side, play the old Mortal Kombat II cabinet, or earn your way onto the Clark stair up to the studio.",
    "The club is alive now. Take A Break is east with Nora's photo room beside it; the kitchen bar is west. The shared west stair goes up to the studio and turns down to the alley at its bottom landing.",
)
replace_one(
    levels,
    """        rampSurface(
          'clark-emergency-stairs',
          'Clark emergency exit stair',
          3.82,
          5.38,
          -5.2,
          -3.4,
          0.72,
          0,
        ),
        rampSurface(
          'studio-stairs',""",
    """        rampSurface(
          'clark-emergency-stairs',
          'Clark emergency exit stair',
          3.82,
          5.38,
          -5.2,
          -3.4,
          0.72,
          0,
        ),
        rampSurface(
          'alley-stairs',
          'Stairs down to alley',
          -9.2,
          -6.8,
          -1.28,
          -0.48,
          -0.72,
          0,
          'x',
        ),
        {
          id: 'alley-stair-bottom',
          name: 'Alley stair lower landing',
          x1: -9.45,
          x2: -9.15,
          z1: -1.28,
          z2: -0.48,
          y: -0.72,
          priority: 21,
        },
        rampSurface(
          'studio-stairs',""",
)
replace_one(
    levels,
    """        { x1: -7.9, x2: -5.25, z1: -3.3, z2: -0.7 },
      ],""",
    """        { x1: -7.9, x2: -5.25, z1: -3.3, z2: -0.7 },
        { x1: -9.55, x2: -6.5, z1: -1.4, z2: -0.4 },
      ],""",
)
replace_one(
    levels,
    """      alleyExit: {
        ...anchor(
          'Alley stairs · down from the studio stair core',
          [-5.7, 0, -0.55],
          1.35,
          'travel',
        ),
        target: 'alley@clubDoor',
      },""",
    """      alleyExit: {
        ...anchor('Stairs ↓ Alleyway', [-9.25, -0.72, -0.82], 1.35, 'travel'),
        target: 'alley@clubDoor',
      },""",
)

print("Recovered Below orientation and retained live alley stair geometry.")
