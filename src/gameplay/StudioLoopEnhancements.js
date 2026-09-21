import { normalizeDrumMachineState } from './DrumMachineSystem.js';
import { normalizeModularPatchState } from './ModularSynthSystem.js';
import { SpectraClipEngine } from '../studio/SpectraClipEngine.js';
import { SpectraRecorder } from '../studio/SpectraRecorder.js';
import { StudioExporter } from '../studio/StudioExporter.js';
import { SpectraProjectStore } from '../studio/SpectraProjectStore.js';
import { SpectraSpatialMixer } from '../studio/SpectraSpatialMixer.js';
import {
  SPECTRA_SPATIAL_SPEAKERS,
  normalizeSpatialPosition,
  spatialPositionFromPointer,
  spatialSpeakerGains,
} from '../studio/SpectraSpatialLayout.js';
import { StudioSession } from '../studio/StudioSession.js';
import {
  SPECTRA_GRID_DIVISIONS,
  SpectraTransport,
  quantizeSpectraTime,
  spectraLoopSeconds,
} from '../studio/SpectraTransport.js';

const GRID_DIVISIONS = SPECTRA_GRID_DIVISIONS;
const LOOP_BARS = [1, 2, 4, 8, 16];
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function loopSeconds(session) {
  return spectraLoopSeconds(session);
}

function quantizePerformance(session, performance) {
  if (!performance?.events?.length) return performance;
  const length = loopSeconds(session);
  performance.bpm = session.bpm;
  performance.duration = length;
  performance.events = performance.events.map((event) => ({
    ...event,
    time: quantizeSpectraTime(session, event.time, { wrap: true, includeSwing: true }),
  }));
  return performance;
}

function enhanceSession(session) {
  if (session._loopBuilderEnhanced) return;
  session._loopBuilderEnhanced = true;
  session.loopEnabled = session.loopEnabled === true;
  session.loopBars = LOOP_BARS.includes(Number(session.loopBars)) ? Number(session.loopBars) : 4;
  session.quantize = GRID_DIVISIONS[session.quantize] ? session.quantize : '1/16';
  session.swing = clamp(session.swing, 0, 0.45);

  session.setLoopBars = (bars) => {
    const next = LOOP_BARS.includes(Number(bars)) ? Number(bars) : session.loopBars;
    session.loopBars = next;
    return next;
  };
  session.setLoopEnabled = (enabled) => {
    session.loopEnabled = enabled === true;
    return session.loopEnabled;
  };
  session.setQuantize = (grid) => {
    if (GRID_DIVISIONS[grid]) session.quantize = grid;
    return session.quantize;
  };
  session.setSwing = (value) => {
    session.swing = clamp(value, 0, 0.45);
    return session.swing;
  };
  session.quantizeTake = (stemId) => {
    const stem = session.stems.find((item) => item.id === stemId);
    if (!stem?.performance) return false;
    quantizePerformance(session, stem.performance);
    return stem.performance;
  };
  session.quantizeLatestTake = () => {
    const stem = [...session.stems].reverse().find((item) => item.performance);
    return stem ? session.quantizeTake(stem.id) : false;
  };
  session.duplicateLatestTake = () => {
    const source = [...session.stems]
      .reverse()
      .find((item) => item.performance || item.assetId == null);
    if (!source) return false;
    const copy = JSON.parse(JSON.stringify(source));
    session.takeCounter += 1;
    copy.id = `${source.kind || 'take'}-${session.takeCounter}`;
    copy.label = `${source.label} · copy`;
    if (copy.performance) quantizePerformance(session, copy.performance);
    session.stems.push(copy);
    if (session.stems.length > 12) session.stems.splice(0, session.stems.length - 12);
    return copy;
  };
  session.removeLatestTake = () => {
    for (let index = session.stems.length - 1; index >= 0; index -= 1) {
      const stem = session.stems[index];
      if (
        [
          'keyboard-performance',
          'browser-microphone',
          'modular-synth',
          'spectra-drum-machine',
          'spectra-live-capture',
          'spectra-collaborative-capture',
        ].includes(stem.source)
      ) {
        session.recordings.delete(stem.id);
        session.stems.splice(index, 1);
        return stem;
      }
    }
    return false;
  };

  const baseAttachPerformance = session.attachPerformance.bind(session);
  session.attachPerformance = (stemId, performance) => {
    const prepared = performance
      ? { ...performance, events: performance.events?.map((event) => ({ ...event })) ?? [] }
      : performance;
    if (prepared && session.loopEnabled) quantizePerformance(session, prepared);
    return baseAttachPerformance(stemId, prepared);
  };

  const baseSnapshot = session.snapshot.bind(session);
  session.snapshot = () => ({
    ...baseSnapshot(),
    loopEnabled: session.loopEnabled,
    loopBars: session.loopBars,
    quantize: session.quantize,
    swing: session.swing,
  });
}

export function stopSpectraLiveInputsForMix(game) {
  game?.drumMachine?.stopLoop?.(false);
  game?.modularSynth?.stopLoop?.(false);
  game?.keyboardPerformance?.stop?.(false);
}

export function connectKeyboardPerformanceToSpectra(game) {
  const performance = game?.keyboardPerformance;
  if (!performance?.setPerformanceEventSink) return false;

  const resourceIdFor = (config = {}) => {
    const kind = String(config.stemKind || config.mode || 'instrument')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 24);
    const label = String(config.label || kind || 'instrument')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 48);
    return `local:${kind || 'instrument'}:${label || 'instrument'}`;
  };

  performance.setCaptureArmed?.(() => game.spectraRecorder?.armed === true);
  performance.setPerformanceMonitor?.(
    ({ config = {}, event = {} } = {}) =>
      game.studioPlayback?.monitorLiveEvent?.(game.studio, config, event, {
        resourceId: resourceIdFor(config),
      }) === true,
  );
  performance.setPerformanceEventSink(({ config = {}, event = {} } = {}) => {
    const recorder = game.spectraRecorder;
    if (!recorder?.armed) return false;
    return recorder.captureLocal(config, event, {
      resourceId: resourceIdFor(config),
    });
  });
  return true;
}

