const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const midiToFrequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const STEP_VALUES = [null, 0, 3, 5, 7, 10, 12];
const STEP_LABELS = ['·', 'C', 'D#', 'F', 'G', 'A#', 'C+'];
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

export function createModularPerformance(patch, bpm = 118, bars = 1) {
  const value = normalizeModularPatchState(patch);
  const safeBpm = clamp(bpm, 50, 220);
  const safeBars = Math.max(1, Math.min(16, Math.floor(Number(bars) || 1)));
  const stepDuration = 60 / safeBpm / 4;
  const events = [];
  if (modularPatchIsAudible(value)) {
    for (let bar = 0; bar < safeBars; bar++) {
      value.steps.forEach((step, index) => {
        if (step == null) return;
        const sequencePitch = value.sequencerToVco ? step : 0;
        const lfoPitch = value.lfoToVco && (index + bar * 16) % 2 === 1 ? 1 : 0;
        const midi = value.baseMidi + sequencePitch + lfoPitch;
        events.push({
          time: (bar * 16 + index) * stepDuration,
          midi,
          frequency: midiToFrequency(midi),
        });
      });
    }
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

  appendButton(label, action, parent = this.ui.buttons) {
    if (!this.ui.document || !parent) return null;
    const button = this.ui.document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.onclick = action;
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
    this.ui.panel(
      'SPECTRA ROOM · PATCHABLE MODULAR',
      `${this.patchSummary()} The 16-step sequencer has ${active} active steps. Patch the modules, program the row, audition it, then record the sequence as a stem into the Spectra console and studio loop system.`,
      [
        ['Preview one bar', () => this.preview()],
        ['Record / send loop to Spectra', () => this.recordToConsole()],
        ['Reset patch + sequence', () => this.reset()],
      ],
    );
    this.renderPatchControls();
    this.renderSequence();
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
      );
    }

    const voiceRow = this.appendRow('row modular-voice-row');
    this.appendButton(
      `VCO: ${this.patch.wave.toUpperCase()}`,
      () => {
        this.patch.wave = cycle(WAVES, this.patch.wave);
        this.save();
        this.open();
      },
      voiceRow,
    );
    this.appendButton(
      `ROOT: MIDI ${this.patch.baseMidi}`,
      () => {
        this.patch.baseMidi = this.patch.baseMidi >= 60 ? 36 : this.patch.baseMidi + 12;
        this.save();
        this.open();
      },
      voiceRow,
    );
    this.appendButton(
      `GATE: ${Math.round(this.patch.gate * 100)}%`,
      () => {
        this.patch.gate = this.patch.gate >= 0.9 ? 0.35 : Math.min(0.95, this.patch.gate + 0.15);
        this.save();
        this.open();
      },
      voiceRow,
    );
  }

  renderSequence() {
    const row = this.appendRow('row modular-step-row');
    this.patch.steps.forEach((step, index) => {
      const labelIndex = STEP_VALUES.findIndex((value) => value === step);
      this.appendButton(
        `${String(index + 1).padStart(2, '0')}·${STEP_LABELS[Math.max(0, labelIndex)]}`,
        () => {
          this.patch.steps[index] = cycle(STEP_VALUES, step);
          this.save();
          this.open();
        },
        row,
      );
    });
  }

  performance(bars = null) {
    const session = this.game.studio;
    const length =
      bars ?? (session?.loopEnabled === true ? Math.max(1, Number(session.loopBars) || 1) : 1);
    return createModularPerformance(this.patch, session?.bpm ?? 118, length);
  }

  preview() {
    const performance = this.performance(1);
    if (!performance.events.length) {
      this.ui.warning?.(
        modularPatchIsAudible(this.patch)
          ? 'Turn on at least one sequencer step.'
          : 'The modular has no complete signal path. Repatch VCO → VCF → VCA and ENV → VCA.',
      );
      this.open();
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

  recordToConsole() {
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
    this.ui.panel(
      'MODULAR LOOP → SPECTRA',
      `${take.label} is now a console stem. It will play through the same mixer, loop builder, mute/solo, EQ and FX controls as the other studio recordings.`,
      [
        ...(typeof this.game.showStudioLoopBuilder === 'function'
          ? [['Open loop / song builder', () => this.game.showStudioLoopBuilder()]]
          : []),
        ['Back to modular', () => this.open()],
      ],
    );
  }

  reset() {
    this.patch = normalizeModularPatchState();
    this.save();
    this.open();
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
  return modular;
}
