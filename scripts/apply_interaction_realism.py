from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_one(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def replace_all(path, old, new, minimum=1):
    text = read(path)
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f"{path}: expected at least {minimum} matches, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new))


# Make the temporary item interpolation stable instead of accumulating lerp error each frame.
props = 'src/gameplay/InteractionPropSystem.js'
replace_one(props, """      start: start.clone(),
      end: end.clone(),""", """      from: start.clone(),
      to: end.clone(),""")
replace_one(props, """      active.start.lerp(active.end, t);
      active.item.position.copy(active.start);""", """      active.item.position.lerpVectors(active.from, active.to, t);""")

# Install the visual transaction system beside the existing performance props.
installer = 'src/gameplay/installPerformanceRealismSystems.js'
write(installer, """import { InteractionPropSystem } from './InteractionPropSystem.js';
import { LedWallSystem } from './LedWallSystem.js';
import { PerformancePropSystem } from './PerformancePropSystem.js';

export function installPerformanceRealismSystems(game, ui) {
  if (!game || game._performanceRealismSystemsInstalled) return;
  game._performanceRealismSystemsInstalled = true;

  const ledWall = new LedWallSystem(game, ui);
  const props = new PerformancePropSystem(game);
  const interactionProps = new InteractionPropSystem(game);
  game.ledWall = ledWall;
  game.performanceProps = props;
  game.interactionProps = interactionProps;
  // BarServiceSystem is constructed before enhancement installers run, so attach its optional
  // visual collaborator here without changing bar state or audio behavior.
  game.barService.interactionProps = interactionProps;

  const baseDispatch = game.interactions.dispatch;
  game.interactions.dispatch = (target) => {
    if (target?.action === 'ledWall') {
      ledWall.showControls();
      return;
    }
    baseDispatch(target);
  };

  const baseAnimate = game.player.animate.bind(game.player);
  game.player.animate = (dt) => {
    baseAnimate(dt);
    props.update(dt);
    // Run last so short hand-to-mouth/handoff poses win only while an interaction is active.
    interactionProps.update(dt);
  };

  const baseDjUpdate = game.dj.update.bind(game.dj);
  game.dj.update = (dt) => {
    const result = baseDjUpdate(dt);
    ledWall.update(dt);
    return result;
  };

  const baseDispose = game.dispose.bind(game);
  game.dispose = async () => {
    interactionProps.dispose();
    props.dispose();
    ledWall.dispose();
    return baseDispose();
  };
}
""")

# Bar drinks now have a physical handoff and the coffee machine produces a cup the player drinks.
bar = 'src/gameplay/BarServiceSystem.js'
replace_one(bar, """    this.elapsedSinceSave = 0;
    this.syncPlayer();""", """    this.elapsedSinceSave = 0;
    this.interactionProps = null;
    this.syncPlayer();""")
replace_one(bar, """  serveAnimation(id) {
    this.sceneManager.current?.npcs?.triggerServe?.(id);
  }""", """  serveAnimation(id, kind = 'mixed') {
    this.sceneManager.current?.npcs?.triggerServe?.(id);
    this.sceneManager.current?.npcs?.triggerHandoff?.(id, kind);
  }

  handoff(id, kind) {
    this.interactionProps?.receiveFromNpc?.(id, kind);
  }""")
replace_one(bar, """      this.serveAnimation(id);
      this.panel(
        id,
        `${this.bartenderName(id)} cuts you off for now and puts a water in front of you.`,
      );""", """      this.serveAnimation(id, 'water');
      this.handoff(id, 'water');
      this.panel(
        id,
        `${this.bartenderName(id)} cuts you off for now and puts a water in front of you.`,
      );""")
replace_one(bar, """    this.serveAnimation(id);
    this.saveState();
    this.panel(id, `${this.bartenderName(id)} serves you a ${drink.label.toLowerCase()}.`);""", """    this.serveAnimation(id, drink.id);
    this.handoff(id, drink.id);
    this.saveState();
    this.panel(id, `${this.bartenderName(id)} serves you a ${drink.label.toLowerCase()}.`);""")
replace_one(bar, """    this.serveAnimation(id);
    this.saveState();
    this.panel(id, `${this.bartenderName(id)} hands you a water.`);""", """    this.serveAnimation(id, 'water');
    this.handoff(id, 'water');
    this.saveState();
    this.panel(id, `${this.bartenderName(id)} hands you a water.`);""")
replace_one(bar, """    this.state.data.coffeesMade =
      Math.max(0, Math.floor(Number(this.state.data.coffeesMade) || 0)) + 1;
    this.saveState();""", """    this.state.data.coffeesMade =
      Math.max(0, Math.floor(Number(this.state.data.coffeesMade) || 0)) + 1;
    this.interactionProps?.selfServe?.('coffee');
    this.saveState();""")

# Beaver physically hands over each item while retaining the existing state/economy logic.
world = 'src/gameplay/BelowAlleyWorldSystem.js'
replace_one(world, """            state.hotDogsEaten = Math.min(999, (state.hotDogsEaten || 0) + 1);
            this.save();""", """            state.hotDogsEaten = Math.min(999, (state.hotDogsEaten || 0) + 1);
            this.game.interactionProps?.receiveFromNpc?.('beaver', 'hotdog');
            this.save();""")
replace_one(world, """            state.tacosEaten = Math.min(999, (state.tacosEaten || 0) + 1);
            this.save();""", """            state.tacosEaten = Math.min(999, (state.tacosEaten || 0) + 1);
            this.game.interactionProps?.receiveFromNpc?.('beaver', 'taco');
            this.save();""")
replace_one(world, """            state.drinksServed = Math.min(999, (state.drinksServed || 0) + 1);
            state.intoxication = clamp01((state.intoxication || 0) + 0.08);
            this.save();""", """            state.drinksServed = Math.min(999, (state.drinksServed || 0) + 1);
            state.intoxication = clamp01((state.intoxication || 0) + 0.08);
            this.game.interactionProps?.receiveFromNpc?.('beaver', 'beer');
            this.save();""")

# Restore Devin's candy exchange choices.
dialogues = 'src/npcs/dialogues.js'
replace_one(dialogues, """    arcadeText:
      '“Wait — yes. Old fighting cabinets especially. Come on, come on. Mortal Kombat is right by the Clark stairs. The sound can wait thirty seconds.”',""", """    arcadeText:
      '“Wait — yes. Old fighting cabinets especially. Come on, come on. Mortal Kombat is right by the Clark stairs. The sound can wait thirty seconds.”',
    takeCandyPrompt: 'Take a candy from Devin',
    takeCandyText: '“Yeah, obviously. Take one. Sound-system sugar is part of the tuning protocol.”',
    giveCandyPrompt: 'Give Devin a candy',
    giveCandyText: '“For me? Perfect. This buys at least another ten minutes of obsessive system tuning.”',""")

game = 'src/core/Game.js'
old_options = """        [
          dialogue.arcadePrompt,
          () => {
            this.player.spawn(DEVIN_ARCADE_GUIDE.player, level.collision);
            const devin = level.npcs?.get?.('devin');
            if (devin?.group) {
              devin.group.position.fromArray(DEVIN_ARCADE_GUIDE.npc);
              devin.group.rotation.y = Math.atan2(
                this.player.position.x - devin.group.position.x,
                this.player.position.z - devin.group.position.z,
              );
            }
            ui.panel('DEVIN · OLD ARCADE GAMES', dialogue.arcadeText, [
              [
                'Play Mortal Kombat II',
                () => {
                  this.stopAll();
                  this.arcade.start();
                },
              ],
            ]);
          },
        ],
      ]);"""
new_options = """        [
          dialogue.arcadePrompt,
          () => {
            this.player.spawn(DEVIN_ARCADE_GUIDE.player, level.collision);
            const devin = level.npcs?.get?.('devin');
            if (devin?.group) {
              devin.group.position.fromArray(DEVIN_ARCADE_GUIDE.npc);
              devin.group.rotation.y = Math.atan2(
                this.player.position.x - devin.group.position.x,
                this.player.position.z - devin.group.position.z,
              );
            }
            ui.panel('DEVIN · OLD ARCADE GAMES', dialogue.arcadeText, [
              [
                'Play Mortal Kombat II',
                () => {
                  this.stopAll();
                  this.arcade.start();
                },
              ],
            ]);
          },
        ],
        [
          dialogue.takeCandyPrompt,
          () => {
            const candy = Math.max(0, Math.floor(Number(this.state.data.candy) || 0));
            if (candy >= 9) {
              ui.panel('DEVIN · CANDY', 'Your pockets are already full of candy.', [
                ['Back', openDevinDialogue],
              ]);
              return;
            }
            this.state.data.candy = candy + 1;
            this.state.data.devinFavor = Math.min(99, (this.state.data.devinFavor || 0) + 1);
            this.interactionProps?.receiveFromNpc?.('devin', 'candy', { consume: false });
            this.save();
            ui.panel(
              'DEVIN · CANDY',
              `${dialogue.takeCandyText} Candy in pocket: ${this.state.data.candy}.`,
              [['Back', openDevinDialogue]],
            );
          },
        ],
        [
          dialogue.giveCandyPrompt,
          () => {
            const candy = Math.max(0, Math.floor(Number(this.state.data.candy) || 0));
            if (candy <= 0) {
              ui.panel('DEVIN · CANDY', 'You check your pockets. No candy to give him yet.', [
                ['Back', openDevinDialogue],
              ]);
              return;
            }
            this.state.data.candy = candy - 1;
            this.state.data.devinFavor = Math.min(99, (this.state.data.devinFavor || 0) + 2);
            this.interactionProps?.giveToNpc?.('devin', 'candy');
            this.save();
            ui.panel(
              'DEVIN · CANDY',
              `${dialogue.giveCandyText} Candy in pocket: ${this.state.data.candy}.`,
              [['Back', openDevinDialogue]],
            );
          },
        ],
      ]);"""
replace_one(game, old_options, new_options)

# Generic NPC handoff pose so Beaver and Devin physically reach toward the prop transaction.
npcs = 'src/npcs/NpcSystem.js'
replace_one(npcs, """        photoPulse: 0,
        servePulse: 0,
        moving: false,""", """        photoPulse: 0,
        servePulse: 0,
        handoffPulse: 0,
        handoffKind: null,
        moving: false,""")
replace_one(npcs, """  triggerServe(id) {
    const npc = this.get(id);
    if (!npc || npc.role !== 'bartender') return false;
    npc.servePulse = 1.15;
    return true;
  }

  dialogue(id) {""", """  triggerServe(id) {
    const npc = this.get(id);
    if (!npc || npc.role !== 'bartender') return false;
    npc.servePulse = 1.15;
    return true;
  }

  triggerHandoff(id, kind = 'item') {
    const npc = this.get(id);
    if (!npc) return false;
    npc.handoffPulse = 1.15;
    npc.handoffKind = kind;
    return true;
  }

  dialogue(id) {""")
replace_one(npcs, """      npc.photoPulse = Math.max(0, npc.photoPulse - dt);
      npc.servePulse = Math.max(0, npc.servePulse - dt);
      npc.moving = false;""", """      npc.photoPulse = Math.max(0, npc.photoPulse - dt);
      npc.servePulse = Math.max(0, npc.servePulse - dt);
      npc.handoffPulse = Math.max(0, npc.handoffPulse - dt);
      if (npc.handoffPulse <= 0) npc.handoffKind = null;
      npc.moving = false;""")
replace_all(npcs, "npc.photoPulse <= 0 && npc.servePulse <= 0", "npc.photoPulse <= 0 && npc.servePulse <= 0 && npc.handoffPulse <= 0", minimum=3)
marker = """      if (npc.role === 'bartender' && npc.propKind === 'bar' && npc.prop) {"""
insert = """      if (npc.handoffPulse > 0 && npc.role !== 'bartender') {
        const phase = 1 - clamp(npc.handoffPulse / 1.15);
        const reach = Math.sin(Math.min(1, phase * 1.32) * Math.PI) * 0.52;
        npc.rightArm.rotation.x = -0.18 - reach * 1.05;
        npc.rightArm.rotation.z = 0.06 + reach * 0.14;
        npc.rightForearm.rotation.x = -0.28 - reach * 1.18;
        npc.leftArm.rotation.x = -0.08 - reach * 0.16;
        npc.body.rotation.x = -reach * 0.045;
        npc.head.rotation.x = -reach * 0.035;
        if (npc.prop && npc.propKind === 'candy') {
          npc.prop.position.set(0.3, 1.17 + reach * 0.08, 0.2 + reach * 0.55);
        }
      } else if (npc.prop && npc.propKind === 'candy') {
        npc.prop.position.set(0.31, 1.2, 0.2);
      }

      if (npc.role === 'bartender' && npc.propKind === 'bar' && npc.prop) {"""
replace_one(npcs, marker, insert)

# Make the shared low-poly human more human without changing root scale, anchors or collision.
human = 'src/avatar/LightweightHuman.js'
replace_one(human, """  const eyeWhite = material(0xf2efe8, { roughness: 0.5 });
  const pupilMaterial = material(0x171419, { roughness: 0.45 });""", """  const eyeWhite = material(0xf2efe8, { roughness: 0.5 });
  const irisMaterial = material(0x5b4338, { roughness: 0.42 });
  const pupilMaterial = material(0x171419, { roughness: 0.4 });""")
replace_one(human, """  const cranium = sphere(0.225, skinMaterial, 14, 10);
  cranium.scale.set(0.93, 1.04, 0.92);
  const jaw = sphere(0.175, skinMaterial, 12, 9);
  jaw.position.y = -0.13;
  jaw.scale.set(0.9, 0.7, 0.84);
  head.add(cranium, jaw);""", """  const cranium = sphere(0.225, skinMaterial, 16, 12);
  cranium.name = 'cranium';
  cranium.scale.set(0.93, 1.04, 0.92);
  const jaw = sphere(0.175, skinMaterial, 14, 10);
  jaw.name = 'jaw';
  jaw.position.y = -0.13;
  jaw.scale.set(0.9, 0.7, 0.84);
  head.add(cranium, jaw);
  for (const [side, x] of [['left', -0.218], ['right', 0.218]]) {
    const ear = sphere(0.043, skinMaterial, 8, 6);
    ear.name = `ear-${side}`;
    ear.scale.set(0.48, 1, 0.42);
    ear.position.set(x, -0.01, -0.002);
    head.add(ear);
  }""")
replace_one(human, """    const pupil = sphere(0.011, pupilMaterial, 7, 5);
    pupil.scale.z = 0.45;
    pupil.position.set(x, 0.03, 0.225);
    head.add(white, pupil);""", """    const iris = sphere(0.017, irisMaterial, 8, 6);
    iris.name = x < 0 ? 'iris-left' : 'iris-right';
    iris.scale.set(1, 0.78, 0.42);
    iris.position.set(x, 0.03, 0.222);
    const pupil = sphere(0.008, pupilMaterial, 7, 5);
    pupil.name = x < 0 ? 'pupil-left' : 'pupil-right';
    pupil.scale.z = 0.4;
    pupil.position.set(x, 0.03, 0.232);
    head.add(white, iris, pupil);""")
replace_one(human, """  const nose = sphere(0.031, skinMaterial, 8, 6);
  nose.scale.set(0.75, 0.75, 0.9);
  nose.position.set(0, -0.044, 0.226);
  const mouth = box(0.077, 0.011, 0.014, accentMaterial);
  mouth.position.set(0, -0.116, 0.188);
  head.add(nose, mouth);""", """  const noseBridge = capsule(0.021, 0.055, skinMaterial, 6);
  noseBridge.name = 'nose-bridge';
  noseBridge.position.set(0, -0.008, 0.211);
  noseBridge.rotation.x = Math.PI / 2;
  const nose = sphere(0.031, skinMaterial, 8, 6);
  nose.name = 'nose-tip';
  nose.scale.set(0.75, 0.72, 0.9);
  nose.position.set(0, -0.047, 0.23);
  const mouth = box(0.082, 0.012, 0.014, accentMaterial);
  mouth.name = 'mouth';
  mouth.position.set(0, -0.116, 0.192);
  head.add(noseBridge, nose, mouth);""")

# Add visual detail to the existing gear meshes only. Device positions and all interaction/audio
# anchors stay unchanged.
dj = 'src/scenes/geometry/djBoothRealism.js'
replace_one(dj, "import { MeshStandardMaterial } from 'three';", "import { Mesh, MeshStandardMaterial, TorusGeometry } from 'three';")
replace_one(dj, "const DEVICE_SCALE = 1.9;", """const DEVICE_SCALE = 1.9;
export const DJ_BOOTH_VISUAL_REVISION = '2026-09-16-realism-2';""")
replace_one(dj, """  const screen = new MeshStandardMaterial({
    color: 0x081018,
    emissive: 0x287db8,
    emissiveIntensity: 1.25,
    roughness: 0.22,
    metalness: 0.08,
  });""", """  const screen = new MeshStandardMaterial({
    color: 0x081018,
    emissive: 0x287db8,
    emissiveIntensity: 1.25,
    roughness: 0.22,
    metalness: 0.08,
  });
  const addJogRing = (x, y, z, radius, color = 0xb5bac0) => {
    const ring = new Mesh(
      new TorusGeometry(radius, 0.018, 8, 28),
      new MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.76 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, z);
    ring.castShadow = true;
    root.add(ring);
    return ring;
  };""")
replace_one(dj, """    cyl(root, 0.332 * DEVICE_SCALE * 0.5, 0.055, platter, x - 0.06 * side, topY + 0.14, deskZ);
    cyl(root, 0.053, 0.065, dark, x - 0.06 * side, topY + 0.17, deskZ);""", """    cyl(root, 0.332 * DEVICE_SCALE * 0.5, 0.055, platter, x - 0.06 * side, topY + 0.14, deskZ);
    cyl(root, 0.28, 0.022, black, x - 0.06 * side, topY + 0.178, deskZ);
    cyl(root, 0.055, 0.026, side < 0 ? blue : red, x - 0.06 * side, topY + 0.196, deskZ);
    addJogRing(x - 0.06 * side, topY + 0.205, deskZ, 0.292, 0xb8bdc1);
    cyl(root, 0.019, 0.045, silver, x - 0.06 * side, topY + 0.218, deskZ);""")
replace_one(dj, """    const jog = cyl(root, 0.21, 0.055, platter, x, topY + 0.18, deskZ + 0.08);
    jog.name = side < 0 ? 'cdj-left-jog' : 'cdj-right-jog';
    cyl(root, 0.155, 0.02, dark, x, topY + 0.215, deskZ + 0.08);""", """    const jog = cyl(root, 0.21, 0.055, platter, x, topY + 0.18, deskZ + 0.08);
    jog.name = side < 0 ? 'cdj-left-jog' : 'cdj-right-jog';
    addJogRing(x, topY + 0.218, deskZ + 0.08, 0.215);
    cyl(root, 0.155, 0.02, dark, x, topY + 0.215, deskZ + 0.08);
    cyl(root, 0.048, 0.018, silver, x, topY + 0.232, deskZ + 0.08);
    // A few small waveform/transport details make the decks read as actual media players.
    for (let i = 0; i < 6; i += 1)
      box(root, 0.055, 0.012, 0.018, i % 2 ? blue : green, x - 0.16 + i * 0.064, topY + 0.199, deskZ - depth * 0.27);""")
replace_one(dj, """      for (const [z, color] of [
        [-0.28, amber],
        [-0.18, white],
        [-0.08, blue],
      ]) {
        cyl(root, 0.025, 0.027, color, cx, topY + 0.2, deskZ + z);
      }
      box(root, 0.026, 0.018, 0.25, dark, cx, topY + 0.205, deskZ + 0.19);""", """      // Gain, 3-band EQ and filter stack for each mixer channel.
      for (const [z, color] of [
        [-0.34, white],
        [-0.26, amber],
        [-0.18, white],
        [-0.1, blue],
        [-0.02, green],
      ]) {
        cyl(root, 0.024, 0.027, color, cx, topY + 0.2, deskZ + z);
      }
      for (let meter = 0; meter < 5; meter += 1)
        box(root, 0.012, 0.012, 0.025, meter > 3 ? red : green, cx + 0.035, topY + 0.202, deskZ + 0.04 + meter * 0.035);
      box(root, 0.026, 0.018, 0.25, dark, cx, topY + 0.205, deskZ + 0.19);""")

# Regression coverage for the visual-only pass.
test = Path('tests/interaction-realism.test.js')
test.write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import {
  createInteractionItem,
  INTERACTION_ITEM_PROFILES,
} from '../src/gameplay/InteractionPropSystem.js';
import { BarServiceSystem } from '../src/gameplay/BarServiceSystem.js';
import { createLightweightHuman } from '../src/avatar/LightweightHuman.js';
import { dialogues } from '../src/npcs/dialogues.js';
import { NpcSystem } from '../src/npcs/NpcSystem.js';
import { DJ_BOOTH_VISUAL_REVISION } from '../src/scenes/geometry/djBoothRealism.js';

test('food, drink, coffee and candy all have physical interaction props', () => {
  for (const kind of ['beer', 'mixed', 'water', 'coffee', 'hotdog', 'taco', 'candy']) {
    assert.ok(INTERACTION_ITEM_PROFILES[kind], `missing ${kind}`);
    const prop = createInteractionItem(kind);
    assert.ok(prop.children.length > 0, `${kind} should render visible geometry`);
  }
});

test('bar service requests visible handoffs and coffee consumption', () => {
  const events = [];
  const state = { data: { intoxication: 0, caffeine: 0, drinksServed: 0, coffeesMade: 0 } };
  const system = new BarServiceSystem({
    state,
    player: { setIntoxication() {} },
    ui: { panel() {} },
    sceneManager: {
      current: {
        definition: { id: 'downstairs' },
        npcs: { triggerServe() {}, triggerHandoff() {}, get: () => ({ name: 'Courtney' }) },
      },
    },
    saveState() {},
  });
  system.interactionProps = {
    receiveFromNpc: (id, kind) => events.push(['receive', id, kind]),
    selfServe: (kind) => events.push(['self', kind]),
  };
  system.order('courtney', { id: 'beer', label: 'Beer / cider', strength: 0.17 });
  system.water('courtney');
  system.coffee();
  assert.deepEqual(events, [
    ['receive', 'courtney', 'beer'],
    ['receive', 'courtney', 'water'],
    ['self', 'coffee'],
  ]);
});

test('Devin exposes both directions of the candy exchange again', () => {
  assert.match(dialogues.devin.takeCandyPrompt, /take.*candy/i);
  assert.match(dialogues.devin.giveCandyPrompt, /give.*candy/i);
});

test('generic NPCs can perform a handoff pose', () => {
  const root = new Group();
  const system = new NpcSystem(root, {
    anchors: {},
    npcs: [{ id: 'beaver', name: 'Beaver', role: 'host', position: [0, 0, 0] }],
  });
  assert.equal(system.triggerHandoff('beaver', 'hotdog'), true);
  assert.ok(system.get('beaver').handoffPulse > 0);
  system.dispose();
});

test('lightweight people now include more facial anatomy without changing their root rig', () => {
  const model = createLightweightHuman();
  const names = new Set(model.head.children.map((child) => child.name));
  for (const name of ['ear-left', 'ear-right', 'iris-left', 'iris-right', 'nose-bridge', 'nose-tip'])
    assert.ok(names.has(name), `missing ${name}`);
});

test('DJ booth visual model has the second realism revision', () => {
  assert.equal(DJ_BOOTH_VISUAL_REVISION, '2026-09-16-realism-2');
});
""")

print('interaction realism patch applied')
