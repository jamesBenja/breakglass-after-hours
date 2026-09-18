const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export const DRUM_MACHINE_KITS = ['808', '909', 'DMX', 'LINN'];
export const DRUM_MACHINE_PATTERNS = ['A', 'B', 'C', 'D'];
export const DRUM_MACHINE_TRACKS = [
  { id: 'kick', label: 'KICK' },
  { id: 'snare', label: 'SNARE' },
  { id: 'clap', label: 'CLAP' },
  { id: 'closed-hat', label: 'CH' },
  { id: 'open-hat', label: 'OH' },
  { id: 'low-tom', label: 'TOM' },
  { id: 'cowbell', label: 'COW' },
  { id: 'rim', label: 'RIM' },
];

const DRUM_MACHINE_RESOURCE_ID = 'upstairs:drumMachine';

const emptyLane = () => Array(16).fill(0);
const blankPattern = () =>
  Object.fromEntries(DRUM_MACHINE_TRACKS.map(({ id }) => [id, emptyLane()]));

function withHits(pattern, track, hits = [], accents = []) {
  for (const step of hits) pattern[track][step % 16] = accents.includes(step) ? 2 : 1;
  return pattern;
}

function presetForKit(kit = '808') {
  const pattern = blankPattern();
  if (kit === '909') {
    withHits(pattern, 'kick', [0, 4, 8, 12], [0, 8]);
    withHits(pattern, 'snare', [4, 12], [12]);
    withHits(pattern, 'clap', [4, 12]);
    withHits(pattern, 'closed-hat', [0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14]);
    withHits(pattern, 'open-hat', [6, 14]);
    withHits(pattern, 'rim', [3, 11]);
  } else if (kit === 'DMX') {
    withHits(pattern, 'kick', [0, 3, 7, 10, 14], [0, 10]);
    withHits(pattern, 'snare', [4, 12], [4, 12]);
    withHits(pattern, 'clap', [4, 9, 12]);
    withHits(pattern, 'closed-hat', [0, 2, 5, 7, 8, 10, 13, 15], [5, 13]);
    withHits(pattern, 'open-hat', [11]);
    withHits(pattern, 'cowbell', [2, 6, 10, 14], [10]);
    withHits(pattern, 'rim', [1, 9]);
  } else if (kit === 'LINN') {
    withHits(pattern, 'kick', [0, 6, 8, 11], [0, 8]);
    withHits(pattern, 'snare', [4, 12], [12]);
    withHits(pattern, 'clap', [4, 12]);
    withHits(pattern, 'closed-hat', [0, 2, 4, 6, 8, 10, 12, 14], [6, 14]);
    withHits(pattern, 'open-hat', [7, 15]);
    withHits(pattern, 'low-tom', [10, 11]);
    withHits(pattern, 'rim', [3, 13]);
  } else {
    withHits(pattern, 'kick', [0, 3, 7, 10, 12], [0, 10]);
    withHits(pattern, 'snare', [4, 12], [12]);
    withHits(pattern, 'clap', [4, 12]);
    withHits(pattern, 'closed-hat', [0, 2, 4, 6, 8, 10, 12, 14], [2, 10]);
    withHits(pattern, 'open-hat', [6, 14]);
    withHits(pattern, 'cowbell', [2, 5, 10, 13], [10]);
    withHits(pattern, 'rim', [7, 15]);
  }
  return pattern;
}

function normalizeLane(value) {
  const source = Array.isArray(value) ? value.slice(0, 16) : [];
  while (source.length < 16) source.push(0);
  return source.map((cell) => {
    const number = Math.round(Number(cell) || 0);
    return number >= 2 ? 2 : number >= 1 ? 1 : 0;
  });
}

function normalizePattern(value, fallbackKit = '808') {
  const fallback = presetForKit(fallbackKit);
  return Object.fromEntries(
    DRUM_MACHINE_TRACKS.map(({ id }) => [
      id,
      normalizeLane(value && typeof value === 'object' ? value[id] : fallback[id]),
    ]),
  );
}

