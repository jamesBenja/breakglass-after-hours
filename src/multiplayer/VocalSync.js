const CHANNEL_LABEL = 'spectra-vocal';
const CHUNK_BYTES = 16 * 1024;
const MAX_SECONDS = 180;
const MAX_BUFFERED_BYTES = 1024 * 1024;

const clampSample = (value) => Math.max(-1, Math.min(1, Number(value) || 0));

function transferId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `vocal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
}

function pcm16FromBuffer(buffer) {
  if (!buffer?.numberOfChannels || typeof buffer.getChannelData !== 'function') return null;
  const source = buffer.getChannelData(0);
  if (!source?.length) return null;
  const pcm = new Int16Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    const sample = clampSample(source[index]);
    pcm[index] = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
  }
  return pcm;
}

function pcmPeak(pcm) {
  let peak = 0;
  for (let index = 0; index < pcm.length; index += 32) {
    peak = Math.max(peak, Math.abs(pcm[index]) / 32768);
  }
  return peak;
}

export class VocalSync {
  constructor(client) {
    this.client = client;
    this.game = client.game;
    this.media = client.media;
    this.channels = new Map();
    this.channelQueues = new Map();
    this.incoming = new Map();
    this.pendingAttachments = [];
    this.pendingPlayback = false;
    this.traceEntries = [];
    this.traceSequence = 0;
    this.disposed = false;

    this.media?.registerDataChannel?.(CHANNEL_LABEL, (peerId, channel) =>
      this.bindChannel(peerId, channel),
    );
    this.patchMicrophoneRecorder();

    this.boundVisibility = () => {
      if (!globalThis.document?.hidden) void this.flushPlayback();
    };
    globalThis.document?.addEventListener?.('visibilitychange', this.boundVisibility);
  }

  trace(event, detail = {}) {
    const entry = {
      seq: ++this.traceSequence,
      event,
      at: Date.now(),
      localId: this.client.localId ?? null,
      visibilityState: globalThis.document?.visibilityState ?? null,
      documentHidden: globalThis.document?.hidden === true,
      ...detail,
    };
    this.traceEntries.push(entry);
    if (this.traceEntries.length > 240) this.traceEntries.shift();
    return entry;
  }

  diagnosticReport() {
    return this.traceEntries.map((entry) => JSON.stringify(entry)).join('\n');
  }

  clearDiagnosticReport() {
    this.traceEntries.length = 0;
    this.traceSequence = 0;
  }

  patchMicrophoneRecorder() {
    const recorder = this.game.micRecorder;
    if (!recorder || recorder._multiplayerVocalSync) return;
    recorder._multiplayerVocalSync = true;
    recorder.multiplayerDiagnosticReport = () => this.diagnosticReport();
    recorder.clearMultiplayerDiagnosticReport = () => this.clearDiagnosticReport();

    const baseStart = recorder.start.bind(recorder);
    recorder.start = async (...args) => {
      this.prepareProducerChannel();
      this.trace('record:start', {
        targetStemId: recorder.spectraTargetStemId ?? null,
        controllerId: this.controllerId(),
      });
      return baseStart(...args);
    };

    const baseStop = recorder.stop.bind(recorder);
    recorder.stop = async (...args) => {
      const result = await baseStop(...args);
      if (result?.buffer?.duration) {
        result.multiplayerTransfer = this.publishLocalTake(result).catch((error) => {
          this.trace('transfer:failed', { message: error?.message ?? String(error) });
          return false;
        });
      }
      return result;
    };
  }

  controllerId() {
    return this.client.world?.resources?.get?.('upstairs:console')?.ownerId ?? null;
  }

  prepareProducerChannel() {
    const controllerId = this.controllerId();
    if (!controllerId || controllerId === this.client.localId) return null;
    return this.channelFor(controllerId);
  }

  channelFor(peerId) {
    if (!peerId || peerId === this.client.localId) return null;
    const existing = this.channels.get(peerId);
    if (existing && existing.readyState !== 'closed') return existing;
    return this.media?.dataChannel?.(peerId, CHANNEL_LABEL, { ordered: true }) ?? null;
  }

  bindChannel(peerId, channel) {
    if (!peerId || !channel) return null;
    channel.binaryType = 'arraybuffer';
    this.channels.set(peerId, channel);
    channel.onopen = () => this.trace('channel:open', { peerId });
    channel.onclose = () => {
      if (this.channels.get(peerId) === channel) this.channels.delete(peerId);
      this.trace('channel:close', { peerId });
    };
    channel.onerror = () => this.trace('channel:error', { peerId });
    channel.onmessage = (event) => void this.handleMessage(peerId, event.data);
    this.trace('channel:bound', { peerId, readyState: channel.readyState });
    return channel;
  }

  waitForOpen(channel, timeoutMs = 8000) {
    if (!channel) return Promise.resolve(false);
    if (channel.readyState === 'open') return Promise.resolve(true);
    if (channel.readyState === 'closed' || channel.readyState === 'closing')
      return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout?.(timer);
        channel.removeEventListener?.('open', opened);
        channel.removeEventListener?.('close', closed);
        resolve(value);
      };
      const opened = () => finish(true);
      const closed = () => finish(false);
      const timer = globalThis.setTimeout?.(() => finish(false), timeoutMs);
      channel.addEventListener?.('open', opened, { once: true });
      channel.addEventListener?.('close', closed, { once: true });
    });
  }

  waitForDrain(channel) {
    if ((Number(channel?.bufferedAmount) || 0) <= MAX_BUFFERED_BYTES) return Promise.resolve();
    channel.bufferedAmountLowThreshold = Math.floor(MAX_BUFFERED_BYTES / 2);
    return new Promise((resolve) => {
      const done = () => {
        channel.removeEventListener?.('bufferedamountlow', done);
        resolve();
      };
      channel.addEventListener?.('bufferedamountlow', done, { once: true });
      globalThis.setTimeout?.(done, 1500);
    });
  }

  enqueue(peerId, action) {
    const previous = this.channelQueues.get(peerId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    this.channelQueues.set(peerId, next);
    next.finally(() => {
      if (this.channelQueues.get(peerId) === next) this.channelQueues.delete(peerId);
    });
    return next;
  }

  localTakeMetadata(result, pcm) {
    const recorder = this.game.micRecorder;
    const targetStemId =
      recorder?.spectraTargetStemId ??
      this.game.studio?.armedStems?.().find((stem) => stem.inputKey === 'vocal')?.id ??
      this.game.studio?.stems?.find((stem) => stem.inputKey === 'vocal')?.id ??
      null;
    return {
      transferId: transferId(),
      originId: this.client.localId ?? null,
      originName: this.game.state?.data?.avatar?.displayName ?? 'Guest vocalist',
      targetStemId,
      sampleRate: Math.max(1, Number(result.buffer?.sampleRate) || 48000),
      frames: pcm.length,
      duration: Number(result.buffer?.duration) || 0,
      timelineStart: Math.max(0, Number(result.timelineStart) || 0),
      pcmPeak: Math.max(0, Number(result.pcmPeak) || pcmPeak(pcm)),
      pcmRms: Math.max(0, Number(result.pcmRms) || 0),
    };
  }

  async publishLocalTake(result) {
    const pcm = pcm16FromBuffer(result?.buffer);
    if (!pcm?.length) return false;
    const metadata = this.localTakeMetadata(result, pcm);
    if (!metadata.targetStemId) {
      this.trace('transfer:skip-no-target');
      return false;
    }

    const controllerId = this.controllerId();
    if (!controllerId) {
      this.trace('transfer:local-only', {
        transferId: metadata.transferId,
        targetStemId: metadata.targetStemId,
        frames: metadata.frames,
      });
      return false;
    }

    if (controllerId === this.client.localId) {
      const peers = [...(this.client.remotePlayers?.keys?.() ?? [])];
      this.trace('transfer:producer-broadcast', {
        transferId: metadata.transferId,
        targetStemId: metadata.targetStemId,
        peers,
        frames: metadata.frames,
        duration: metadata.duration,
      });
      if (!peers.length) return false;
      const results = await Promise.all(
        peers.map((peerId) => this.sendTake(peerId, { ...metadata, relayed: true }, pcm)),
      );
      return results.some(Boolean);
    }

    this.trace('transfer:queue', {
      transferId: metadata.transferId,
      targetStemId: metadata.targetStemId,
      controllerId,
      frames: metadata.frames,
      duration: metadata.duration,
    });
    return this.sendTake(controllerId, metadata, pcm);
  }

  async sendTake(peerId, metadata, pcm) {
    return this.enqueue(peerId, async () => {
      const channel = this.channelFor(peerId);
      if (!(await this.waitForOpen(channel))) {
        this.trace('transfer:channel-not-open', { peerId, transferId: metadata.transferId });
        return false;
      }

      channel.send(JSON.stringify({ type: 'vocal-start', ...metadata }));
      let chunks = 0;
      const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_BYTES) {
        if (channel.readyState !== 'open') return false;
        await this.waitForDrain(channel);
        const chunk = bytes.slice(offset, Math.min(bytes.byteLength, offset + CHUNK_BYTES));
        channel.send(chunk.buffer);
        chunks += 1;
      }
      channel.send(
        JSON.stringify({
          type: 'vocal-end',
          transferId: metadata.transferId,
          chunks,
          bytes: bytes.byteLength,
        }),
      );
      this.trace('transfer:sent', {
        peerId,
        transferId: metadata.transferId,
        targetStemId: metadata.targetStemId,
        chunks,
        bytes: bytes.byteLength,
        duration: metadata.duration,
      });
      return true;
    });
  }

  async handleMessage(peerId, data) {
    if (typeof data === 'string') {
      let message = null;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (message?.type === 'vocal-start') {
        this.beginIncoming(peerId, message);
      } else if (message?.type === 'vocal-end') {
        await this.finishIncoming(peerId, message);
      }
      return;
    }

    let bytes = null;
    if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (globalThis.Blob && data instanceof Blob)
      bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes) this.appendIncoming(peerId, bytes);
  }

  beginIncoming(peerId, message) {
    const frames = Math.max(0, Math.floor(Number(message.frames) || 0));
    const sampleRate = Math.max(1, Math.floor(Number(message.sampleRate) || 0));
    const duration = frames / sampleRate;
    if (!message.transferId || !frames || duration > MAX_SECONDS) {
      this.trace('receive:rejected', {
        peerId,
        transferId: message.transferId ?? null,
        frames,
        sampleRate,
        duration,
      });
      return;
    }
    const key = `${peerId}:${message.transferId}`;
    this.incoming.set(key, {
      peerId,
      metadata: {
        ...message,
        frames,
        sampleRate,
        duration,
      },
      chunks: [],
      bytes: 0,
    });
    this.trace('receive:start', {
      peerId,
      transferId: message.transferId,
      targetStemId: message.targetStemId ?? null,
      frames,
      sampleRate,
      duration,
    });
  }

  currentIncoming(peerId) {
    const candidates = [...this.incoming.values()].filter((entry) => entry.peerId === peerId);
    return candidates.at(-1) ?? null;
  }

  appendIncoming(peerId, bytes) {
    const incoming = this.currentIncoming(peerId);
    if (!incoming) {
      this.trace('receive:orphan-chunk', { peerId, bytes: bytes.byteLength });
      return false;
    }
    const maxBytes = incoming.metadata.frames * 2;
    if (incoming.bytes + bytes.byteLength > maxBytes + CHUNK_BYTES) {
      this.incoming.delete(`${peerId}:${incoming.metadata.transferId}`);
      this.trace('receive:overflow', {
        peerId,
        transferId: incoming.metadata.transferId,
        bytes: incoming.bytes + bytes.byteLength,
        maxBytes,
      });
      return false;
    }
    incoming.chunks.push(bytes.slice());
    incoming.bytes += bytes.byteLength;
    return true;
  }

  async finishIncoming(peerId, message) {
    const key = `${peerId}:${message.transferId}`;
    const incoming = this.incoming.get(key);
    if (!incoming) return false;
    this.incoming.delete(key);

    const expectedBytes = incoming.metadata.frames * 2;
    if (incoming.bytes !== expectedBytes) {
      this.trace('receive:incomplete', {
        peerId,
        transferId: message.transferId,
        bytes: incoming.bytes,
        expectedBytes,
      });
      return false;
    }

    const packed = new Uint8Array(expectedBytes);
    let cursor = 0;
    for (const chunk of incoming.chunks) {
      packed.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
    const pcm = new Int16Array(packed.buffer);
    const transfer = { metadata: incoming.metadata, pcm };
    this.trace('receive:complete', {
      peerId,
      transferId: message.transferId,
      targetStemId: incoming.metadata.targetStemId ?? null,
      chunks: incoming.chunks.length,
      bytes: incoming.bytes,
      peak: Number(pcmPeak(pcm).toFixed(5)),
    });

    if (!this.attachTransfer(transfer)) this.pendingAttachments.push(transfer);
    return true;
  }

  targetFor(metadata) {
    const studio = this.game.studio;
    if (!studio) return null;
    return (
      studio.stems?.find?.(
        (stem) => stem.id === metadata.targetStemId && stem.inputKey === 'vocal',
      ) ??
      studio.armedStems?.().find?.((stem) => stem.inputKey === 'vocal') ??
      studio.stems?.find?.((stem) => stem.inputKey === 'vocal') ??
      null
    );
  }

  attachTransfer(transfer) {
    const context = this.game.audio?.context;
    const studio = this.game.studio;
    const target = this.targetFor(transfer.metadata);
    if (!context?.createBuffer || !studio || !target) return false;

    const { metadata, pcm } = transfer;
    const buffer = context.createBuffer(1, pcm.length, metadata.sampleRate);
    const output = buffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index += 1) {
      output[index] = pcm[index] < 0 ? pcm[index] / 32768 : pcm[index] / 32767;
    }

    this.game.studioPlayback?.stopRecordedStemPlayback?.(target.id);
    target.kind = 'vocal';
    target.inputKey = 'vocal';
    target.source = 'browser-microphone';
    target.assetId = null;
    target.performance = null;
    target.clipActive = true;
    target.clipStart = 0;
    target.sourceOffset = 0;
    target.sourceDuration = buffer.duration;
    target.renderedAudio = true;
    target.renderedAudioAt = Date.now();
    target.vocalCaptureMode = 'multiplayer-pcm';
    target.vocalRawDuration = buffer.duration;
    target.vocalPcmDuration = buffer.duration;
    target.vocalPcmPeak = Math.max(0, Number(metadata.pcmPeak) || pcmPeak(pcm));
    target.vocalPcmRms = Math.max(0, Number(metadata.pcmRms) || 0);
    target.vocalMultiplayerOriginId = metadata.originId ?? null;
    target.vocalMultiplayerOriginName = metadata.originName ?? 'Guest vocalist';
    target.vocalTimelineStart = Math.max(0, Number(metadata.timelineStart) || 0);
    studio.replaceRecording?.(target.id, buffer, null);
    this.game.studioPlayback?.updateMix?.(studio, { immediate: true });
    this.game.save?.();

    this.trace('receive:attached', {
      transferId: metadata.transferId,
      targetStemId: target.id,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      peak: Number(target.vocalPcmPeak.toFixed(5)),
      controllerId: this.controllerId(),
    });

    if (this.game.studioPlayback?.playing === true) {
      this.pendingPlayback = true;
      void this.flushPlayback();
    }

    if (
      this.controllerId() === this.client.localId &&
      metadata.originId &&
      metadata.originId !== this.client.localId &&
      metadata.relayed !== true
    ) {
      const relayMetadata = { ...metadata, relayed: true };
      for (const peerId of this.client.remotePlayers?.keys?.() ?? []) {
        if (peerId === metadata.originId) continue;
        void this.sendTake(peerId, relayMetadata, pcm);
      }
    }
    return true;
  }

  async flushPlayback() {
    if (!this.pendingPlayback || globalThis.document?.hidden) return false;
    if (this.game.audio?.context?.state !== 'running') return false;
    this.pendingPlayback = false;
    const count =
      (await this.game.studioPlayback?.resyncRecordedVocalPlayback?.(this.game.studio, {
        settleMs: 0,
      })) ?? 0;
    this.trace('playback:resynced', { count });
    return count > 0;
  }

  update() {
    if (this.pendingAttachments.length) {
      const pending = this.pendingAttachments;
      this.pendingAttachments = [];
      for (const transfer of pending) {
        if (!this.attachTransfer(transfer)) this.pendingAttachments.push(transfer);
      }
      if (this.pendingAttachments.length > 8) {
        this.pendingAttachments.splice(0, this.pendingAttachments.length - 8);
      }
    }
    if (this.pendingPlayback && !globalThis.document?.hidden) void this.flushPlayback();
  }

  dispose() {
    this.disposed = true;
    globalThis.document?.removeEventListener?.('visibilitychange', this.boundVisibility);
    for (const channel of this.channels.values()) {
      try {
        channel.close?.();
      } catch {
        // Peer shutdown will close it.
      }
    }
    this.channels.clear();
    this.incoming.clear();
    this.pendingAttachments.length = 0;
  }
}
