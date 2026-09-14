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
  'v',
]);
const actionKeys = {
  e: 'interact',
  f: 'dance',
  ' ': 'jump',
  m: 'stopAudio',
  j: 'jump',
  c: 'recenter',
  v: 'toggleView',
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
    this.touchDirections = new Set();
    this.touchBindings = [];
    this.touchPointerId = null;
    this.touchLastX = 0;
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
    this.touchPointerId = null;
    this.cameraDelta = this.zoomDelta = 0;
    this.keys.clear();
    this.actions.clear();
    this.touchDirections.clear();
  }

  consume(action) {
    return this.actions.delete(action);
  }

  movement() {
    const x =
      Number(this.keys.has('d') || this.keys.has('arrowright')) -
      Number(this.keys.has('a') || this.keys.has('arrowleft')) +
      Number(this.touchDirections.has('right')) -
      Number(this.touchDirections.has('left'));
    const z =
      Number(this.keys.has('s') || this.keys.has('arrowdown')) -
      Number(this.keys.has('w') || this.keys.has('arrowup')) +
      Number(this.touchDirections.has('down')) -
      Number(this.touchDirections.has('up'));
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
      if (!this.enabled) return;
      const isTouch = event.pointerType === 'touch';
      if (!isTouch && event.button !== 2) return;
      this.dragging = true;
      this.touchPointerId = isTouch ? event.pointerId : null;
      this.touchLastX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    this.onPointerMove = (event) => {
      if (!this.enabled || !this.dragging) return;
      if (this.touchPointerId != null && event.pointerId !== this.touchPointerId) return;
      const movementX =
        event.pointerType === 'touch' ? event.clientX - this.touchLastX : event.movementX;
      this.touchLastX = event.clientX;
      this.cameraDelta -= movementX * 0.006;
      event.preventDefault();
    };
    this.onPointerUp = (event) => {
      if (this.touchPointerId != null && event.pointerId !== this.touchPointerId) return;
      this.dragging = false;
      this.touchPointerId = null;
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

  bindTouchControls(root = document) {
    const controls = root.getElementById?.('mobileControls');
    if (!controls) return;

    const bind = (element, type, listener) => {
      element.addEventListener(type, listener, { passive: false });
      this.touchBindings.push([element, type, listener]);
    };

    for (const button of controls.querySelectorAll('[data-move]')) {
      const direction = button.dataset.move;
      const press = (event) => {
        if (!this.enabled) return;
        this.touchDirections.add(direction);
        button.classList.add('pressed');
        button.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      };
      const release = (event) => {
        this.touchDirections.delete(direction);
        button.classList.remove('pressed');
        event.preventDefault();
      };
      bind(button, 'pointerdown', press);
      bind(button, 'pointerup', release);
      bind(button, 'pointercancel', release);
      bind(button, 'pointerleave', release);
    }

    for (const button of controls.querySelectorAll('[data-action]')) {
      const action = button.dataset.action;
      const press = (event) => {
        if (!this.enabled) return;
        this.actions.add(action);
        button.classList.add('pressed');
        event.preventDefault();
      };
      const release = (event) => {
        button.classList.remove('pressed');
        event.preventDefault();
      };
      bind(button, 'pointerdown', press);
      bind(button, 'pointerup', release);
      bind(button, 'pointercancel', release);
      bind(button, 'pointerleave', release);
    }
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
    for (const [element, type, listener] of this.touchBindings) {
      element.removeEventListener(type, listener);
    }
    this.touchBindings = [];
    this.clear();
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
  }
}
