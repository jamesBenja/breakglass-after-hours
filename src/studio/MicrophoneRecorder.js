async function decodeRecordingBlob(audio, blob) {
  const context = audio?.context;
  if (!context?.decodeAudioData || !blob?.size || typeof blob.arrayBuffer !== 'function') {
    return null;
  }

  let bytes = null;
  try {
    bytes = await blob.arrayBuffer();
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value ?? null);
    };
    try {
      const result = context.decodeAudioData(bytes.slice(0), finish, () => finish(null));
      if (result?.then) result.then(finish, () => finish(null));
    } catch {
      finish(null);
    }
  });
}

/**
 * Minimal browser microphone recorder for Spectra vocal takes.
 *
 * Uses the browser's native MediaRecorder format with no forced mime type, AudioWorklet or
 * ScriptProcessor. Safari produces the recording file; Spectra decodes it into its normal
 * channel path when possible and keeps the native Blob as a fallback.
 */
export class MicrophoneRecorder {
  constructor(audio) {
    this.audio = audio;
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.startedAt = 0;
    this.spectraTransport = null;
    this.transportOwner = 'microphone-recorder';
    this.timelineStart = 0;
  }

  get supported() {
    return !!(globalThis.navigator?.mediaDevices?.getUserMedia && globalThis.MediaRecorder);
  }

  get recording() {
    return this.recorder?.state === 'recording';
  }

  async start() {
    if (!this.supported) throw new Error('Browser microphone recording is unavailable here.');
    if (this.recording) return false;

    const audioSession = globalThis.navigator?.audioSession;
    if (audioSession) {
      try {
        audioSession.type = 'play-and-record';
      } catch {
        // Older Safari versions may not expose a writable Audio Session API.
      }
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) this.chunks.push(event.data);
    };

    this.startedAt = performance.now();
    if (this.spectraTransport) {
      // Vocal takes are Spectra loops just like armed instrument recordings. Force the same
      // loop-grid invariant before capturing so clipStart is wrapped to the active bar cycle.
      const session = this.spectraTransport.session;
      if (session) {
        session.loopEnabled = true;
        session.loopBars = [1, 2, 4, 8, 16].includes(Number(session.loopBars))
          ? Number(session.loopBars)
          : 4;
      }
      this.spectraTransport.acquire(this.transportOwner, { position: 0 });
      const position = this.spectraTransport.position();
      this.timelineStart = this.spectraTransport.quantizeTime(position, {
        wrap: this.spectraTransport.session?.loopEnabled === true,
        includeSwing: true,
      });
    } else {
      this.timelineStart = 0;
    }

    this.recorder.start();
    return true;
  }

  async stop() {
    if (!this.recorder || this.recorder.state !== 'recording') return null;
    const recorder = this.recorder;

    const stopped = new Promise((resolve, reject) => {
      recorder.onerror = (event) =>
        reject(event.error ?? new Error('Microphone recording failed.'));
      recorder.onstop = resolve;
    });

    recorder.stop();
    await stopped;

    // Safari can dispatch its final dataavailable immediately before or just after stop.
    // Give the event queue one turn before declaring the take empty.
    await new Promise((resolve) => globalThis.setTimeout?.(resolve, 0) ?? resolve());

    const duration = Math.max(0, (performance.now() - this.startedAt) / 1000);
    const type = this.chunks[0]?.type || recorder.mimeType || 'audio/mp4';
    const blob = new Blob(this.chunks, { type });

    this.cleanupStream();
    await this.audio.recoverAfterMicrophoneCapture?.();

    // Prefer a decoded AudioBuffer so the take enters the exact same WebAudio/Spectra bus,
    // fader, mute/solo, FX, meters and spatial path as every other recorded track. Keep the
    // native MediaRecorder Blob too so Safari still has a raw-file fallback if decoding fails.
    const buffer = await decodeRecordingBlob(this.audio, blob);

    this.recorder = null;
    this.chunks = [];
    this.spectraTransport?.release?.(this.transportOwner);

    return {
      blob,
      buffer,
      // Wall-clock capture duration is authoritative for the raw-take scrubber. Safari may
      // successfully decode only a prefix of its own MediaRecorder file, so never shrink the
      // source duration to a shorter decoded AudioBuffer.
      duration: Math.max(duration, Number(buffer?.duration) || 0),
      type: blob.type || type,
      timelineStart: this.timelineStart,
      bytes: blob.size,
    };
  }

  cancel() {
    if (this.recorder?.state === 'recording') {
      try {
        this.recorder.stop();
      } catch {
        // Already stopping.
      }
    }
    this.cleanupStream();
    void this.audio.recoverAfterMicrophoneCapture?.();
    this.recorder = null;
    this.chunks = [];
    this.spectraTransport?.release?.(this.transportOwner);
    this.timelineStart = 0;
  }

  cleanupStream() {
    for (const track of this.stream?.getTracks?.() ?? []) track.stop();
    this.stream = null;

    const audioSession = globalThis.navigator?.audioSession;
    if (audioSession) {
      try {
        audioSession.type = 'playback';
      } catch {
        // Older Safari versions may not expose a writable Audio Session API.
      }
    }
  }

  dispose() {
    this.cancel();
  }
}
