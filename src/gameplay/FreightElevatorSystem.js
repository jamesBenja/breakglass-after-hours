import { endgameChecklist, fullGameComplete } from './RoofEndgameSystem.js';

export const FREIGHT_FLOORS = Object.freeze({ roof: 0, alley: 100 });
export const FREIGHT_ALIGNMENT_TOLERANCE = 0.85;
export const FREIGHT_MIN_POSITION = -5;
export const FREIGHT_MAX_POSITION = 105;

export const FREIGHT_HISTORY_LAYERS = Object.freeze([
  {
    max: 14,
    title: 'ROOF / NOW',
    detail: 'Roof tar, patched conduit, AC vibration and the final years of Breakglass.',
  },
  {
    max: 31,
    title: 'RECENT BUILDOUT',
    detail: 'Club wiring, broadcast cable, newer repairs and layers added on top of older ones.',
  },
  {
    max: 49,
    title: 'STUDIO YEARS',
    detail: 'Old session rooms, patch runs, paint lines and the building being adapted again and again.',
  },
  {
    max: 67,
    title: 'EARLY BREAKGLASS',
    detail: 'Bare rooms, heavy gear, improvised fixes and the freight cage doing the work.',
  },
  {
    max: 84,
    title: 'OLDER INDUSTRIAL LAYERS',
    detail: 'Freight rails, tired brick, old electrical work, blocked openings and previous tenants.',
  },
  {
    max: 100,
    title: 'FOUNDATION / YARD',
    detail: 'Pipes, concrete, patched masonry and the alley appearing at the bottom of the shaft.',
  },
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export function historicalLayerAt(position) {
  const value = clamp(position, 0, 100);
  return FREIGHT_HISTORY_LAYERS.find((layer) => value <= layer.max) ?? FREIGHT_HISTORY_LAYERS.at(-1);
}

export function freightAligned(position, floorPosition, tolerance = FREIGHT_ALIGNMENT_TOLERANCE) {
  return Math.abs(Number(position) - Number(floorPosition)) <= tolerance;
}

export function stepFreightPosition(position, direction, amount = 0.68) {
  return clamp(
    Number(position) + (direction > 0 ? 1 : -1) * Math.abs(Number(amount) || 0),
    FREIGHT_MIN_POSITION,
    FREIGHT_MAX_POSITION,
  );
}

function floorLabel(sceneId) {
  return sceneId === 'roof' ? 'ROOF' : 'ALLEY';
}

export class FreightElevatorSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.activeScene = null;
    this.phase = 'landing';
    this.gateClosed = false;
    this.holdTimer = null;
    this.holdDirection = 0;
    this.refs = {};
    this.position = clamp(
      game.state?.data?.freightElevatorPosition ?? FREIGHT_FLOORS.roof,
      FREIGHT_MIN_POSITION,
      FREIGHT_MAX_POSITION,
    );
  }

  data() {
    return this.game.state.data;
  }

  context() {
    return { djLessonCompleted: this.game.djLesson?.completed === true };
  }

  unlocked() {
    return (
      this.game.godMode === true ||
      this.data().roofEscapeUnlocked === true ||
      fullGameComplete(this.data(), this.context())
    );
  }

  sceneId() {
    return this.game.sceneManager?.current?.definition?.id ?? this.activeScene ?? 'roof';
  }

  floorPosition(sceneId = this.activeScene ?? this.sceneId()) {
    return FREIGHT_FLOORS[sceneId] ?? FREIGHT_FLOORS.roof;
  }

  targetScene() {
    return this.activeScene === 'roof' ? 'alley' : 'roof';
  }

  targetPosition() {
    return this.floorPosition(this.targetScene());
  }

  save() {
    this.data().freightElevatorPosition = this.position;
    this.game.save?.();
  }

  stopHold({ save = true, rerender = false } = {}) {
    if (this.holdTimer != null) {
      clearInterval(this.holdTimer);
      this.holdTimer = null;
    }
    this.holdDirection = 0;
    if (save) this.save();
    if (rerender) this.render();
  }

  open(target = null) {
    this.stopHold({ save: false });
    this.activeScene = this.sceneId();

    if (!['roof', 'alley'].includes(this.activeScene)) return false;
    if (this.activeScene === 'roof' && !this.unlocked()) {
      const missing = endgameChecklist(this.data(), this.context()).filter((item) => !item.complete);
      this.ui.panel(
        'SEALED FREIGHT HATCH',
        `The roof hatch will not release yet. Scratched into the grey plate: FINISH THE BUILDING. Remaining: ${missing.map((item) => item.label).join(' · ')}.`,
      );
      return true;
    }
    if (this.activeScene === 'alley' && !this.data().roofEscapeUnlocked && !this.game.godMode) {
      this.ui.panel(
        'OLD FREIGHT ELEVATOR',
        'The grey alley gate is here, but the freight system is still locked from somewhere above. The controls are dead.',
      );
      return true;
    }

    this.position = clamp(
      this.data().freightElevatorPosition ?? this.floorPosition(this.activeScene),
      FREIGHT_MIN_POSITION,
      FREIGHT_MAX_POSITION,
    );
    this.phase = 'landing';
    this.gateClosed = false;
    this.render(target);
    return true;
  }

  createButton(label, action, className = '') {
    const button = this.ui.document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (className) button.className = className;
    button.onclick = action;
    return button;
  }

  createHoldButton(label, direction, disabled = false) {
    const button = this.createButton(label, () => {}, 'freight-hold-button');
    button.disabled = disabled;
    button.onpointerdown = (event) => {
      if (button.disabled) return;
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      this.startHold(direction);
    };
    const release = (event) => {
      if (event?.pointerId != null && button.hasPointerCapture?.(event.pointerId)) {
        button.releasePointerCapture?.(event.pointerId);
      }
      this.stopHold({ save: true, rerender: true });
    };
    button.onpointerup = release;
    button.onpointercancel = release;
    return button;
  }

  buildShaftVisual(targetFloor) {
    const machine = this.ui.document.createElement('section');
    machine.className = 'freight-machine';

    const shaft = this.ui.document.createElement('div');
    shaft.className = 'freight-shaft-window';

    const strip = this.ui.document.createElement('div');
    strip.className = 'freight-history-strip';
    for (const layer of FREIGHT_HISTORY_LAYERS) {
      const section = this.ui.document.createElement('div');
      section.className = 'freight-history-layer';
      const title = this.ui.document.createElement('strong');
      title.textContent = layer.title;
      const copy = this.ui.document.createElement('small');
      copy.textContent = layer.detail;
      section.append(title, copy);
      strip.appendChild(section);
    }

    const bars = this.ui.document.createElement('div');
    bars.className = 'freight-cage-bars';
    shaft.append(strip, bars);

    const history = this.ui.document.createElement('div');
    history.className = 'freight-history-readout';

    const gauge = this.ui.document.createElement('div');
    gauge.className = 'freight-tape-gauge';
    const fixedTape = this.ui.document.createElement('span');
    fixedTape.className = 'freight-tape fixed';
    fixedTape.textContent = 'SANDOR';
    const movingTape = this.ui.document.createElement('span');
    movingTape.className = 'freight-tape moving';
    movingTape.textContent = 'CAGE';
    gauge.append(fixedTape, movingTape);

    const alignment = this.ui.document.createElement('div');
    alignment.className = 'freight-alignment-readout';

    machine.append(shaft, history, gauge, alignment);
    this.ui.buttons.appendChild(machine);

    this.refs = { strip, history, movingTape, alignment, targetFloor };
    this.updateVisuals();
  }

  updateVisuals() {
    if (!this.refs.strip) return;
    const progress = clamp(this.position, 0, 100);
    this.refs.strip.style.transform = `translateY(${-progress * 0.71}%)`;
    const layer = historicalLayerAt(progress);
    this.refs.history.textContent = `${layer.title} · ${layer.detail}`;

    const target = Number(this.refs.targetFloor) || 0;
    const offset = this.position - target;
    const gaugeOffset = clamp(offset * 8, -48, 48);
    this.refs.movingTape.style.transform = `translateY(${gaugeOffset}px)`;

    const aligned = freightAligned(this.position, target);
    const relation =
      aligned ? 'TAPE LINED UP' : offset < 0 ? `${Math.abs(offset).toFixed(1)} HIGH` : `${Math.abs(offset).toFixed(1)} LOW`;
    this.refs.alignment.textContent = `Cage ${this.position.toFixed(1)} · target ${target.toFixed(1)} · ${relation}`;
    this.refs.alignment.classList.toggle('aligned', aligned);
  }

  render() {
    if (!this.ui.document || !this.ui.buttons) return;
    const sceneFloor = this.floorPosition(this.activeScene);
    const cageAtLanding = freightAligned(this.position, sceneFloor);

    if (this.phase === 'landing') {
      this.ui.clearPanel(
        'OLD BREAKGLASS FREIGHT ELEVATOR',
        cageAtLanding
          ? `The grey freight cage is sitting at ${floorLabel(this.activeScene)}. The gate is manual and the two scraps of white electrical tape still mark the only reliable stopping point.`
          : `The cage is somewhere else in the shaft. There is no automatic levelling: hold the call direction until Sandor's two pieces of white electrical tape line up exactly.`,
      );
      this.buildShaftVisual(sceneFloor);

      const controls = this.ui.document.createElement('div');
      controls.className = 'row freight-controls';
      controls.append(
        this.createHoldButton('HOLD ↑ UP', -1, cageAtLanding),
        this.createHoldButton('HOLD ↓ DOWN', 1, cageAtLanding),
      );
      this.ui.buttons.appendChild(controls);

      const enter = this.createButton(
        cageAtLanding ? 'Open gate and step into cage' : 'Gate will not open until tape is aligned',
        () => this.enterCabin(),
        'freight-gate-button',
      );
      enter.disabled = !cageAtLanding;
      this.ui.buttons.appendChild(enter);
      return;
    }

    const destination = this.targetScene();
    const targetFloor = this.targetPosition();
    const aligned = freightAligned(this.position, targetFloor);
    const movingAllowed = this.gateClosed;

    this.ui.clearPanel(
      `FREIGHT CAGE · ${floorLabel(this.activeScene)} → ${floorLabel(destination)}`,
      this.gateClosed
        ? `Gate shut. Hold the direction continuously. Let go to stop. The cage has no automatic floor levelling, so overshooting the white tape means correcting back the other way.`
        : 'You are inside the old grey cage. Nothing moves until you drag the rattling inner gate fully shut.',
    );
    this.buildShaftVisual(targetFloor);

    const gateRow = this.ui.document.createElement('div');
    gateRow.className = 'row freight-gate-row';
    const gate = this.createButton(
      this.gateClosed ? '✓ INNER GATE CLOSED' : 'Pull inner gate shut',
      () => {
        this.gateClosed = true;
        this.game.audio?.tone?.(92, 0.16, 'square', 0.025);
        this.render();
      },
      'freight-gate-button',
    );
    gate.disabled = this.gateClosed;
    gateRow.appendChild(gate);
    this.ui.buttons.appendChild(gateRow);

    const controls = this.ui.document.createElement('div');
    controls.className = 'row freight-controls';
    controls.append(
      this.createHoldButton('HOLD ↑ UP', -1, !movingAllowed),
      this.createHoldButton('HOLD ↓ DOWN', 1, !movingAllowed),
    );
    this.ui.buttons.appendChild(controls);

    const exit = this.createButton(
      aligned ? `Open gate at ${floorLabel(destination)}` : 'Door catches · align the white tape first',
      () => this.exitCabin(),
      'freight-gate-button freight-exit-button',
    );
    exit.disabled = !aligned || !this.gateClosed;
    this.ui.buttons.appendChild(exit);
  }

  enterCabin() {
    const currentFloor = this.floorPosition(this.activeScene);
    if (!freightAligned(this.position, currentFloor)) {
      this.ui.warning?.("The landing gate is jammed. Sandor's tape marks are not lined up.");
      this.render();
      return;
    }
    this.phase = 'inside';
    this.gateClosed = false;
    this.render();
  }

  startHold(direction) {
    if (this.phase === 'inside' && !this.gateClosed) {
      this.ui.warning?.('Close the freight gate before touching the motor controls.');
      return;
    }
    this.stopHold({ save: false });
    this.holdDirection = direction > 0 ? 1 : -1;
    this.game.audio?.tone?.(58, 0.18, 'sawtooth', 0.018);

    const tick = () => {
      this.position = stepFreightPosition(this.position, this.holdDirection);
      this.data().freightElevatorPosition = this.position;
      this.updateVisuals();
    };
    tick();
    this.holdTimer = setInterval(tick, 55);
  }

  async exitCabin() {
    const targetScene = this.targetScene();
    const targetFloor = this.targetPosition();
    if (!this.gateClosed || !freightAligned(this.position, targetFloor)) {
      this.ui.warning?.("The door will not clear the sill. Line up Sandor's white tape first.");
      this.render();
      return;
    }

    this.stopHold({ save: false });
    this.position = targetFloor;
    this.data().freightElevatorPosition = targetFloor;
    this.data().roofEscapeUnlocked = true;
    this.data().freightElevatorTrips = Math.min(
      999,
      (this.data().freightElevatorTrips ?? 0) + 1,
    );
    this.data().roofEscapeVisits = Math.min(999, (this.data().roofEscapeVisits ?? 0) + 1);
    this.game.save?.();

    const target =
      targetScene === 'alley' ? 'alley@freightElevator' : 'roof@freightElevator';
    await this.game.sceneManager.request(target);
    this.activeScene = targetScene;
    this.phase = 'landing';
    this.gateClosed = false;
    this.ui.panel(
      targetScene === 'alley' ? 'FREIGHT ELEVATOR · ALLEY' : 'FREIGHT ELEVATOR · ROOF',
      targetScene === 'alley'
        ? 'The tape marks line up. The gate scrapes open onto the yard. Looking back up the shaft feels like looking through a vertical excavation of every version of the building.'
        : 'The tape marks meet exactly and the old gate releases onto the roof. The cage settles with one final metallic complaint.',
    );
  }

  handle(target) {
    if (!['freightElevator', 'roofEscape'].includes(target?.action)) return false;
    return this.open(target);
  }

  dispose() {
    this.stopHold({ save: false });
    this.refs = {};
  }
}

export function installFreightElevatorSystem(game, ui) {
  if (!game || game._freightElevatorInstalled) return game?.freightElevator ?? null;
  game._freightElevatorInstalled = true;
  const system = new FreightElevatorSystem(game, ui);
  game.freightElevator = system;

  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (system.handle(target)) return;
    baseDispatch(target);
  };

  return system;
}
