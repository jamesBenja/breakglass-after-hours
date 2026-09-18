import { AudioEngine } from '../audio/AudioEngine.js';

let prototypeInstalled = false;

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
    return Promise.resolve(pending).then(() => {
      primeOutput(this);
      this._audioReady = this.context?.state === 'running' && this._outputPrimed === true;
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
  const arm = () => {
    const nativeResumePending = audio._nativeMediaResumePending === true;
    if (audio._audioReady && audio.context?.state === 'running' && !nativeResumePending) return;
    const request = nativeResumePending ? audio.resume() : audio.unlock();
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
    return baseDispose();
  };
}
