import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PointLight } from 'three';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function buildPoliceVisual(root, position) {
  if (!root?.add) return null;
  const group = new Group();
  group.name = 'alley:police-response';
  group.position.fromArray(position);

  const dark = new MeshStandardMaterial({ color: 0x1b2430, roughness: 0.76, metalness: 0.08 });
  const glass = new MeshStandardMaterial({ color: 0x32475c, roughness: 0.35, metalness: 0.18 });
  const skin = new MeshStandardMaterial({ color: 0xaa765a, roughness: 0.82, metalness: 0.02 });
  const car = new Mesh(new BoxGeometry(3.1, 0.72, 1.55), dark);
  car.position.set(0, 0.48, 0);
  car.castShadow = true;
  const cabin = new Mesh(new BoxGeometry(1.55, 0.62, 1.35), glass);
  cabin.position.set(-0.15, 1.05, 0);
  cabin.castShadow = true;
  group.add(car, cabin);

  for (const [index, z] of [-1.05, 1.05].entries()) {
    const officer = new Group();
    officer.position.set(1.9, 0, z * 0.55);
    const body = new Mesh(new BoxGeometry(0.48, 0.92, 0.32), dark);
    body.position.y = 0.92;
    const head = new Mesh(new BoxGeometry(0.3, 0.32, 0.3), skin);
    head.position.y = 1.63;
    const cap = new Mesh(new BoxGeometry(0.36, 0.1, 0.38), dark);
    cap.position.y = 1.83;
    officer.add(body, head, cap);
    officer.rotation.y = index ? -0.2 : 0.2;
    group.add(officer);
  }

  const redLight = new PointLight(0xff334d, 0, 11, 2);
  const blueLight = new PointLight(0x3f7cff, 0, 11, 2);
  redLight.position.set(-0.25, 1.55, -0.35);
  blueLight.position.set(-0.25, 1.55, 0.35);
  group.add(redLight, blueLight);
  group.visible = false;
  root.add(group);
  return { group, redLight, blueLight, materials: [dark, glass, skin] };
}

/** Dynamic alley spill-out, neighbour-noise pressure and police escalation. */
export class AlleySystem {
  constructor(rootOrConfig = {}, maybeConfig = {}) {
    const hasRoot = typeof rootOrConfig?.add === 'function';
    const root = hasRoot ? rootOrConfig : null;
    const config = hasRoot ? maybeConfig : rootOrConfig;
    this.occupancy = Math.max(0, Number(config.startOccupancy ?? 6));
    this.conversationLevel = clamp(config.conversationLevel ?? 0.24);
    this.disturbance = clamp(config.disturbance ?? 0.12);
    this.staffWarningLevel = 0;
    this.lastWarningAt = -Infinity;
    this.neighborTolerance = clamp(config.neighborTolerance ?? 0.55, 0.15, 0.95);
    this.elapsed = 0;

    this.policePosition = config.policePosition ?? [-22.5, 0, 0.1];
    this.policePresent = false;
    this.policeVisits = 0;
    this.policeCooldown = 0;
    this.policeResponseTime = 0;
    this.highNoiseTime = 0;
    this.lastPoliceOutcome = null;
    this.evacuationRequired = false;
    this.evacuationStarted = false;
    this.visual = buildPoliceVisual(root, this.policePosition);
  }

  chat(amount = 0.08) {
    this.conversationLevel = clamp(this.conversationLevel + amount);
    this.disturbance = clamp(this.disturbance + amount * 0.45);
  }

  quiet(amount = 0.18) {
    this.conversationLevel = clamp(this.conversationLevel - amount);
    this.disturbance = clamp(this.disturbance - amount * 0.7);
  }

  setPoliceVisible(visible) {
    if (this.visual?.group) this.visual.group.visible = !!visible;
  }

  arrivePolice() {
    if (this.policePresent || this.evacuationStarted) return false;
    this.policePresent = true;
    this.policeVisits += 1;
    this.policeResponseTime = 0;
    this.highNoiseTime = 0;
    this.lastPoliceOutcome = 'arrived';
    this.setPoliceVisible(true);
    if (this.policeVisits >= 2) {
      this.evacuationRequired = true;
      this.lastPoliceOutcome = 'returned-shutdown';
    }
    return true;
  }

  resolvePolice(response) {
    if (!this.policePresent || this.evacuationStarted) return null;
    if (response === 'cooperate') {
      this.lastPoliceOutcome = 'cooperated';
      this.policePresent = false;
      this.policeCooldown = 34;
      this.occupancy = Math.max(2, this.occupancy - 6);
      this.quiet(0.48);
      this.neighborTolerance = clamp(this.neighborTolerance - 0.05, 0.15, 0.95);
      this.setPoliceVisible(false);
      return 'You apologize, move the alley crowd inside and promise to keep the door under control. They leave with a warning.';
    }
    if (response === 'brushOff') {
      this.lastPoliceOutcome = 'brushed-off';
      this.policePresent = false;
      this.policeCooldown = 12;
      this.quiet(0.12);
      this.neighborTolerance = clamp(this.neighborTolerance - 0.16, 0.15, 0.95);
      this.setPoliceVisible(false);
      return 'They leave unconvinced. The next complaint will bring them back quickly, and a return visit means the party is over.';
    }
    this.lastPoliceOutcome = 'argued';
    this.evacuationRequired = true;
    return 'The conversation goes badly. Police tell you the event is being shut down and everyone has to leave.';
  }