function enhancePlayback(playback, session, game) {
  if (playback._loopBuilderEnhanced) return;
  playback._loopBuilderEnhanced = true;
  playback.nativeSyncTimer = null;
  playback.transportStartedAt = 0;

  playback.loopDuration = (activeSession = playback.session ?? session) =>
    loopSeconds(activeSession);
  playback.loopSteps = (activeSession = playback.session ?? session) =>
    Math.max(16, activeSession.loopBars * 16);
  playback.transportPosition = () => playback.position?.() ?? 0;

  const baseStartAlignedAssets = playback.startAlignedAssets.bind(playback);
  playback.startAlignedAssets = (activeSession, buffers, offset = 0) => {
    baseStartAlignedAssets(activeSession, buffers, offset);
    playback.transportOffset = Math.max(0, Number(offset) || 0);
    playback.transportStartedAt = playback.audio.context.currentTime + 0.06;
    if (!activeSession.loopEnabled) return;
    const end = loopSeconds(activeSession);
    for (const source of playback.sources) {
      if (!source?.buffer) continue;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = Math.min(source.buffer.duration, end);
    }
  };

  const baseStartNativeAssets = playback.startNativeAssets.bind(playback);
  playback.startNativeAssets = async (activeSession, offset = 0) => {
    const result = await baseStartNativeAssets(activeSession, offset);
    if (!result) return false;
    playback.transportOffset = Math.max(0, Number(offset) || 0);
    playback.transportStartedAt = playback.audio.context?.currentTime ?? 0;
    if (playback.nativeSyncTimer) playback.timers.clearInterval(playback.nativeSyncTimer);
    playback.nativeSyncTimer = playback.timers.setInterval(() => {
      const media = [...playback.nativeStems.values()];
      if (!media.length) return;
      const leader = media[0];
      const duration = loopSeconds(activeSession);
      if (activeSession.loopEnabled && leader.currentTime >= duration) {
        for (const element of media) element.currentTime %= duration;
      }
      const transportPosition = playback.spectraTransport?.running
        ? playback.spectraTransport.position()
        : null;
      const target =
        transportPosition == null
          ? leader.currentTime
          : activeSession.loopEnabled
            ? transportPosition % duration
            : transportPosition;
      for (const element of media) {
        if (Math.abs(element.currentTime - target) > 0.12) element.currentTime = target;
      }
    }, 500);
    return true;
  };

  const basePlay = playback.play.bind(playback);
  playback.play = async (activeSession, offset = 0, options = {}) => {
    enhanceSession(activeSession);
    const result = await basePlay(activeSession, offset, options);
    playback.transportOffset = Math.max(0, Number(offset) || 0);
    playback.transportStartedAt = playback.audio.context?.currentTime ?? 0;
    return result;
  };

  const baseRenderPerformance = playback.renderPerformance.bind(playback);
  playback.renderPerformance = (stem, step, when) => {
    const activeSession = playback.session ?? session;
    if (!activeSession.loopEnabled) return baseRenderPerformance(stem, step, when);
    return baseRenderPerformance(stem, step % playback.loopSteps(activeSession), when);
  };

  const baseUpdateMix = playback.updateMix.bind(playback);
  playback.updateMix = (activeSession = session, options = {}) => {
    enhanceSession(activeSession);
    return baseUpdateMix(activeSession, options);
  };

  const baseStop = playback.stop.bind(playback);
  playback.stop = () => {
    if (playback.nativeSyncTimer) playback.timers.clearInterval(playback.nativeSyncTimer);
    playback.nativeSyncTimer = null;
    playback.transportOffset = 0;
    playback.transportStartedAt = 0;
    return baseStop();
  };
}

const cleanProjectName = (value, fallback = 'Untitled Spectra Session') => {
  const name = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64);
  return name || fallback;
};

function projectId() {
  return `spectra-project-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff)
    .toString(36)
    .padStart(3, '0')}`;
}

function projectById(game, id) {
  return (game.state.data.studioProjects ?? []).find((project) => project.id === id) ?? null;
}

function currentProject(game) {
  return projectById(game, game.state.data.activeStudioProjectId);
}

async function freezePerformanceStems(game, session, stems, { persist = true } = {}) {
  const candidates = (stems ?? []).filter((stem) => stem?.performance?.events?.length);
  let rendered = 0;
  let failed = 0;
  const projectId = persist ? game.state?.data?.activeStudioProjectId : null;

  for (const stem of candidates) {
    try {
      const frozen = await game.studioExporter?.renderPerformanceStem?.(session, stem.id);
      if (!frozen?.buffer) throw new Error('Offline render returned no audio buffer.');
      session.attachRecording(stem.id, frozen.buffer, frozen.blob ?? null);
      stem.renderedAudio = true;
      stem.renderedAudioAt = Date.now();
      if (projectId && frozen.blob) {
        await game.spectraProjectStore?.put?.(projectId, stem.id, frozen.blob);
      }
      rendered += 1;
    } catch {
      stem.renderedAudio = false;
      stem.renderedAudioAt = null;
      failed += 1;
    }
  }

  if (projectId) {
    const active = projectById(game, projectId);
    if (active) {
      active.session = session.snapshot();
      active.updatedAt = Date.now();
    }
  }
  game.save?.();
  return { rendered, failed };
}

async function ensureFrozenPerformanceAudio(game, session) {
  const missing = (session?.stems ?? []).filter(
    (stem) =>
      stem.renderedAudio === true &&
      stem.performance?.events?.length &&
      !session.recordings?.has?.(stem.id),
  );
  if (!missing.length) return { rendered: 0, failed: 0 };
  return freezePerformanceStems(game, session, missing, { persist: true });
}

function currentSessionHasMaterial(game) {
  return (
    game.studio.takeCounter > 0 ||
    game.studio.stems.some(
      (stem) => stem.assetId || stem.performance || game.studio.recordings.has(stem.id),
    )
  );
}

function instrumentProjectSnapshot(game) {
  return {
    drumMachine: normalizeDrumMachineState(
      game.drumMachine?.state ?? game.state.data.spectraDrumMachine,
    ),
    modularSynth: normalizeModularPatchState(
      game.modularSynth?.patch ?? game.state.data.modularSynth,
    ),
  };
}

