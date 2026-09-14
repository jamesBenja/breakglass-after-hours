/** Operates only on the active level; ignores out-of-range candidates individually. */
export class InteractionSystem {
  constructor(dispatch) {
    this.dispatch = dispatch;
    this.level = null;
    this.definition = null;
  }

  setLevel(level) {
    this.level = level?.definition ? level : null;
    this.definition = level?.definition ?? level ?? null;
  }

  candidates() {
    const result = [];
    for (const [id, anchor] of Object.entries(this.definition?.anchors ?? {})) {
      // Once a named NPC is a real roaming actor, do not leave a ghost interaction at its
      // original authoring anchor.
      if (anchor.action === 'dialogue' && this.level?.npcs?.has?.(id)) continue;
      result.push({ id, ...anchor });
    }
    result.push(...(this.level?.npcs?.interactionTargets?.() ?? []));
    return result;
  }

  nearest(position) {
    let nearest = null;
    let best = Infinity;
    for (const target of this.candidates()) {
      const [x, y, z] = target.position;
      const distance = Math.hypot(position.x - x, position.y - y, position.z - z);
      if (distance <= target.radius && distance < best) {
        best = distance;
        nearest = target;
      }
    }
    return nearest;
  }

  interact(position) {
    const target = this.nearest(position);
    if (!target) return false;
    this.dispatch(target);
    return true;
  }
}
