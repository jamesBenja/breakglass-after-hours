/** Operates only on the active level; ignores out-of-range candidates individually. */
export class InteractionSystem {
  constructor(dispatch) {
    this.dispatch = dispatch;
    this.definition = null;
  }

  setLevel(definition) {
    this.definition = definition;
  }

  nearest(position) {
    let nearest = null;
    let best = Infinity;
    for (const [id, anchor] of Object.entries(this.definition?.anchors ?? {})) {
      const [x, y, z] = anchor.position;
      const distance = Math.hypot(position.x - x, position.y - y, position.z - z);
      if (distance <= anchor.radius && distance < best) {
        best = distance;
        nearest = { id, ...anchor };
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