export function normalizeDrumMachineState(value = {}) {
  const kit = DRUM_MACHINE_KITS.includes(value.kit) ? value.kit : '808';
  const selectedPattern = DRUM_MACHINE_PATTERNS.includes(value.selectedPattern)
    ? value.selectedPattern
    : 'A';
  const defaults = {
    A: presetForKit('808'),
    B: presetForKit('909'),
    C: presetForKit('DMX'),
    D: presetForKit('LINN'),
  };
  const patterns = {};
  for (const slot of DRUM_MACHINE_PATTERNS) {
    patterns[slot] = normalizePattern(value.patterns?.[slot] ?? defaults[slot], kit);
  }
  return { kit, selectedPattern, patterns };
}

function eventName(kit, track, velocity) {
  return `${String(kit).toLowerCase()}-${track}${velocity >= 2 ? '-accent' : ''}`;
}

export function createDrumMachinePerformance(value, bpm = 118, bars = 1, swing = 0) {
  const state = normalizeDrumMachineState(value);
  const safeBpm = clamp(bpm, 50, 220);
  const safeBars = Math.max(1, Math.min(16, Math.floor(Number(bars) || 1)));
  const safeSwing = clamp(swing, 0, 0.45);
  const stepDuration = 60 / safeBpm / 4;
  const pattern = state.patterns[state.selectedPattern];
  const events = [];

  for (let bar = 0; bar < safeBars; bar += 1) {
    for (let step = 0; step < 16; step += 1) {
      const swingOffset = step % 2 === 1 ? stepDuration * safeSwing : 0;
      for (const track of DRUM_MACHINE_TRACKS) {
        const velocity = pattern[track.id][step];
        if (!velocity) continue;
        events.push({
          time: (bar * 16 + step) * stepDuration + swingOffset,
          drum: eventName(state.kit, track.id, velocity),
        });
      }
    }
  }

  return {
    mode: 'drums',
    label: `Spectra ${state.kit} drum machine · pattern ${state.selectedPattern}`,
    baseMidi: 36,
    wave: 'sine',
    volume: 0.085,
    noteDuration: stepDuration * 0.8,
    octaveLayer: false,
    bpm: safeBpm,
    duration: safeBars * 16 * stepDuration,
    events,
  };
}