function stopSpectraWorkspace(game) {
  game.spectraRecorder?.cancel?.();
  game.keyboardPerformance?.stop?.(false);
  game.drumMachine?.stopLoop?.(false);
  game.modularSynth?.stopLoop?.(false);
  game.studioPlayback?.stop?.();
  game.spectraTransport?.stop?.();
  game.spectraClipEngine?.pending?.clear?.();
}

async function saveCurrentProject(game, ui, { asNew = false, name = null } = {}) {
  const projects = game.state.data.studioProjects ?? (game.state.data.studioProjects = []);
  const active = currentProject(game);
  const now = Date.now();
  const id = asNew || !active ? projectId() : active.id;
  const projectName = cleanProjectName(name ?? active?.name ?? game.studio.name);
  game.studio.project = true;
  game.studio.name = projectName;
  const session = game.studio.snapshot();
  session.project = true;
  session.name = projectName;
  const instruments = instrumentProjectSnapshot(game);
  const project = {
    id,
    name: projectName,
    createdAt: active && !asNew ? active.createdAt || now : now,
    updatedAt: now,
    session,
    ...instruments,
  };

  const existingIndex = projects.findIndex((item) => item.id === id);
  if (existingIndex >= 0) projects[existingIndex] = project;
  else projects.push(project);

  while (projects.length > 24) {
    const removed = projects.shift();
    if (removed?.id) void game.spectraProjectStore?.deleteProject?.(removed.id);
  }

  game.state.data.activeStudioProjectId = id;
  game.save();

  let audioResult = { saved: 0, missing: 0 };
  try {
    audioResult = (await game.spectraProjectStore?.saveSession?.(id, game.studio)) ?? audioResult;
  } catch {
    audioResult.missing += [...game.studio.recordings.keys()].length;
  }

  const detail = audioResult.missing
    ? ` Session data is saved, but ${audioResult.missing} in-memory microphone take${audioResult.missing === 1 ? '' : 's'} could not be persisted.`
    : audioResult.saved
      ? ` ${audioResult.saved} microphone take${audioResult.saved === 1 ? '' : 's'} saved in this browser too.`
      : '';
  ui.warning?.(`Saved Spectra session “${projectName}”.${detail}`);
  return project;
}

async function loadProject(game, ui, id) {
  const project = projectById(game, id);
  if (!project) return false;
  stopSpectraWorkspace(game);
  game.studio.replace({ ...project.session, project: true, name: project.name });
  enhanceSession(game.studio);

  if (game.drumMachine) {
    game.drumMachine.state = normalizeDrumMachineState(project.drumMachine);
    game.drumMachine.persist?.();
  }
  if (game.modularSynth) {
    game.modularSynth.patch = normalizeModularPatchState(project.modularSynth);
    game.modularSynth.persist?.();
  }

  game.state.data.activeStudioProjectId = project.id;
  game.save();

  let restored = { restored: 0, failed: 0 };
  try {
    restored =
      (await game.spectraProjectStore?.restoreSession?.(
        project.id,
        game.studio,
        game.audio?.context,
      )) ?? restored;
  } catch {
    restored.failed += 1;
  }

  await ensureFrozenPerformanceAudio(game, game.studio);
  game.studioPlayback?.updateMix?.(game.studio);
  const detail = restored.restored
    ? ` · restored ${restored.restored} recorded audio clip${restored.restored === 1 ? '' : 's'}`
    : restored.failed
      ? ' · some browser-recorded audio could not be restored'
      : '';
  ui.warning?.(`Opened Spectra session “${project.name}”${detail}.`);
  return true;
}

function showProjectNameEditor(
  game,
  ui,
  {
    title,
    text,
    initial = '',
    confirmLabel = 'SAVE',
    onConfirm,
    back = () => buildSessionManagerPanel(game, ui),
  },
) {
  ui.panel(title, text, []);
  const input = ui.document.createElement('input');
  input.type = 'text';
  input.maxLength = 64;
  input.value = initial;
  input.placeholder = 'Session name';
  input.className = 'spectra-session-name-input';
  input.setAttribute('aria-label', 'Spectra session name');

  const row = ui.document.createElement('div');
  row.className = 'row spectra-session-name-row';
  const confirm = ui.document.createElement('button');
  confirm.type = 'button';
  confirm.textContent = confirmLabel;
  confirm.onclick = async () => {
    const value = cleanProjectName(input.value);
    await onConfirm(value);
  };
  const cancel = ui.document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'CANCEL';
  cancel.onclick = back;
  row.append(confirm, cancel);
  ui.buttons.append(input, row);
  input.onkeydown = (event) => {
    if (event.key === 'Enter') confirm.click();
  };
  input.focus?.();
}

async function createNewProject(game, ui, name) {
  stopSpectraWorkspace(game);
  game.studio.newProject(cleanProjectName(name), 118);
  game.drumMachine && (game.drumMachine.state = normalizeDrumMachineState());
  game.drumMachine?.persist?.();
  game.modularSynth && (game.modularSynth.patch = normalizeModularPatchState());
  game.modularSynth?.persist?.();
  game.state.data.activeStudioProjectId = null;
  game.save();
  await saveCurrentProject(game, ui, { asNew: true, name });
  buildLoopPanel(game, ui);
}

async function duplicateCurrentProject(game, ui) {
  const active = currentProject(game);
  if (!active) return false;
  const copyName = cleanProjectName(`${active.name} copy`);
  const sourceId = active.id;
  const copy = await saveCurrentProject(game, ui, { asNew: true, name: copyName });
  try {
    if (!game.studio.recordingBlobs?.size) {
      await game.spectraProjectStore?.copyProject?.(sourceId, copy.id);
      await game.spectraProjectStore?.restoreSession?.(copy.id, game.studio, game.audio?.context);
    }
  } catch {
    // Metadata/session duplication remains valid even when browser audio storage is unavailable.
  }
  return copy;
}

async function deleteCurrentProject(game, ui) {
  const active = currentProject(game);
  if (!active) return false;
  game.state.data.studioProjects = (game.state.data.studioProjects ?? []).filter(
    (project) => project.id !== active.id,
  );
  game.state.data.activeStudioProjectId = null;
  try {
    await game.spectraProjectStore?.deleteProject?.(active.id);
  } catch {
    // Deleting the JSON project is still useful if IndexedDB is unavailable.
  }
  game.save();
  ui.warning?.(
    `Deleted saved Spectra session “${active.name}”. The open working session remains on the console until you load or create another one.`,
  );
  return true;
}

