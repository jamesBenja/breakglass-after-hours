class BreakglassMicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = [];
    this.pendingFrames = 0;
    this.port.onmessage = (event) => {
      if (event.data === 'flush') {
        this.flush();
        this.port.postMessage({ type: 'flushed' });
      }
    };
  }

  flush() {
    if (!this.pendingFrames) return;
    const merged = new Float32Array(this.pendingFrames);
    let offset = 0;
    for (const chunk of this.pending) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pending = [];
    this.pendingFrames = 0;
    this.port.postMessage(merged, [merged.buffer]);
  }

  process(inputs, outputs) {
    const output = outputs[0]?.[0];
    if (output) output.fill(0);

    const input = inputs[0]?.[0];
    if (input?.length) {
      this.pending.push(Float32Array.from(input));
      this.pendingFrames += input.length;
      if (this.pendingFrames >= 2048) this.flush();
    }
    return true;
  }
}

registerProcessor('breakglass-mic-capture-v2', BreakglassMicCaptureProcessor);
