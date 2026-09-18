import { AlleySystem } from '../alley/AlleySystem.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const STORAGE_KEY = 'breakglass.policeStrictness';

const POLICE_MODES = {
  relaxed: {
    label: 'RELAXED',
    complaintThreshold: 0.84,
    complaintSeconds: 32,
    responseSeconds: 52,
  },
  normal: {
    label: 'NORMAL',
    complaintThreshold: 0.78,
    complaintSeconds: 22,
    responseSeconds: 40,
  },
  strict: {
    label: 'STRICT',
    complaintThreshold: 0.7,
    complaintSeconds: 12,
    responseSeconds: 28,
  },
};

const modeFor = (value) => (value in POLICE_MODES ? value : 'normal');

function ensureState(alley) {
  alley.policeStrictness = modeFor(alley.policeStrictness);
  alley.rowdyLevel = clamp(Number(alley.rowdyLevel) || 0);
  alley.spillOutPressure = clamp(Number(alley.spillOutPressure) || 0);
  alley.clubAttendance = Math.max(0, Number(alley.clubAttendance) || 0);
  alley.clubCapacity = Math.max(1, Number(alley.clubCapacity) || 110);
  alley.clubDanceShare = clamp(Number(alley.clubDanceShare) || 0.5);
  alley.clubMixQuality = clamp(Number(alley.clubMixQuality) || 0.72);
}

let patched = false;