export class DrumMachineSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.state = normalizeDrumMachineState(game.state?.data?.spectraDrumMachine);
    this.playing = false;
    this.currentStep = -1;
    this.nextStepIndex = 0;
    this.nextStepTime = 0;
    this.scheduler = null;
    this.stepButtons = new Map();
    this.persist();
  }

  persist() {
    this.state = normalizeDrumMachineState(this.state);
    if (this.game.state?.data) this.game.state.data.spectraDrumMachine = this.state;
  }

  save() {
    this.persist();
    this.game.save?.();
  }

  appendButton(label, action, parent = this.ui.buttons, className = '') {
    if (!this.ui.document || !parent) return null;
    const button = this.ui.document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.onclick = action;
    if (className) button.className = className;
    parent.appendChild(button);
    return button;
  }

  appendRow(className = 'row') {
    if (!this.ui.document || !this.ui.buttons) return null;
    const row = this.ui.document.createElement('div');
    row.className = className;
    this.ui.buttons.appendChild(row);
    return row;
  }

  transportBpm() {
    return clamp(this.game.studio?.bpm ?? 118, 50, 220);
  }

  transportSwing() {
    return clamp(this.game.studio?.swing ?? 0, 0, 0.45);
  }

  stepDuration() {
    return 60 / this.transportBpm() / 4;
  }

  pattern() {
    return this.state.patterns[this.state.selectedPattern];
  }

  activeStepCount() {
    return DRUM_MACHINE_TRACKS.reduce(
      (total, track) => total + this.pattern()[track.id].filter(Boolean).length,
      0,
    );
  }

  open() {
    this.state = normalizeDrumMachineState(this.state);
    const status = this.playing
      ? `PLAYING · step ${this.currentStep + 1 || 1}/16`
      : 'STOPPED';
    this.ui.panel(
      'SPECTRA · RHYTHM PROGRAMMER',
      `${this.state.kit} voice bank · pattern ${this.state.selectedPattern} · ${status} · ${Math.round(this.transportBpm())} BPM · swing ${Math.round(this.transportSwing() * 100)}%. ${this.activeStepCount()} programmed hits. Tap a step once for a hit, twice for an accent.`,
      [
        [
          this.playing ? '■ STOP DRUM MACHINE' : '▶ START DRUM MACHINE',
          () => (this.playing ? this.stopLoop() : this.startLoop()),
        ],
        ['Record current pattern → Spectra', () => this.recordToConsole()],
      ],
    );
    this.renderTransport();
    this.renderKitAndMemory();
    this.renderSequence();
    this.renderPatternTools();
  }

  renderTransport() {
    const row = this.appendRow('row drum-machine-transport');
    this.appendButton('BPM −5', () => this.adjustTempo(-5), row);
    const bpm = this.appendButton(`${Math.round(this.transportBpm())} BPM`, () => {}, row);
    if (bpm) bpm.disabled = true;
    this.appendButton('BPM +5', () => this.adjustTempo(5), row);
    for (const swing of [0, 0.12, 0.24, 0.36]) {
      this.appendButton(
        `${Math.round(swing * 100)}% SWING`,
        () => this.setSwing(swing),
        row,
        Math.abs(this.transportSwing() - swing) < 0.005 ? 'active' : '',
      );
    }
  }

  renderKitAndMemory() {
    const kitRow = this.appendRow('row drum-machine-kits');
    for (const kit of DRUM_MACHINE_KITS) {
      this.appendButton(
        kit,
        () => {
          this.state.kit = kit;
          this.save();
          this.open();
        },
        kitRow,
        kit === this.state.kit ? 'active' : '',
      );
    }

    const memoryRow = this.appendRow('row drum-machine-memory');
    for (const slot of DRUM_MACHINE_PATTERNS) {
      this.appendButton(
        `PATTERN ${slot}`,
        () => {
          this.state.selectedPattern = slot;
          this.save();
          this.open();
        },
        memoryRow,
        slot === this.state.selectedPattern ? 'active' : '',
      );
    }
  }

  renderSequence() {
    this.stepButtons.clear();
    const grid = this.appendRow('drum-machine-grid');
    if (!grid || !this.ui.document) return;

    const corner = this.ui.document.createElement('div');
    corner.className = 'drum-machine-lane-label drum-machine-grid-corner';
    corner.textContent = this.state.kit;
    grid.appendChild(corner);
    for (let step = 0; step < 16; step += 1) {
      const header = this.ui.document.createElement('div');
      header.className = 'drum-machine-step-number';
      header.textContent = String(step + 1);
      grid.appendChild(header);
    }

    for (const track of DRUM_MACHINE_TRACKS) {
      const label = this.ui.document.createElement('div');
      label.className = 'drum-machine-lane-label';
      label.textContent = track.label;
      grid.appendChild(label);
      for (let step = 0; step < 16; step += 1) {
        const velocity = this.pattern()[track.id][step];
        const button = this.appendButton(
          velocity >= 2 ? '▲' : velocity === 1 ? '●' : '·',
          () => this.editStep(track.id, step),
          grid,
          this.stepClass(track.id, step),
        );
        if (button) {
          button.setAttribute('aria-label', `${track.label} step ${step + 1}`);
          button.setAttribute('aria-pressed', velocity ? 'true' : 'false');
          this.stepButtons.set(`${track.id}:${step}`, button);
        }
      }
    }
    this.updatePlayhead(this.currentStep);
  }

  renderPatternTools() {
    const row = this.appendRow('row drum-machine-tools');
    this.appendButton(
      `LOAD ${this.state.kit} PRESET`,
      () => {
        this.state.patterns[this.state.selectedPattern] = presetForKit(this.state.kit);
        this.save();
        this.open();
      },
      row,
    );
    this.appendButton(
      'CLEAR PATTERN',
      () => {
        this.state.patterns[this.state.selectedPattern] = blankPattern();
        this.save();
        this.open();
      },
      row,
    );
  }

  stepClass(trackId, step) {
    const velocity = this.pattern()[trackId][step];
    const classes = ['drum-machine-step'];
    if (velocity === 1) classes.push('active');
    if (velocity >= 2) classes.push('accent');
    if (this.playing && step === this.currentStep) classes.push('playhead');
    if (step % 4 === 0) classes.push('beat');
    return classes.join(' ');
  }

  editStep(trackId, step) {
    const lane = this.pattern()[trackId];
    lane[step] = (lane[step] + 1) % 3;
    this.save();
    this.open();
  }

  adjustTempo(delta) {
    if (!this.game.studio) return;
    this.game.studio.bpm = clamp(this.transportBpm() + Number(delta || 0), 50, 220);
    this.save();
    if (this.playing) {
      this.game.audio?.updateExternalTransport?.('spectra-drum-machine', {
        interval: this.stepDuration(),
      });
    }
    this.open();
  }

  setSwing(value) {
    if (!this.game.studio) return;
    if (typeof this.game.studio.setSwing === 'function') this.game.studio.setSwing(value);
    else this.game.studio.swing = clamp(value, 0, 0.45);
    this.save();
    this.open();
  }

  performance(bars = null) {
    const length =
      bars ??
      (this.game.studio?.loopEnabled === true
        ? Math.max(1, Number(this.game.studio.loopBars) || 1)
        : 1);
    return createDrumMachinePerformance(
      this.state,
      this.transportBpm(),
      length,
      this.transportSwing(),
    );
  }

  triggerStep(step, baseWhen = 0) {
    const pattern = this.pattern();
    const swingDelay = step % 2 === 1 ? this.stepDuration() * this.transportSwing() : 0;
    let hits = 0;
    for (const track of DRUM_MACHINE_TRACKS) {
      const velocity = pattern[track.id][step];
      if (!velocity) continue;
      const name = eventName(this.state.kit, track.id, velocity);
      const delay = Math.max(0, Number(baseWhen) || 0) + swingDelay;
      this.game.studioPlayback?.playDrumEvent?.(name, delay);
      this.game.multiplayer?.instrumentSync?.publishExternal?.(
        {
          mode: 'drums',
          stemKind: 'drums',
          label: `Spectra ${this.state.kit} drum machine`,
          volume: velocity >= 2 ? 0.11 : 0.085,
          duration: this.stepDuration() * 0.8,
        },
        { type: 'drum', name },
        { resourceId: DRUM_MACHINE_RESOURCE_ID, offsetSeconds: delay },
      );
      hits += 1;
    }
    return hits;
  }

  scheduleLiveSteps() {
    const context = this.game.audio?.context;
    if (!this.playing || !context || context.state !== 'running') return;
    const horizon = context.currentTime + 0.12;
    this.nextStepTime = Math.max(this.nextStepTime, context.currentTime);
    while (this.nextStepTime <= horizon) {
      const step = this.nextStepIndex;
      this.triggerStep(step, this.nextStepTime - context.currentTime);
      this.updatePlayhead(step);
      this.nextStepTime += this.stepDuration();
      this.nextStepIndex = (step + 1) % 16;
    }
  }

  async startLoop() {
    if (this.playing) return;
    try {
      await this.game.audio?.init?.();
    } catch {
      this.ui.warning?.('Audio could not start. Tap the game once and try the drum machine again.');
      return;
    }
    const context = this.game.audio?.context;
    if (!context) {
      this.ui.warning?.('Audio is not available yet. Tap the game once and try again.');
      return;
    }

    this.playing = true;
    this.currentStep = -1;
    this.nextStepIndex = 0;
    this.nextStepTime = context.currentTime + 0.03;
    this.game.audio?.setExternalTransport?.(
      'spectra-drum-machine',
      `Spectra ${this.state.kit} drum machine`,
      this.stepDuration(),
      { vibe: 0.44, mixQuality: 0.94 },
    );
    this.scheduleLiveSteps();
    const timers = this.game.audio?.timers ?? globalThis;
    this.scheduler = timers.setInterval(() => this.scheduleLiveSteps(), 20);
    this.open();
  }

  stopLoop(refresh = true) {
    const timers = this.game.audio?.timers ?? globalThis;
    if (this.scheduler != null) timers.clearInterval(this.scheduler);
    this.scheduler = null;
    this.playing = false;
    this.currentStep = -1;
    this.nextStepIndex = 0;
    this.game.audio?.clearExternalTransport?.('spectra-drum-machine');
    this.updatePlayhead(-1);
    if (refresh) this.open();
  }

  updatePlayhead(step) {
    this.currentStep = Number.isInteger(step) ? step : -1;
    for (const [key, button] of this.stepButtons) {
      const parts = key.split(':');
      const buttonStep = Number(parts[parts.length - 1]);
      button.className = this.stepClass(parts.slice(0, -1).join(':'), buttonStep);
    }
  }

  recordToConsole() {
    const session = this.game.studio;
    if (!session?.addTake || !session?.attachPerformance) return;
    const performance = this.performance();
    if (!performance.events.length) {
      this.ui.warning?.('Program at least one drum-machine step before recording.');
      return;
    }
    const take = session.addTake(
      'drums',
      `${this.state.kit} drum machine · pattern ${this.state.selectedPattern}`,
      'spectra-drum-machine',
    );
    session.attachPerformance(take.id, performance);
    this.save();
    this.game.studioPlayback?.updateMix?.(session);
    this.ui.panel(
      'DRUM MACHINE → SPECTRA',
      `${take.label} is now a normal Spectra drum stem. It can be mixed, muted, soloed, looped, overdubbed and exported with the rest of the session.`,
      [
        ...(typeof this.game.showStudioLoopBuilder === 'function'
          ? [['Open loop / song builder', () => this.game.showStudioLoopBuilder()]]
          : []),
        ['Back to drum machine', () => this.open()],
      ],
    );
  }

  handle(target) {
    if (target?.action !== 'drumMachine') return false;
    this.open();
    return true;
  }

  dispose() {
    this.stopLoop(false);
    this.stepButtons.clear();
  }
}

