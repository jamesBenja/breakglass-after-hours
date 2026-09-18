const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export const SPECTRA_GRID_DIVISIONS = {
  '1/4': 1,
  '1/8': 2,
  '1/16': 4,
};

export function spectraLoopSeconds(session) {
  return Math.max(
    0.25,
    ((Math.max(1, Number(session?.loopBars) || 4) * 4 * 60) /
      Math.max(1, Number(session?.bpm) || 118)),
  );
}

export function spectraStepDuration(session) {
  return 60 / Math.max(1, Number(session?.bpm) || 118) / 4;
}

export function quantizeSpectraTime(
  session,
  rawTime,
  { wrap = session?.loopEnabled === true, includeSwing = true } = {},
) {
  const divisions = SPECTRA_GRID_DIVISIONS[session?.quantize] ?? 4;
  const beat = 60 / Math.max(1, Number(session?.bpm) || 118);
  const grid = beat / divisions;
  const swing = includeSwing ? clamp(session?.swing, 0, 0.45) : 0;
  const raw = Math.max(0, Number(rawTime) || 0);
  const step = Math.round(raw / grid);
  let time = step * grid;
  if (step % 2 === 1) time += grid * swing;
  if (wrap) {
    const length = spectraLoopSeconds(session);
    time = ((time % length) + length) % length;
  }
  return time;
}

/**
 * Musical clock for the Spectra ecosystem only.
 *
 * It never owns, stops, reroutes or recreates the AudioEngine. It only reads the existing
 * AudioContext clock and publishes scheduled sixteenth-note callbacks. Every callback receives
 * a relative WebAudio `when` value so instruments can schedule into their existing audio path.
 */
export class SpectraTransport {
  constructor(audio, session, timers = globalThis) {
    this.audio = audio;
    this.session = session;
    this.timers = timers;
    this.running = false;
    this.originContextTime = 0;
    this.nextStepIndex = 0;
    this.nextStepContextTime = 0;
    this.timer = null;
    this.subscribers = new Map();
    this.owners = new Set();
    this.generation = 0;
    this.lastPosition = 0;
  }

  get context() {
    return this.audio?.context ?? null;
  }

  get stepDuration() {
    return spectraStepDuration(this.session);
  }

  get loopSteps() {
    return Math.max(16, Math.max(1, Number(this.session?.loopBars) || 4) * 16);
  }

  position() {
    const context = this.context;
    if (!this.running || !context) return Math.max(0, this.lastPosition);
    let value = Math.max(0, context.currentTime - this.originContextTime);
    if (this.session?.loopEnabled) {
      const length = spectraLoopSeconds(this.session);
      value = ((value % length) + length) % length;
    }
    return value;
  }

  positionAtOffset(offsetSeconds = 0) {
    const offset = Math.max(0, Number(offsetSeconds) || 0);
    const value = this.position() + offset;
    if (!this.session?.loopEnabled) return value;
    const length = spectraLoopSeconds(this.session);
    return ((value % length) + length) % length;
  }

  musicalStep(position = this.position(), stepDuration = this.stepDuration) {
    return Math.max(0, position / Math.max(0.001, stepDuration));
  }

  snapshot() {
    const position = this.position();
    const step = Math.floor(this.musicalStep(position)) % this.loopSteps;
    return {
      running: this.running,
      position,
      absoluteStep: Math.floor(this.musicalStep(position)),
      loopStep: step,
      bar: Math.floor(step / 16) + 1,
      beat: Math.floor((step % 16) / 4) + 1,
      sixteenth: (step % 4) + 1,
      bpm: Math.max(1, Number(this.session?.bpm) || 118),
      swing: clamp(this.session?.swing, 0, 0.45),
      quantize: this.session?.quantize ?? '1/16',
      loopBars: Math.max(1, Number(this.session?.loopBars) || 4),
      owners: [...this.owners],
    };
  }

  subscribe(id, callback) {
    if (!id || typeof callback !== 'function') return () => {};
    this.subscribers.set(id, callback);
    return () => {
      if (this.subscribers.get(id) === callback) this.subscribers.delete(id);
    };
  }

  acquire(owner, options = {}) {
    if (owner) this.owners.add(owner);
    if (!this.running) this.start(options);
    return this.snapshot();
  }

