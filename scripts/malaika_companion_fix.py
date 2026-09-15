from pathlib import Path


def replace_one(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


replace_one(
    'src/gameplay/partyLifeEnhancements.js',
    """      speed: 0.58,
    });""",
    """      speed: 0.58,
      companionId: 'nora',
      companionOffset: [0.9, 0, 0.45],
    });""",
)

replace_one(
    'src/npcs/NpcSystem.js',
    """        speed: npc.speed ?? 0.48,
        phase: index * 2.1,""",
    """        speed: npc.speed ?? 0.48,
        companionId: npc.companionId ?? null,
        companionOffset: Array.isArray(npc.companionOffset)
          ? new Vector3().fromArray(npc.companionOffset)
          : new Vector3(0.85, 0, 0.45),
        phase: index * 2.1,""",
)

replace_one(
    'src/npcs/NpcSystem.js',
    """      npc.moving = false;
      if (npc.route.length > 1 && npc.photoPulse <= 0 && npc.servePulse <= 0) {
        const target = npc.route[npc.routeIndex % npc.route.length];
        const dx = target.x - npc.group.position.x;
        const dz = target.z - npc.group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.16) npc.routeIndex = (npc.routeIndex + 1) % npc.route.length;
        else {
          const amount = Math.min(distance, npc.speed * dt);
          npc.group.position.x += (dx / distance) * amount;
          npc.group.position.z += (dz / distance) * amount;
          npc.group.position.y += (target.y - npc.group.position.y) * (1 - Math.exp(-5 * dt));
          npc.group.rotation.y = Math.atan2(dx, dz);
          npc.moving = true;
        }
      }
""",
    """      npc.moving = false;
      const companion = npc.companionId ? this.get(npc.companionId) : null;
      if (companion && npc.photoPulse <= 0 && npc.servePulse <= 0) {
        const target = companion.group.position.clone().add(npc.companionOffset);
        const dx = target.x - npc.group.position.x;
        const dz = target.z - npc.group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.78) {
          const amount = Math.min(Math.max(0, distance - 0.64), npc.speed * 1.18 * dt);
          npc.group.position.x += (dx / distance) * amount;
          npc.group.position.z += (dz / distance) * amount;
          npc.group.position.y += (target.y - npc.group.position.y) * (1 - Math.exp(-5 * dt));
          npc.group.rotation.y = Math.atan2(dx, dz);
          npc.moving = amount > 0.001;
        } else {
          npc.group.rotation.y = companion.group.rotation.y;
        }
      } else if (npc.route.length > 1 && npc.photoPulse <= 0 && npc.servePulse <= 0) {
        const target = npc.route[npc.routeIndex % npc.route.length];
        const dx = target.x - npc.group.position.x;
        const dz = target.z - npc.group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.16) npc.routeIndex = (npc.routeIndex + 1) % npc.route.length;
        else {
          const amount = Math.min(distance, npc.speed * dt);
          npc.group.position.x += (dx / distance) * amount;
          npc.group.position.z += (dz / distance) * amount;
          npc.group.position.y += (target.y - npc.group.position.y) * (1 - Math.exp(-5 * dt));
          npc.group.rotation.y = Math.atan2(dx, dz);
          npc.moving = true;
        }
      }
""",
)

replace_one(
    'tests/character-social-pass.test.js',
    """  assert.ok(malaika.route.length >= 5);
  assert.ok(HOUSE_DJS.some((dj) => dj.id === 'malaika' && dj.name === 'DJ FLLEUR'));""",
    """  assert.ok(malaika.route.length >= 5);
  assert.equal(malaika.companionId, 'nora');
  assert.deepEqual(malaika.companionOffset, [0.9, 0, 0.45]);
  assert.ok(HOUSE_DJS.some((dj) => dj.id === 'malaika' && dj.name === 'DJ FLLEUR'));""",
)

print('Malaika companion behavior patched.')
