const MIC_CAPTURE_WORKLET = 'breakglass-mic-capture-v2';

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
    this.captureMode = null;
    this.captureFlushResolve = null;
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

    await this.audio.resume?.();
    const context = this.audio.context;
    if (context?.state !== 'running' && context?.state !== 'closed') {
      try {
        await context.resume?.();
      } catch {
        // The current user gesture normally keeps this available; capture setup still continues.
      }
    }

    this.chunks = [];
    this.pcmChunks = [];
    this.captureSampleRate = context?.sampleRate || 48000;
    await this.setupPcmCapture();

    const candidates = [
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

    this.recorder.start(100);
    return true;
  }

  async setupPcmCapture() {
    const context = this.audio.context;
    if (!context || !this.stream || typeof context.createMediaStreamSource !== 'function') {
      return false;
    }

    this.captureSource = context.createMediaStreamSource(this.stream);

    if (
      context.audioWorklet?.addModule &&
      typeof globalThis.AudioWorkletNode === 'function'
    ) {
      try {
        const key = '__breakglassMicCaptureWorkletV2';
        if (!context[key]) {
          const url = new URL('./MicrophoneCaptureWorklet.js', import.meta.url);
          context[key] = context.audioWorklet.addModule(url.href);
        }
        await context[key];

        const node = new globalThis.AudioWorkletNode(context, MIC_CAPTURE_WORKLET, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
          channelCountMode: 'explicit',
        });
        node.port.onmessage = (event) => {
          if (event.data?.type === 'flushed') {
            this.captureFlushResolve?.();
            this.captureFlushResolve = null;
            return;
          }
          if (event.data instanceof Float32Array && event.data.length) {
            this.pcmChunks.push(event.data);
          }
        };

        this.captureSink = context.createGain();
        this.captureSink.gain.value = 0.000001;
        this.captureProcessor = node;
        this.captureMode = 'worklet';
        this.captureSource.connect(node);
        node.connect(this.captureSink);
        this.captureSink.connect(context.destination);
        return true;
      } catch {
        this.captureSource?.disconnect?.();
        this.captureSource = null;
        this.captureProcessor = null;
        this.captureSink = null;
        this.captureMode = null;
      }
    }

    if (typeof context.createScriptProcessor !== 'function') return false;

    this.captureSource = context.createMediaStreamSource(this.stream);
    const processor = context.createScriptProcessor(2048, 1, 1);
    this.captureSink = context.createGain();
    this.captureSink.gain.value = 0.000001;
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer?.getChannelData?.(0);
      if (input?.length) this.pcmChunks.push(Float32Array.from(input));
      const output = event.outputBuffer?.getChannelData?.(0);
      output?.fill?.(0);
    };
    this.captureProcessor = processor;
    this.captureMode = 'script-processor';
    this.captureSource.connect(processor);
    processor.connect(this.captureSink);
    this.captureSink.connect(context.destination);
    return true;
  }

  async flushPcmCapture() {
    if (this.captureMode !== 'worklet' || !this.captureProcessor?.port) return;
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.captureFlushResolve = null;
        resolve();
      };
      this.captureFlushResolve = finish;
      this.captureProcessor.port.postMessage('flush');
      globalThis.setTimeout?.(finish, 80);
    });
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
    await this.flushPcmCapture();

    const duration = Math.max(0, (performance.now() - this.startedAt) / 1000);
    const type = recorder.mimeType || this.chunks[0]?.type || 'audio/webm';
    const blob = new Blob(this.chunks, { type });

    let buffer = this.buildPcmBuffer();
    const pcmFrames = this.pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const captureMode = this.captureMode;
    this.pcmChunks = [];

    if (!buffer && blob.size) {
      try {
        buffer = await this.audio.context.decodeAudioData(await blob.arrayBuffer());
      } catch {
        // The encoded blob is kept for persistence/export even when Safari cannot decode it here.
      }
    }

    this.cleanupStream();
    await this.audio.recoverAfterMicrophoneCapture?.();

    this.recorder = null;
    this.chunks = [];
    this.spectraTransport?.release?.(this.transportOwner);

    return {
      blob,
      buffer,
      duration,
      type,
      timelineStart: this.timelineStart,
      pcmFrames,
      captureMode,
    };
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
    if (this.captureProcessor && 'onaudioprocess' in this.captureProcessor) {
      this.captureProcessor.onaudioprocess = null;
    }
    if (this.captureProcessor?.port) this.captureProcessor.port.onmessage = null;
    this.captureSource?.disconnect?.();
    this.captureProcessor?.disconnect?.();
    this.captureSink?.disconnect?.();
    this.captureSource = null;
    this.captureProcessor = null;
    this.captureSink = null;
    this.captureMode = null;
    this.captureFlushResolve = null;

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
