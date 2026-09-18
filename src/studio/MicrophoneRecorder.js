/**
 * Browser-mic capture for vocal takes. The physical input remains the device microphone;
 * selected Breakglass mic/EQ/compressor choices are stored as modeled processing metadata.
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
    return !!(
      globalThis.navigator?.mediaDevices?.getUserMedia &&
      globalThis.MediaRecorder &&
      this.audio.context
    );
  }

  get recording() {
    return this.recorder?.state === 'recording';
  }

  async start() {
    if (!this.supported) throw new Error('Browser microphone recording is unavailable here.');
    if (this.recording) return false;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.chunks = [];
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (event) => {
      if (event.data?.size) this.chunks.push(event.data);
    };
    this.startedAt = performance.now();
    if (this.spectraTransport) {
      this.spectraTransport.acquire(this.transportOwner, { position: 0 });
      const position = this.spectraTransport.position();
      this.timelineStart = this.spectraTransport.quantizeTime(position, {
        wrap: this.spectraTransport.session?.loopEnabled === true,
        includeSwing: true,
      });
    } else this.timelineStart = 0;
    this.recorder.start(250);
    return true;
  }

  async stop() {
    if (!this.recorder || this.recorder.state !== 'recording') return null;
    const recorder = this.recorder;
    const done = new Promise((resolve, reject) => {
      recorder.onerror = (event) =>
        reject(event.error ?? new Error('Microphone recording failed.'));
      recorder.onstop = resolve;
    });
    recorder.stop();
    await done;
    const duration = Math.max(0, (performance.now() - this.startedAt) / 1000);
    const type = recorder.mimeType || this.chunks[0]?.type || 'audio/webm';
    const blob = new Blob(this.chunks, { type });
    let buffer = null;
    try {
      buffer = await this.audio.context.decodeAudioData(await blob.arrayBuffer());
    } catch {
      // Some browser MediaRecorder containers are not accepted by decodeAudioData. The raw
      // blob can still be retained/exported later; the prototype reports the limitation.
    }
    this.cleanupStream();
    this.recorder = null;
    this.chunks = [];
    this.spectraTransport?.release?.(this.transportOwner);
    return { blob, buffer, duration, type, timelineStart: this.timelineStart };
  }

  cancel() {
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.cleanupStream();
    this.recorder = null;
    this.chunks = [];
    this.spectraTransport?.release?.(this.transportOwner);
    this.timelineStart = 0;
  }

  cleanupStream() {
    for (const track of this.stream?.getTracks?.() ?? []) track.stop();
    this.stream = null;
  }

  dispose() {
    this.cancel();
  }
}