function buildSessionManagerPanel(game, ui) {
  const projects = game.state.data.studioProjects ?? [];
  const active = currentProject(game);
  const unsaved = !active && currentSessionHasMaterial(game);
  const status = active
    ? `Current: ${active.name} · ${projects.length} saved session${projects.length === 1 ? '' : 's'}`
    : unsaved
      ? `Current working session is not in the named library · ${projects.length} saved session${projects.length === 1 ? '' : 's'}`
      : `No named session is currently open · ${projects.length} saved session${projects.length === 1 ? '' : 's'}`;

  const actions = [
    [
      active ? 'SAVE SESSION' : 'SAVE CURRENT AS SESSION',
      async () => {
        if (active) {
          await saveCurrentProject(game, ui);
          buildSessionManagerPanel(game, ui);
        } else {
          showProjectNameEditor(game, ui, {
            title: 'SAVE SPECTRA SESSION',
            text: 'Name the current song/session. It will remain editable when reopened.',
            initial: game.studio.name === 'Dance Shoes' ? '' : game.studio.name,
            confirmLabel: 'SAVE SESSION',
            onConfirm: async (name) => {
              await saveCurrentProject(game, ui, { asNew: true, name });
              buildSessionManagerPanel(game, ui);
            },
          });
        }
      },
    ],
    [
      'SAVE AS NEW SESSION',
      () =>
        showProjectNameEditor(game, ui, {
          title: 'SAVE SPECTRA SESSION AS',
          text: 'Create a separate editable copy of the current Spectra song.',
          initial: active ? `${active.name} copy` : game.studio.name,
          confirmLabel: 'SAVE AS',
          onConfirm: async (name) => {
            await saveCurrentProject(game, ui, { asNew: true, name });
            buildSessionManagerPanel(game, ui);
          },
        }),
    ],
    [
      'NEW BLANK SESSION',
      () =>
        showProjectNameEditor(game, ui, {
          title: 'NEW SPECTRA SESSION',
          text: unsaved
            ? 'The current working session has not been explicitly saved as a named project. Create a new blank song only if you are ready to replace the working console.'
            : 'Create a blank Spectra song with an empty console, 118 BPM, four-bar loop and fresh attached instruments.',
          initial: '',
          confirmLabel: 'CREATE SESSION',
          onConfirm: (name) => createNewProject(game, ui, name),
        }),
    ],
    ...(active
      ? [
          [
            'RENAME CURRENT SESSION',
            () =>
              showProjectNameEditor(game, ui, {
                title: 'RENAME SPECTRA SESSION',
                text: 'Rename the current saved project.',
                initial: active.name,
                confirmLabel: 'RENAME',
                onConfirm: async (name) => {
                  active.name = name;
                  active.session.name = name;
                  active.updatedAt = Date.now();
                  game.studio.name = name;
                  game.save();
                  buildSessionManagerPanel(game, ui);
                },
              }),
          ],
          [
            'DUPLICATE CURRENT SESSION',
            async () => {
              await duplicateCurrentProject(game, ui);
              buildSessionManagerPanel(game, ui);
            },
          ],
          [
            'DELETE SAVED CURRENT SESSION',
            async () => {
              await deleteCurrentProject(game, ui);
              buildSessionManagerPanel(game, ui);
            },
          ],
        ]
      : []),
    ...[...projects]
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      .map((project) => [
        `${project.id === active?.id ? '✓ ' : ''}OPEN · ${project.name}`,
        async () => {
          await loadProject(game, ui, project.id);
          buildLoopPanel(game, ui);
        },
      ]),
    ['Back to loop / song builder', () => buildLoopPanel(game, ui)],
  ];

  ui.panel(
    'SPECTRA · SESSIONS',
    `${status}. Named sessions preserve the editable console arrangement, clip states, mixer settings, tempo/loop grid, programmed drum machine, modular patch and recorded performances. Browser microphone takes are stored locally on this device when IndexedDB is available.`,
    actions,
  );
}

function cloneSongSnapshot(session) {
  const snapshot = session.snapshot();
  const droppedMicTakes = snapshot.stems.filter(
    (stem) => stem.source === 'browser-microphone' && !stem.assetId && !stem.performance,
  ).length;
  snapshot.stems = snapshot.stems.filter(
    (stem) => stem.source !== 'browser-microphone' || stem.assetId || stem.performance,
  );
  return { snapshot, droppedMicTakes };
}

function saveSongToLibrary(game, ui) {
  const songs = game.state.data.studioSongs ?? (game.state.data.studioSongs = []);
  const { snapshot, droppedMicTakes } = cloneSongSnapshot(game.studio);
  const number = songs.length + 1;
  const song = {
    id: `studio-song-${Date.now()}`,
    name: `${game.studio.name || 'Breakglass Session'} · loop ${number}`,
    savedAt: Date.now(),
    session: snapshot,
  };
  songs.push(song);
  if (songs.length > 8) songs.splice(0, songs.length - 8);
  game.save();
  if (droppedMicTakes) {
    ui.warning?.(
      'Saved the playable loop. Browser-mic audio remains available in the current studio session but is not yet stored in the house song library.',
    );
  } else ui.warning?.(`Saved “${song.name}” to the Breakglass house song library.`);
  return song;
}

function makeSongSession(song) {
  const session = new StudioSession(song.session);
  enhanceSession(session);
  return session;
}

async function playStudioSessionDownstairs(game, session, songId = null) {
  game.dj?.stop?.();
  game.partyLife?.houseDj?.holdForPlayer?.(8);
  game.audio?.stop?.();
  enhanceSession(session);
  const played = await game.studioPlayback.play(session);
  game.activeStudioSongId = played ? songId : null;
  return played;
}

