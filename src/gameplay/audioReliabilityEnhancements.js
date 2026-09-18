import { AudioEngine } from '../audio/AudioEngine.js';

let prototypeInstalled = false;

export function isIOSAudioHost(navigatorTarget = globalThis.navigator) {
  if (!navigatorTarget) return false;
  const userAgent = String(navigatorTarget.userAgent || '');
  const platform = String(navigatorTarget.platform || '');
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === 'MacIntel' && Number(navigatorTarget.maxTouchPoints) > 1)
  );
}

export function createIOSForegroundAudioWake({
  game,
  ui,
  windowTarget = globalThis.window,
  documentTarget = globalThis.document,
  navigatorTarget = globalThis.navigator,
  timers = globalThis,
} = {}) {
  if (
    !game?.audio ||
    !windowTarget?.addEventListener ||
    !documentTarget?.addEventListener ||
    !isIOSAudioHost(navigatorTarget)
  )
    return null;

  const audio = game.audio;
  const foregroundWake = createIOSForegroundAudioWake({ game, ui });
  let armed = false;
  let timer = null;
  let wakePromise = null;

  const clearTimer = () => {
    if (timer == null) return;
    timers.clearTimeout?.(timer);
    timer = null;
  };

  const setArmed = (value) => {
    armed = value === true;
    audio._foregroundWakePending = armed;
  };

  const wake = () => {
    if (!armed || documentTarget.hidden || !audio.context) return Promise.resolve(false);
    if (wakePromise) return wakePromise;

    wakePromise = (async () => {
      try {
        // The normal visibility handler runs first and may already be restoring the context and
        // persistent transports. Let that finish, then deliberately perform one extra device cycle.
        // This reproduces the Safari tab-switch cycle that reliably wakes an otherwise running
        // but inaudible iOS audio route after returning to the app.
        if (game.audioPlaybackResumePromise) {
          try {
            await game.audioPlaybackResumePromise;
          } catch {
            // The forced cycle below is the fallback if the first visibility resume failed.
          }
        }

        if (documentTarget.hidden || !audio.context) return false;

        if (audio.context.state !== 'running') {
          const firstResume = game.resumeAudioPlayback?.() ?? audio.resume?.();
          if (firstResume) await Promise.resolve(firstResume);
        }

        if (documentTarget.hidden || !audio.context) return false;

        if (audio.context.state === 'running') {
          try {
            await audio.suspend?.();
          } catch {
            // Continue to the explicit resume attempt even if Safari rejects the suspend request.
          }
        }

        const result = await audio.resume?.();
        const running = audio.context?.state === 'running';
        if (running) setArmed(false);
        return running && result !== false;
      } catch (error) {
        setArmed(true);
        ui?.warning?.('Audio recovery: ' + error.message);
        return false;
      } finally {
        wakePromise = null;
      }
    })();

    return wakePromise;
  };

  const schedule = (delay = 120) => {
    if (!armed || documentTarget.hidden) return;
    clearTimer();
    timer = timers.setTimeout?.(() => {
      timer = null;
      void wake();
    }, delay);
  };

  const onVisibility = () => {
    if (documentTarget.hidden) {
      clearTimer();
      setArmed(true);
      return;
    }
    if (armed) schedule(140);
  };

  const onFocus = () => {
    if (armed && !documentTarget.hidden) schedule(20);
  };

  const onPageShow = (event) => {
    if (event?.persisted) setArmed(true);
    if (armed && !documentTarget.hidden) schedule(20);
  };

  const onPageHide = () => {
    clearTimer();
    setArmed(true);
  };

  documentTarget.addEventListener('visibilitychange', onVisibility);
  windowTarget.addEventListener('focus', onFocus, true);
  windowTarget.addEventListener('pageshow', onPageShow, true);
  windowTarget.addEventListener('pagehide', onPageHide, true);

  return {
    get armed() {
      return armed;
    },
    wake,
    dispose() {
      clearTimer();
      documentTarget.removeEventListener?.('visibilitychange', onVisibility);
      windowTarget.removeEventListener?.('focus', onFocus, true);
      windowTarget.removeEventListener?.('pageshow', onPageShow, true);
      windowTarget.removeEventListener?.('pagehide', onPageHide, true);
      setArmed(false);
    },
  };
}
function primeOutput(engine) {
  const context = engine.context;
  if (!context || engine._outputPrimed) return engine._outputPrimed === true;
  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // The one-frame unlock source may already have been released by the browser.
      }
    };
    source.start(0);
    source.stop?.(context.currentTime + 0.005);
    engine._outputPrimed = true;
    return true;
  } catch {
    return false;
  }
}