  release(owner, { stopWhenIdle = true } = {}) {
    if (owner) this.owners.delete(owner);
    if (stopWhenIdle && this.owners.size === 0) this.stop();
    return this.snapshot();
  }

  start({ position = 0, contextTime = null, restart = false } = {}) {
    const context = this.context;
    if (!context) return false;
    if (this.running && !restart) return true;

    const safePosition = Math.max(0, Number(position) || 0);
    const lead = 0.04;
    const anchor =
      Number.isFinite(Number(contextTime)) && Number(contextTime) >= context.currentTime
        ? Number(contextTime)
        : context.currentTime + lead;

    this.generation += 1;
    this.running = true;
    this.lastPosition = safePosition;
    this.originContextTime = anchor - safePosition;

    const stepDuration = this.stepDuration;
    const musicalStep = safePosition / stepDuration;
    const isExactlyOnGrid = Math.abs(musicalStep - Math.round(musicalStep)) < 0.0001;
    this.nextStepIndex = isExactlyOnGrid ? Math.round(musicalStep) : Math.ceil(musicalStep);
    this.nextStepContextTime = this.originContextTime + this.nextStepIndex * stepDuration;

    if (this.timer != null) this.timers.clearInterval(this.timer);
    this.schedule();
    this.timer = this.timers.setInterval(() => this.schedule(), 20);
    return true;
  }

  restart(position = 0, contextTime = null) {
    return this.start({ position, contextTime, restart: true });
  }

  stop() {
    this.lastPosition = this.position();
    this.running = false;
    this.generation += 1;
    if (this.timer != null) this.timers.clearInterval(this.timer);
    this.timer = null;
    this.owners.clear();
    return true;
  }

  schedule() {
    const context = this.context;
    if (!this.running || !context || context.state !== 'running') return;
    const horizon = context.currentTime + 0.12;
    const stepDuration = this.stepDuration;

    while (this.nextStepContextTime <= horizon) {
      const absoluteStep = this.nextStepIndex;
      const loopStep = ((absoluteStep % this.loopSteps) + this.loopSteps) % this.loopSteps;
      const swingDelay = absoluteStep % 2 === 1 ? stepDuration * clamp(this.session?.swing, 0, 0.45) : 0;
      const scheduledContextTime = this.nextStepContextTime + swingDelay;
      const event = {
        absoluteStep,
        loopStep,
        bar: Math.floor(loopStep / 16) + 1,
        beat: Math.floor((loopStep % 16) / 4) + 1,
        sixteenth: (loopStep % 4) + 1,
        stepDuration,
        swingDelay,
        contextTime: scheduledContextTime,
        when: Math.max(0, scheduledContextTime - context.currentTime),
        position: absoluteStep * stepDuration + swingDelay,
      };

      for (const callback of this.subscribers.values()) {
        try {
          callback(event);
        } catch {
          // One instrument must never be able to stop the shared Spectra clock.
        }
      }

      this.nextStepIndex += 1;
      this.nextStepContextTime = this.originContextTime + this.nextStepIndex * stepDuration;
    }
  }

  reconfigure(mutator = null) {
    const context = this.context;
    const wasRunning = this.running && !!context;
    const oldStepDuration = this.stepDuration;
    const oldPosition = this.position();
    const musicalStep = oldPosition / Math.max(0.001, oldStepDuration);

    if (typeof mutator === 'function') mutator(this.session);
    if (!wasRunning) return this.snapshot();

    const newPosition = musicalStep * this.stepDuration;
    this.restart(newPosition, context.currentTime + 0.04);
    return this.snapshot();
  }

  setTempo(bpm) {
    return this.reconfigure((session) => {
      session.bpm = clamp(bpm, 50, 220);
    });
  }

  setSwing(value) {
    this.session.swing = clamp(value, 0, 0.45);
    return this.snapshot();
  }

  setLoopBars(bars) {
    return this.reconfigure((session) => {
      session.loopBars = [1, 2, 4, 8, 16].includes(Number(bars))
        ? Number(bars)
        : session.loopBars;
    });
  }

  setQuantize(grid) {
    if (SPECTRA_GRID_DIVISIONS[grid]) this.session.quantize = grid;
    return this.snapshot();
  }

  quantizeTime(rawTime, options = {}) {
    return quantizeSpectraTime(this.session, rawTime, options);
  }

  dispose() {
    this.owners.clear();
    this.subscribers.clear();
    this.stop();
  }
}
