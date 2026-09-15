import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three';

const material = (color, metalness = 0.04, roughness = 0.65) =>
  new MeshStandardMaterial({ color, metalness, roughness });

function guitarProp(kind = 'guitar') {
  const group = new Group();
  group.name = `held-${kind}`;
  const bodyMat = material(kind === 'bass' ? 0x304f68 : 0x8e493e, 0.12, 0.5);
  const wood = material(0x8a623d, 0.02, 0.64);
  const metal = material(0xc4c7ca, 0.65, 0.35);
  const body = new Mesh(new BoxGeometry(kind === 'bass' ? 0.34 : 0.38, 0.5, 0.12), bodyMat);
  body.scale.x = 1.15;
  const neck = new Mesh(new BoxGeometry(0.08, kind === 'bass' ? 0.92 : 0.78, 0.07), wood);
  const head = new Mesh(new BoxGeometry(0.13, 0.18, 0.07), wood);
  const bridge = new Mesh(new BoxGeometry(0.16, 0.035, 0.04), metal);
  body.position.set(0.11, -0.03, 0);
  neck.position.set(-0.03, 0.56, 0);
  head.position.set(-0.03, kind === 'bass' ? 1.08 : 0.95, 0);
  bridge.position.set(0.1, -0.08, 0.075);
  group.add(body, neck, head, bridge);
  group.rotation.z = -0.47;
  group.rotation.y = -0.08;
  group.position.set(0.08, 1.0, 0.32);
  return group;
}

function tapeProp() {
  const group = new Group();
  group.name = 'held-tape-reel';
  const reelMat = material(0xb5b8ba, 0.75, 0.32);
  const tapeMat = material(0x30231d, 0.05, 0.7);
  const rim = new Mesh(new TorusGeometry(0.19, 0.025, 8, 20), reelMat);
  rim.rotation.x = Math.PI / 2;
  const hub = new Mesh(new CylinderGeometry(0.055, 0.055, 0.055, 14), tapeMat);
  hub.rotation.x = Math.PI / 2;
  const spokeA = new Mesh(new BoxGeometry(0.34, 0.028, 0.035), reelMat);
  const spokeB = spokeA.clone();
  spokeB.rotation.z = Math.PI / 2;
  group.add(rim, hub, spokeA, spokeB);
  group.position.set(0.4, 0.92, 0.18);
  group.rotation.x = 0.1;
  group.rotation.y = -0.4;
  return group;
}

export class PerformancePropSystem {
  constructor(game) {
    this.game = game;
    this.player = game.player;
    this.guitar = guitarProp('guitar');
    this.bass = guitarProp('bass');
    this.tape = tapeProp();
    this.guitar.visible = false;
    this.bass.visible = false;
    this.tape.visible = false;
    this.player.object.add(this.guitar, this.bass, this.tape);
    this.elapsed = 0;
  }

  update(dt) {
    this.elapsed += dt;
    const config = this.game.keyboardPerformance?.config;
    const performanceActive = this.game.keyboardPerformance?.active === true;
    const guitarActive = performanceActive && config?.mode === 'guitar';
    const bassActive = performanceActive && config?.mode === 'bass';
    const carryingTape = !!this.game.state?.data?.archiveTape && !guitarActive && !bassActive;

    this.guitar.visible = guitarActive;
    this.bass.visible = bassActive;
    this.tape.visible = carryingTape;

    if (guitarActive || bassActive) {
      const prop = guitarActive ? this.guitar : this.bass;
      const bass = bassActive;
      const strum = Math.sin(this.elapsed * (bass ? 8.2 : 12)) * (bass ? 0.16 : 0.3);
      const fret = Math.sin(this.elapsed * 2.1) * 0.06;
      prop.rotation.x = Math.sin(this.elapsed * 2.3) * 0.025;
      prop.rotation.z = -0.47 + Math.sin(this.elapsed * 1.25) * 0.018;

      // The shoulders establish the broad playing pose; elbows put each hand where the instrument
      // actually is. Most visible strumming now happens below the right elbow.
      this.player.leftArm.rotation.x = -0.7 + fret * 0.15;
      this.player.leftArm.rotation.z = -0.22;
      this.player.leftForearm.rotation.x = -0.92 + fret;
      this.player.leftForearm.rotation.z = -0.16;
      this.player.rightArm.rotation.x = -0.54;
      this.player.rightArm.rotation.z = 0.22;
      this.player.rightForearm.rotation.x = -0.68 + strum;
      this.player.rightForearm.rotation.z = 0.08;
      this.player.head.rotation.y = Math.sin(this.elapsed * 1.2) * 0.08;
      this.player.head.rotation.x = -0.025 + Math.sin(this.elapsed * 0.8) * 0.018;
      this.player.body.rotation.z += Math.sin(this.elapsed * 1.3) * 0.012;
    } else if (carryingTape) {
      this.tape.rotation.z += dt * 0.55;
      this.tape.position.y = 0.92 + Math.sin(this.elapsed * 1.55) * 0.012;
      this.player.rightArm.rotation.x = -0.48;
      this.player.rightArm.rotation.z = 0.18;
      this.player.rightForearm.rotation.x = -0.78;
      this.player.rightForearm.rotation.z = 0.06;
      this.player.leftArm.rotation.x = -0.14;
      this.player.leftForearm.rotation.x = -0.2;
    }
  }

  dispose() {
    for (const prop of [this.guitar, this.bass, this.tape]) prop.removeFromParent();
  }
}