function patchAlleySystem() {
  if (patched) return;
  patched = true;

  const baseChat = AlleySystem.prototype.chat;
  const baseQuiet = AlleySystem.prototype.quiet;
  const baseArrivePolice = AlleySystem.prototype.arrivePolice;
  const baseResolvePolice = AlleySystem.prototype.resolvePolice;
  const baseSnapshot = AlleySystem.prototype.snapshot;

  AlleySystem.prototype.setPoliceStrictness = function setPoliceStrictness(value) {
    ensureState(this);
    this.policeStrictness = modeFor(value);
    return this.policeStrictness;
  };

  AlleySystem.prototype.setPartyContext = function setPartyContext(crowd = {}) {
    ensureState(this);
    const attendance = Math.max(0, Number(crowd.attendance) || 0);
    const capacity = Math.max(1, Number(crowd.capacity) || 110);
    const danceFloor = Math.max(0, Number(crowd.danceFloor) || 0);
    const danceShare = clamp(
      crowd.danceShare == null
        ? attendance > 0
          ? danceFloor / attendance
          : 0.5
        : Number(crowd.danceShare) || 0,
    );
    const mixQuality = clamp(Number(crowd.mixQuality) || 0);
    const density = clamp(attendance / capacity);
    const offFloorShare = attendance > 0 ? clamp(1 - danceFloor / attendance) : 0;
    const lostFloor = clamp((0.52 - danceShare) / 0.46);
    const badBlend = clamp((0.58 - mixQuality) / 0.5);

    // CrowdSystem already moves off-floor guests into Take A Break/social zones. A fraction of
    // that social pressure now spills outside, especially after a bad blend empties the floor.
    this.spillOutPressure = clamp(
      offFloorShare * 0.34 + lostFloor * 0.52 + badBlend * 0.18 + density * lostFloor * 0.2,
    );
    this.clubAttendance = attendance;
    this.clubCapacity = capacity;
    this.clubDanceShare = danceShare;
    this.clubMixQuality = mixQuality;
  };

  AlleySystem.prototype.chat = function enhancedChat(amount = 0.08) {
    ensureState(this);
    const result = baseChat.call(this, amount);
    if (amount >= 0.08) {
      this.rowdyLevel = clamp(this.rowdyLevel + amount * 1.55);
      this.disturbance = clamp(this.disturbance + amount * 0.28);
    }
    return result;
  };

  AlleySystem.prototype.quiet = function enhancedQuiet(amount = 0.18) {
    ensureState(this);
    const result = baseQuiet.call(this, amount);
    this.rowdyLevel = clamp(this.rowdyLevel - amount * 1.35);
    this.highNoiseTime = Math.max(0, this.highNoiseTime - amount * 8);
    return result;
  };

  AlleySystem.prototype.arrivePolice = function enhancedPoliceArrival() {
    ensureState(this);
    const arrived = baseArrivePolice.call(this);
    if (!arrived) return false;

    // A return visit is serious, but no longer an instant game-over. Shutdown happens if the
    // player argues or ignores the officers. Return visits do shorten the response window.
    if (this.policeVisits >= 2 && !this.evacuationStarted) {
      this.evacuationRequired = false;
      this.lastPoliceOutcome = 'returned-warning';
    }
    return true;
  };

  AlleySystem.prototype.resolvePolice = function enhancedResolvePolice(response) {
    const result = baseResolvePolice.call(this, response);
    if (response === 'brushOff' && result) {
      return 'They leave unconvinced. Another complaint will bring them back faster, and ignoring a return visit can shut the party down.';
    }
    return result;
  };

  AlleySystem.prototype.update = function enhancedAlleyUpdate(dt, metrics = {}) {
    ensureState(this);
    this.elapsed += dt;
    this.policeCooldown = Math.max(0, this.policeCooldown - dt);
    this.updatePoliceLights();

    if (this.evacuationStarted) {
      // A shutdown moves the club crowd into the alley rather than making everybody vanish.
      this.occupancy += (40 - this.occupancy) * (1 - Math.exp(-0.48 * dt));
      this.conversationLevel += (0.78 - this.conversationLevel) * (1 - Math.exp(-0.34 * dt));
      this.disturbance += (0.22 - this.disturbance) * (1 - Math.exp(-0.55 * dt));
      this.staffWarningLevel = 2;
      return;
    }

    const playing = !!metrics.playing;
    const energy = clamp(metrics.energy ?? (playing ? 0.5 : 0));
    const vibe = clamp(metrics.vibe ?? energy);
    const density = clamp(this.clubAttendance / this.clubCapacity);
    const musicDoorLeak = playing ? energy * 0.035 : 0;

    // Indoor music should not summon police by itself. Outside occupancy comes mostly from people
    // abandoning the floor/socializing outside, plus a small normal baseline on a busy night.
    const targetOccupancy = clamp(
      2.5 + density * 3.2 + this.spillOutPressure * 12.5 + this.rowdyLevel * 2.5,
      2,
      20,
    );
    this.occupancy +=
      (targetOccupancy - this.occupancy) *
      (1 - Math.exp(-(this.spillOutPressure > 0.45 ? 0.1 : 0.055) * dt));

    const occupancyPressure = clamp(this.occupancy / 15);
    const speechFloor = clamp(
      0.11 + occupancyPressure * 0.42 + this.rowdyLevel * 0.42 + this.spillOutPressure * 0.14,
    );
    this.conversationLevel += (speechFloor - this.conversationLevel) * (1 - Math.exp(-0.09 * dt));
    this.rowdyLevel = Math.max(0, this.rowdyLevel - dt * 0.016);

    const targetDisturbance = clamp(
      occupancyPressure * 0.36 +
        this.conversationLevel * 0.58 +
        this.rowdyLevel * 0.46 +
        this.spillOutPressure * 0.18 +
        musicDoorLeak -
        this.neighborTolerance * 0.22,
    );
    this.disturbance += (targetDisturbance - this.disturbance) * (1 - Math.exp(-0.26 * dt));

    const tuning = POLICE_MODES[this.policeStrictness];
    const previous = this.staffWarningLevel;
    const warningThreshold = tuning.complaintThreshold - 0.2;
    this.staffWarningLevel =
      this.disturbance > tuning.complaintThreshold - 0.04
        ? 2
        : this.disturbance > warningThreshold
          ? 1
          : 0;
    if (this.staffWarningLevel > previous) this.lastWarningAt = this.elapsed;

    const outsideActuallyNoisy = this.occupancy >= 6 || this.rowdyLevel >= 0.42;
    if (outsideActuallyNoisy && this.disturbance > tuning.complaintThreshold) {
      this.highNoiseTime += dt;
    } else {
      this.highNoiseTime = Math.max(0, this.highNoiseTime - dt * 1.15);
    }

    if (
      !this.policePresent &&
      this.policeCooldown <= 0 &&
      this.highNoiseTime >= tuning.complaintSeconds
    ) {
      this.arrivePolice();
    }

    if (this.policePresent && !this.evacuationRequired) {
      this.policeResponseTime += dt;
      const returnMultiplier =
        this.policeVisits <= 1 ? 1 : Math.max(0.55, 1 - (this.policeVisits - 1) * 0.18);
      const responseDeadline = tuning.responseSeconds * returnMultiplier;
      if (this.policeResponseTime >= responseDeadline) {
        this.lastPoliceOutcome = 'ignored';
        this.evacuationRequired = true;
      }
    }

    // A healthy floor gradually relieves outside pressure instead of continuing to ratchet upward.
    if (playing && this.clubDanceShare > 0.7 && vibe > 0.62) {
      this.spillOutPressure = Math.max(0, this.spillOutPressure - dt * 0.012);
    }
  };

  AlleySystem.prototype.warningText = function enhancedWarningText() {
    ensureState(this);
    const tuning = POLICE_MODES[this.policeStrictness];
    if (this.evacuationStarted)
      return 'Police have ended the party. Music is off and everyone is being cleared out.';
    if (this.evacuationRequired)
      return 'The police warning was ignored. The party is being shut down and everyone has to leave.';
    if (this.policePresent) {
      const returnText =
        this.policeVisits > 1 ? ' They have been here before, so this warning is shorter.' : '';
      return `Police are outside after a neighbour complaint. Go talk to them before the warning expires.${returnText}`;
    }
    if (this.staffWarningLevel >= 2)
      return 'Outside noise is at complaint level. Get people inside or calm the alley before police are called.';
    if (this.staffWarningLevel === 1)
      return 'The alley is getting loud. Off-floor guests are spilling outside and the neighbours can hear them.';
    if (this.spillOutPressure > 0.45)
      return 'The dance floor is thinning and people are drifting toward Take A Break and outside.';
    return `It is calm outside. Police pressure is ${tuning.label.toLowerCase()}; indoor music alone will not trigger a complaint.`;
  };

  AlleySystem.prototype.snapshot = function enhancedSnapshot() {
    ensureState(this);
    const snapshot = baseSnapshot.call(this);
    const tuning = POLICE_MODES[this.policeStrictness];
    const returnMultiplier =
      this.policeVisits <= 1 ? 1 : Math.max(0.55, 1 - (this.policeVisits - 1) * 0.18);
    return {
      ...snapshot,
      rowdyLevel: this.rowdyLevel,
      spillOutPressure: this.spillOutPressure,
      policeStrictness: this.policeStrictness,
      complaintThreshold: tuning.complaintThreshold,
      complaintProgress: clamp(this.highNoiseTime / tuning.complaintSeconds),
      responseDeadline: tuning.responseSeconds * returnMultiplier,
      clubDanceShare: this.clubDanceShare,
      clubMixQuality: this.clubMixQuality,
      warning: this.warningText(),
    };
  };
}