  beginEvacuation() {
    this.evacuationRequired = true;
    this.evacuationStarted = true;
    this.policePresent = true;
    this.lastPoliceOutcome = 'evacuating';
    this.setPoliceVisible(true);
  }

  interactionTargets() {
    if (!this.policePresent) return [];
    return [
      {
        id: 'alley-police',
        name: this.evacuationRequired ? 'Police · party shutdown' : 'Police officers',
        position: this.policePosition,
        radius: 2.4,
        action: 'police',
      },
    ];
  }

  updatePoliceLights() {
    if (!this.visual) return;
    if (!this.policePresent) {
      this.visual.redLight.intensity = 0;
      this.visual.blueLight.intensity = 0;
      return;
    }
    const phase = Math.sin(this.elapsed * 10.5);
    this.visual.redLight.intensity = phase > 0 ? 5.8 : 0.5;
    this.visual.blueLight.intensity = phase <= 0 ? 5.8 : 0.5;
  }

  update(dt, metrics = {}) {
    this.elapsed += dt;
    this.policeCooldown = Math.max(0, this.policeCooldown - dt);
    this.updatePoliceLights();

    if (this.evacuationStarted) {
      this.occupancy = Math.max(0, this.occupancy - dt * 0.95);
      this.conversationLevel = Math.max(0.04, this.conversationLevel - dt * 0.055);
      this.disturbance += (0.08 - this.disturbance) * (1 - Math.exp(-0.7 * dt));
      this.staffWarningLevel = 2;
      return;
    }

    const playing = !!metrics.playing;
    const energy = clamp(metrics.energy ?? (playing ? 0.5 : 0));
    const vibe = clamp(metrics.vibe ?? energy);
    const partyPull = playing ? clamp(vibe * 0.72 + energy * 0.28) : 0;
    const targetOccupancy = clamp(4 + partyPull * 13, 2, 18);
    this.occupancy +=
      (targetOccupancy - this.occupancy) * (1 - Math.exp(-(playing ? 0.055 : 0.035) * dt));

    const occupancyPressure = clamp(this.occupancy / 14);
    const speechFloor = clamp(0.13 + occupancyPressure * 0.5 + energy * 0.08);
    this.conversationLevel += (speechFloor - this.conversationLevel) * (1 - Math.exp(-0.075 * dt));

    const target = clamp(
      occupancyPressure * 0.48 +
        this.conversationLevel * 0.64 +
        energy * 0.08 -
        this.neighborTolerance * 0.18,
    );
    this.disturbance += (target - this.disturbance) * (1 - Math.exp(-0.32 * dt));

    const previous = this.staffWarningLevel;
    this.staffWarningLevel = this.disturbance > 0.72 ? 2 : this.disturbance > 0.46 ? 1 : 0;
    if (this.staffWarningLevel > previous) this.lastWarningAt = this.elapsed;

    if (this.disturbance > 0.68) this.highNoiseTime += dt;
    else this.highNoiseTime = Math.max(0, this.highNoiseTime - dt * 1.6);

    if (!this.policePresent && this.policeCooldown <= 0 && this.highNoiseTime >= 8) {
      this.arrivePolice();
    }

    if (this.policePresent && !this.evacuationRequired) {
      this.policeResponseTime += dt;
      if (this.policeResponseTime >= 24) {
        this.lastPoliceOutcome = 'ignored';
        this.evacuationRequired = true;
      }
    }
  }

  warningText() {
    if (this.evacuationStarted)
      return 'Police have ended the party. Music is off and everyone is being cleared out.';
    if (this.evacuationRequired)
      return 'Police are here and the party is being shut down. Everyone has to leave.';
    if (this.policePresent)
      return 'Police have arrived after a neighbour complaint. You need to go talk to them.';
    if (this.staffWarningLevel >= 2)
      return 'The alley is loud enough to trigger complaints. Get people inside and lower the voices.';
    if (this.staffWarningLevel === 1)
      return 'The alley is getting loud. More people outside means more voices carrying to the neighbours.';
    return 'It is calm outside. Club bass is bleeding through the door, but the alley is mostly conversation.';
  }

  snapshot() {
    return {
      occupancy: Math.round(this.occupancy),
      conversationLevel: this.conversationLevel,
      disturbance: this.disturbance,
      staffWarningLevel: this.staffWarningLevel,
      lastWarningAt: this.lastWarningAt,
      neighborTolerance: this.neighborTolerance,
      policePresent: this.policePresent,
      policeVisits: this.policeVisits,
      policeCooldown: this.policeCooldown,
      policeResponseTime: this.policeResponseTime,
      lastPoliceOutcome: this.lastPoliceOutcome,
      evacuationRequired: this.evacuationRequired,
      evacuationStarted: this.evacuationStarted,
      warning: this.warningText(),
    };
  }

  dispose() {
    if (!this.visual) return;
    this.visual.group.removeFromParent();
    this.visual.group.traverse((object) => object.geometry?.dispose?.());
    for (const item of this.visual.materials) item.dispose();
    this.visual = null;
  }
}
