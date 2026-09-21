const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const midiToFrequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const MODULAR_RESOURCE_ID = 'upstairs:modularSynth';

const STEP_VALUES = [null, 0, 3, 5, 7, 10, 12];
const PLAYABLE_STEP_VALUES = STEP_VALUES.filter((value) => value != null);
const STEP_LABELS = new Map([
  [null, '·'],
  [0, 'C'],
  [3, 'D#'],
  [5, 'F'],
  [7, 'G'],
  [10, 'A#'],
  [12, 'C+'],
]);
const WAVES = ['sawtooth', 'square', 'triangle'];
const PATCH_CABLES = [
  ['sequencerToVco', 'SEQ → VCO'],
  ['vcoToVcf', 'VCO → VCF'],
  ['vcfToVca', 'VCF → VCA'],
  ['envToVca', 'ENV → VCA'],
  ['lfoToVco', 'LFO → VCO'],
];

const defaultSteps = () => [0, null, 7, null, 3, null, 10, null, 0, null, 12, 10, 7, null, 3, null];

export function normalizeModularPatchState(value = {}) {
  const steps = Array.isArray(value.steps) ? value.steps.slice(0, 16) : defaultSteps();
  while (steps.length < 16) steps.push(null);
  return {
    wave: WAVES.includes(value.wave) ? value.wave : 'sawtooth',
    baseMidi: clamp(Math.round(Number(value.baseMidi) || 48), 36, 60),
    gate: clamp(Number(value.gate) || 0.72, 0.2, 0.95),
    sequencerToVco: value.sequencerToVco !== false,
    vcoToVcf: value.vcoToVcf !== false,
    vcfToVca: value.vcfToVca !== false,
    envToVca: value.envToVca !== false,
    lfoToVco: value.lfoToVco === true,
    steps: steps.map((step) =>
      STEP_VALUES.includes(step == null ? null : Number(step))
        ? step == null
          ? null
          : Number(step)
        : null,
    ),
  };
}

export function modularPatchIsAudible(patch) {
  const value = normalizeModularPatchState(patch);
  return value.vcoToVcf && value.vcfToVca && value.envToVca;
}

export function modularStepEvent(patch, index) {
  const value = normalizeModularPatchState(patch);
  if (!modularPatchIsAudible(value)) return null;
  const stepIndex = Math.abs(Math.floor(Number(index) || 0)) % 16;
  const step = value.steps[stepIndex];
  if (step == null) return null;
  const sequencePitch = value.sequencerToVco ? step : 0;
  const lfoPitch = value.lfoToVco && stepIndex % 2 === 1 ? 1 : 0;
  const midi = value.baseMidi + sequencePitch + lfoPitch;
  return { midi, frequency: midiToFrequency(midi) };
}

export function createModularPerformance(patch, bpm = 118, bars = 1) {
  const value = normalizeModularPatchState(patch);
  const safeBpm = clamp(bpm, 50, 220);
  const safeBars = Math.max(1, Math.min(16, Math.floor(Number(bars) || 1)));
  const stepDuration = 60 / safeBpm / 4;
  const events = [];
  for (let bar = 0; bar < safeBars; bar++) {
    value.steps.forEach((_step, index) => {
      const event = modularStepEvent(value, index);
      if (!event) return;
      events.push({
        time: (bar * 16 + index) * stepDuration,
        ...event,
      });
    });
  }
  return {
    mode: 'synth',
    label: 'Spectra modular sequencer',
    baseMidi: value.baseMidi,
    wave: value.wave,
    volume: 0.062,
    noteDuration: stepDuration * value.gate,
    octaveLayer: false,
    bpm: safeBpm,
    duration: safeBars * 16 * stepDuration,
    events,
  };
}

function cycle(values, current) {
  const index = values.indexOf(current);
  return values[(index + 1 + values.length) % values.length];
}

