from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def replace_one(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact match, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def sub_one(path, pattern, replacement):
    text = read(path)
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, found {count}: {pattern[:100]!r}")
    write(path, text)


# -----------------------------------------------------------------------------
# Reference-driven NPC looks
# -----------------------------------------------------------------------------
npc = 'src/npcs/NpcSystem.js'
looks = r'''export const CHARACTER_LOOKS = {
  nora: {
    skin: 0xc99779,
    hair: 0xef4d87,
    outfit: 0x303139,
    accent: 0xa95c83,
    hairStyle: 'long',
    prop: 'camera',
    bodyWidth: 0.9,
    heightScale: 0.99,
    tattoos: true,
  },
  malaika: {
    skin: 0xc89073,
    hair: 0xe8d2a9,
    outfit: 0x15171b,
    trousers: 0x111318,
    accent: 0xcf4058,
    hairStyle: 'long',
    curls: true,
    glasses: true,
    tattoos: true,
    lipColor: 0xd94f62,
    bodyWidth: 0.88,
    heightScale: 1.0,
  },
  sam: {
    skin: 0xc68f72,
    hair: 0x211b1b,
    outfit: 0x1c2026,
    trousers: 0x12151b,
    accent: 0x606b77,
    hairStyle: 'bald',
    tattoos: true,
    headTattoo: true,
    bodyWidth: 0.78,
    heightScale: 1.13,
  },
  james: {
    skin: 0xc79472,
    hair: 0xd1b47c,
    outfit: 0x1d2025,
    accent: 0x607184,
    hairStyle: 'long',
    bodyWidth: 0.9,
    heightScale: 1.02,
    prop: 'camera',
  },
  jace: {
    skin: 0xc28f70,
    hair: 0xc7a878,
    outfit: 0x1d2024,
    accent: 0x9f4c5a,
    hairStyle: 'long',
    glasses: true,
    bodyWidth: 0.96,
    heightScale: 1.04,
  },
  zander: {
    skin: 0xd1a083,
    hair: 0x76563e,
    outfit: 0xe6e0d5,
    trousers: 0x7b8792,
    accent: 0x493d39,
    hairStyle: 'long',
    curls: true,
    glasses: true,
    bodyWidth: 0.84,
    heightScale: 1.05,
  },
  boogaloo: {
    skin: 0x9b684c,
    hair: 0x211b1a,
    outfit: 0xc9cac6,
    accent: 0xc0a35f,
    hairStyle: 'long',
    curls: true,
    bodyWidth: 0.92,
    heightScale: 1.06,
  },
  courtney: {
    skin: 0xc18b70,
    hair: 0x251a1a,
    outfit: 0x202126,
    accent: 0xa9577c,
    hairStyle: 'bob',
    bun: true,
    glasses: true,
    tattoos: true,
    bodyWidth: 0.9,
    heightScale: 0.98,
    prop: 'bar',
  },
  simla: {
    skin: 0xa97860,
    hair: 0x22191a,
    outfit: 0xd36c83,
    accent: 0xefb1c0,
    hairStyle: 'bob',
    bodyWidth: 0.86,
    heightScale: 0.98,
    prop: 'bar',
  },
  lunice: {
    skin: 0x73503f,
    hair: 0x211b19,
    outfit: 0xe2e0db,
    accent: 0x7467a8,
    hairStyle: 'buzz',
    beard: true,
    bodyWidth: 1.02,
    heightScale: 1.04,
  },
  jashim: {
    skin: 0x9a6b50,
    hair: 0x201817,
    outfit: 0x35465e,
    accent: 0x657fb2,
    hairStyle: 'short',
  },
  devin: {
    skin: 0xb57f60,
    hair: 0x2a201c,
    outfit: 0x294752,
    accent: 0x5d8998,
    hairStyle: 'short',
    prop: 'candy',
  },
  david: {
    skin: 0xb68a68,
    hair: 0x5a4638,
    outfit: 0x66513f,
    accent: 0xa88a62,
    hairStyle: 'short',
  },
  beaver: {
    skin: 0xc28b6a,
    hair: 0x654736,
    outfit: 0x242326,
    accent: 0xc26d3e,
    hairStyle: 'short',
    beard: true,
    mustache: true,
    bodyWidth: 1.18,
    heightScale: 1.02,
  },
};'''
sub_one(npc, r"const CHARACTER_LOOKS = \{.*?\n\};", looks)
replace_one(
    npc,
    """const variation = (id, salt = 0) => {
  let value = salt + 13;
  for (const char of String(id)) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return (value % 1000) / 999;
};

function createCharacter(npc) {""",
    r"""const variation = (id, salt = 0) => {
  let value = salt + 13;
  for (const char of String(id)) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return (value % 1000) / 999;
};

function addReferenceDetails(model, look) {
  const ink = material(0x27262b);
  if (look.glasses) {
    for (const x of [-0.074, 0.074]) {
      for (const y of [0.062, -0.002]) {
        const bar = new Mesh(new BoxGeometry(0.12, 0.012, 0.012), ink);
        bar.position.set(x, y, 0.232);
        model.head.add(bar);
      }
      for (const side of [-1, 1]) {
        const bar = new Mesh(new BoxGeometry(0.012, 0.072, 0.012), ink);
        bar.position.set(x + side * 0.054, 0.03, 0.232);
        model.head.add(bar);
      }
    }
    const bridge = new Mesh(new BoxGeometry(0.035, 0.01, 0.012), ink);
    bridge.position.set(0, 0.031, 0.234);
    model.head.add(bridge);
  }
  if (look.lipColor) {
    const lips = new Mesh(new BoxGeometry(0.086, 0.018, 0.016), material(look.lipColor));
    lips.position.set(0, -0.116, 0.204);
    model.head.add(lips);
  }
  if (look.tattoos) {
    for (const arm of [model.leftForearm, model.rightForearm]) {
      for (let i = 0; i < 4; i++) {
        const mark = new Mesh(new BoxGeometry(0.055 + i * 0.008, 0.012, 0.012), ink);
        mark.position.set((i % 2 ? 1 : -1) * 0.018, -0.08 - i * 0.058, 0.054);
        mark.rotation.z = i * 0.43;
        arm.add(mark);
      }
    }
  }
  if (look.headTattoo) {
    for (let i = 0; i < 3; i++) {
      const mark = new Mesh(new BoxGeometry(0.018, 0.085 - i * 0.014, 0.012), ink);
      mark.position.set((i - 1) * 0.038, 0.135 - i * 0.02, 0.214);
      mark.rotation.z = (i - 1) * 0.24;
      model.head.add(mark);
    }
  }
  if (look.beard) {
    const beard = new Mesh(new SphereGeometry(0.15, 9, 7), model.materials.hair);
    beard.scale.set(0.82, 0.52, 0.55);
    beard.position.set(0, -0.145, 0.13);
    model.head.add(beard);
  }
  if (look.mustache) {
    const moustache = new Mesh(new BoxGeometry(0.105, 0.025, 0.02), model.materials.hair);
    moustache.position.set(0, -0.086, 0.216);
    model.head.add(moustache);
  }
  if (look.bun) {
    const bun = new Mesh(new SphereGeometry(0.12, 9, 7), model.materials.hair);
    bun.position.set(0, 0.16, -0.17);
    model.head.add(bun);
  }
  if (look.curls) {
    for (const [x, y, z, s] of [
      [-0.18, -0.12, -0.08, 1],
      [0.18, -0.12, -0.08, 1],
      [-0.15, -0.3, -0.1, 0.9],
      [0.15, -0.3, -0.1, 0.9],
      [-0.05, -0.42, -0.12, 0.82],
      [0.08, -0.45, -0.12, 0.82],
    ]) {
      const curl = new Mesh(new SphereGeometry(0.074 * s, 8, 6), model.materials.hair);
      curl.scale.set(0.75, 1.25, 0.72);
      curl.position.set(x, y, z);
      model.head.add(curl);
    }
  }
}

export function createNpcCharacter(npc) {""",
)
replace_one(
    npc,
    """  const bodyWidth = 0.94 + variation(npc.id, 2) * 0.13;
  const model = createLightweightHuman({
    skin: look.skin,
    hair: look.hair,
    outfit: look.outfit ?? npc.color ?? DEFAULT_LOOK.outfit,
    trousers: 0x181a1e,
    shoes: 0x14161a,
    accent: look.accent,
    hairStyle: look.hairStyle,
  });""",
    """  const bodyWidth = look.bodyWidth ?? 0.94 + variation(npc.id, 2) * 0.13;
  const model = createLightweightHuman({
    skin: look.skin,
    hair: look.hair,
    outfit: look.outfit ?? npc.color ?? DEFAULT_LOOK.outfit,
    trousers: look.trousers ?? 0x181a1e,
    shoes: look.shoes ?? 0x14161a,
    accent: look.accent,
    hairStyle: look.hairStyle,
  });""",
)
replace_one(
    npc,
    """  model.leftArm.position.x *= bodyWidth;
  model.rightArm.position.x *= bodyWidth;

  const accentMat = model.materials.accent;""",
    """  model.leftArm.position.x *= bodyWidth;
  model.rightArm.position.x *= bodyWidth;
  addReferenceDetails(model, look);

  const accentMat = model.materials.accent;""",
)
replace_one(
    npc,
    """    prop,
    propKind: look.prop ?? null,
  };
}""",
    """    prop,
    propKind: look.prop ?? null,
    heightScale: look.heightScale ?? null,
  };
}""",
)
replace_one(npc, "const model = createCharacter(npc);", "const model = createNpcCharacter(npc);")
replace_one(
    npc,
    "const heightScale = 0.96 + variation(npc.id, 19) * 0.09;",
    "const heightScale = model.heightScale ?? 0.96 + variation(npc.id, 19) * 0.09;",
)
