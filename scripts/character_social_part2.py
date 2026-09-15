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
# Sam and Malaika world roles/dialogue
# -----------------------------------------------------------------------------
dialogues = 'src/npcs/dialogues.js'
replace_one(
    dialogues,
    """  bouncer: {
    title: 'DOOR',
    text: '“You’re good. Head in when you’re ready. And please keep it down if you come back outside.”',
  },""",
    """  sam: {
    title: 'SAM · SECURITY',
    text: '“You’re good. Head in when you’re ready. If you come back outside, keep the alley chill for the neighbours.”',
  },
  malaika: {
    title: 'MALAIKA / DJ FLLEUR',
    text: '“Get in the photo. Nora has the camera — I’ll make sure everybody actually looks alive.”',
  },""",
)

alley = 'src/world/alley.js'
replace_one(
    alley,
    "bouncer: anchor('Bouncer', [-4.9, 0, -1.2], 1.2, 'dialogue'),",
    "sam: anchor('Sam · security', [-4.9, 0, -1.2], 1.25, 'dialogue'),",
)
replace_one(
    alley,
    "{ id: 'bouncer', name: 'Door', anchor: 'bouncer', role: 'staff', color: 0x394653 },",
    "{ id: 'sam', name: 'Sam', anchor: 'sam', role: 'security', color: 0x252a31, rotationY: -Math.PI / 2 },",
)

# -----------------------------------------------------------------------------
# Group photo system (shared through existing multiplayer world-object channel)
# -----------------------------------------------------------------------------
# GroupPhotoSystem.js is committed separately before this patch runs.


party = 'src/gameplay/partyLifeEnhancements.js'
replace_one(
    party,
    "import { LiveBandSystem } from './LiveBandSystem.js';",
    "import { LiveBandSystem } from './LiveBandSystem.js';\nimport { GroupPhotoSystem } from './GroupPhotoSystem.js';",
)
replace_one(
    party,
    """export function preparePartyLifeWorld() {
  if (prepared) return;
  prepared = true;

  const alley = levels.alley;""",
    """export function preparePartyLifeWorld() {
  if (prepared) return;
  prepared = true;

  const downstairs = levels.downstairs;
  if (!downstairs.npcs.some((npc) => npc.id === 'malaika')) {
    downstairs.npcs.push({
      id: 'malaika',
      name: 'Malaika / DJ FLLEUR',
      role: 'photo-hype',
      position: [-1.75, 0, 1.55],
      route: [
        [-1.75, 0, 1.55],
        [0.85, 0, 2.2],
        [4.05, 0, -0.55],
        [7.35, 0, 4.05],
        [8.1, 0, 5.15],
        [-1.75, 0, 1.55],
      ],
      speed: 0.58,
    });
  }

  const alley = levels.alley;""",
)
replace_one(
    party,
    """  const photos = new PartyLifePhotoSystem(game, ui);
  const houseDj = new HouseDjSystem(game, ui);
  const liveBand = new LiveBandSystem(game);
  const smoking = new SmokingSystem(game, ui);
  game.partyLife = { photos, houseDj, liveBand, smoking };""",
    """  const photos = new PartyLifePhotoSystem(game, ui);
  const groupPhoto = new GroupPhotoSystem(game, ui, photos);
  const houseDj = new HouseDjSystem(game, ui);
  const liveBand = new LiveBandSystem(game);
  const smoking = new SmokingSystem(game, ui);
  game.partyLife = { photos, groupPhoto, houseDj, liveBand, smoking };
  // createActions holds the original PhotoSystem object, so expose the new social action there
  // without coupling the core Game constructor to the later multiplayer enhancement layer.
  game.photos.startGroupPhoto = (photographerId = 'nora') => groupPhoto.start(photographerId);
  game.photos.joinGroupPhoto = () => groupPhoto.join();""",
)
replace_one(
    party,
    """  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (target?.action === 'dj' && houseDj.isHouseAudio()) {""",
    """  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    const npcId = target?.npcId ?? target?.id;
    if (target?.action === 'dialogue' && ['nora', 'malaika'].includes(npcId)) {
      const isMalaika = npcId === 'malaika';
      ui.panel(
        isMalaika ? 'MALAIKA / DJ FLLEUR' : 'NORA · PHOTOGRAPHER',
        isMalaika
          ? 'Malaika is moving with Nora, hyping people into the frame and occasionally jumping into the shot herself.'
          : 'Nora has the camera ready. Take a quick portrait or turn it into a shared group photo.',
        [
          ['Start group photo', () => groupPhoto.start('nora')],
          ['Quick portrait', () => void photos.capturePortrait('nora')],
          ['Talk', () => baseDispatch(target)],
        ],
      );
      return;
    }
    if (target?.action === 'dj' && houseDj.isHouseAudio()) {""",
)
replace_one(
    party,
    """      smoking.update(dt);
      photos.update(dt, liveBand.center);""",
    """      smoking.update(dt);
      photos.update(dt, liveBand.center);
      groupPhoto.update(dt);""",
)
replace_one(
    party,
    """    photos.dispose();
    houseDj.dispose();""",
    """    photos.dispose();
    groupPhoto.dispose();
    houseDj.dispose();""",
)