function buildSongLibraryPanel(game, ui, location = 'HOUSE PLAYBACK') {
  const songs = game.state.data.studioSongs ?? [];
  const currentHasMaterial =
    game.studio.takeCounter > 0 ||
    game.studio.stems.some(
      (stem) => stem.assetId || stem.performance || game.studio.recordings.has(stem.id),
    );
  const actions = [
    ...(currentHasMaterial
      ? [
          [
            'Play current studio session',
            async () => {
              await playStudioSessionDownstairs(game, game.studio, 'current');
              buildSongLibraryPanel(game, ui, location);
            },
          ],
        ]
      : []),
    ...[...songs].reverse().map((song) => [
      `Play ${song.name}`,
      async () => {
        await playStudioSessionDownstairs(game, makeSongSession(song), song.id);
        buildSongLibraryPanel(game, ui, location);
      },
    ]),
    [
      'Stop studio playback',
      () => {
        game.studioPlayback.stop();
        game.activeStudioSongId = null;
        buildSongLibraryPanel(game, ui, location);
      },
    ],
    ...(songs.length
      ? [
          [
            'Delete newest saved song',
            () => {
              songs.pop();
              game.save();
              buildSongLibraryPanel(game, ui, location);
            },
          ],
        ]
      : []),
  ];
  ui.panel(
    `${location.toUpperCase()} · STUDIO SONGS`,
    songs.length
      ? `${songs.length} saved studio loop${songs.length === 1 ? '' : 's'} are in the house library. The current studio session can also be auditioned directly, including any in-memory mic takes.`
      : 'No studio loops have been saved to the house library yet. Build one upstairs and use SAVE SONG TO HOUSE LIBRARY. The current studio session can still be auditioned directly.',
    actions,
  );
}

async function sendSpatialMixToTakeABreak(game, ui) {
  ui.warning?.('Rendering eight-channel Spectra installation mix…');
  const rendered = await game.studioExporter.renderSpatialWav(game.studio);
  const active = currentProject(game);
  const id = active?.id
    ? `spectra-installation-${active.id}`
    : `spectra-installation-${Date.now().toString(36)}`;
  const blob = new Blob([rendered.bytes], { type: 'audio/wav' });
  await game.spectraProjectStore.put(`installation:${id}`, 'mix', blob);

  const programs =
    game.state.data.spectraInstallations ?? (game.state.data.spectraInstallations = []);
  const metadata = {
    id,
    label: game.studio.name || active?.name || 'Spectra spatial mix',
    artist: 'Spectra',
    description: 'Eight-channel spatial mix authored in the Spectra control room.',
    sourceProjectId: active?.id ?? null,
    duration: rendered.duration,
    updatedAt: Date.now(),
    kind: 'spectra-spatial',
  };
  const index = programs.findIndex((program) => program.id === id);
  if (index >= 0) programs[index] = metadata;
  else programs.push(metadata);
  if (programs.length > 12) {
    const removed = programs.splice(0, programs.length - 12);
    for (const program of removed) {
      void game.spectraProjectStore.deleteProject(`installation:${program.id}`);
    }
  }

  game.spatialAudio?.setSpectraPrograms?.(programs);
  game.spatialAudio?.setInstallationProgram?.(id);
  game.save();
  ui.warning?.(
    `Sent “${metadata.label}” to Take A Break as an eight-channel installation program.`,
  );
  return metadata;
}

function buildSpatialTrackPanel(game, ui, stemId) {
  const stem = game.studio.stems.find((item) => item.id === stemId);
  if (!stem) return buildSpatialMixerPanel(game, ui);
  stem.spatial = normalizeSpatialPosition(stem.spatial);
  const gains = spatialSpeakerGains(stem.spatial);
  ui.panel(
    `SPECTRA · SPATIAL · ${stem.label.toUpperCase()}`,
    `Drag the track around its own room grid. Speaker energy: ${gains
      .map((gain, index) => `${index + 1}:${Math.round(gain * 100)}`)
      .join(' · ')}. Spread controls how broadly the track occupies the eight-speaker array.`,
    [
      [
        stem.spatial.enabled ? 'SPATIAL TRACK ON · DISABLE' : 'SPATIAL TRACK OFF · ENABLE',
        () => {
          game.spectraSpatialMixer.updatePosition(stem.id, { enabled: !stem.spatial.enabled });
          buildSpatialTrackPanel(game, ui, stem.id);
        },
      ],
      [
        'CENTER TRACK',
        () => {
          game.spectraSpatialMixer.updatePosition(stem.id, { x: 0.5, y: 0.5 });
          buildSpatialTrackPanel(game, ui, stem.id);
        },
      ],
      ['Back to 8-channel mixer', () => buildSpatialMixerPanel(game, ui)],
    ],
  );

  const grid = ui.document.createElement('div');
  grid.className = 'spectra-spatial-grid';
  grid.setAttribute('aria-label', `${stem.label} spatial position`);
  for (const speaker of SPECTRA_SPATIAL_SPEAKERS) {
    const node = ui.document.createElement('div');
    node.className = 'spectra-spatial-speaker';
    node.textContent = speaker.label;
    node.style.left = `${speaker.grid[0] * 100}%`;
    node.style.top = `${speaker.grid[1] * 100}%`;
    grid.appendChild(node);
  }
  const puck = ui.document.createElement('div');
  puck.className = 'spectra-spatial-puck';
  puck.textContent = 'TRACK';
  const positionPuck = () => {
    puck.style.left = `${stem.spatial.x * 100}%`;
    puck.style.top = `${stem.spatial.y * 100}%`;
  };
  positionPuck();
  grid.appendChild(puck);

  const move = (event) => {
    const rect = grid.getBoundingClientRect();
    const point = spatialPositionFromPointer(rect, event.clientX, event.clientY);
    stem.spatial = game.spectraSpatialMixer.updatePosition(stem.id, point) || stem.spatial;
    positionPuck();
  };
  grid.onpointerdown = (event) => {
    grid.setPointerCapture?.(event.pointerId);
    move(event);
  };
  grid.onpointermove = (event) => {
    if (grid.hasPointerCapture?.(event.pointerId)) move(event);
  };
  ui.buttons.appendChild(grid);

  const spread = ui.document.createElement('label');
  spread.className = 'spectra-spatial-spread';
  const readout = ui.document.createElement('span');
  readout.textContent = `SPREAD · ${Math.round(stem.spatial.spread * 100)}%`;
  const slider = ui.document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.value = String(Math.round(stem.spatial.spread * 100));
  slider.oninput = () => {
    stem.spatial =
      game.spectraSpatialMixer.updatePosition(stem.id, {
        spread: Number(slider.value) / 100,
      }) || stem.spatial;
    readout.textContent = `SPREAD · ${slider.value}%`;
  };
  spread.append(readout, slider);
  ui.buttons.appendChild(spread);
}

