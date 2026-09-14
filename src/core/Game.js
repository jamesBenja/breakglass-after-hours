import { WebGLRenderer, PCFSoftShadowMap } from 'three';
import { AssetLoader } from '../assets/AssetLoader.js';
import { assetManifest } from '../assets/manifest.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { PlayerController } from '../player/PlayerController.js';
import { InputController } from '../player/InputController.js';
import { FollowCamera } from '../player/FollowCamera.js';
import { SceneManager } from '../scenes/SceneManager.js';
import { createUpstairsScene } from '../scenes/UpstairsScene.js';
import { createBelowScene } from '../scenes/BelowScene.js';
import { GameState } from '../state/GameState.js';
import { InteractionSystem } from '../interactions/InteractionSystem.js';
import { createActions } from '../interactions/createActions.js';

/** Composition root. Systems communicate via explicit references and callbacks. */
export class Game {
  constructor(ui, options = {}) {
    this.ui = ui;
    this.spatialPass = options.spatialPass;
    this.started = false;
    this.disposed = false;
    this.scenes = new Map();
    this.saveElapsed = 0;
    this.fps = 60;
    let storage = options.storage;
    if (!('storage' in options)) {
      try {
        storage = window.localStorage;
      } catch {
        /* Restricted browsers still play. */
      }
    }
    this.state = new GameState(storage, (message) => ui.warning(message));
    this.assets = new AssetLoader(assetManifest, {
      baseUrl: new URL(import.meta.env.BASE_URL, document.baseURI).href,
      onWarning: (message) => ui.warning(message),
      onProgress: ({ loaded, total }) => {
        ui.status.textContent = `Loading assets ${loaded}/${total}…`;
      },
    });
    this.audio = new AudioEngine({
      assets: this.assets,
      onTrack: (id) => {
        this.state.data.lastTrack = id;
        this.save();
      },
    });
    this.player = new PlayerController();
    this.input = new InputController();
    this.camera = new FollowCamera(innerWidth / innerHeight);
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Breakglass game view');
    document.body.prepend(this.renderer.domElement);
    this.input.bindCamera(this.renderer.domElement);
    this.sceneManager = new SceneManager({
      scenes: this.scenes,
      player: this.player,
      onFade: (active) => {
        ui.fade(active);
        this.input.clear();
      },
      onEnter: (level) => {
        this.interactions.setLevel(level.definition);
        this.camera.configure(level.definition.cameraOffset, this.player.position, level.collision);
        ui.floorTag.textContent = level.definition.title;
        ui.panel(...level.definition.intro);
        this.state.visit(level.definition.id);
        this.save();
      },
    });
    const canAct = () => this.started && !this.sceneManager.changing && !document.hidden;
    this.interactions = new InteractionSystem(
      createActions({
        audio: this.audio,
        sceneManager: this.sceneManager,
        player: this.player,
        ui,
        state: this.state,
        canAct,
      }),
    );
    this.onResize = () => {
      this.camera.resize(innerWidth, innerHeight);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.setSize(innerWidth, innerHeight);
    };
    this.onVisibility = () => {
      this.input.clear();
      this.lastTime = null;
      this.save();
      const request = document.hidden ? this.audio.suspend() : this.audio.resume();
      request.catch((error) => ui.warning(`Audio: ${error.message}`));
    };
    this.onPageHide = () => this.save();
    this.onContextLost = (event) => {
      event.preventDefault();
      this.input.setEnabled(false);
      this.audio.stop();
      this.save();
      ui.fatal(new Error('The graphics context was lost'));
    };
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.frame = (now) => this.update(now);
  }

  async initialize() {
    for (const factory of [createUpstairsScene, createBelowScene]) {
      const level = await factory(this.assets, this.spatialPass);
      this.scenes.set(level.definition.id, level);
    }
    const definition = this.scenes.get(this.state.data.sceneId).definition;
    const sameLayout =
      !definition.layoutRevision || definition.layoutRevision === this.state.data.layoutRevision;
    this.sceneManager.start(this.state.data.sceneId, sameLayout ? this.state.data.position : null);
    this.ui.ready(async () => {
      try {
        await this.audio.init();
      } catch {
        this.ui.warning('Audio is unavailable. You can still explore.');
      }
      this.started = true;
      this.input.setEnabled(true);
      this.renderer.domElement.focus();
      this.save();
    });
    this.renderer.setAnimationLoop(this.frame);
  }

  update(now, movementOverride = null) {
    const elapsed = this.lastTime == null ? 0 : (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.max(0, Math.min(0.035, elapsed));
    if (elapsed > 0) this.fps += (1 / elapsed - this.fps) * 0.03;
    if (this.started && !document.hidden) {
      if (this.input.consume('debug')) this.state.data.debug = !this.state.data.debug;
      if (this.input.consume('stopAudio')) this.audio.stop();
      this.sceneManager.update(dt);
      if (!this.sceneManager.changing) {
        if (this.input.consume('recenter')) this.camera.recenter();
        const cameraInput = this.input.cameraInput(dt);
        this.camera.orbit(cameraInput.orbit);
        this.camera.zoom(cameraInput.zoom);
        if (this.input.consume('dance')) this.player.dance();
        this.player.update(
          dt,
          movementOverride ?? this.camera.worldMovement(this.input.movement()),
          this.sceneManager.current.collision,
          this.input.consume('jump'),
        );
        if (this.input.consume('interact')) this.interactions.interact(this.player.position);
      } else {
        this.input.clear();
      }
      this.sceneManager.current.update(dt, this.audio);
      this.saveElapsed += dt;
      if (this.saveElapsed >= 2) {
        this.save();
        this.saveElapsed = 0;
      }
    }
    const level = this.sceneManager.current;
    this.camera.update(dt, this.player.position, level.collision);
    this.ui.update({
      level,
      player: this.player,
      target: this.interactions.nearest(this.player.position),
      audio: this.audio,
      state: this.state.data,
      camera: this.camera,
      transitionPhase: this.sceneManager.phase,
      fps: this.fps,
    });
    this.renderer.render(level.scene, this.camera.camera);
  }

  save() {
    if (this.started && this.sceneManager.current) {
      this.state.save(
        this.sceneManager.current.definition.id,
        this.player.position,
        this.sceneManager.current.definition.layoutRevision,
      );
    }
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.save();
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.input.dispose();
    this.player.dispose();
    this.sceneManager.dispose();
    await this.audio.dispose();
    await this.assets.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.ui.dispose();
  }
}
