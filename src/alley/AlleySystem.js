import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PointLight } from 'three';
import { poseLightweightHuman } from '../avatar/LightweightHuman.js';
import { createNpcCharacter } from '../npcs/NpcSystem.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function buildPoliceVisual(root, position) {
  if (!root?.add) return null;
  const group = new Group();
  group.name = 'alley:police-response';
  group.position.fromArray(position);

  const dark = new MeshStandardMaterial({ color: 0x172231, roughness: 0.6, metalness: 0.18 });
  const trim = new MeshStandardMaterial({ color: 0x07090d, roughness: 0.52, metalness: 0.35 });
  const glass = new MeshStandardMaterial({
    color: 0x47637a,
    roughness: 0.18,
    metalness: 0.12,
    transparent: true,
    opacity: 0.84,
  });
  const headlight = new MeshStandardMaterial({
    color: 0xe9f3ff,
    emissive: 0xbad6ff,
    emissiveIntensity: 1.5,
    roughness: 0.22,
  });
  const redMaterial = new MeshStandardMaterial({
    color: 0xff2947,
    emissive: 0xff1637,
    emissiveIntensity: 2.1,
  });
  const blueMaterial = new MeshStandardMaterial({
    color: 0x2d65ff,
    emissive: 0x214fff,
    emissiveIntensity: 2.1,
  });

  const chassis = new Mesh(new BoxGeometry(3.45, 0.58, 1.62), dark);
  chassis.position.set(0, 0.48, 0);
  chassis.castShadow = true;
  const hood = new Mesh(new BoxGeometry(1.05, 0.22, 1.5), dark);
  hood.position.set(1.13, 0.83, 0);
  const trunk = new Mesh(new BoxGeometry(0.68, 0.2, 1.48), dark);
  trunk.position.set(-1.34, 0.8, 0);
  const cabin = new Mesh(new BoxGeometry(1.55, 0.64, 1.36), glass);
  cabin.position.set(-0.22, 1.04, 0);
  cabin.castShadow = true;
  const bumperFront = new Mesh(new BoxGeometry(0.14, 0.18, 1.66), trim);
  bumperFront.position.set(1.78, 0.39, 0);
  const bumperRear = bumperFront.clone();
  bumperRear.position.x = -1.78;
  group.add(chassis, hood, trunk, cabin, bumperFront, bumperRear);

  for (const x of [-1.12, 1.08]) {
    for (const z of [-0.82, 0.82]) {
      const wheel = new Mesh(new CylinderGeometry(0.31, 0.31, 0.22, 12), trim);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.31, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }
  for (const z of [-0.52, 0.52]) {
    const lamp = new Mesh(new BoxGeometry(0.08, 0.18, 0.3), headlight);
    lamp.position.set(1.76, 0.62, z);
    group.add(lamp);
  }

  const lightBarBase = new Mesh(new BoxGeometry(0.78, 0.06, 0.24), trim);
  lightBarBase.position.set(-0.24, 1.43, 0);
  const redBar = new Mesh(new BoxGeometry(0.34, 0.11, 0.19), redMaterial);
  redBar.position.set(-0.24, 1.51, -0.14);
  const blueBar = new Mesh(new BoxGeometry(0.34, 0.11, 0.19), blueMaterial);
  blueBar.position.set(-0.24, 1.51, 0.14);
  group.add(lightBarBase, redBar, blueBar);

  const officers = [];
  const officerStarts = [
    [1.95, 0, -0.62],
    [1.9, 0, 0.62],
    [0.8, 0, 0.92],
  ];
  for (let index = 0; index < officerStarts.length; index++) {
    const model = createNpcCharacter({
      id: `police-officer-${index + 1}`,
      appearance: {
        skin: index === 1 ? 0x8f624c : 0xc08b6d,
        hair: 0x17191d,
        outfit: 0x182a40,
        trousers: 0x111a26,
        accent: 0x8b9db2,
        hairStyle: 'short',
        cap: true,
        bodyWidth: 0.96,
      },
    });
    model.group.position.fromArray(officerStarts[index]);
    model.group.rotation.y = index === 0 ? 0.28 : index === 1 ? -0.24 : -0.55;
    model.group.scale.setScalar(1.03);
    model.group.visible = index < 2;
    group.add(model.group);
    officers.push({
      model,
      base: [...officerStarts[index]],
      phase: index * 1.7,
    });
  }

  const redLight = new PointLight(0xff334d, 0, 14, 2);
  const blueLight = new PointLight(0x3f7cff, 0, 14, 2);
  redLight.position.set(-0.25, 1.62, -0.35);
  blueLight.position.set(-0.25, 1.62, 0.35);
  group.add(redLight, blueLight);
  group.visible = false;
  root.add(group);
  return {
    group,
    redLight,
    blueLight,
    redBar,
    blueBar,
    officers,
    materials: [dark, trim, glass, headlight, redMaterial, blueMaterial],
  };
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
    if (response === 'ticket') {
      this.lastPoliceOutcome = 'ticket';
      this.evacuationRequired = true;
      return 'The officers say this is the repeat complaint. The party is shut down and a noise complaint ticket has been issued.';
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
      this.visual.redBar.material.emissiveIntensity = 0.25;
      this.visual.blueBar.material.emissiveIntensity = 0.25;
      return;
    }
    const phase = Math.sin(this.elapsed * 10.5);
    const redOn = phase > 0;
    this.visual.redLight.intensity = redOn ? 6.8 : 0.45;
    this.visual.blueLight.intensity = redOn ? 0.45 : 6.8;
    this.visual.redBar.material.emissiveIntensity = redOn ? 3.2 : 0.35;
    this.visual.blueBar.material.emissiveIntensity = redOn ? 0.35 : 3.2;

    const busting = this.evacuationRequired || this.evacuationStarted;
    for (const [index, officer] of this.visual.officers.entries()) {
      const model = officer.model;
      model.group.visible = index < 2 || busting;
      if (!model.group.visible) continue;
      const advance = busting ? Math.min(4.2 + index * 0.45, this.policeResponseTime * 0.34 + 0.6) : 0;
      model.group.position.set(
        officer.base[0] + advance,
        officer.base[1],
        officer.base[2] + Math.sin(this.elapsed * 0.55 + officer.phase) * 0.08,
      );
      poseLightweightHuman(model, {
        time: this.elapsed,
        phase: officer.phase,
        moving: busting,
        energy: busting ? 0.58 : 0.24,
      });
      if (!busting) {
        const talk = (Math.sin(this.elapsed * 1.35 + officer.phase) + 1) * 0.5;
        model.rightArm.rotation.x = -0.12 - talk * 0.28;
        model.rightForearm.rotation.x = -0.18 - talk * 0.34;
        model.head.rotation.y += Math.sin(this.elapsed * 0.7 + officer.phase) * 0.045;
      }
    }
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