function buildSpatialMixerPanel(game, ui) {
  const stems = game.studio.stems;
  const preview = game.spectraSpatialMixer?.previewEnabled === true;
  ui.panel(
    'SPECTRA · 8-CHANNEL SPATIAL MIXER',
    `This room mirrors the eight Take A Break speaker channels. Each track has its own spatial grid and spread. ${preview ? 'Eight-speaker room preview is active.' : 'Stereo monitoring is active.'}`,
    [
      [
        preview ? '■ EXIT 8-SPEAKER PREVIEW' : '▶ MONITOR THROUGH 8 SPEAKERS',
        async () => {
          await game.audio?.init?.();
          game.spectraSpatialMixer?.togglePreview?.();
          if (!game.studioPlayback.playing) await game.studioPlayback.play(game.studio);
          buildSpatialMixerPanel(game, ui);
        },
      ],
      ...stems.map((stem) => [
        `POSITION · ${stem.label}`,
        () => buildSpatialTrackPanel(game, ui, stem.id),
      ]),
      [
        'SEND 8CH MIX TO TAKE A BREAK',
        async () => {
          try {
            await sendSpatialMixToTakeABreak(game, ui);
          } catch (error) {
            ui.warning?.(`Spatial render failed: ${error?.message || 'unknown error'}`);
          }
          buildSpatialMixerPanel(game, ui);
        },
      ],
      ['Back to loop / song builder', () => buildLoopPanel(game, ui)],
    ],
  );
}

function buildClipPanel(game, ui) {
  const { studio, studioPlayback, spectraClipEngine } = game;
  const clips = spectraClipEngine?.clips?.() ?? [];
  const transport = game.spectraTransport?.snapshot?.();
  const clock = transport?.running
    ? `bar ${transport.bar} · beat ${transport.beat} · ${Math.round(transport.bpm)} BPM`
    : 'clock stopped';

  const actions = [
    [
      studioPlayback.playing ? '■ STOP CLIP PLAYBACK' : '▶ PLAY CURRENT CLIPS',
      async () => {
        if (studioPlayback.playing) studioPlayback.stop();
        else await studioPlayback.play(studio);
        buildClipPanel(game, ui);
      },
    ],
    ...clips.map((clip) => {
      const queued =
        clip.queued == null ? '' : clip.queued ? ' · QUEUED TO START' : ' · QUEUED TO STOP';
      const label =
        clip.queued == null
          ? clip.active
            ? `■ STOP NEXT BAR · ${clip.label}`
            : `▶ LAUNCH NEXT BAR · ${clip.label}`
          : `CANCEL / FLIP QUEUE · ${clip.label}`;
      return [
        `${label}${queued}`,
        () => {
          spectraClipEngine.toggle(clip.id);
          buildClipPanel(game, ui);
        },
      ];
    }),
    [
      '▶ LAUNCH ALL NEXT BAR',
      () => {
        spectraClipEngine?.queueAll?.(true);
        buildClipPanel(game, ui);
      },
    ],
    [
      '■ STOP ALL NEXT BAR',
      () => {
        spectraClipEngine?.queueAll?.(false);
        buildClipPanel(game, ui);
      },
    ],
    ['Back to loop / song builder', () => buildLoopPanel(game, ui)],
  ];

  ui.panel(
    'SPECTRA · QUANTIZED CLIP LAUNCHER',
    `${clock}. Every console stem is also a Spectra clip. Step sequences, live performances and audio/sample loops launch or stop together on bar boundaries while retaining their own mixer channel.`,
    actions,
  );
}