patchAlleySystem();

function readStrictness() {
  try {
    return modeFor(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'normal');
  } catch {
    return 'normal';
  }
}

function writeStrictness(value) {
  const mode = modeFor(value);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode);
  } catch {
    // The game still works if storage is blocked.
  }
  return mode;
}

function installGateControl(game, ui) {
  const gateCard = ui.gate?.querySelector?.('.card');
  const enter = ui.enter;
  if (!gateCard || !enter || gateCard.querySelector('[data-police-pressure]')) return;

  const row = ui.document.createElement('label');
  row.dataset.policePressure = 'true';
  row.className = 'game-option police-pressure-option';
  const caption = ui.document.createElement('span');
  caption.textContent = 'Police pressure';
  const select = ui.document.createElement('select');
  select.setAttribute('aria-label', 'Police pressure');
  for (const [value, config] of Object.entries(POLICE_MODES)) {
    const option = ui.document.createElement('option');
    option.value = value;
    option.textContent = config.label[0] + config.label.slice(1).toLowerCase();
    select.appendChild(option);
  }
  select.value = readStrictness();
  select.onchange = () => {
    const mode = writeStrictness(select.value);
    game.scenes?.get('alley')?.alley?.setPoliceStrictness?.(mode);
  };
  row.append(caption, select);
  gateCard.insertBefore(row, enter);
}

export function installPartyPressureEnhancements(game, ui) {
  patchAlleySystem();
  installGateControl(game, ui);

  if (!ui._partyPressureWarningPatched) {
    const baseWarning = ui.warning.bind(ui);
    ui.warning = (message) =>
      baseWarning(
        message === 'Police have returned to Breakglass. The party is being shut down.'
          ? 'Police have returned to Breakglass. This is a serious final warning — go outside and talk to them before it escalates.'
          : message,
      );
    ui._partyPressureWarningPatched = true;
  }

  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    const clubCrowd = game.scenes?.get('downstairs')?.crowd?.snapshot?.();
    const alley = game.scenes?.get('alley')?.alley;
    if (alley) {
      if (clubCrowd) alley.setPartyContext?.(clubCrowd);
      alley.setPoliceStrictness?.(readStrictness());
    }
    return baseUpdate(now, movementOverride);
  };
}
