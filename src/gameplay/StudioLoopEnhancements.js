import { SpectraClipEngine } from '../studio/SpectraClipEngine.js';
import { SpectraRecorder } from '../studio/SpectraRecorder.js';
import { StudioExporter } from '../studio/StudioExporter.js';
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

function enhancePlayback(playback, session) {
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
        if (Math.abs(element.currentTime - target) > 0.035) element.currentTime = target;
      }
    }, 120);
    return true;
  };

  const basePlay = playback.play.bind(playback);
  playback.play = async (activeSession, offset = 0) => {
    enhanceSession(activeSession);
    const result = await basePlay(activeSession, offset);
    playback.transportOffset = Math.max(0, Number(offset) || 0);
    playback.transportStartedAt = playback.audio.context?.currentTime ?? 0;
    return result;
  };

  const baseRenderPerformance = playback.renderPerformance.bind(playback);
  playback.renderPerformance = (stem, step, when) => {
    const activeSession = playback.session ?? session;
    if (!activeSession.loopEnabled) return baseRenderPerformance(stem, step, when);
    const performance = stem.performance;
    if (performance?.events?.length) {
      performance.duration = loopSeconds(activeSession);
      performance.bpm = activeSession.bpm;
    }
    return baseRenderPerformance(stem, step % playback.loopSteps(activeSession), when);
  };

  const baseUpdateMix = playback.updateMix.bind(playback);
  playback.updateMix = (activeSession = session) => {
    enhanceSession(activeSession);
    return baseUpdateMix(activeSession);
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
      recordStatus.armed
        ? '■ FINISH LIVE MULTITRACK + BUILD STEMS'
        : '● ARM LIVE MULTITRACK RECORDING',
      () => {
        if (recorder?.armed) {
          const stems = recorder.stop({ commit: true });
          ui.warning?.(
            stems.length
              ? `Spectra built ${stems.length} separate live stem${stems.length === 1 ? '' : 's'} from the jam.`
              : 'No instrument events were captured, so no stems were added.',
          );
        } else {
          recorder?.arm?.();
          ui.warning?.(
            'Spectra is armed. Recording begins on the first instrument note from any player.',
          );
        }
        game.save();
        buildLoopPanel(game, ui);
      },
    ],
    ...(!recordStatus.armed
      ? [
          [
            '● ARM + PLAY LOOP FOR OVERDUB',
            async () => {
              studio.setLoopEnabled(true);
              recorder?.arm?.();
              await studioPlayback.play(studio);
              ui.warning?.(
                'Loop is rolling. Spectra will punch in on the first live instrument note.',
              );
              buildLoopPanel(game, ui);
            },
          ],
        ]
      : [
          [
            'Cancel live multitrack capture',
            () => {
              recorder?.cancel?.();
              buildLoopPanel(game, ui);
            },
          ],
        ]),
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
  enhanceSession(game.studio);
  game.spectraTransport ??= new SpectraTransport(game.audio, game.studio);
  game.spectraClipEngine ??= new SpectraClipEngine(game);
  game.studioPlayback.spectraTransport = game.spectraTransport;
  game.keyboardPerformance.spectraTransport = game.spectraTransport;
  game.micRecorder.spectraTransport = game.spectraTransport;
  enhancePlayback(game.studioPlayback, game.studio);
  game.spectraRecorder ??= new SpectraRecorder(game, ui);
  game.studioExporter ??= new StudioExporter(game);
  game.showStudioLoopBuilder = () => buildLoopPanel(game, ui);
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
      const result = baseStudioMixer(session, options);
      const button = ui.document.createElement('button');
      button.type = 'button';
      button.textContent = 'LOOP / SONG BUILDER';
      button.className = 'studio-loop-builder-button';
      button.onclick = () => buildLoopPanel(game, ui);
      ui.buttons?.appendChild(button);

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