export class ModularSynthSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.patch = normalizeModularPatchState(game.state?.data?.modularSynth);
    this.selectedStepValue = 0;
    this.playing = false;
    this.currentStep = -1;
    this.transportUnsubscribe = null;
    this.stepButtons = [];
    this.persist();
  }

  persist() {
    if (!this.game.state?.data) return;
    this.game.state.data.modularSynth = normalizeModularPatchState(this.patch);
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

  stepDuration() {
    return 60 / this.transportBpm() / 4;
  }

  patchSummary() {
    const disconnected = PATCH_CABLES.filter(
      ([key]) => key !== 'lfoToVco' && this.patch[key] === false,
    ).map(([, label]) => label);
    const lfo = this.patch.lfoToVco ? 'LFO patched to pitch' : 'LFO unpatched';
    return disconnected.length
      ? `NO SIGNAL: reconnect ${disconnected.join(', ')}. ${lfo}.`
      : `Signal path live · ${this.patch.wave} VCO · ${lfo}.`;
  }

  open() {
    this.patch = normalizeModularPatchState(this.patch);
    const active = this.patch.steps.filter((step) => step != null).length;
    const transport = this.playing
      ? `LOOP PLAYING · step ${this.currentStep + 1 || 1}/16 · ${Math.round(this.transportBpm())} BPM. Tap steps or change the patch and you will hear the next pass immediately.`
      : `Loop stopped · ${Math.round(this.transportBpm())} BPM. Pick a note, tap steps into the grid, then start the live loop.`;
    this.ui.panel(
      'SPECTRA ROOM · LIVE MODULAR SEQUENCER',
      `${this.patchSummary()} ${transport} ${active} steps are programmed.`,
      [
        [
          this.playing ? '■ STOP LIVE LOOP' : '▶ START LIVE LOOP',
          () => (this.playing ? this.stopLoop() : this.startLoop()),
        ],
      ],
    );
    this.renderTransportControls();
    this.renderPatchControls();
    this.renderPitchPalette();
    this.renderSequence();
    this.renderPatternTools();
  }

  renderTransportControls() {
    const row = this.appendRow('row modular-transport-row');
    this.appendButton('BPM −5', () => this.adjustTempo(-5), row, 'modular-transport-button');
    const bpm = this.appendButton(
      `${Math.round(this.transportBpm())} BPM`,
      () => {},
      row,
      'modular-transport-readout',
    );
    if (bpm) bpm.disabled = true;
    this.appendButton('BPM +5', () => this.adjustTempo(5), row, 'modular-transport-button');
  }

  renderPatchControls() {
    const cableRow = this.appendRow('row modular-patch-row');
    for (const [key, label] of PATCH_CABLES) {
      this.appendButton(
        `${this.patch[key] ? '●' : '○'} ${label}`,
        () => {
          this.patch[key] = !this.patch[key];
          this.save();
          this.open();
        },
        cableRow,
        this.patch[key] ? 'modular-patch active' : 'modular-patch',
      );
    }

    const voiceRow = this.appendRow('row modular-voice-row');
    this.appendButton(
      `VCO ${this.patch.wave.toUpperCase()}`,
      () => {
        this.patch.wave = cycle(WAVES, this.patch.wave);
        this.save();
        this.open();
      },
      voiceRow,
      'modular-voice-button',
    );
    this.appendButton(
      `ROOT MIDI ${this.patch.baseMidi}`,
      () => {
        this.patch.baseMidi = this.patch.baseMidi >= 60 ? 36 : this.patch.baseMidi + 12;
        this.save();
        this.open();
      },
      voiceRow,
      'modular-voice-button',
    );
    this.appendButton(
      `GATE ${Math.round(this.patch.gate * 100)}%`,
      () => {
        this.patch.gate = this.patch.gate >= 0.9 ? 0.35 : Math.min(0.95, this.patch.gate + 0.15);
        this.save();
        this.open();
      },
      voiceRow,
      'modular-voice-button',
    );
  }

  renderPitchPalette() {
    const row = this.appendRow('row modular-pitch-row');
    for (const value of PLAYABLE_STEP_VALUES) {
      this.appendButton(
        STEP_LABELS.get(value),
        () => {
          this.selectedStepValue = value;
          this.open();
        },
        row,
        value === this.selectedStepValue ? 'modular-pitch active' : 'modular-pitch',
      );
    }
  }

  stepLabel(index) {
    const value = this.patch.steps[index];
    const playhead = this.playing && index === this.currentStep ? '▶ ' : '';
    return `${playhead}${String(index + 1).padStart(2, '0')}  ${STEP_LABELS.get(value) ?? '·'}`;
  }

  renderSequence() {
    this.stepButtons = [];
    const grid = this.appendRow('modular-step-grid');
    this.patch.steps.forEach((step, index) => {
      const button = this.appendButton(
        this.stepLabel(index),
        () => this.editStep(index),
        grid,
        step == null ? 'modular-step' : 'modular-step active',
      );
      if (button) {
        button.dataset.stepIndex = String(index);
        button.setAttribute('aria-pressed', step == null ? 'false' : 'true');
        this.stepButtons[index] = button;
      }
    });
    this.updatePlayhead(this.currentStep);
  }

  renderPatternTools() {
    const row = this.appendRow('row modular-pattern-tools');
    this.appendButton(
      'CLEAR STEPS',
      () => {
        this.patch.steps = Array(16).fill(null);
        this.save();
        this.open();
      },
      row,
    );
    this.appendButton(
      'DEFAULT PATTERN',
      () => {
        this.patch.steps = defaultSteps();
        this.save();
        this.open();
      },
      row,
    );
    this.appendButton('RESET PATCH', () => this.reset(), row);
  }

  editStep(index) {
    const current = this.patch.steps[index];
    this.patch.steps[index] = current === this.selectedStepValue ? null : this.selectedStepValue;
    this.save();
    this.open();
  }

  adjustTempo(delta) {
    if (!this.game.studio) return;
    const next = clamp(this.transportBpm() + Number(delta || 0), 50, 220);
    if (this.game.spectraTransport) this.game.spectraTransport.setTempo(next);
    else this.game.studio.bpm = next;
    this.save();
    this.open();
  }

  performance(bars = null) {
    const session = this.game.studio;
    const length =
      bars ?? (session?.loopEnabled === true ? Math.max(1, Number(session.loopBars) || 1) : 1);
    return createModularPerformance(this.patch, this.transportBpm(), length);
  }

  triggerStep(index, when = 0) {
    const event = modularStepEvent(this.patch, index);
    if (!event) return false;
    const delay = Math.max(0, Number(when) || 0);
    const duration = this.stepDuration() * this.patch.gate;
    const config = {
      mode: 'synth',
      stemKind: 'synth',
      label: 'Spectra modular sequencer',
      wave: this.patch.wave,
      volume: 0.062,
      duration,
      octaveLayer: false,
    };
    const monitored = this.game.studioPlayback?.monitorLiveEvent?.(
      this.game.studio,
      config,
      { type: 'midi', midi: event.midi },
      { resourceId: MODULAR_RESOURCE_ID, when: delay },
    );
    if (!monitored)
      this.game.audio?.tone?.(event.frequency, duration, this.patch.wave, 0.062, delay);
    const instrumentSync = this.game.multiplayer?.instrumentSync;
    if (instrumentSync?.publishExternal) {
      instrumentSync.publishExternal(
        config,
        { type: 'midi', midi: event.midi },
        {
          resourceId: MODULAR_RESOURCE_ID,
          offsetSeconds: delay,
        },
      );
    } else {
      this.game.spectraRecorder?.captureLocal?.(
        config,
        { type: 'midi', midi: event.midi },
        {
          resourceId: MODULAR_RESOURCE_ID,
          offsetSeconds: delay,
        },
      );
    }
    return true;
  }

  async startLoop() {
    if (this.playing) return;
    try {
      await this.game.audio?.init?.();
    } catch {
      this.ui.warning?.('Audio could not start. Tap the game once and try the modular again.');
      return;
    }
    const context = this.game.audio?.context;
    if (!context) {
      this.ui.warning?.('Audio is not available yet. Tap the game once and try again.');
      return;
    }

    // The modular joins the shared Spectra clock. It never starts/stops the building audio
    // engine or any spatial zone; only this instrument's musical callbacks are registered here.
    const transport = this.game.spectraTransport;
    if (!transport) {
      this.ui.warning?.('Spectra master transport is unavailable.');
      return;
    }
    this.playing = true;
    this.currentStep = -1;
    this.transportUnsubscribe?.();
    this.transportUnsubscribe = transport.subscribe('modular-synth', (event) => {
      if (!this.playing) return;
      const step = event.loopStep % 16;
      this.triggerStep(step, event.when);
      this.updatePlayhead(step);
    });
    transport.acquire('modular-synth', { position: 0 });
    this.open();
  }

  stopLoop(refresh = true) {
    this.transportUnsubscribe?.();
    this.transportUnsubscribe = null;
    this.game.spectraTransport?.release?.('modular-synth');
    this.playing = false;
    this.currentStep = -1;
    this.updatePlayhead(-1);
    if (refresh) this.open();
  }

  updatePlayhead(index) {
    this.currentStep = Number.isInteger(index) ? index : -1;
    for (let step = 0; step < this.stepButtons.length; step++) {
      const button = this.stepButtons[step];
      if (!button) continue;
      button.textContent = this.stepLabel(step);
      button.classList?.toggle?.('playhead', this.playing && step === this.currentStep);
    }
  }

  preview() {
    const performance = this.performance(1);
    if (!performance.events.length) {
      this.ui.warning?.(
        modularPatchIsAudible(this.patch)
          ? 'Program at least one active sequencer step.'
          : 'The modular has no complete signal path. Repatch VCO → VCF → VCA and ENV → VCA.',
      );
      return;
    }
    for (const event of performance.events) {
      this.game.audio?.tone?.(
        event.frequency,
        performance.noteDuration,
        performance.wave,
        performance.volume,
        event.time,
      );
    }
  }

  async recordToConsole() {
    const session = this.game.studio;
    if (!session?.addTake || !session?.attachPerformance) return;
    const performance = this.performance();
    if (!performance.events.length) {
      this.ui.warning?.(
        modularPatchIsAudible(this.patch)
          ? 'Program at least one active sequencer step before recording.'
          : 'There is no complete modular signal path to record.',
      );
      this.open();
      return;
    }
    const take = session.addTake(
      'synth',
      `Modular sequence ${session.takeCounter + 1}`,
      'modular-synth',
    );
    session.attachPerformance(take.id, performance);
    this.save();
    await this.game.audio?.init?.();
    this.game.spectraTransport?.restart?.(0);
    await this.game.studioPlayback?.play?.(session, 0);
    this.ui.warning?.(
      `Recorded ${performance.events.length} modular event${performance.events.length === 1 ? '' : 's'} to “${take.label}”. The recorded stem is now playing through its Spectra fader.`,
    );
    this.ui.panel(
      'MODULAR LOOP → SPECTRA',
      `${take.label} is now a console stem. Playback has handed off from the live sequencer to the recorded Spectra channel so its fader, mute, solo, EQ, FX and spatial position control what you hear.`,
      [
        ...(typeof this.game.showStudioLoopBuilder === 'function'
          ? [['Open loop / song builder', () => this.game.showStudioLoopBuilder()]]
          : []),
        ['Back to live modular', () => this.open()],
      ],
    );
  }

  reset() {
    this.patch = normalizeModularPatchState();
    this.selectedStepValue = 0;
    this.save();
    this.open();
  }

  dispose() {
    this.stopLoop(false);
    this.stepButtons = [];
  }

  handle(target) {
    if (target?.action !== 'modularSynth') return false;
    this.open();
    return true;
  }
}

export function installModularSynthSystem(game, ui) {
  if (!game || game._modularSynthSystemInstalled) return game?.modularSynth ?? null;
  game._modularSynthSystemInstalled = true;
  const modular = new ModularSynthSystem(game, ui);
  game.modularSynth = modular;
  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (modular.handle(target)) return;
    baseDispatch(target);
  };
  const baseStopAll = game.stopAll?.bind(game);
  if (baseStopAll) {
    game.stopAll = (...args) => {
      modular.stopLoop(false);
      return baseStopAll(...args);
    };
  }
  return modular;
}