export function installDrumMachineSystem(game, ui) {
  if (!game || game._drumMachineSystemInstalled) return game?.drumMachine ?? null;
  game._drumMachineSystemInstalled = true;
  const drumMachine = new DrumMachineSystem(game, ui);
  game.drumMachine = drumMachine;
  game.showSpectraDrumMachine = () => drumMachine.open();

  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (drumMachine.handle(target)) return;
    baseDispatch(target);
  };

  const baseStopAll = game.stopAll?.bind(game);
  if (baseStopAll) {
    game.stopAll = (...args) => {
      drumMachine.stopLoop(false);
      return baseStopAll(...args);
    };
  }

  if (!ui._drumMachineMixerPatched && typeof ui.studioMixer === 'function') {
    const baseStudioMixer = ui.studioMixer.bind(ui);
    ui.studioMixer = (...args) => {
      const result = baseStudioMixer(...args);
      const button = ui.document.createElement('button');
      button.type = 'button';
      button.textContent = '808 / 909 / DMX / LINN DRUM MACHINE';
      button.className = 'spectra-drum-machine-button';
      button.onclick = () => drumMachine.open();
      ui.buttons?.appendChild(button);
      return result;
    };
    ui._drumMachineMixerPatched = true;
  }

  return drumMachine;
}
