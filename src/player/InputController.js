const handled = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'e',
  ' ',
  'm',
  'j',
  'f3',
  'f',
  'q',
  'r',
  'c',
]);
const actionKeys = {
  e: 'interact',
  f: 'dance',
  ' ': 'jump',
  m: 'stopAudio',
  j: 'jump',
  c: 'recenter',
  f3: 'debug',
};

export class InputController {
  constructor(target = window) {
    this.target = target;
    this.enabled = false;
    this.dragging = false;
    this.cameraDelta = 0;
    this.zoomDelta = 0;
    this.keys = new Set();
    this.actions = new Set();
    this.onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (!this.enabled || !handled.has(key) || event.altKey || event.ctrlKey || event.metaKey)
        return;
      if (event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      // Let keyboard activation of a focused button work normally.
      if (key === ' ' && event.target?.closest?.('button')) return;
      event.preventDefault();
      this.keys.add(key);
      if (!event.repeat && actionKeys[key]) this.actions.add(actionKeys[key]);
    };
    this.onKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
    this.onBlur = () => this.clear();
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.clear();
  }

  clear() {
    this.dragging = false;
    this.cameraDelta = this.zoomDelta = 0;
    this.keys.clear();
    this.actions.clear();
  }

  consume(action) {
    return this.actions.delete(action);
  }

  movement() {
    const x =
      Number(this.keys.has('d') || this.keys.has('arrowright')) -
      Number(this.keys.has('a') || this.keys.has('arrowleft'));
    const z =
      Number(this.keys.has('s') || this.keys.has('arrowdown')) -
      Number(this.keys.has('w') || this.keys.has('arrowup'));
    const length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
  }

  cameraInput(dt) {
    const orbit =
      (Number(this.keys.has('r')) - Number(this.keys.has('q'))) * 1.8 * dt + this.cameraDelta;
    const zoom = this.zoomDelta;
    this.cameraDelta = this.zoomDelta = 0;
    return { orbit, zoom };
  }

  bindCamera(canvas) {
    this.canvas = canvas;
    this.onPointerDown = (event) => {
      if (this.enabled && event.button === 2) {
        this.dragging = true;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    };
    this.onPointerMove = (event) => {
      if (this.enabled && this.dragging) this.cameraDelta -= event.movementX * 0.006;
    };
    this.onPointerUp = () => {
      this.dragging = false;
    };
    this.onContextMenu = (event) => event.preventDefault();
    this.onWheel = (event) => {
      if (this.enabled) {
        this.zoomDelta += event.deltaY * 0.01;
        event.preventDefault();
      }
    };
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  dispose() {
    if (this.canvas) {
      for (const [type, listener] of [
        ['pointerdown', this.onPointerDown],
        ['pointermove', this.onPointerMove],
        ['pointerup', this.onPointerUp],
        ['pointercancel', this.onPointerUp],
        ['contextmenu', this.onContextMenu],
        ['wheel', this.onWheel],
      ])
        this.canvas.removeEventListener(type, listener);
    }
    this.clear();
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
  }
}
