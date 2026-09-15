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
  group.position.set(0.46, 0.86, 0.1);
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
      const strum = Math.sin(this.elapsed * 12) * 0.22;
      prop.rotation.x = Math.sin(this.elapsed * 2.3) * 0.025;
      this.player.leftArm.rotation.x = -0.78;
      this.player.leftArm.rotation.z = -0.22;
      this.player.rightArm.rotation.x = -0.72 + strum;
      this.player.rightArm.rotation.z = 0.28;
      this.player.head.rotation.y = Math.sin(this.elapsed * 1.2) * 0.08;
    } else if (carryingTape) {
      this.tape.rotation.z += dt * 0.7;
      this.player.rightArm.rotation.x = -0.55;
      this.player.rightArm.rotation.z = 0.22;
    }
  }

  dispose() {
    for (const prop of [this.guitar, this.bass, this.tape]) prop.removeFromParent();
  }
}
