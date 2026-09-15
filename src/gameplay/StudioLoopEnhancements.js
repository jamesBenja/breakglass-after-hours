const GRID_DIVISIONS = {
  '1/4': 1,
  '1/8': 2,
  '1/16': 4,
};
const LOOP_BARS = [1, 2, 4, 8, 16];
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function loopSeconds(session) {
  return Math.max(0.25, (session.loopBars * 4 * 60) / Math.max(1, session.bpm));
}

function quantizePerformance(session, performance) {
  if (!performance?.events?.length) return performance;
  const divisions = GRID_DIVISIONS[session.quantize] ?? 4;
  const beat = 60 / Math.max(1, session.bpm);
  const grid = beat / divisions;
  const length = loopSeconds(session);
  const swing = clamp(session.swing, 0, 0.45);
  performance.bpm = session.bpm;
  performance.duration = length;
  performance.events = performance.events.map((event) => {
    const raw = Math.max(0, Number(event.time) || 0);
    let step = Math.round(raw / grid);
    let time = step * grid;
    if (step % 2 === 1) time += grid * swing;
    time = ((time % length) + length) % length;
    return { ...event, time };
  });
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
      if (stem.source === 'keyboard-performance' || stem.source === 'browser-microphone') {
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

  playback.loopDuration = () => loopSeconds(session);
  playback.loopSteps = () => Math.max(16, session.loopBars * 16);
  playback.transportPosition = () => {
    if (!playback.audio.context || !playback.playing) return 0;
    const elapsed = Math.max(0, playback.audio.context.currentTime - playback.transportStartedAt);
    if (!session.loopEnabled) return elapsed;
    return elapsed % playback.loopDuration();
  };

  const baseStartAlignedAssets = playback.startAlignedAssets.bind(playback);
  playback.startAlignedAssets = (activeSession, buffers) => {
    baseStartAlignedAssets(activeSession, buffers);
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
  playback.startNativeAssets = async (activeSession) => {
    const result = await baseStartNativeAssets(activeSession);
    if (!result) return false;
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
      const target = leader.currentTime;
      for (const element of media.slice(1)) {
        if (Math.abs(element.currentTime - target) > 0.035) element.currentTime = target;
      }
    }, 120);
    return true;
  };

  const basePlay = playback.play.bind(playback);
  playback.play = async (activeSession) => {
    enhanceSession(activeSession);
    const result = await basePlay(activeSession);
    playback.transportStartedAt = playback.audio.context?.currentTime ?? 0;
    return result;
  };

  const baseRenderPerformance = playback.renderPerformance.bind(playback);
  playback.renderPerformance = (stem, step, when) => {
    if (!session.loopEnabled) return baseRenderPerformance(stem, step, when);
    const performance = stem.performance;
    if (performance?.events?.length) {
      performance.duration = loopSeconds(session);
      performance.bpm = session.bpm;
    }
    return baseRenderPerformance(stem, step % playback.loopSteps(), when);
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
    playback.transportStartedAt = 0;
    return baseStop();
  };
}

function buildLoopPanel(game, ui) {
  const { studio, studioPlayback } = game;
  enhanceSession(studio);
  const status = `${studio.loopEnabled ? 'LOOP ON' : 'LOOP OFF'} · ${studio.loopBars} bars · ${studio.quantize} grid · swing ${Math.round(studio.swing * 100)}%`;
  const actions = [
    [
      studio.loopEnabled ? 'Disable loop' : 'Enable loop',
      async () => {
        studio.setLoopEnabled(!studio.loopEnabled);
        if (studioPlayback.playing) await studioPlayback.play(studio);
        game.save();
        buildLoopPanel(game, ui);
      },
    ],
    ...LOOP_BARS.map((bars) => [
      `${studio.loopBars === bars ? '✓ ' : ''}${bars} bar${bars === 1 ? '' : 's'}`,
      async () => {
        studio.setLoopBars(bars);
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
      studio.setQuantize(grid);
      game.save();
      buildLoopPanel(game, ui);
    };
    row.appendChild(button);
  }
  for (const swing of [0, 0.12, 0.24, 0.36]) {
    const button = ui.document.createElement('button');
    button.textContent = `${Math.round(swing * 100)}% SWING`;
    button.onclick = () => {
      studio.setSwing(swing);
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
  enhancePlayback(game.studioPlayback, game.studio);
  game.showStudioLoopBuilder = () => buildLoopPanel(game, ui);

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
      return result;
    };
    ui._studioLoopBuilderPatched = true;
  }
  return game.studio;
}
