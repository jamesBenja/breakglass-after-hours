import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Could not find patch anchor in ${path}: ${before.slice(0, 120)}`);
  }
  writeFileSync(path, source.replace(before, after));
}

// Green world-space names for every named humanoid interaction.
replaceOnce(
  'src/npcs/NpcSystem.js',
  "import { BoxGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';\nimport { createLightweightHuman, poseLightweightHuman } from '../avatar/LightweightHuman.js';",
  "import { BoxGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';\nimport { createLightweightHuman, poseLightweightHuman } from '../avatar/LightweightHuman.js';\nimport { createWorldNameplate } from '../ui/WorldNameplate.js';",
);
replaceOnce(
  'src/npcs/NpcSystem.js',
  `      const route = (npc.route ?? []).map((point) => new Vector3().fromArray(point));\n      return {\n        ...model,\n        id: npc.id,\n        name: npc.name ?? npc.id,\n        role: npc.role ?? 'guest',\n        interactive:\n          npc.interactive !== false &&\n          !npc.id.startsWith('line-') &&\n          !npc.id.startsWith('smoker-') &&\n          npc.id !== 'friend',`,
  `      const route = (npc.route ?? []).map((point) => new Vector3().fromArray(point));\n      const interactive =\n        npc.interactive !== false &&\n        !npc.id.startsWith('line-') &&\n        !npc.id.startsWith('smoker-') &&\n        npc.id !== 'friend';\n      const nameplate = interactive && npc.name ? createWorldNameplate(npc.name) : null;\n      if (nameplate) model.group.add(nameplate.sprite);\n      return {\n        ...model,\n        id: npc.id,\n        name: npc.name ?? npc.id,\n        role: npc.role ?? 'guest',\n        interactive,\n        nameplate,`,
);
replaceOnce(
  'src/npcs/NpcSystem.js',
  `  dispose() {\n    for (const npc of this.npcs) npc.group.removeFromParent();\n    this.npcs = [];\n  }`,
  `  dispose() {\n    for (const npc of this.npcs) {\n      npc.nameplate?.dispose?.();\n      npc.group.removeFromParent();\n    }\n    this.npcs = [];\n  }`,
);

// Maddox is also a named progression character, so give him the same green treatment.
replaceOnce(
  'src/pets/MaddoxSystem.js',
  `} from 'three';\n\nconst material`,
  `} from 'three';\nimport { createWorldNameplate } from '../ui/WorldNameplate.js';\n\nconst material`,
);
replaceOnce(
  'src/pets/MaddoxSystem.js',
  `    this.name = config.name ?? 'Maddox';\n    this.radius = config.radius ?? 1.35;`,
  `    this.name = config.name ?? 'Maddox';\n    this.nameplate = createWorldNameplate(this.name, { height: 1.88, width: 1.62 });\n    if (this.nameplate) this.root.add(this.nameplate.sprite);\n    this.radius = config.radius ?? 1.35;`,
);
replaceOnce(
  'src/pets/MaddoxSystem.js',
  `  dispose() {\n    this.root.removeFromParent();\n  }`,
  `  dispose() {\n    this.nameplate?.dispose?.();\n    this.root.removeFromParent();\n  }`,
);

// Support clue-only locked-door anchors which disappear once their boolean state is true.
replaceOnce(
  'src/interactions/InteractionSystem.js',
  `  unlocked(anchor) {\n    if (!anchor.requires) return true;\n    const value = this.state?.data?.[anchor.requires] ?? this.state?.[anchor.requires];\n    return value === true;\n  }`,
  `  unlocked(anchor) {\n    if (anchor.requires) {\n      const value = this.state?.data?.[anchor.requires] ?? this.state?.[anchor.requires];\n      if (value !== true) return false;\n    }\n    if (anchor.requiresNot) {\n      const value = this.state?.data?.[anchor.requiresNot] ?? this.state?.[anchor.requiresNot];\n      if (value === true) return false;\n    }\n    return true;\n  }`,
);

// Add an actual FX send to each Spectra channel strip so the final mix challenge can score effects.
replaceOnce(
  'src/studio/StudioSession.js',
  `  high: clamp(Number(stem.high) || 0, -1, 1),\n  mute: stem.mute === true,`,
  `  high: clamp(Number(stem.high) || 0, -1, 1),\n  fx: clamp(Number(stem.fx) || 0, 0, 1),\n  mute: stem.mute === true,`,
);
replaceOnce(
  'src/studio/StudioSession.js',
  `      high: 0,\n      mute: false,`,
  `      high: 0,\n      fx: 0,\n      mute: false,`,
);
replaceOnce(
  'src/studio/StudioSession.js',
  `  setEq(id, band, value) {\n    const stem = this.stems.find((item) => item.id === id);\n    if (!stem || !['low', 'high'].includes(band)) return false;\n    stem[band] = clamp(Number(value) || 0, -1, 1);\n    return true;\n  }\n\n  toggleMute(id) {`,
  `  setEq(id, band, value) {\n    const stem = this.stems.find((item) => item.id === id);\n    if (!stem || !['low', 'high'].includes(band)) return false;\n    stem[band] = clamp(Number(value) || 0, -1, 1);\n    return true;\n  }\n\n  setFx(id, value) {\n    const stem = this.stems.find((item) => item.id === id);\n    if (!stem) return false;\n    stem.fx = clamp(Number(value) || 0, 0, 1);\n    return true;\n  }\n\n  toggleMute(id) {`,
);

replaceOnce(
  'src/ui/Hud.js',
  `      this.addMixerRange(strip, 'High shelf', -1, 1, 0.01, stem.high ?? 0, (value) => {\n        session.setEq(stem.id, 'high', value);\n        onMix();\n      });\n\n      const row = this.document.createElement('div');`,
  `      this.addMixerRange(strip, 'High shelf', -1, 1, 0.01, stem.high ?? 0, (value) => {\n        session.setEq(stem.id, 'high', value);\n        onMix();\n      });\n      this.addMixerRange(strip, 'FX send', 0, 1, 0.01, stem.fx ?? 0, (value) => {\n        session.setFx(stem.id, value);\n        onMix();\n      });\n\n      const row = this.document.createElement('div');`,
);
replaceOnce(
  'src/ui/Hud.js',
  "      `${session.name} · ${session.stems.length} stems. Fader, pan, shelves, mute and solo all feed the actual WebAudio channel strips.`,",
  "      `${session.name} · ${session.stems.length} stems. Fader, pan, shelves, FX send, mute and solo all feed the actual WebAudio channel strips.`,",
);

replaceOnce(
  'src/studio/StudioPlayback.js',
  `    const compressor = context.createDynamicsCompressor();\n    const fader = context.createGain();\n    const pan =`,
  `    const compressor = context.createDynamicsCompressor();\n    const fader = context.createGain();\n    const fxGain = context.createGain();\n    const fxDelay = context.createDelay(0.5);\n    const pan =`,
);
replaceOnce(
  'src/studio/StudioPlayback.js',
  `    compressor.connect(fader);\n    fader.connect(pan ?? this.audio.master);\n    pan?.connect(this.audio.master);\n    bus = { input, color, low, high, compressor, fader, pan };`,
  `    compressor.connect(fader);\n    fader.connect(pan ?? this.audio.master);\n    pan?.connect(this.audio.master);\n    fxGain.gain.value = 0;\n    fxDelay.delayTime.value = 0.18;\n    fader.connect(fxGain);\n    fxGain.connect(fxDelay);\n    fxDelay.connect(this.audio.master);\n    bus = { input, color, low, high, compressor, fader, pan, fxGain, fxDelay };`,
);
replaceOnce(
  'src/studio/StudioPlayback.js',
  `      bus.fader.gain.setTargetAtTime(audible ? stem.level : 0, time, 0.025);\n      if (bus.pan) bus.pan.pan.setTargetAtTime(stem.pan ?? 0, time, 0.025);`,
  `      bus.fader.gain.setTargetAtTime(audible ? stem.level : 0, time, 0.025);\n      bus.fxGain.gain.setTargetAtTime((stem.fx ?? 0) * 0.38, time, 0.025);\n      if (bus.pan) bus.pan.pan.setTargetAtTime(stem.pan ?? 0, time, 0.025);`,
);

// Save-state architecture for difficulty, room access and the Spectra reward.
replaceOnce(
  'src/state/GameState.js',
  `import { LIVE_ARCHIVE_IDS } from '../archive/liveArchive.js';\nimport { normalizeAvatar } from '../avatar/profile.js';`,
  `import { LIVE_ARCHIVE_IDS } from '../archive/liveArchive.js';\nimport { normalizeAvatar } from '../avatar/profile.js';\nimport { normalizeDifficulty } from '../gameplay/guidance.js';\nimport { MIXING_CHALLENGE_IDS } from '../studio/MixingChallenge.js';`,
);
replaceOnce(
  'src/state/GameState.js',
  `  'beaver',\n  'bouncer',\n];`,
  `  'beaver',\n  'sam',\n  'malaika',\n  'dave',\n  'bouncer',\n];`,
);
replaceOnce(
  'src/state/GameState.js',
  `  storageAccessGranted: false,\n  hotDogsEaten: 0,`,
  `  storageAccessGranted: false,\n  deadRoomAccessGranted: false,\n  difficulty: 'medium',\n  mixingChallengeCompleted: [],\n  mixingRewardKey: false,\n  alleyShortcutUnlocked: false,\n  hotDogsEaten: 0,`,
);
replaceOnce(
  'src/state/GameState.js',
  `  state.storageAccessGranted = value.storageAccessGranted === true;\n  state.hotDogsEaten = Math.max(0, Math.min(999, Math.floor(Number(value.hotDogsEaten) || 0)));`,
  `  state.storageAccessGranted = value.storageAccessGranted === true;\n  state.deadRoomAccessGranted = value.deadRoomAccessGranted === true;\n  state.difficulty = normalizeDifficulty(value.difficulty);\n  if (Array.isArray(value.mixingChallengeCompleted)) {\n    state.mixingChallengeCompleted = [\n      ...new Set(value.mixingChallengeCompleted.filter((id) => MIXING_CHALLENGE_IDS.includes(id))),\n    ];\n  }\n  state.mixingRewardKey = value.mixingRewardKey === true;\n  state.alleyShortcutUnlocked = value.alleyShortcutUnlocked === true || state.mixingRewardKey;\n  state.hotDogsEaten = Math.max(0, Math.min(999, Math.floor(Number(value.hotDogsEaten) || 0)));`,
);

// Turn the old service opening on the studio exterior into a real reward door.
replaceOnce(
  'src/world/upstairs/plan.js',
  `  4: [{ id: 'main-entry-door', name: 'Main entry', at: 0.43, width: 2.0, exterior: true }],`,
  `  4: [\n    { id: 'main-entry-door', name: 'Main entry', at: 0.43, width: 2.0, exterior: true },\n    {\n      id: 'alley-shortcut-door',\n      name: 'Service stair to alley',\n      at: 0.8,\n      width: 1.55,\n      exterior: true,\n    },\n  ],`,
);

// Studio room gates, lock clues, escort points and the bidirectional service-stair anchor.
replaceOnce(
  'src/world/upstairs/definition.js',
  `  const fridgePosition = at(785, 635);\n  return {`,
  `  const fridgePosition = at(785, 635);\n  const doorGate = (id, requires, position, size) => {\n    const [x, , z] = position;\n    return {\n      id,\n      requires,\n      collision: {\n        x1: x - size[0] / 2,\n        x2: x + size[0] / 2,\n        z1: z - size[2] / 2,\n        z2: z + size[2] / 2,\n        y1: 0,\n        y2: size[1],\n      },\n      visual: { position: [x, size[1] / 2, z], size, color: 0x34463a },\n    };\n  };\n  const progressionGates = [\n    doorGate('dead-room-gate', 'deadRoomAccessGranted', at(386, 692), [1.72, 2.25, 0.16]),\n    doorGate(\n      'storage-gallery-gate',\n      'storageAccessGranted',\n      at(415, 995),\n      [1.68, 2.25, 0.16],\n    ),\n    doorGate(\n      'storage-hall-gate',\n      'storageAccessGranted',\n      at(519, 1024),\n      [0.16, 2.25, 1.48],\n    ),\n    doorGate(\n      'alley-shortcut-gate',\n      'alleyShortcutUnlocked',\n      at(414, 1116),\n      [1.64, 2.25, 0.18],\n    ),\n  ];\n  const guidePoints = {\n    storage: { player: at(430, 1020), npc: at(410, 1008) },\n    deadRoom: { player: at(386, 666), npc: at(386, 684) },\n  };\n  return {`,
);
replaceOnce(
  'src/world/upstairs/definition.js',
  `    spawns: {\n      ...spawns,\n      roofReturn: at(435, 1075, 1.4),\n    },`,
  `    spawns: {\n      ...spawns,\n      roofReturn: at(435, 1075, 1.4),\n      alleyShortcut: at(414, 1090),\n    },`,
);
replaceOnce(
  'src/world/upstairs/definition.js',
  `    closedSuites,\n    navigation: { allowAirborne: true, boundary: footprint, surfaces, obstacles: solids },`,
  `    closedSuites,\n    progressionGates,\n    guidePoints,\n    navigation: { allowAirborne: true, boundary: footprint, surfaces, obstacles: solids },`,
);
replaceOnce(
  'src/world/upstairs/definition.js',
  `      instruments: {\n        name: 'Guitar + bass rack',\n        position: at(305, 625),\n        radius: 1.7,\n        action: 'instruments',\n      },`,
  `      instruments: {\n        name: 'Guitar + bass rack',\n        position: at(305, 625),\n        radius: 1.7,\n        action: 'instruments',\n        requires: 'deadRoomAccessGranted',\n      },`,
);
replaceOnce(
  'src/world/upstairs/definition.js',
  `      amps: {\n        name: 'Dead Room amps',\n        position: at(365, 605),\n        radius: 1.8,\n        action: 'amps',\n      },`,
  `      amps: {\n        name: 'Dead Room amps',\n        position: at(365, 605),\n        radius: 1.8,\n        action: 'amps',\n        requires: 'deadRoomAccessGranted',\n      },`,
);
replaceOnce(
  'src/world/upstairs/definition.js',
  `      tapeArchive: {\n        name: 'Breakglass tape archive',\n        position: at(383, 1027),\n        radius: 1.55,\n        action: 'tapeArchive',\n      },`,
  `      tapeArchive: {\n        name: 'Breakglass tape archive',\n        position: at(383, 1027),\n        radius: 1.55,\n        action: 'tapeArchive',\n        requires: 'storageAccessGranted',\n      },\n      deadRoomLock: {\n        name: 'Dead Room · locked',\n        position: at(386, 700),\n        radius: 1.55,\n        action: 'progressionDoor',\n        progression: 'dead-room',\n        requiresNot: 'deadRoomAccessGranted',\n      },\n      storageLock: {\n        name: 'Storage · locked',\n        position: at(415, 986),\n        radius: 1.55,\n        action: 'progressionDoor',\n        progression: 'storage',\n        requiresNot: 'storageAccessGranted',\n      },\n      storageHallLock: {\n        name: 'Storage · locked',\n        position: at(532, 1024),\n        radius: 1.55,\n        action: 'progressionDoor',\n        progression: 'storage',\n        requiresNot: 'storageAccessGranted',\n      },`,
);
replaceOnce(
  'src/world/upstairs/definition.js',
  `      roofPassage: {\n        name: 'Hidden roof hatch',\n        position: at(435, 1075, 1.4),\n        radius: 1.5,\n        action: 'travel',\n        target: 'roof@hatch',\n        requires: 'roofSecretUnlocked',\n      },\n      stairs: {`,
  `      roofPassage: {\n        name: 'Hidden roof hatch',\n        position: at(435, 1075, 1.4),\n        radius: 1.5,\n        action: 'travel',\n        target: 'roof@hatch',\n        requires: 'roofSecretUnlocked',\n      },\n      alleyShortcut: {\n        name: 'Service stair ↓ alley',\n        position: at(414, 1100),\n        radius: 1.55,\n        action: 'travel',\n        target: 'alley@studioShortcut',\n        requires: 'alleyShortcutUnlocked',\n      },\n      alleyShortcutLock: {\n        name: 'Service stair · locked',\n        position: at(414, 1100),\n        radius: 1.55,\n        action: 'progressionDoor',\n        progression: 'shortcut',\n        requiresNot: 'alleyShortcutUnlocked',\n      },\n      stairs: {`,
);

// Give the alley a second authored door for the reward shortcut.
replaceOnce(
  'src/world/alley.js',
  `    clubDoor: [-3.7, 0, -1.0],\n  },`,
  `    clubDoor: [-3.7, 0, -1.0],\n    studioShortcut: [0, 0, -1.0],\n  },`,
);
replaceOnce(
  'src/world/alley.js',
  `      { id: 'north-wall-east', x1: -2.7, x2: 29.5, z1: -2.5, z2: -2.25, y1: 0, y2: 3.2 },`,
  `      { id: 'north-wall-east-a', x1: -2.7, x2: -0.9, z1: -2.5, z2: -2.25, y1: 0, y2: 3.2 },\n      { id: 'north-wall-east-b', x1: 0.9, x2: 29.5, z1: -2.5, z2: -2.25, y1: 0, y2: 3.2 },`,
);
replaceOnce(
  'src/world/alley.js',
  `  },\n  anchors: {\n    clubDoor: {`,
  `  },\n  progressionGates: [\n    {\n      id: 'alley-studio-shortcut-gate',\n      requires: 'alleyShortcutUnlocked',\n      collision: { x1: -0.9, x2: 0.9, z1: -2.5, z2: -2.25, y1: 0, y2: 2.25 },\n      visual: { position: [0, 1.125, -2.375], size: [1.8, 2.25, 0.25], color: 0x34463a },\n    },\n  ],\n  anchors: {\n    clubDoor: {`,
);
replaceOnce(
  'src/world/alley.js',
  `    clubDoor: {\n      ...anchor('Stairwell ↑ Breakglass', [-3.7, 0, -1.72], 1.7, 'travel'),\n      target: 'downstairs@alley',\n    },\n    sam:`,
  `    clubDoor: {\n      ...anchor('Stairwell ↑ Breakglass', [-3.7, 0, -1.72], 1.7, 'travel'),\n      target: 'downstairs@alley',\n    },\n    studioShortcut: {\n      ...anchor('Service stair ↑ studio', [0, 0, -1.72], 1.6, 'travel'),\n      target: 'upstairs@alleyShortcut',\n      requires: 'alleyShortcutUnlocked',\n    },\n    studioShortcutLock: {\n      ...anchor('Service stair · locked', [0, 0, -1.72], 1.6, 'progressionDoor'),\n      progression: 'shortcut',\n      requiresNot: 'alleyShortcutUnlocked',\n    },\n    sam:`,
);

// Progression gates become first-class scene systems.
replaceOnce(
  'src/scenes/createLevel.js',
  `import { CompanionMaddoxSystem } from '../pets/CompanionMaddoxSystem.js';\nimport { disposeObject } from './disposeObject.js';`,
  `import { CompanionMaddoxSystem } from '../pets/CompanionMaddoxSystem.js';\nimport { ProgressionGateSystem } from '../gameplay/ProgressionGateSystem.js';\nimport { disposeObject } from './disposeObject.js';`,
);
replaceOnce(
  'src/scenes/createLevel.js',
  `  const collision = new CollisionWorld(definition.navigation);\n  const npcs = new NpcSystem(gameplay, definition);`,
  `  const collision = new CollisionWorld(definition.navigation);\n  const progressionGates = definition.progressionGates?.length\n    ? new ProgressionGateSystem(gameplay, collision, definition.progressionGates)\n    : null;\n  const npcs = new NpcSystem(gameplay, definition);`,
);
replaceOnce(
  'src/scenes/createLevel.js',
  `    collision,\n    npcs,`,
  `    collision,\n    progressionGates,\n    npcs,`,
);
replaceOnce(
  'src/scenes/createLevel.js',
  `      maddox?.dispose();\n      roof?.dispose();`,
  `      maddox?.dispose();\n      progressionGates?.dispose();\n      roof?.dispose();`,
);

// Sync gate visuals/collision every time a floor is entered, including saved games.
replaceOnce(
  'src/core/Game.js',
  `      onEnter: (level) => {\n        this.syncMaddoxPresence(level, { entered: true });\n        this.interactions.setLevel(level);`,
  `      onEnter: (level) => {\n        this.syncMaddoxPresence(level, { entered: true });\n        level.progressionGates?.sync?.(this.state.data);\n        this.interactions.setLevel(level);`,
);

// Interactive dialogue progression and the Spectra challenge UI.
replaceOnce(
  'src/interactions/createActions.js',
  `import { DJ_TRACKS } from '../dj/DjMixer.js';\nimport { STUDIO_SESSION_TEMPLATES } from '../studio/sessionCatalog.js';`,
  `import { DJ_TRACKS } from '../dj/DjMixer.js';\nimport { progressionHint } from '../gameplay/guidance.js';\nimport {\n  MIXING_CHALLENGES,\n  createReferenceMix,\n  feedbackForMix,\n  mixingChallengeById,\n  mixingGameComplete,\n  nextMixingChallenge,\n  scoreMix,\n  startMixingChallenge,\n} from '../studio/MixingChallenge.js';\nimport { STUDIO_SESSION_TEMPLATES } from '../studio/sessionCatalog.js';`,
);
replaceOnce(
  'src/interactions/createActions.js',
  `  const hasStudio = !!studio;\n  const hasDj = !!dj && typeof ui.djMixer === 'function';\n\n  const appendButton`,
  `  const hasStudio = !!studio;\n  const hasDj = !!dj && typeof ui.djMixer === 'function';\n  let activeMixChallengeId = null;\n\n  const syncProgression = () =>\n    sceneManager.current?.progressionGates?.sync?.(state?.data ?? {});\n\n  const escortToGuide = (guideId, npcId) => {\n    const level = sceneManager.current;\n    const guide = level?.definition?.guidePoints?.[guideId];\n    if (!level || !guide || !player) return false;\n    player.spawn(guide.player, level.collision);\n    const npc = level.npcs?.get?.(npcId);\n    if (npc?.group) {\n      npc.group.position.fromArray(guide.npc);\n      npc.group.rotation.y = Math.atan2(\n        player.position.x - npc.group.position.x,\n        player.position.z - npc.group.position.z,\n      );\n    }\n    return true;\n  };\n\n  const progressionDoorPanel = (target) =>\n    panel(\n      (target?.name ?? 'LOCKED').toUpperCase(),\n      progressionHint(target?.progression, state?.data?.difficulty),\n    );\n\n  const appendButton`,
);

const challengeFunctions = `  const mixChallengeMenu = () => {\n    if (!studio || !studioPlayback) return;\n    const completed = new Set(state?.data?.mixingChallengeCompleted ?? []);\n    const available = MIXING_CHALLENGES.filter(\n      (challenge, index) =>\n        index === 0 ||\n        completed.has(challenge.id) ||\n        completed.has(MIXING_CHALLENGES[index - 1].id),\n    );\n    const reward = state?.data?.mixingRewardKey === true;\n    panel(\n      'SPECTRA · MIX MATCH',\n      reward\n        ? 'All current mix levels are complete. The Spectra master key has opened the direct service stair between the studio and alley.'\n        : 'Match the hidden reference mixes by ear. Each level adds another part of the console. Dance Shoes is the temporary multitrack source until more Breakglass stem folders are attached.',\n      [\n        ...available.map((challenge) => [\n          (completed.has(challenge.id) ? '✓ ' : '') +\n            'Level ' +\n            challenge.level +\n            ' · ' +\n            challenge.label,\n          () => beginMixChallenge(challenge.id),\n        ]),\n        ['Back to console', consolePanel],\n      ],\n    );\n  };\n\n  const beginMixChallenge = (id) => {\n    const challenge = startMixingChallenge(studio, id);\n    if (!challenge) return;\n    studioPlayback.stop();\n    activeMixChallengeId = challenge.id;\n    rememberStudio();\n    mixChallengeConsolePanel();\n  };\n\n  const listenMixReference = async () => {\n    const challenge = mixingChallengeById(activeMixChallengeId);\n    const reference = createReferenceMix(activeMixChallengeId);\n    if (!challenge || !reference) return;\n    studioPlayback.stop();\n    dj?.stop?.();\n    audio.stop();\n    await studioPlayback.play(reference);\n    panel(\n      'REFERENCE MIX · LEVEL ' + challenge.level,\n      'Listen to the target. The reference uses a separate console snapshot, so your working faders and settings are not overwritten.',\n      [\n        [\n          'Return to my mix',\n          () => {\n            studioPlayback.stop();\n            mixChallengeConsolePanel();\n          },\n        ],\n      ],\n    );\n  };\n\n  const checkMixChallenge = () => {\n    const challenge = mixingChallengeById(activeMixChallengeId);\n    if (!challenge) return mixChallengeMenu();\n    const result = scoreMix(studio, challenge.id);\n    if (!result.pass) {\n      const feedback = feedbackForMix(result, state?.data?.difficulty).join(' ');\n      panel(\n        'MIX CHECK · ' + result.score + '%',\n        (feedback || 'The mix is not close enough yet.') + ' Listen again, make a few changes and resubmit.',\n        [\n          ['Keep mixing', mixChallengeConsolePanel],\n          ['Hear reference again', listenMixReference],\n          ['Restart level', () => beginMixChallenge(challenge.id)],\n        ],\n      );\n      return;\n    }\n\n    const completed = state.data.mixingChallengeCompleted ?? [];\n    if (!completed.includes(challenge.id)) completed.push(challenge.id);\n    state.data.mixingChallengeCompleted = completed;\n    const finished = mixingGameComplete(completed);\n    if (finished) {\n      state.data.mixingRewardKey = true;\n      state.data.alleyShortcutUnlocked = true;\n      syncProgression();\n      saveState();\n      panel(\n        'SPECTRA MASTER KEY',\n        'All mix levels passed. A green service key releases from beneath the console. It unlocks the direct service stair beside Storage, giving you a new route between the studio floor and the alley.',\n        [\n          [\n            'Pocket the key',\n            () => {\n              activeMixChallengeId = null;\n              consolePanel();\n            },\n          ],\n        ],\n      );\n      return;\n    }\n\n    saveState();\n    const next = nextMixingChallenge(completed);\n    panel(\n      'LEVEL ' + challenge.level + ' PASSED · ' + result.score + '%',\n      'That mix matches. The next Spectra challenge is now unlocked.',\n      [\n        ...(next ? [['Start next level', () => beginMixChallenge(next.id)]] : []),\n        ['Challenge menu', mixChallengeMenu],\n      ],\n    );\n  };\n\n  const mixChallengeConsolePanel = () => {\n    const challenge = mixingChallengeById(activeMixChallengeId);\n    if (!challenge || !studio || !studioPlayback || typeof ui.studioMixer !== 'function') {\n      mixChallengeMenu();\n      return;\n    }\n    ui.studioMixer(studio, {\n      onMix: () => {\n        studioPlayback.updateMix(studio);\n        rememberStudio();\n      },\n      onPlay: async () => {\n        dj?.stop?.();\n        audio.stop();\n        await studioPlayback.play(studio);\n      },\n      onStop: () => studioPlayback.stop(),\n    });\n    if (ui.title) ui.title.textContent = 'SPECTRA MIX CHALLENGE · LEVEL ' + challenge.level;\n    if (ui.text) {\n      ui.text.textContent =\n        challenge.label +\n        '. Match the reference by ear, then submit the mix. Scored controls: ' +\n        challenge.parameters.join(', ') +\n        '.';\n    }\n    appendButton('Hear reference mix', listenMixReference);\n    appendButton('Check my mix', checkMixChallenge);\n    appendButton('Restart level', () => beginMixChallenge(challenge.id));\n    appendButton('Exit challenge', () => {\n      studioPlayback.stop();\n      activeMixChallengeId = null;\n      consolePanel();\n    });\n  };\n\n`;
replaceOnce(
  'src/interactions/createActions.js',
  `  const consolePanel = () => {`,
  challengeFunctions + `  const consolePanel = () => {`,
);
replaceOnce(
  'src/interactions/createActions.js',
  `    appendButton('Load Breakglass session', sessionLibraryPanel);`,
  `    appendButton('Spectra mix challenge', mixChallengeMenu);\n    appendButton('Load Breakglass session', sessionLibraryPanel);`,
);
replaceOnce(
  'src/interactions/createActions.js',
  `    installation: installationPanel,\n    travel: (target) => sceneManager.request(target.target),`,
  `    installation: installationPanel,\n    progressionDoor: progressionDoorPanel,\n    travel: (target) => sceneManager.request(target.target),`,
);
replaceOnce(
  'src/interactions/createActions.js',
  `      if (id === 'jace' && sceneManager.current.definition.id === 'upstairs')\n        characterActions.push(['Ask about the Neve room', neveConsolePanel]);`,
  `      if (id === 'jace' && sceneManager.current.definition.id === 'upstairs') {\n        const storageUnlocked = state?.data?.storageAccessGranted === true;\n        characterActions.push([\n          storageUnlocked ? 'Take me back to the tape archive' : 'Tell me about the studio tape archives',\n          () => {\n            state.data.storageAccessGranted = true;\n            syncProgression();\n            saveState();\n            escortToGuide('storage', 'jace');\n            panel(\n              'JACE · TAPE ARCHIVE',\n              storageUnlocked\n                ? '“Here it is again. Storage is open now, so you can come back whenever you want.”'\n                : '“The tape archive is in Storage. I keep that room closed when nobody is using it. Come on — I will open it and show you where the reels live.”',\n            );\n          },\n        ]);\n        characterActions.push(['Ask about the Neve room', neveConsolePanel]);\n      }`,
);
replaceOnce(
  'src/interactions/createActions.js',
  `        characterActions.push([\n          'Show me the tape archive',\n          () =>\n            panel(\n              'JAMES · BREAKGLASS TAPES',\n              '“These reels are part of the building memory. Pick one from the archive, bring it into the historic Neve room, thread it on the machine and listen there.”',\n              [\n                ['Browse the tape archive', tapeArchivePanel],\n                ['Go to the tape machine', tapeMachinePanel],\n              ],\n            ),\n        ]);`,
  `        characterActions.push([\n          state?.data?.storageAccessGranted ? 'Where are the tape archives again?' : 'Where are the tape archives?',\n          () =>\n            panel(\n              'JAMES · BREAKGLASS TAPES',\n              state?.data?.storageAccessGranted\n                ? '“Storage is open now. The reels are in there; bring one to the historic Neve room if you want to hear it.”'\n                : '“Jace looks after the tape room. Ask him about the archive and he can open Storage for you.”',\n            ),\n        ]);`,
);
replaceOnce(
  'src/interactions/createActions.js',
  `      if (id === 'boogaloo' && sceneManager.current.definition.id === 'upstairs')\n        characterActions.push(['Play the synth', synthPanel]);`,
  `      if (id === 'boogaloo' && sceneManager.current.definition.id === 'upstairs') {\n        const deadRoomUnlocked = state?.data?.deadRoomAccessGranted === true;\n        characterActions.push([\n          deadRoomUnlocked ? 'Take me back to the guitars and amps' : 'Which amps should I pair with which guitars?',\n          () => {\n            state.data.deadRoomAccessGranted = true;\n            syncProgression();\n            saveState();\n            escortToGuide('deadRoom', 'boogaloo');\n            panel(\n              'BOOGALOO · DEAD ROOM',\n              deadRoomUnlocked\n                ? '“Dead Room is still open. Try another chain.”'\n                : '“Start with the instrument, then pick the amp for what you want it to do. Come on — I will open the Dead Room and you can actually try the combinations.”',\n            );\n          },\n        ]);\n        characterActions.push(['Play the synth', synthPanel]);\n      }`,
);

// Dave is now a real named interaction on the founders' roof scene rather than a green label with no response.
replaceOnce(
  'src/npcs/dialogues.js',
  `  david: {\n    title: 'DAVID · FURNITURE DEALER',\n    text: '“Half the building is furniture if you know which wall to move.”',\n  },`,
  `  david: {\n    title: 'DAVID · FURNITURE DEALER',\n    text: '“Half the building is furniture if you know which wall to move.”',\n  },\n  dave: {\n    title: 'DAVE · BREAKGLASS FOUNDER',\n    text: '“We spent a lot of time up here when the studio was young. The roof was part smoke break, part meeting room.”',\n  },`,
);

console.log('Guided progression + Spectra mixing architecture applied.');
