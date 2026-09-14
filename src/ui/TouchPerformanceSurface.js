const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const BLACK_KEYS = [
  [1, 0],
  [3, 1],
  [6, 3],
  [8, 4],
  [10, 5],
  [13, 7],
  [15, 8],
];

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const DRUMS = [
  ['kick', 'KICK'],
  ['snare', 'SNARE'],
  ['closed-hat', 'CLOSED\nHAT'],
  ['open-hat', 'OPEN\nHAT'],
  ['low-tom', 'LOW\nTOM'],
  ['high-tom', 'HIGH\nTOM'],
  ['crash', 'CRASH'],
];

const isTouchDevice = () => {
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  return globalThis.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches === true;
};

const noteName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/**
 * Mobile performance surface. It deliberately stays DOM-based: taps are immediate, multi-touch
 * works on separate buttons, and the Three.js scene does not need a second input/raycast layer.
 */
export class TouchPerformanceSurface {
  constructor(document = globalThis.document) {
    this.document = document;
    this.element = null;
    this.performance = null;
    this.renderToken = 0;
    this.enhanceLabels();
  }

  enhanceLabels() {
    if (!this.document || !isTouchDevice() || typeof MutationObserver === 'undefined') return;
    const buttons = this.document.getElementById('buttons');
    if (!buttons) return;
    const relabel = () => {
      for (const button of buttons.querySelectorAll('button')) {
        if (button.textContent === 'Play with keyboard') button.textContent = 'Play instrument';
        if (button.textContent === 'Play kit with keyboard') button.textContent = 'Play drum kit';
      }
    };
    this.observer = new MutationObserver(relabel);
    this.observer.observe(buttons, { childList: true, subtree: true });
    relabel();
  }

  show(performance) {
    this.clear(false);
    if (!this.document || !isTouchDevice()) return;
    this.performance = performance;
    this.document.body?.classList.add('performance-active');
    const token = ++this.renderToken;
    queueMicrotask(() => {
      if (token !== this.renderToken || !performance.active) return;
      this.render(performance);
    });
  }

  clear(removeBodyClass = true) {
    this.renderToken += 1;
    this.element?.remove();
    this.element = null;
    this.performance = null;
    if (removeBodyClass) this.document?.body?.classList.remove('performance-active');
  }

  dispose() {
    this.clear();
    this.observer?.disconnect();
    this.observer = null;
  }

  makeButton(label, className, onHit, ariaLabel = label) {
    const button = this.document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    const press = (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.add('active');
      button.setPointerCapture?.(event.pointerId);
      onHit();
      globalThis.navigator?.vibrate?.(7);
    };
    const release = (event) => {
      event?.preventDefault?.();
      button.classList.remove('active');
    };
    button.addEventListener('pointerdown', press, { passive: false });
    button.addEventListener('pointerup', release, { passive: false });
    button.addEventListener('pointercancel', release, { passive: false });
    button.addEventListener('pointerleave', release, { passive: false });
    return button;
  }

  render(performance) {
    const host = this.document.getElementById('buttons');
    if (!host) return;
    const surface = this.document.createElement('section');
    surface.className = `performance-surface performance-${performance.config?.mode ?? 'instrument'}`;
    surface.setAttribute(
      'aria-label',
      `${performance.config?.label ?? 'Instrument'} touch controls`,
    );
    surface.addEventListener('contextmenu', (event) => event.preventDefault());

    const header = this.document.createElement('div');
    header.className = 'performance-surface-header';
    const title = this.document.createElement('strong');
    title.textContent = performance.config?.label ?? 'Instrument';
    const status = this.document.createElement('span');
    status.textContent = performance.recording ? '● RECORDING' : 'TOUCH TO PLAY';
    header.append(title, status);
    surface.appendChild(header);

    const mode = performance.config?.mode;
    if (mode === 'drums') this.renderDrums(surface, performance);
    else if (mode === 'guitar' || mode === 'bass') this.renderFretboard(surface, performance, mode);
    else this.renderKeys(surface, performance);

    host.prepend(surface);
    this.element = surface;
  }

  renderKeys(surface, performance) {
    const keyboard = this.document.createElement('div');
    keyboard.className = 'touch-keyboard';
    const base = performance.config?.baseMidi ?? 48;

    WHITE_SEMITONES.forEach((semitone, index) => {
      const midi = base + semitone;
      const key = this.makeButton(
        index === 0 || semitone === 12 ? noteName(midi) : '',
        'touch-key white-key',
        () => performance.playMidi(midi),
        noteName(midi),
      );
      key.style.setProperty('--white-index', String(index));
      keyboard.appendChild(key);
    });

    for (const [semitone, afterWhite] of BLACK_KEYS) {
      const midi = base + semitone;
      const key = this.makeButton(
        '',
        'touch-key black-key',
        () => performance.playMidi(midi),
        noteName(midi),
      );
      key.style.setProperty('--after-white', String(afterWhite));
      keyboard.appendChild(key);
    }
    surface.appendChild(keyboard);
  }

  renderDrums(surface, performance) {
    const pads = this.document.createElement('div');
    pads.className = 'touch-drum-pads';
    for (const [id, label] of DRUMS) {
      const pad = this.makeButton(
        label,
        `touch-drum-pad drum-${id}`,
        () => performance.triggerDrum(id),
        label.replace('\n', ' '),
      );
      pads.appendChild(pad);
    }
    surface.appendChild(pads);
  }

  renderFretboard(surface, performance, mode) {
    const tuning = mode === 'bass' ? [43, 38, 33, 28] : [64, 59, 55, 50, 45, 40];
    const labels = mode === 'bass' ? ['G', 'D', 'A', 'E'] : ['e', 'B', 'G', 'D', 'A', 'E'];
    const board = this.document.createElement('div');
    board.className = `touch-fretboard ${mode}`;

    tuning.forEach((openMidi, stringIndex) => {
      const row = this.document.createElement('div');
      row.className = 'touch-string-row';
      const stringLabel = this.document.createElement('span');
      stringLabel.className = 'touch-string-label';
      stringLabel.textContent = labels[stringIndex];
      row.appendChild(stringLabel);
      for (let fret = 0; fret <= 5; fret += 1) {
        const midi = openMidi + fret;
        const button = this.makeButton(
          fret === 0 ? 'OPEN' : String(fret),
          'touch-fret',
          () => performance.playMidi(midi),
          `${labels[stringIndex]} string ${fret === 0 ? 'open' : `fret ${fret}`} · ${noteName(midi)}`,
        );
        row.appendChild(button);
      }
      board.appendChild(row);
    });
    surface.appendChild(board);
  }
}
