/**
 * Minimal browser microphone recorder for Spectra vocal takes.
 *
 * Deliberately uses the browser's native MediaRecorder format with no forced mime type,
 * no AudioWorklet, no ScriptProcessor and no WebAudio decode step. Safari is responsible
 * for producing one complete recording file, and Spectra plays that exact Blob back.
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

    this.recorder = null;
    this.chunks = [];
    this.spectraTransport?.release?.(this.transportOwner);

    return {
      blob,
      buffer: null,
      duration,
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