function buildLoopPanel(game, ui) {
  const { studio, studioPlayback } = game;
  enhanceSession(studio);
  const recorder = game.spectraRecorder;
  const recordStatus = recorder?.status?.() ?? {
    armed: false,
    recording: false,
    lanes: 0,
    events: 0,
  };
  const transportStatus = game.spectraTransport?.snapshot?.();
  const clockLabel = transportStatus?.running
    ? `CLOCK BAR ${transportStatus.bar} · BEAT ${transportStatus.beat} · STEP ${transportStatus.sixteenth} · ${Math.round(transportStatus.bpm)} BPM`
    : `CLOCK STOPPED · ${Math.round(studio.bpm)} BPM`;
  const status = `${clockLabel} · ${studio.loopEnabled ? 'LOOP ON' : 'LOOP OFF'} · ${studio.loopBars} bars · ${studio.quantize} grid · swing ${Math.round(studio.swing * 100)}% · ${
    recordStatus.armed
      ? recordStatus.recording
        ? `RECORDING ${recordStatus.lanes} live track${recordStatus.lanes === 1 ? '' : 's'}`
        : 'ARMED · waiting for first note'
      : 'live recorder idle'
  }`;
  const actions = [
    ['OPEN SPECTRA SESSIONS', () => buildSessionManagerPanel(game, ui)],
    ['OPEN 8-CHANNEL SPATIAL MIXER', () => buildSpatialMixerPanel(game, ui)],
    ['OPEN QUANTIZED CLIP LAUNCHER', () => buildClipPanel(game, ui)],
    [
      transportStatus?.running ? '■ STOP SPECTRA MASTER CLOCK' : '▶ START SPECTRA MASTER CLOCK',
      () => {
        if (game.spectraTransport?.running) {
          game.spectraTransport.stop();
        } else {
          game.spectraTransport?.acquire?.('manual-transport', { position: 0 });
        }
        buildLoopPanel(game, ui);
      },
    ],
    [
      '↺ RESTART CLOCK AT BAR 1',
      () => {
        game.spectraTransport?.restart?.(0);
        buildLoopPanel(game, ui);
      },
    ],
    [
      'BPM −5',
      () => {
        game.spectraTransport?.setTempo?.(studio.bpm - 5);
        game.save();
        buildLoopPanel(game, ui);
      },
    ],
    [
      'BPM +5',
      () => {
        game.spectraTransport?.setTempo?.(studio.bpm + 5);
        game.save();
        buildLoopPanel(game, ui);
      },
    ],
    [
      'RECORDING IS CONTROLLED FROM THE SPECTRA CONSOLE',
      () => {
        ui.warning?.(
          'Arm channels and use the master RECORD button on the Spectra console. Instruments stay input-monitored automatically.',
        );
      },
    ],
    [
      studio.loopEnabled ? 'Disable loop' : 'Enable loop',
      async () => {
        studio.setLoopEnabled(!studio.loopEnabled);
        game.spectraTransport?.reconfigure?.();
        if (studioPlayback.playing) await studioPlayback.play(studio);
        game.save();
        buildLoopPanel(game, ui);
      },
    ],
    ...LOOP_BARS.map((bars) => [
      `${studio.loopBars === bars ? '✓ ' : ''}${bars} bar${bars === 1 ? '' : 's'}`,
      async () => {
        if (game.spectraTransport) game.spectraTransport.setLoopBars(bars);
        else studio.setLoopBars(bars);
        studio.setLoopEnabled(true);
        if (studioPlayback.playing) await studioPlayback.play(studio);
        game.save();
        buildLoopPanel(game, ui);
      },
    ]),
    [
      'Quantize latest take',
      () => {
        if (!studio.quantizeLatestTake()) ui.warning?.('Record a playable take first.');
        game.save();
        buildLoopPanel(game, ui);
      },
    ],
    [
      'Duplicate latest take',
      () => {
        if (!studio.duplicateLatestTake()) ui.warning?.('No take is available to duplicate.');
        game.save();
        buildLoopPanel(game, ui);
      },
    ],
    [
      'Delete latest take',
      () => {
        if (!studio.removeLatestTake()) ui.warning?.('There are no recorded takes to remove.');
        game.save();
        buildLoopPanel(game, ui);
      },
    ],
    [
      'EXPORT MIX WAV',
      async () => {
        try {
          ui.warning?.('Rendering Spectra mix offline…');
          const result = await game.studioExporter.exportMix(studio);
          ui.warning?.(`Exported ${result.filename} · ${result.duration.toFixed(1)} seconds.`);
        } catch (error) {
          ui.warning?.(`Track export failed: ${error?.message || 'unknown export error'}`);
        }
        buildLoopPanel(game, ui);
      },
    ],
    [
      'EXPORT SESSION PACK · MIX + STEM WAVS',
      async () => {
        try {
          ui.warning?.('Rendering Spectra mix and individual stems offline…');
          const result = await game.studioExporter.exportSessionPack(studio);
          ui.warning?.(
            `Exported ${result.filename} with the mix + ${result.stems} stem WAV${result.stems === 1 ? '' : 's'}.`,
          );
        } catch (error) {
          ui.warning?.(`Session export failed: ${error?.message || 'unknown export error'}`);
        }
        buildLoopPanel(game, ui);
      },
    ],
    [
      'Save song to house library',
      () => {
        saveSongToLibrary(game, ui);
        buildLoopPanel(game, ui);
      },
    ],
    ['Open house song library', () => buildSongLibraryPanel(game, ui, 'Studio')],
  ];
  ui.panel(
    'STUDIO LOOP / SONG BUILDER',
    `${status}. Record takes into the console, quantize them to the shared loop, duplicate layers, and keep the backing session running while you overdub.`,
    actions,
  );

  const row = ui.document.createElement('div');
  row.className = 'row studio-loop-grid';
  for (const grid of Object.keys(GRID_DIVISIONS)) {
    const button = ui.document.createElement('button');
    button.textContent = `${studio.quantize === grid ? '✓ ' : ''}${grid}`;
    button.onclick = () => {
      if (game.spectraTransport) game.spectraTransport.setQuantize(grid);
      else studio.setQuantize(grid);
      game.save();
      buildLoopPanel(game, ui);
    };
    row.appendChild(button);
  }
  for (const swing of [0, 0.12, 0.24, 0.36]) {
    const button = ui.document.createElement('button');
    button.textContent = `${Math.round(swing * 100)}% SWING`;
    button.onclick = () => {
      if (game.spectraTransport) game.spectraTransport.setSwing(swing);
      else studio.setSwing(swing);
      game.save();
      buildLoopPanel(game, ui);
    };
    row.appendChild(button);
  }
  ui.buttons.appendChild(row);
}

