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
# Reference inventory / regression tests
# -----------------------------------------------------------------------------

party_test = 'tests/party-life.test.js'
replace_one(
    party_test,
    "  'James Benjamin',\n  'Siren Mars',",
    "  'James Benjamin',\n  'DJ FLLEUR',\n  'Siren Mars',",
)

write(
    'docs/CHARACTER_REFERENCES.md',
    r'''# Character visual references

The Drive folder supplied for the BG20 game is the visual source of truth for recurring real-world characters. The game remains deliberately stylized, but named characters should preserve the most legible traits from their references rather than receiving randomized generic looks.

## Applied in this pass

- **Sam** — chat reference; Drive/Sam is currently empty. Tall and very slim, shaved/bald head, extensive arm tattoos and visible head tattoo marks, dark club/security clothes. Front-door security in the alley.
- **Malaika / DJ FLLEUR** — Drive/Malaika + chat reference. Long pale-blonde wavy/curly hair, glasses, bright lips, arm tattoos, black clubwear. Roams with Nora when off the decks and can rotate into the house-DJ booth.
- **Nora** — Drive/Nora. Bright pink long hair in the selected reference, tattoos, camera always readable as her prop.
- **James** — Drive/James. Slim build, shoulder-length blond hair, dark sleeveless/club-studio look.
- **Beaver** — Drive/Beaver. Stockier build, brown hair, beard/moustache, black BBQ/vendor look.
- **Courtney** — Drive/Courtney. Dark hair, glasses, dark outfit, tattoo detail.
- **Simla** — Drive/Simla. Slim build, short/dark hair and pink top from the selected reference.
- **Zander** — Drive/Zander. Tall/slim, long curly brown hair and glasses.
- **Jace** — Drive/Jace. Long light/blond hair, glasses, dark stage/studio clothing.
- **Boogaloo** — Drive/Boogaloo. Tall/slim, voluminous dark curls, light/grey top.
- **Lunice** — Drive/Lunice. Close-cropped hair, full beard and a clean light top in the selected reference; used when Lunice rotates into the house-DJ booth.

## Deliberately not guessed

- **David**: the `David` folder is currently empty.
- **Devin**: the available selected frames are environmental/group views rather than a clean single-person reference, so his existing look is retained until a clearer portrait is identified.
- **Dave** is a separate Drive folder/reference and is not assumed to be David the furniture dealer.
- **Hydra**: the available reference is a two-person booth photo, so no appearance is assigned until the intended person in that frame is unambiguous.
- Folders for artists not yet represented as named roaming NPCs remain available for later character/DJ passes rather than being mapped to the wrong person.

When a new named character is added, keep the reference mapping here and put their key visual traits in `CHARACTER_LOOKS` rather than relying on per-session random proportions.
''',
)

write(
    'tests/character-social-pass.test.js',
    r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_LOOKS } from '../src/npcs/NpcSystem.js';
import { HOUSE_DJS } from '../src/gameplay/HouseDjSystem.js';
import { groupPhotoCountdownLabel } from '../src/gameplay/GroupPhotoSystem.js';
import { preparePartyLifeWorld } from '../src/gameplay/partyLifeEnhancements.js';
import { levels } from '../src/world/levels.js';

preparePartyLifeWorld();

test('Sam replaces the generic front-door bouncer', () => {
  assert.ok(levels.alley.npcs.some((npc) => npc.id === 'sam' && npc.role === 'security'));
  assert.equal(levels.alley.npcs.some((npc) => npc.id === 'bouncer'), false);
  assert.ok(levels.alley.anchors.sam);
  assert.equal(CHARACTER_LOOKS.sam.hairStyle, 'bald');
  assert.equal(CHARACTER_LOOKS.sam.tattoos, true);
  assert.equal(CHARACTER_LOOKS.sam.headTattoo, true);
  assert.ok(CHARACTER_LOOKS.sam.heightScale > 1.08);
  assert.ok(CHARACTER_LOOKS.sam.bodyWidth < 0.85);
});

test('Malaika roams with Nora and can appear as DJ FLLEUR', () => {
  const malaika = levels.downstairs.npcs.find((npc) => npc.id === 'malaika');
  const nora = levels.downstairs.npcs.find((npc) => npc.id === 'nora');
  assert.ok(malaika);
  assert.ok(nora);
  assert.ok(malaika.route.length >= 5);
  assert.ok(HOUSE_DJS.some((dj) => dj.id === 'malaika' && dj.name === 'DJ FLLEUR'));
  assert.equal(CHARACTER_LOOKS.malaika.hairStyle, 'long');
  assert.equal(CHARACTER_LOOKS.malaika.curls, true);
  assert.equal(CHARACTER_LOOKS.malaika.glasses, true);
  assert.equal(CHARACTER_LOOKS.malaika.tattoos, true);
});

test('photo-backed recurring characters have explicit non-random reference traits', () => {
  for (const id of ['nora', 'james', 'beaver', 'courtney', 'simla', 'zander', 'jace', 'boogaloo', 'lunice']) {
    assert.ok(CHARACTER_LOOKS[id], `missing look for ${id}`);
    assert.ok(Number.isFinite(CHARACTER_LOOKS[id].bodyWidth), `missing body width for ${id}`);
    assert.ok(Number.isFinite(CHARACTER_LOOKS[id].heightScale), `missing height scale for ${id}`);
  }
});

test('group photo countdown resolves to a synchronized 3-2-1-flash sequence', () => {
  assert.equal(groupPhotoCountdownLabel(1000, 4500), '3');
  assert.equal(groupPhotoCountdownLabel(1800, 4500), '3');
  assert.equal(groupPhotoCountdownLabel(2600, 4500), '2');
  assert.equal(groupPhotoCountdownLabel(3600, 4500), '1');
  assert.equal(groupPhotoCountdownLabel(4400, 4500), 'FLASH');
});

test('Below room orientation remains the recovered architecture', () => {
  const surfaces = new Map(levels.downstairs.navigation.surfaces.map((surface) => [surface.id, surface]));
  assert.equal(surfaces.get('lounge').name, 'Take A Break');
  assert.ok(surfaces.get('lounge').x1 > 0, 'Take A Break must remain on east side');
  assert.equal(surfaces.get('service').name, 'Kitchen + Bar');
  assert.ok(surfaces.get('service').x2 < 0, 'Kitchen + Bar must remain on west side');
  assert.equal(surfaces.get('east-service').name, 'Nora Photo Room / Production');
});
''',
)

print('character/social/photo pass applied')
