from pathlib import Path

spatial_path = Path('src/audio/SpatialAudioSystem.js')
text = spatial_path.read_text()

text = text.replace(
"""    this.installationWet = null;\n    this.installationLimiter = null;\n    this.emitters = [];\n""",
"""    this.installationWet = null;\n    this.installationLimiter = null;\n    this.installationOutput = null;\n    this.emitters = [];\n""",
1,
)

text = text.replace(
"""    this.installationDry = context.createGain();\n    this.installationLimiter = context.createDynamicsCompressor?.() ?? null;\n    const output = this.installationLimiter ?? this.audio.master;\n    if (this.installationLimiter) {\n      this.installationLimiter.threshold.value = -8;\n      this.installationLimiter.knee.value = 10;\n      this.installationLimiter.ratio.value = 6;\n      this.installationLimiter.attack.value = 0.005;\n      this.installationLimiter.release.value = 0.24;\n      this.installationLimiter.connect(this.audio.master);\n    }\n""",
"""    this.installationDry = context.createGain();\n    this.installationLimiter = context.createDynamicsCompressor?.() ?? null;\n    this.installationOutput = context.createGain();\n    this.installationOutput.gain.value = 0.78;\n    this.installationOutput.connect(context.destination);\n    const output = this.installationLimiter ?? this.installationOutput;\n    if (this.installationLimiter) {\n      this.installationLimiter.threshold.value = -8;\n      this.installationLimiter.knee.value = 10;\n      this.installationLimiter.ratio.value = 6;\n      this.installationLimiter.attack.value = 0.005;\n      this.installationLimiter.release.value = 0.24;\n      this.installationLimiter.connect(this.installationOutput);\n    }\n""",
1,
)

text = text.replace(
"""    this.installationBus?.disconnect();\n    this.installationLimiter?.disconnect();\n    this.installationFeedback = null;\n""",
"""    this.installationBus?.disconnect();\n    this.installationLimiter?.disconnect();\n    this.installationOutput?.disconnect();\n    this.installationFeedback = null;\n""",
1,
)

text = text.replace(
"""    this.installationBus = null;\n    this.installationLimiter = null;\n    this.noiseBuffer = null;\n""",
"""    this.installationBus = null;\n    this.installationLimiter = null;\n    this.installationOutput = null;\n    this.noiseBuffer = null;\n""",
1,
)

spatial_path.write_text(text)

levels_path = Path('src/world/levels.js')
levels = levels_path.read_text()
levels = levels.replace(
"""      installation: anchor('Take A Break installation', [7.65, 0, 4.8], 1.5, 'installation'),\n""",
"""      installation: anchor(\n        'Spatial experiences / installation controls',\n        [7.5, 0, 3.5],\n        3.2,\n        'installation',\n      ),\n""",
1,
)
levels_path.write_text(levels)

test_path = Path('tests/installation-programs.test.js')
tests = test_path.read_text()
if "installation output bypasses the room attenuation bus" not in tests:
    tests += r'''

function audioParam(value = 0) {
  return {
    value,
    setTargetAtTime(next) {
      this.value = next;
    },
  };
}

function audioNode(extra = {}) {
  return {
    connections: [],
    connect(target) {
      this.connections.push(target);
      return target;
    },
    disconnect() {},
    ...extra,
  };
}

test('installation output bypasses the room attenuation bus', () => {
  const destination = audioNode();
  const master = audioNode({ gain: audioParam(0.48) });
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    destination,
    createGain: () => audioNode({ gain: audioParam(1) }),
    createDynamicsCompressor: () =>
      audioNode({
        threshold: audioParam(),
        knee: audioParam(),
        ratio: audioParam(),
        attack: audioParam(),
        release: audioParam(),
      }),
    createBiquadFilter: () =>
      audioNode({ frequency: audioParam(4000), Q: audioParam(0.7), type: 'lowpass' }),
    createDelay: () => audioNode({ delayTime: audioParam() }),
    createOscillator: () =>
      audioNode({
        frequency: audioParam(110),
        detune: audioParam(),
        type: 'sine',
        start() {},
        stop() {},
      }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(64) }),
    createBufferSource: () => audioNode({ start() {}, stop() {}, buffer: null, loop: false }),
    createPanner: () =>
      audioNode({
        positionX: audioParam(),
        positionY: audioParam(),
        positionZ: audioParam(),
      }),
  };
  const spatial = new SpatialAudioSystem({
    context,
    master,
    environment: {},
    activeExternalTransport: { owner: 'dj' },
  });
  spatial.ensureInstallation();

  assert.ok(spatial.installationOutput.connections.includes(destination));
  assert.ok(spatial.installationLimiter.connections.includes(spatial.installationOutput));
  assert.equal(spatial.installationLimiter.connections.includes(master), false);
});
'''

test_path.write_text(tests)
