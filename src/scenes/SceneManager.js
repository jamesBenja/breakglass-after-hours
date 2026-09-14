/** Owns floor membership and a timed fade state machine. No browser timers. */
export class SceneManager {
  constructor({ scenes, player, onEnter = () => {}, onFade = () => {} }) {
    this.scenes = scenes;
    this.player = player;
    this.onEnter = onEnter;
    this.onFade = onFade;
    this.current = null;
    this.pending = null;
    this.phase = 'idle';
    this.remaining = 0;
  }

  get changing() {
    return this.phase !== 'idle';
  }

  enter(id, spawn = 'stairs', savedPosition = null) {
    const level = this.scenes.get(id);
    if (!level) throw new Error(`Unknown scene: ${id}`);
    const candidate = savedPosition && {
      x: savedPosition[0],
      y: savedPosition[1],
      z: savedPosition[2],
    };
    const position =
      candidate && level.collision.isValidPosition(candidate)
        ? savedPosition
        : level.definition.spawns[spawn];
    if (!position) throw new Error(`Unknown spawn: ${id}/${spawn}`);
    this.player.object.removeFromParent();
    level.scene.add(this.player.object);
    this.player.spawn(position, level.collision);
    this.current = level;
    this.onEnter(level);
  }

  start(id, position = null) {
    this.enter(id, 'start', position);
  }

  request(destination, spawn = 'stairs') {
    let id = destination;
    if (typeof destination === 'string' && destination.includes('@')) {
      const parts = destination.split('@');
      id = parts[0];
      spawn = parts[1] || spawn;
    }
    if (this.changing || !this.scenes.has(id) || this.current?.definition.id === id) return false;
    this.pending = { id, spawn };
    this.phase = 'out';
    this.remaining = 0.3;
    this.onFade(true);
    return true;
  }

  update(dt) {
    if (!this.changing) return;
    this.remaining -= dt;
    if (this.remaining > 1e-8) return;
    if (this.phase === 'out') {
      this.enter(this.pending.id, this.pending.spawn);
      this.pending = null;
      this.phase = 'in';
      this.remaining = 0.06;
      this.onFade(false);
    } else {
      this.phase = 'idle';
    }
  }

  dispose() {
    this.player.object.removeFromParent();
    for (const level of this.scenes.values()) level.dispose();
    this.scenes.clear();
    this.current = null;
    this.pending = null;
    this.phase = 'idle';
  }
}
