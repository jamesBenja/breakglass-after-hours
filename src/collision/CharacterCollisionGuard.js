const point = (value) => ({
  x: Number(value?.x) || 0,
  y: Number(value?.y) || 0,
  z: Number(value?.z) || 0,
});

const planarDistance = (a, b) => Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.z ?? 0) - (a?.z ?? 0));

/**
 * Keeps authored character motion inside the same collision world used by the player.
 * Large jumps are treated as intentional teleports (scene transitions, escorts, scripted snaps)
 * while ordinary frame-to-frame walking is resolved against walls and fixtures.
 */
export function constrainCharacterMotion(collision, beforeInput, position, maxStep = 2.5) {
  if (!collision || !beforeInput || !position) return false;
  const before = point(beforeInput);
  const attempted = point(position);
  const distance = planarDistance(before, attempted);
  if (!Number.isFinite(distance) || distance < 1e-6 || distance > maxStep) return false;

  // If a character was authored inside a solid, allow a valid destination to recover rather
  // than permanently trapping it. Normal walking begins using collision as soon as it is clear.
  if (!collision.isValidPosition(before) && collision.isValidPosition(attempted)) return false;

  const resolved = { ...before };
  collision.move(resolved, attempted.x - before.x, attempted.z - before.z, { grounded: true });
  position.x = resolved.x;
  position.z = resolved.z;
  if (Number.isFinite(resolved.y)) position.y = resolved.y;
  return Math.abs(resolved.x - attempted.x) > 1e-5 || Math.abs(resolved.z - attempted.z) > 1e-5;
}

export function snapshotNpcPositions(npcs) {
  return (npcs?.npcs ?? []).map((npc) => point(npc.group?.position));
}

export function constrainNpcPositions(collision, npcs, before) {
  let changed = false;
  for (let i = 0; i < (npcs?.npcs?.length ?? 0); i++) {
    const position = npcs.npcs[i]?.group?.position;
    if (position && constrainCharacterMotion(collision, before?.[i], position)) changed = true;
  }
  return changed;
}

export function snapshotCrowdPositions(crowd) {
  return (crowd?.members ?? []).map((member) => ({ x: member.currentX, y: 0, z: member.currentZ }));
}

export function constrainCrowdPositions(collision, crowd, before) {
  let changed = false;
  for (let i = 0; i < (crowd?.members?.length ?? 0); i++) {
    const member = crowd.members[i];
    const y = collision?.surfaceY?.(member.currentX, member.currentZ, 0) ?? 0;
    const position = { x: member.currentX, y, z: member.currentZ };
    if (constrainCharacterMotion(collision, before?.[i], position)) {
      member.currentX = position.x;
      member.currentZ = position.z;
      changed = true;
    }
  }
  return changed;
}