export function installStudioLoopEnhancements(game, ui) {
  const saved = game.state?.data?.studio ?? {};
  game.studio.loopEnabled = saved.loopEnabled === true;
  game.studio.loopBars = LOOP_BARS.includes(Number(saved.loopBars)) ? Number(saved.loopBars) : 4;
  game.studio.quantize = GRID_DIVISIONS[saved.quantize] ? saved.quantize : '1/16';
  game.studio.swing = clamp(saved.swing, 0, 0.45);
  game.studio.clickEnabled = saved.clickEnabled === true;
  enhanceSession(game.studio);
  game.spectraTransport ??= new SpectraTransport(game.audio, game.studio);
  game.spectraClipEngine ??= new SpectraClipEngine(game);
  game.studioPlayback.spectraTransport = game.spectraTransport;
  game.keyboardPerformance.spectraTransport = game.spectraTransport;
  game.micRecorder.spectraTransport = game.spectraTransport;
  enhancePlayback(game.studioPlayback, game.studio, game);
  game.spectraRecorder ??= new SpectraRecorder(game, ui);
  connectKeyboardPerformanceToSpectra(game);
  game.studioExporter ??= new StudioExporter(game);
  game.spectraProjectStore ??= new SpectraProjectStore();
  game.spectraSpatialMixer ??= new SpectraSpatialMixer(game);
  game.studioPlayback.spatialMixer = game.spectraSpatialMixer;
  game.spatialAudio?.setSpectraPrograms?.(game.state.data.spectraInstallations ?? []);
  game.spatialAudio?.setSpectraProgramProvider?.(async (programId, context) => {
    const items = await game.spectraProjectStore.list(`installation:${programId}`);
    const blob = items.find((item) => item.stemId === 'mix')?.blob;
    if (!blob) return null;
    return context.decodeAudioData(await blob.arrayBuffer());
  });
  const activeProjectId = game.state.data.activeStudioProjectId;
  if (activeProjectId) {
    void game.spectraProjectStore
      .restoreSession(activeProjectId, game.studio, game.audio?.context)
      .then(async () => {
        await ensureFrozenPerformanceAudio(game, game.studio);
        game.studioPlayback?.updateMix?.(game.studio);
      })
      .catch(() => {});
  } else {
    void ensureFrozenPerformanceAudio(game, game.studio)
      .then(() => game.studioPlayback?.updateMix?.(game.studio))
      .catch(() => {});
  }
  game.showStudioLoopBuilder = () => buildLoopPanel(game, ui);
  game.showSpectraSessions = () => buildSessionManagerPanel(game, ui);
  game.showStudioSongLibrary = (location = 'House playback') =>
    buildSongLibraryPanel(game, ui, location);

  if (!game.interactions._studioSongPlayerPatched) {
    const baseDispatch = game.interactions.dispatch.bind(game.interactions);
    game.interactions.dispatch = (target) => {
      if (target?.action === 'studioSongPlayer') {
        buildSongLibraryPanel(game, ui, target.location ?? target.name ?? 'House playback');
        return;
      }
      baseDispatch(target);
    };
    game.interactions._studioSongPlayerPatched = true;
  }

  if (!ui._studioLoopBuilderPatched && typeof ui.studioMixer === 'function') {
    const baseStudioMixer = ui.studioMixer.bind(ui);
    ui.studioMixer = (session, options = {}) => {
      const recorder = game.spectraRecorder;
      const recordStatus = recorder?.status?.() ?? {
        armed: false,
        recording: false,
        lanes: 0,
        events: 0,
      };
      const onRecord = async () => {
        if (recorder?.armed) {
          const committed = recorder.stop({ commit: true });
          if (committed.length) {
            ui.warning?.(
              `Rendering ${committed.length} recorded channel${committed.length === 1 ? '' : 's'} to audio…`,
            );
            const frozen = await freezePerformanceStems(game, session, committed);
            await game.audio?.init?.();
            game.drumMachine?.stopLoop?.(false);
            game.modularSynth?.stopLoop?.(false);
            await game.studioPlayback?.play?.(session, 0, { restartTransport: true });
            game.save?.();
            if (frozen.failed) {
              ui.warning?.(
                `Recorded ${committed.length} loop${committed.length === 1 ? '' : 's'}. ${frozen.rendered} rendered to audio; ${frozen.failed} remains on event-playback fallback because offline rendering was unavailable.`,
              );
            } else {
              ui.warning?.(
                `Recorded and rendered ${frozen.rendered} audio loop${frozen.rendered === 1 ? '' : 's'} into the armed channel${frozen.rendered === 1 ? '' : 's'} and started playback from bar 1.`,
              );
            }
          } else {
            ui.warning?.('Recording stopped. No events reached the armed channels.');
          }
          return committed;
        }

        const armedTracks =
          session.armedStems?.() ?? session.stems.filter((stem) => stem.recordArm);
        if (!armedTracks.length) {
          ui.warning?.('Arm at least one console channel before pressing RECORD.');
          return false;
        }
        await game.audio?.init?.();
        session.loopEnabled = true;
        const armed = recorder?.arm?.();
        if (!armed) {
          ui.warning?.('Spectra could not arm the selected inputs.');
          return false;
        }
        game.save?.();
        ui.warning?.(
          `RECORD READY · ${armedTracks.map((stem) => stem.label).join(', ')}. Input monitoring stays on.`,
        );
        return true;
      };

      const onTempo = (bpm) => {
        game.spectraTransport?.setTempo?.(bpm);
        game.save?.();
      };
      const onClick = (enabled) => {
        game.spectraTransport?.setClickEnabled?.(enabled);
        game.save?.();
      };

      const onLoopBars = async (bars) => {
        game.spectraTransport?.setLoopBars?.(bars);
        session.loopEnabled = true;
        if (game.studioPlayback?.playing) await game.studioPlayback.play(session, 0);
        game.save?.();
      };
      const meterProvider = () => ({
        ...(game.studioPlayback?.meterSnapshot?.(session) ?? {
          channels: {},
          master: { left: 0, right: 0 },
        }),
        transport: game.spectraTransport?.snapshot?.() ?? null,
      });

      const result = baseStudioMixer(session, {
        ...options,
        onRecord,
        recordStatus,
        onTempo,
        onClick,
        onLoopBars,
        meterProvider,
      });
      const button = ui.document.createElement('button');
      button.type = 'button';
      button.textContent = 'LOOP / SONG BUILDER';
      button.className = 'studio-loop-builder-button';
      button.onclick = () => buildLoopPanel(game, ui);
      ui.buttons?.appendChild(button);

      const spatialButton = ui.document.createElement('button');
      spatialButton.type = 'button';
      spatialButton.textContent = '8CH SPATIAL MIXER';
      spatialButton.className = 'studio-spatial-mixer-button';
      spatialButton.onclick = () => buildSpatialMixerPanel(game, ui);
      ui.buttons?.appendChild(spatialButton);

      const exportButton = ui.document.createElement('button');
      exportButton.type = 'button';
      exportButton.textContent = 'EXPORT TRACK';
      exportButton.className = 'studio-track-export-button';
      exportButton.onclick = async () => {
        try {
          ui.warning?.('Rendering Spectra mix offline…');
          const exported = await game.studioExporter.exportMix(session);
          ui.warning?.(`Exported ${exported.filename}.`);
        } catch (error) {
          ui.warning?.(`Track export failed: ${error?.message || 'unknown export error'}`);
        }
      };
      ui.buttons?.appendChild(exportButton);
      return result;
    };
    ui._studioLoopBuilderPatched = true;
  }

  if (!ui._studioSongDjPatched && typeof ui.djMixer === 'function') {
    const baseDjMixer = ui.djMixer.bind(ui);
    ui.djMixer = (...args) => {
      const result = baseDjMixer(...args);
      const button = ui.document.createElement('button');
      button.type = 'button';
      button.textContent = 'STUDIO SONGS / LOOPS';
      button.onclick = () => buildSongLibraryPanel(game, ui, 'DJ booth');
      ui.buttons?.appendChild(button);
      return result;
    };
    ui._studioSongDjPatched = true;
  }
  return game.studio;
}
