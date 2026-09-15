from pathlib import Path


def replace_once(path, old, new):
    path = Path(path)
    text = path.read_text()
    if old not in text:
        raise RuntimeError(f'Expected source block not found in {path}')
    path.write_text(text.replace(old, new, 1))


npc_path = Path('src/npcs/NpcSystem.js')
npc = npc_path.read_text()

old_jashim = """  jashim: {\n    skin: 0x9a6b50,\n    hair: 0x201817,\n    outfit: 0x35465e,\n    accent: 0x657fb2,\n    hairStyle: 'short',\n  },\n"""
new_jashim = """  jashim: {\n    skin: 0xb78368,\n    hair: 0x151619,\n    outfit: 0x111214,\n    trousers: 0x777a7d,\n    accent: 0x4f565e,\n    hairStyle: 'long',\n    bangs: true,\n    tattoos: true,\n    neckTattoo: true,\n    handTattoos: true,\n    bodyWidth: 1.08,\n    heightScale: 0.98,\n  },\n"""
if old_jashim not in npc:
    raise RuntimeError('Jashim source look changed unexpectedly')
npc = npc.replace(old_jashim, new_jashim, 1)

if "  dave: {" not in npc:
    dave_block = """  dave: {\n    skin: 0xb9876a,\n    hair: 0x231c1a,\n    outfit: 0x26292c,\n    trousers: 0x17191d,\n    accent: 0x9b895f,\n    hairStyle: 'short',\n    beard: true,\n    mustache: true,\n    cap: true,\n    bodyWidth: 1.0,\n    heightScale: 1.02,\n  },\n"""
    marker = "  david: {\n"
    if marker not in npc:
        raise RuntimeError('David marker missing')
    npc = npc.replace(marker, dave_block + marker, 1)

extra_details = """
  if (look.bangs) {
    for (const [x, y, scale, tilt] of [
      [-0.13, 0.045, 1.0, -0.22],
      [-0.045, 0.0, 1.12, -0.08],
      [0.045, -0.01, 1.08, 0.08],
      [0.13, 0.035, 0.96, 0.22],
    ]) {
      const lock = new Mesh(new SphereGeometry(0.072 * scale, 8, 6), model.materials.hair);
      lock.scale.set(0.7, 1.55, 0.62);
      lock.position.set(x, y, 0.19);
      lock.rotation.z = tilt;
      model.head.add(lock);
    }
  }
  if (look.neckTattoo) {
    for (let i = 0; i < 3; i++) {
      const mark = new Mesh(new BoxGeometry(0.045 + i * 0.008, 0.012, 0.012), ink);
      mark.position.set((i - 1) * 0.028, -0.015 - i * 0.018, 0.071);
      mark.rotation.z = (i - 1) * 0.45;
      model.neck.add(mark);
    }
  }
  if (look.handTattoos) {
    for (const hand of [model.leftHand, model.rightHand]) {
      for (let i = 0; i < 2; i++) {
        const mark = new Mesh(new BoxGeometry(0.032, 0.009, 0.01), ink);
        mark.position.set((i ? 1 : -1) * 0.016, 0, 0.055);
        mark.rotation.z = i ? 0.6 : -0.6;
        hand.add(mark);
      }
    }
  }
  if (look.cap) {
    const cap = new Mesh(new SphereGeometry(0.238, 10, 7), model.materials.hair);
    cap.scale.set(1.02, 0.43, 1.02);
    cap.position.set(0, 0.185, 0.002);
    const brim = new Mesh(new BoxGeometry(0.24, 0.035, 0.16), model.materials.hair);
    brim.position.set(0, 0.115, 0.21);
    brim.rotation.x = -0.08;
    const badge = new Mesh(new BoxGeometry(0.075, 0.018, 0.012), model.materials.accent);
    badge.position.set(0, 0.155, 0.225);
    model.head.add(cap, brim, badge);
  }
"""
end_marker = "\n}\n\nexport function createNpcCharacter(npc) {"
if "if (look.bangs)" not in npc:
    if end_marker not in npc:
        raise RuntimeError('Reference-detail insertion point missing')
    npc = npc.replace(end_marker, extra_details + end_marker, 1)

npc_path.write_text(npc)

replace_once(
    'src/world/roof.js',
    """      appearance: {\n        prop: 'founder',\n        skin: 0xb78667,\n        hair: 0x31241e,\n        outfit: 0x35383d,\n        accent: 0x765c46,\n        hairStyle: 'short',\n      },\n""",
    """      appearance: { prop: 'founder' },\n""",
)

replace_once(
    'src/npcs/dialogues.js',
    """  david: {\n    title: 'DAVID · FURNITURE DEALER',\n""",
    """  dave: {\n    title: 'DAVE · FOUNDER',\n    text: '“You found the roof. Grab a spot — the building looks different from up here.”',\n  },\n  david: {\n    title: 'DAVID · FURNITURE DEALER',\n""",
)

refs = Path('docs/CHARACTER_REFERENCES.md')
refs_text = refs.read_text()
refs_text = refs_text.replace(
    "- **Lunice** — Drive/Lunice. Close-cropped hair, full beard and a clean light top in the selected reference; used when Lunice rotates into the house-DJ booth.\n",
    "- **Lunice** — Drive/Lunice. Close-cropped hair, full beard and a clean light top in the selected reference; used when Lunice rotates into the house-DJ booth.\n"
    "- **Jashim** — Drive/Jashim. Long shaggy black hair with heavy bangs, oversized black tee, loose grey pants, and visible neck/arm/hand tattoo detail.\n"
    "- **Dave** — Drive/Dave. Dark baseball cap, short dark hair, beard/moustache, and dark button-up. He is the third studio founder in the roof bonus level with James and Jace.\n",
    1,
)
refs_text = refs_text.replace(
    "- **Dave** is a separate Drive folder/reference and is not assumed to be David the furniture dealer.\n",
    "- **Dave and David remain separate characters**: Dave is the roof-level founder; David is the furniture dealer. The Dave reference is never applied to David.\n",
    1,
)
refs.write_text(refs_text)

test_path = Path('tests/character-social-pass.test.js')
test = test_path.read_text()
test = test.replace(
    "    'lunice',\n",
    "    'lunice',\n    'jashim',\n    'dave',\n",
    1,
)
insert_before = "\ntest('group photo countdown resolves to a synchronized 3-2-1-flash sequence', () => {"
extra_test = """

test('Jashim and roof-founder Dave use their photo references without colliding with David', () => {
  assert.equal(CHARACTER_LOOKS.jashim.hairStyle, 'long');
  assert.equal(CHARACTER_LOOKS.jashim.bangs, true);
  assert.equal(CHARACTER_LOOKS.jashim.tattoos, true);
  assert.equal(CHARACTER_LOOKS.jashim.neckTattoo, true);
  assert.equal(CHARACTER_LOOKS.jashim.handTattoos, true);
  assert.equal(CHARACTER_LOOKS.dave.cap, true);
  assert.equal(CHARACTER_LOOKS.dave.beard, true);
  assert.equal(CHARACTER_LOOKS.dave.mustache, true);
  assert.notEqual(CHARACTER_LOOKS.david.cap, true);
  assert.ok(levels.roof.npcs.some((npc) => npc.id === 'dave' && npc.role === 'founder'));
  assert.equal(levels.roof.npcs.some((npc) => npc.id === 'david'), false);
});
"""
if extra_test.strip() not in test:
    if insert_before not in test:
        raise RuntimeError('Test insertion point missing')
    test = test.replace(insert_before, extra_test + insert_before, 1)
test_path.write_text(test)

print('final Jashim/Dave character reference patch applied')