function installPrototypeReliability() {
  if (prototypeInstalled) return;
  prototypeInstalled = true;

  const baseInit = AudioEngine.prototype.init;
  const baseResume = AudioEngine.prototype.resume;
  const baseSuspend = AudioEngine.prototype.suspend;
  const basePlay = AudioEngine.prototype.play;
  const basePlayAsset = AudioEngine.prototype.playAsset;
  const baseTone = AudioEngine.prototype.tone;
  const baseKick = AudioEngine.prototype.kick;
  const baseHat = AudioEngine.prototype.hat;
  const basePluckedString = AudioEngine.prototype.pluckedString;

  AudioEngine.prototype.primeOutput = function reliablePrimeOutput() {
    return primeOutput(this);
  };

  AudioEngine.prototype.init = function reliableInit() {
    // Calling the original async function executes context creation and context.resume()
    // synchronously up to its first await. Prime immediately, while the browser still considers
    // the pointer/touch event an active user gesture.
    const pending = baseInit.call(this);
    primeOutput(this);
    return Promise.resolve(pending).then(() => {
      primeOutput(this);
      this._audioReady = this.context?.state === 'running' && this._outputPrimed === true;
      return this.context;
    });
  };

  AudioEngine.prototype.unlock = function unlock() {
    return this.init().then(() => {
      primeOutput(this);
      this._audioReady = this.context?.state === 'running' && this._outputPrimed === true;
      return this._audioReady;
    });
  };

  AudioEngine.prototype.suspend = async function reliableSuspend() {
    this._audioReady = false;
    this._outputPrimed = false;
    return baseSuspend.call(this);
  };

  AudioEngine.prototype.resume = function reliableResume() {
    this._audioReady = false;
    this._outputPrimed = false;
    const pending = baseResume.call(this);
    primeOutput(this);
    return Promise.resolve(pending).then((result) => {
      primeOutput(this);
      this._audioReady = this.context?.state === 'running' && this._outputPrimed === true;
      return result;
    });
  };

  AudioEngine.prototype.play = async function reliablePlay(...args) {
    if (!this.context || this.context.state !== 'running' || !this._audioReady) await this.unlock();
    return basePlay.apply(this, args);
  };

  AudioEngine.prototype.playAsset = async function reliablePlayAsset(...args) {
    if (!this.context || this.context.state !== 'running' || !this._audioReady) await this.unlock();
    return basePlayAsset.apply(this, args);
  };

  const prepareOneShot = (base) =>
    function reliableOneShot(...args) {
      if (!this.context || this.context.state !== 'running' || !this._audioReady) {
        // Do not await here. init() constructs/resumes/primes the context synchronously up to its
        // first await, allowing the note source below to be created during the same gesture.
        void this.unlock().catch(() => {});
      }
      return base.apply(this, args);
    };

  AudioEngine.prototype.tone = prepareOneShot(baseTone);
  AudioEngine.prototype.kick = prepareOneShot(baseKick);
  AudioEngine.prototype.hat = prepareOneShot(baseHat);
  if (basePluckedString) AudioEngine.prototype.pluckedString = prepareOneShot(basePluckedString);
}

export function installAudioReliabilityEnhancements(game, ui) {
  installPrototypeReliability();
  if (!game || game._audioReliabilityInstalled) return;
  game._audioReliabilityInstalled = true;

  const audio = game.audio;
  const foregroundWake = createIOSForegroundAudioWake({ game, ui });
  const arm = () => {
    if (foregroundWake?.armed) {
      void foregroundWake.wake();
      return;
    }
    const nativeResumePending = audio._nativeMediaResumePending === true;
    const contextResumePending = audio._contextResumePending === true;
    const playbackRecoveryPending = game.audioPlaybackRecoveryPending === true;
    if (
      audio._audioReady &&
      audio.context?.state === 'running' &&
      !nativeResumePending &&
      !contextResumePending &&
      !playbackRecoveryPending
    )
      return;

    const recovering =
      nativeResumePending || contextResumePending || playbackRecoveryPending || audio.context;
    const request = recovering ? (game.resumeAudioPlayback?.() ?? audio.resume()) : audio.unlock();
    void Promise.resolve(request).catch((error) => ui?.warning?.(`Audio: ${error.message}`));
  };

  // touchstart matters on iPhone: it occurs earlier in the gesture than click/touchend and gives
  // Safari the most reliable opportunity to unlock its hardware output path.
  window.addEventListener('touchstart', arm, { capture: true, passive: true });
  window.addEventListener('pointerdown', arm, true);
  window.addEventListener('keydown', arm, true);

  // Wrap the final DJ implementation after music FX + phase-sync patches have been installed.
  // A transport intent counter makes STOP authoritative even when PLAY is still awaiting Safari's
  // unlock promise. Without this, a late-resolving PLAY could start a deck after the user stopped it.
  const baseDjPlayDeck = game.dj?.playDeck?.bind(game.dj);
  const baseDjStopDeck = game.dj?.stopDeck?.bind(game.dj);
  if (baseDjPlayDeck && baseDjStopDeck) {
    game.dj.playDeck = async (deckId) => {
      const deck = game.dj.decks?.[deckId];
      if (!deck) return false;
      const intent = (deck._transportIntent ?? 0) + 1;
      deck._transportIntent = intent;
      await audio.unlock();
      if (deck._transportIntent !== intent) return false;
      const result = await baseDjPlayDeck(deckId);
      if (deck._transportIntent !== intent) {
        baseDjStopDeck(deckId);
        return false;
      }
      return result;
    };

    game.dj.stopDeck = (deckId) => {
      const deck = game.dj.decks?.[deckId];
      if (deck) deck._transportIntent = (deck._transportIntent ?? 0) + 1;
      return baseDjStopDeck(deckId);
    };
  }

  const baseDispose = game.dispose.bind(game);
  game.dispose = async () => {
    window.removeEventListener('touchstart', arm, true);
    window.removeEventListener('pointerdown', arm, true);
    window.removeEventListener('keydown', arm, true);
    foregroundWake?.dispose();
    return baseDispose();
  };
}