# -----------------------------------------------------------------------------
# Malaika can also rotate into the actual booth; off-duty she resumes roaming with Nora.
# House DJs use the same named-character look profiles when one exists.
# -----------------------------------------------------------------------------
house = 'src/gameplay/HouseDjSystem.js'
replace_one(
    house,
    "import { createLightweightHuman, poseLightweightHuman } from '../avatar/LightweightHuman.js';",
    "import { poseLightweightHuman } from '../avatar/LightweightHuman.js';\nimport { createNpcCharacter } from '../npcs/NpcSystem.js';",
)
replace_one(
    house,
    "{ id: 'james-benjamin', name: 'James Benjamin', trackId: 'in-flux-break', accent: 0xff5e91 },",
    "{ id: 'james-benjamin', characterId: 'james', name: 'James Benjamin', trackId: 'in-flux-break', accent: 0xff5e91 },\n  { id: 'malaika', characterId: 'malaika', name: 'DJ FLLEUR', trackId: 'atrakar', accent: 0xff587e },",
)
sub_one(
    house,
    r"function person\(accent\) \{.*?\n\}",
    r"""function person(dj) {
  const model = createNpcCharacter({
    id: dj.characterId ?? dj.id,
    name: dj.name,
    appearance: { accent: dj.accent, prop: null },
  });

  // Headphones follow the head rather than floating at a fixed world-space height.
  const detail = new MeshStandardMaterial({ color: dj.accent, roughness: 0.55 });
  const band = new Mesh(new BoxGeometry(0.4, 0.045, 0.07), detail);
  band.position.set(0, 0.17, 0);
  const leftCup = new Mesh(new BoxGeometry(0.055, 0.12, 0.085), detail);
  const rightCup = leftCup.clone();
  leftCup.position.set(-0.205, 0.02, 0);
  rightCup.position.set(0.205, 0.02, 0);
  model.head.add(band, leftCup, rightCup);
  model.headphones = { band, leftCup, rightCup };
  model.detail = detail;
  return model;
}""",
)
replace_one(house, "const model = person(this.selected.accent);", "const model = person(this.selected);")
replace_one(
    house,
    """  applyLook() {
    if (this.performer) {
      this.performer.detail.color.setHex(this.selected.accent);
      this.performer.materials.accent.color.setHex(this.selected.accent);
    }
  }""",
    """  applyLook() {
    const downstairs = this.game.scenes.get('downstairs');
    if (!downstairs || !this.performer) return;
    const position = this.performer.group.position.clone();
    const rotation = this.performer.group.rotation.y;
    this.performer.group.removeFromParent();
    const model = person(this.selected);
    model.group.name = 'house-dj';
    model.group.position.copy(position);
    model.group.rotation.y = rotation;
    downstairs.gameplay.add(model.group);
    this.performer = model;
  }""",
)
replace_one(
    house,
    """    if (this.performer) {
      this.performer.group.visible = !playerDj && !studioPlaybackDownstairs;
      const metrics = this.game.dj.metrics?.() ?? {};""",
    """    if (this.performer) {
      this.performer.group.visible = !playerDj && !studioPlaybackDownstairs;
      const malaika = this.game.scenes.get('downstairs')?.npcs?.get?.('malaika');
      if (malaika?.group)
        malaika.group.visible = !(this.selectedId === 'malaika' && this.performer.group.visible);
      const metrics = this.game.dj.metrics?.() ?? {};""",
)
