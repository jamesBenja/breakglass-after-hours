/**
 * Browser microphone recorder for Spectra Vocal.
 *
 * The raw MediaRecorder Blob exists for scrubber audition only.
 * Spectra itself uses direct PCM captured from the same microphone stream, so mixer playback
 * never depends on MediaRecorder duration metadata or decodeAudioData().
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

    this.pcmSource = null;
    this.pcmProcessor = null;
    this.pcmSink = null;
    this.pcmChunks = [];
    this.pcmSampleRate = 0;
  }

  get supported() {
    return !!(globalThis.navigator?.mediaDevices?.getUserMedia && globalThis.MediaRecorder);
  }

  get recording() {
    return this.recorder?.state === 'recording';
  }

  async startPcmCapture() {
    const context = this.audio?.context;
    if (
      !context?.createMediaStreamSource ||
      !context?.createScriptProcessor ||
      !context?.createBuffer ||
      !this.stream
    ) {
      return false;
    }

    try {
      if (context.state === 'suspended') await context.resume?.();
      this.pcmChunks = [];
      this.pcmSampleRate = Math.max(1, Number(context.sampleRate) || 48000);

      const source = context.createMediaStreamSource(this.stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const sink = context.createGain();
      sink.gain.value = 0;

      processor.onaudioprocess = (event) => {
        const input = event?.inputBuffer;
        if (!input?.numberOfChannels || typeof input.getChannelData !== 'function') return;
        const channel = input.getChannelData(0);
        if (!channel?.length) return;
        this.pcmChunks.push(Float32Array.from(channel));
        this.pcmSampleRate = Math.max(
          1,
          Number(input.sampleRate) || Number(context.sampleRate) || this.pcmSampleRate || 48000,
        );
      };

      source.connect(processor);
      processor.connect(sink);
      sink.connect(context.destination ?? this.audio.master);

      this.pcmSource = source;
      this.pcmProcessor = processor;
      this.pcmSink = sink;
      return true;
    } catch {
      this.clearPcmCapture();
      return false;
    }
  }

  clearPcmCapture() {
    if (this.pcmProcessor) this.pcmProcessor.onaudioprocess = null;
    this.pcmSource?.disconnect?.();
    this.pcmProcessor?.disconnect?.();
    this.pcmSink?.disconnect?.();
    this.pcmSource = null;
    this.pcmProcessor = null;
    this.pcmSink = null;
  }

  finishPcmCapture() {
    const context = this.audio?.context;
    const chunks = this.pcmChunks;
    const sampleRate = Math.max(
      1,
      Number(this.pcmSampleRate) || Number(context?.sampleRate) || 48000,
    );

    this.clearPcmCapture();
    this.pcmChunks = [];
    this.pcmSampleRate = 0;

    if (!context?.createBuffer || !chunks.length) return null;
    const frames = chunks.reduce((sum, chunk) => sum + (chunk?.length ?? 0), 0);
    if (!(frames > 0)) return null;

    let buffer = null;
    try {
      buffer = context.createBuffer(1, frames, sampleRate);
      const target = buffer.getChannelData(0);
      let cursor = 0;
      for (const chunk of chunks) {
        if (!chunk?.length) continue;
        target.set(chunk, cursor);
        cursor += chunk.length;
      }
    } catch {
      return null;
    }
    return buffer;
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

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) this.chunks.push(event.data);
    };

    await this.startPcmCapture();

    this.startedAt = performance.now();
    if (this.spectraTransport) {
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

    // Keep periodic raw-file chunks for reliable scrubber capture. Spectra does not consume
    // these chunks anymore; it uses the direct PCM path above.
    try {
      this.recorder.start(250);
    } catch {
      this.recorder.start();
    }
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

    try {
      recorder.requestData?.();
    } catch {
      // Optional MediaRecorder API.
    }
    recorder.stop();
    await stopped;
    await new Promise((resolve) => globalThis.setTimeout?.(resolve, 40) ?? resolve());

    const duration = Math.max(0, (performance.now() - this.startedAt) / 1000);
    const type = this.chunks[0]?.type || recorder.mimeType || 'audio/mp4';
    const blob = new Blob(this.chunks, { type });
    const buffer = this.finishPcmCapture();

    this.cleanupStream();
    await this.audio.recoverAfterMicrophoneCapture?.();

    this.recorder = null;
    this.chunks = [];
    this.spectraTransport?.release?.(this.transportOwner);

    return {
      blob,
      buffer,
      duration: Math.max(duration, Number(buffer?.duration) || 0),
      pcmDuration: Math.max(0, Number(buffer?.duration) || 0),
      captureMode: buffer ? 'direct-pcm' : 'raw-only',
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
    this.clearPcmCapture();
    this.pcmChunks = [];
    this.pcmSampleRate = 0;
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
