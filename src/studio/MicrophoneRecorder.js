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
    this.captureSource = null;
    this.captureProcessor = null;
    this.captureSink = null;
    this.pcmChunks = [];
    this.captureSampleRate = 0;
    this.previousAudioSessionType = null;
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
    const audioSession = globalThis.navigator?.audioSession;
    if (audioSession) {
      try {
        this.previousAudioSessionType = audioSession.type ?? null;
        audioSession.type = 'play-and-record';
      } catch {
        this.previousAudioSessionType = null;
      }
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.chunks = [];
    this.pcmChunks = [];
    this.captureSampleRate = this.audio.context.sampleRate || 48000;

    // Capture raw PCM in parallel with MediaRecorder. Safari can produce a perfectly valid
    // MediaRecorder blob that decodeAudioData cannot immediately decode, and by the time we try
    // HTMLAudio playback the original user gesture may be gone. A direct AudioBuffer avoids both.
    if (
      typeof this.audio.context.createMediaStreamSource === 'function' &&
      typeof this.audio.context.createScriptProcessor === 'function'
    ) {
      this.captureSource = this.audio.context.createMediaStreamSource(this.stream);
      this.captureProcessor = this.audio.context.createScriptProcessor(2048, 1, 1);
      this.captureSink = this.audio.context.createGain();
      this.captureSink.gain.value = 0;
      this.captureProcessor.onaudioprocess = (event) => {
        const input = event.inputBuffer?.getChannelData?.(0);
        if (input?.length) this.pcmChunks.push(Float32Array.from(input));
      };
      this.captureSource.connect(this.captureProcessor);
      this.captureProcessor.connect(this.captureSink);
      this.captureSink.connect(this.audio.context.destination);
    }
    const candidates = [
      // Safari/iOS is much more reliable decoding its own AAC/MP4 MediaRecorder output back into
      // WebAudio than WebM, so prefer MP4 whenever the browser exposes it.
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
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
    recorder.requestData?.();
    recorder.stop();
    await done;
    const duration = Math.max(0, (performance.now() - this.startedAt) / 1000);
    const type = recorder.mimeType || this.chunks[0]?.type || 'audio/webm';
    const blob = new Blob(this.chunks, { type });

    let buffer = this.buildPcmBuffer();
    if (!buffer && blob.size) {
      try {
        buffer = await this.audio.context.decodeAudioData(await blob.arrayBuffer());
      } catch {
        // Raw PCM capture is the primary Safari-safe playback path. Keep the blob for persistence
        // even if the browser cannot decode its MediaRecorder container.
      }
    }
    this.cleanupStream();
    await this.audio.recoverAfterMicrophoneCapture?.();
    this.recorder = null;
    this.chunks = [];
    this.spectraTransport?.release?.(this.transportOwner);
    return { blob, buffer, duration, type, timelineStart: this.timelineStart };
  }

  cancel() {
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.cleanupStream();
    void this.audio.recoverAfterMicrophoneCapture?.();
    this.recorder = null;
    this.chunks = [];
    this.spectraTransport?.release?.(this.transportOwner);
    this.timelineStart = 0;
    this.pcmChunks = [];
  }

  buildPcmBuffer() {
    const chunks = this.pcmChunks;
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (!total || !this.audio.context?.createBuffer) return null;

    const buffer = this.audio.context.createBuffer(
      1,
      total,
      this.captureSampleRate || this.audio.context.sampleRate || 48000,
    );
    const channel = buffer.getChannelData(0);
    let offset = 0;
    for (const chunk of chunks) {
      channel.set(chunk, offset);
      offset += chunk.length;
    }
    return buffer;
  }

  cleanupStream() {
    if (this.captureProcessor) this.captureProcessor.onaudioprocess = null;
    this.captureSource?.disconnect?.();
    this.captureProcessor?.disconnect?.();
    this.captureSink?.disconnect?.();
    this.captureSource = null;
    this.captureProcessor = null;
    this.captureSink = null;

    for (const track of this.stream?.getTracks?.() ?? []) track.stop();
    this.stream = null;

    const audioSession = globalThis.navigator?.audioSession;
    if (audioSession) {
      try {
        audioSession.type = 'playback';
      } catch {
        // Older Safari versions do not expose a writable Audio Session API.
      }
    }
  }

  dispose() {
    this.cancel();
  }
}
