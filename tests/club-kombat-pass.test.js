import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KOMBAT_FIGHTERS,
  chooseCpuFighter,
  fighterById,
  specialVisualForHit,
} from '../src/arcade/fighters.js';
import { dialogues } from '../src/npcs/dialogues.js';
import {
  BELOW_SOUND_RIG,
  DEVIN_ARCADE_GUIDE,
  MORTAL_KOMBAT_CABINET,
} from '../src/world/belowClubConfig.js';
import { levels } from '../src/world/levels.js';

test('Below uses four ceiling-hung corner quads and a suspended center sub', () => {
  assert.equal(BELOW_SOUND_RIG.quads.length, 4);
  for (const [x, y, z] of BELOW_SOUND_RIG.quads) {
    assert.ok(Math.abs(x) > 4.5, 'quad should live in a room corner');
    assert.ok(Math.abs(z) > 2.3, 'quad should live in a room corner');
    assert.ok(y > 2, 'quad should be suspended above head height');
  }
  assert.ok(
    BELOW_SOUND_RIG.quadSize[0] > BELOW_SOUND_RIG.quadSize[1] * 1.8,
    'quad cabinets should be horizontally oriented',
  );
  assert.equal(BELOW_SOUND_RIG.sub[0], 0);
  assert.equal(BELOW_SOUND_RIG.sub[2], 0);
  assert.ok(BELOW_SOUND_RIG.sub[1] > 2, 'sub should hang from the ceiling');
});

test('Mortal Kombat cabinet sits beside the Clark emergency stair', () => {
  assert.deepEqual(levels.downstairs.anchors.arcade.position, MORTAL_KOMBAT_CABINET);
  const [x, , z] = MORTAL_KOMBAT_CABINET;
  assert.ok(x > 5.0 && x < 5.8, 'cabinet should be tucked into the east Clark-stair corner');
  assert.ok(z < -2.3 && z > -3.2);
  const clark = levels.downstairs.anchors.clarkEmergencyExit.position;
  const distance = Math.hypot(clark[0] - x, clark[2] - z);
  assert.ok(distance < 2.5, 'cabinet should be immediately beside the Clark exit route');
});

test('Devin has a sound conversation and an old-arcade escort beat', () => {
  assert.match(dialogues.devin.text, /four hangs/i);
  assert.match(dialogues.devin.soundPrompt, /listening/i);
  assert.match(dialogues.devin.arcadePrompt, /old arcade games/i);
  assert.match(dialogues.devin.arcadeText, /Mortal Kombat/i);
  assert.ok(DEVIN_ARCADE_GUIDE.player[0] > 4.5);
  assert.ok(DEVIN_ARCADE_GUIDE.npc[0] > 3.5);
});

test('Underground Kombat exposes the requested ten-character scene roster', () => {
  assert.equal(KOMBAT_FIGHTERS.length, 10);
  const names = KOMBAT_FIGHTERS.map((fighter) => fighter.name);
  for (const name of [
    'THE PROMOTER',
    'THE VINYL DJ',
    'THE TIK TOK DJ',
    'THE K KIDS',
    'THE HEADS',
    'THE PRODUCER',
    'THE LIGHTING PERSON',
    'NON BINARY',
    'MUSCLE GAY',
    'OLDER RAVER',
  ])
    assert.ok(names.includes(name), `missing ${name}`);
});

test('The Promoter throws booking books and can remove the opposing DJ from the lineup', () => {
  const promoter = fighterById('promoter');
  assert.match(promoter.moves.light, /BOOK/);
  assert.match(promoter.moves.special, /DISAPPEAR/);
  const visual = specialVisualForHit(
    promoter,
    {
      type: 'hit',
      target: 'opponent',
      attack: 'special',
      guarded: false,
    },
    100,
  );
  assert.equal(visual.side, 'opponent');
  assert.equal(visual.label, 'DJ REMOVED FROM LINEUP');
  assert.ok(visual.until > 100);
});

test('CPU fighter selection never mirrors the selected player', () => {
  for (const fighter of KOMBAT_FIGHTERS) {
    assert.notEqual(chooseCpuFighter(fighter.id, () => 0).id, fighter.id);
    assert.notEqual(chooseCpuFighter(fighter.id, () => 0.999).id, fighter.id);
  }
});
