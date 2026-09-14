import { WebGLRenderer, PCFSoftShadowMap } from 'three';
import { UndergroundKombat } from '../arcade/UndergroundKombat.js';
import { AssetLoader } from '../assets/AssetLoader.js';
import { assetManifest } from '../assets/manifest.js';
import { normalizeAvatar } from '../avatar/profile.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { SpatialAudioSystem } from '../audio/SpatialAudioSystem.js';
import { DjMixer } from '../dj/DjMixer.js';
import { BarServiceSystem } from '../gameplay/BarServiceSystem.js';
import { LightingControlSystem } from '../gameplay/LightingControlSystem.js';
import { MaddoxInteractionSystem } from '../gameplay/MaddoxInteractionSystem.js';
import { PoliceInteractionSystem } from '../gameplay/PoliceInteractionSystem.js';
import { PlayerController } from '../player/PlayerController.js';
import { InputController } from '../player/InputController.js';
import { FollowCamera } from '../player/FollowCamera.js';
import { SceneManager } from '../scenes/SceneManager.js';
import { createUpstairsScene } from '../scenes/UpstairsScene.js';
import { createBelowScene } from '../scenes/BelowScene.js';
import { createAlleyScene } from '../scenes/AlleyScene.js';
import { createRoofScene } from '../scenes/RoofScene.js';
import { GameState } from '../state/GameState.js';
import { StudioSession } from '../studio/StudioSession.js';
import { StudioPlayback } from '../studio/StudioPlayback.js';
import { MicrophoneRecorder } from '../studio/MicrophoneRecorder.js';
import { KeyboardPerformance } from '../studio/KeyboardPerformance.js';
import { PhotoSystem } from '../photos/PhotoSystem.js';
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
    this.evacuationStarted = false;
    this.lastPoliceVisits = 0;
    let storage = options.storage;
    if (!('storage' in options)) {
      try {
        storage = window.localStorage;
      } catch {
        /* Restricted browsers still play. */
      }
    }
    this.state = new GameState(storage, (message) => ui.warning(message));
    ui.setAvatarProfile?.(this.state.data.avatar);
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
    this.spatialAudio = new SpatialAudioSystem(this.audio);
    this.studio = new StudioSession(this.state.data.studio);
    this.studioPlayback = new StudioPlayback(this.audio);
    this.micRecorder = new MicrophoneRecorder(this.audio);
    this.keyboardPerformance = new KeyboardPerformance(this.audio);
    this.dj = new DjMixer(this.audio);
    this.player = new PlayerController(this.state.data.avatar);
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
    this.input.bindTouchControls(document);

    // iOS/Safari may suspend WebAudio until a direct gesture. Capture every genuine gameplay
    // gesture until the one shared context is running so instruments, DJ decks and cabinet SFX
    // do not silently fail after the title gate has already been dismissed.
    this.onAudioGesture = () => {
      if (this.audio.context?.state === 'running') return;
      void this.audio.init().catch(() => {});
    };
    window.addEventListener('pointerdown', this.onAudioGesture, true);
    window.addEventListener('touchend', this.onAudioGesture, true);
    window.addEventListener('keydown', this.onAudioGesture, true);

    this.arcade = new UndergroundKombat(document, this.audio, {
      onActive: (active) => {
        this.input.clear();
        this.input.setEnabled(!active && this.started);
        if (!active && this.started) this.renderer.domElement.focus();
      },
      onWin: () => {
        this.state.data.arcadeWins = Math.min(999, (this.state.data.arcadeWins ?? 0) + 1);
        this.save();
      },
    });

    this.stopAll = () => {
      this.keyboardPerformance.stop(false);
      this.studioPlayback.stop();
      this.dj.stop();
      this.audio.stop();
      this.micRecorder.cancel();
    };

    this.beginEvacuation = () => {
      if (this.evacuationStarted) return;
      this.evacuationStarted = true;
      this.stopAll();
      this.scenes.get('alley')?.alley?.beginEvacuation?.();
      for (const level of this.scenes.values()) {
        if (!level.crowd) continue;
        level.crowd.min = 0;
        level.crowd.idle = 0;
        level.crowd.targetAttendance = 0;
        level.crowd.danceShare = 0;
      }
      ui.warning('Police have shut the party down. Everyone has to leave.');
      ui.panel(
        'PARTY EVACUATION',
        'Police have ended the event. The music is off and the crowd is clearing out of Breakglass.',
        [],
      );
    };

    this.sceneManager = new SceneManager({
      scenes: this.scenes,
      player: this.player,
      onFade: (active) => {
        if (active) this.keyboardPerformance.stop(false);
        ui.fade(active);
        this.input.clear();
      },
      onEnter: (level) => {
        this.syncMaddoxPresence(level, { entered: true });
        this.interactions.setLevel(level);
        this.camera.configure(
          level.definition.cameraOffset,
          this.player.position,
          level.collision,
          level.definition.camera,
        );
        this.player.object.visible = !this.camera.isFirstPerson;
        ui.floorTag.textContent = level.definition.title;
        ui.panel(...level.definition.intro);
        this.state.visit(level.definition.id);
        this.save();
      },
    });

    this.photos = new PhotoSystem({
      renderer: this.renderer,
      state: this.state,
      sceneManager: this.sceneManager,
      player: this.player,
      ui,
      saveState: () => this.save(),
    });

    this.barService = new BarServiceSystem({
      state: this.state,
      player: this.player,
      ui,
      sceneManager: this.sceneManager,
      saveState: () => this.save(),
    });

    this.lightingControl = new LightingControlSystem({
      ui,
      sceneManager: this.sceneManager,
    });

    this.maddoxInteraction = new MaddoxInteractionSystem({
      state: this.state,
      ui,
      sceneManager: this.sceneManager,
      saveState: () => this.save(),
    });

    this.policeInteraction = new PoliceInteractionSystem({
      ui,
      sceneManager: this.sceneManager,
    });

    const canAct = () => this.started && !this.sceneManager.changing && !document.hidden;
    const baseActions = createActions({
      audio: this.audio,
      spatialAudio: this.spatialAudio,
      sceneManager: this.sceneManager,
      player: this.player,
      ui,
      state: this.state,
      studio: this.studio,
      studioPlayback: this.studioPlayback,
      micRecorder: this.micRecorder,
      keyboardPerformance: this.keyboardPerformance,
      photos: this.photos,
      dj: this.dj,
      stopAll: this.stopAll,
      saveState: () => this.save(),
      canAct,
    });
    this.interactions = new InteractionSystem((target) => {
      if (target?.action === 'arcade') {
        this.stopAll();
        this.arcade.start();
        return;
      }
      if (this.policeInteraction.handle(target)) return;
      if (this.maddoxInteraction.handle(target)) return;
      if (this.lightingControl.handle(target)) return;
      if (this.barService.handle(target)) return;
      baseActions(target);
    }, this.state);
    this.onResize = () => {
      this.camera.resize(innerWidth, innerHeight);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.setSize(innerWidth, innerHeight);
    };
    this.onVisibility = () => {
      this.input.clear();
      if (document.hidden) this.keyboardPerformance.stop(false);
      this.lastTime = null;
      this.save();
      const request = document.hidden ? this.audio.suspend() : this.audio.resume();
      request.catch((error) => ui.warning(`Audio: ${error.message}`));
    };
    this.onPageHide = () => this.save();
    this.onContextLost = (event) => {
      event.preventDefault();
      this.input.setEnabled(false);
      this.stopAll();
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
    for (const factory of [
      createUpstairsScene,
      createBelowScene,
      createAlleyScene,
      createRoofScene,
    ]) {
      const level = await factory(this.assets, this.spatialPass);
      this.scenes.set(level.definition.id, level);
    }
    this.photos.attachPhotoWall(this.scenes.get('downstairs'));
    const definition = this.scenes.get(this.state.data.sceneId).definition;
    const sameLayout =
      !definition.layoutRevision || definition.layoutRevision === this.state.data.layoutRevision;
    this.sceneManager.start(this.state.data.sceneId, sameLayout ? this.state.data.position : null);
    this.ui.ready(async (avatarProfile) => {
      this.state.data.avatar = normalizeAvatar(avatarProfile ?? this.state.data.avatar);
      this.state.data.avatarConfigured = true;
      this.player.applyAvatar(this.state.data.avatar);
      this.player.setIntoxication(this.state.data.intoxication);
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

  syncMaddoxPresence(level, { entered = false } = {}) {
    const dog = level?.maddox;
    if (!dog?.setPresence) return;
    const levelId = level.definition.id;
    const unlocked = this.state.data.roofSecretUnlocked === true;
    const companion = unlocked && this.state.data.maddoxCompanion === true;
    const home = levelId === 'upstairs';
    const roof = levelId === 'roof';
    const visible = home || (roof && unlocked) || companion;
    const snapshot = dog.snapshot?.() ?? {};
    const cameFromRoof = entered && home && this.state.data.sceneId === 'roof';
    const guidingToRoof =
      home && !entered && !snapshot.following && (snapshot.leading || snapshot.arrivedAtLeadTarget);
    const following = visible && (roof || companion) && !guidingToRoof;
    dog.setPresence({
      visible,
      following,
      position: this.player.position,
      snap: entered && visible && (following || cameFromRoof),
    });
  }

  update(now, movementOverride = null) {
    const elapsed = this.lastTime == null ? 0 : (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.max(0, Math.min(0.035, elapsed));
    if (elapsed > 0) this.fps += (1 / elapsed - this.fps) * 0.03;
    if (this.started && !document.hidden) {
      if (this.input.consume('debug')) this.state.data.debug = !this.state.data.debug;
      if (this.input.consume('stopAudio')) this.stopAll();
      this.sceneManager.update(dt);
      if (!this.sceneManager.changing) {
        if (this.input.consume('recenter')) this.camera.recenter();
        if (
          this.input.consume('toggleView') &&
          this.sceneManager.current.definition.id === 'downstairs'
        ) {
          this.camera.toggleMode();
        }
        const cameraInput = this.input.cameraInput(dt);
        this.camera.orbit(cameraInput.orbit);
        this.camera.zoom(cameraInput.zoom);
        if (this.input.consume('dance')) this.player.dance();

        let movement = movementOverride ?? this.camera.worldMovement(this.input.movement());
        if (this.keyboardPerformance.active) movement = { x: 0, z: 0 };
        if (!movementOverride && this.sceneManager.current.crowd) {
          const crowdScale = this.sceneManager.current.crowd.movementScaleAt(this.player.position);
          movement = { x: movement.x * crowdScale, z: movement.z * crowdScale };
        }
        this.player.update(
          dt,
          movement,
          this.sceneManager.current.collision,
          this.keyboardPerformance.active ? false : this.input.consume('jump'),
        );
        if (!this.keyboardPerformance.active && this.input.consume('interact')) {
          this.interactions.interact(this.player.position);
        }
      } else {
        this.input.clear();
      }
      this.barService.update(dt);
      this.dj.update(dt);
      const currentLevel = this.sceneManager.current;
      this.syncMaddoxPresence(currentLevel);
      currentLevel.update(dt, this.audio, this.player.position);
      const alleyLevel = this.scenes.get('alley');
      if (alleyLevel && alleyLevel !== currentLevel) {
        alleyLevel.alley?.update(dt, this.audio.metrics?.() ?? { playing: this.audio.playing });
      }
      const alleyState = alleyLevel?.alley?.snapshot?.();
      if (alleyState && alleyState.policeVisits > this.lastPoliceVisits) {
        this.lastPoliceVisits = alleyState.policeVisits;
        ui.warning(
          alleyState.policeVisits >= 2
            ? 'Police have returned to Breakglass. The party is being shut down.'
            : 'Police have arrived in the alley. Go outside and talk to them before this escalates.',
        );
      }
      if (alleyState?.evacuationRequired) this.beginEvacuation();
      this.saveElapsed += dt;
      if (this.saveElapsed >= 2) {
        this.save();
        this.saveElapsed = 0;
      }
    }
    const level = this.sceneManager.current;
    this.camera.update(dt, this.player.position, level.collision);
    this.player.object.visible = !this.camera.isFirstPerson;
    if (this.started) {
      this.spatialAudio.update(level, this.player, this.camera);
      this.studioPlayback.updateNativeMix?.(this.studio);
    }
    this.ui.update({
      level,
      player: this.player,
      target: this.interactions.nearest(this.player.position),
      audio: this.audio,
      state: this.state.data,
      camera: this.camera,
      dj: this.dj,
      transitionPhase: this.sceneManager.phase,
      fps: this.fps,
    });
    this.renderer.render(level.scene, this.camera.camera);
  }

  save() {
    this.state.data.studio = this.studio.snapshot();
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
    window.removeEventListener('pointerdown', this.onAudioGesture, true);
    window.removeEventListener('touchend', this.onAudioGesture, true);
    window.removeEventListener('keydown', this.onAudioGesture, true);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.arcade.dispose();
    this.input.dispose();
    this.keyboardPerformance.dispose();
    this.micRecorder.dispose();
    this.studioPlayback.dispose();
    this.dj.dispose();
    this.spatialAudio.dispose();
    this.photos.dispose();
    this.player.dispose();
    this.sceneManager.dispose();
    await this.audio.dispose();
    await this.assets.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.ui.dispose();
  }
}
