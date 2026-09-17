import fs from 'node:fs';

function replaceOrThrow(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(needle, replacement);
}

{
  const path = 'src/gameplay/DjAccuracyEnhancements.js';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOrThrow(
    source,
    "    track.bpmAudited = true;\n",
    "    track.bpmAudited = true;\n    track.freeTime = audited.freeTime === true;\n",
    'free-time metadata',
  );
  source = replaceOrThrow(
    source,
    `function patchUi(ui, mixer) {\n  addDesktopMidEq(ui, mixer);\n  addMobileAccuracyUi(ui, mixer);\n}\n`,
    `function markFreeTimeControls(ui, mixer) {\n  const hosts = [...(ui.buttons?.querySelectorAll?.('.dj-deck') ?? [])];\n  hosts.forEach((host, index) => {\n    const deckId = index === 0 ? 'A' : 'B';\n    const state = mixer.snapshot?.().decks?.[deckId];\n    const track = trackById(state?.trackId);\n    for (const option of host.querySelectorAll?.('select option') ?? []) {\n      const optionTrack = trackById(option.value);\n      if (optionTrack?.freeTime) option.textContent = \`${'${'}optionTrack.label} · FREE\`;\n    }\n    if (!track?.freeTime) return;\n    const tempoLabel = [...host.querySelectorAll('label')].find((candidate) =>\n      candidate.textContent.trim().startsWith('Tempo'),\n    );\n    const tempo = tempoLabel?.querySelector('input[type="range"]');\n    if (tempo) tempo.disabled = true;\n    const caption = tempoLabel?.querySelector('span');\n    if (caption) caption.textContent = 'Tempo: FREE · no fixed beat grid';\n    const sync = [...host.querySelectorAll('button')].find(\n      (button) => button.textContent.trim().toLowerCase() === 'sync',\n    );\n    if (sync) {\n      sync.disabled = true;\n      sync.title = 'Free-time recording: beat sync is intentionally unavailable.';\n    }\n  });\n\n  const focusId = mixer._mobileFocusDeck ?? 'A';\n  const focusTrack = trackById(mixer.snapshot?.().decks?.[focusId]?.trackId);\n  for (const option of ui.buttons?.querySelectorAll?.('select option') ?? []) {\n    const optionTrack = trackById(option.value);\n    if (optionTrack?.freeTime) option.textContent = \`${'${'}optionTrack.label} · FREE\`;\n  }\n  if (focusTrack?.freeTime) {\n    const tempo = ui.buttons?.querySelector?.('input[aria-label="TEMPO"]');\n    if (tempo) {\n      tempo.disabled = true;\n      const caption = tempo.closest('label')?.querySelector('span');\n      if (caption) caption.textContent = 'TEMPO FREE · NO FIXED GRID';\n    }\n    for (const button of ui.buttons?.querySelectorAll?.('button') ?? []) {\n      if (button.textContent.trim().toLowerCase() !== 'sync') continue;\n      button.disabled = true;\n      button.title = 'Free-time recording: beat sync is intentionally unavailable.';\n    }\n  }\n}\n\nfunction patchUi(ui, mixer) {\n  addDesktopMidEq(ui, mixer);\n  addMobileAccuracyUi(ui, mixer);\n  markFreeTimeControls(ui, mixer);\n}\n`,
    'free-time UI handling',
  );
  source = replaceOrThrow(
    source,
    "      state.bpmAuditConfidence = track.bpmAuditConfidence ?? null;\n",
    "      state.bpmAuditConfidence = track.bpmAuditConfidence ?? null;\n      state.freeTime = track.freeTime === true;\n",
    'free-time snapshot',
  );
  fs.writeFileSync(path, source);
}

{
  const path = 'src/gameplay/djSyncEnhancements.js';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOrThrow(
    source,
    "  const track = trackById(deck.trackId);\n  const beat = 60 / Math.max(1, track.bpm);\n",
    "  const track = trackById(deck.trackId);\n  if (track.freeTime) return 0;\n  const beat = 60 / Math.max(1, track.bpm);\n",
    'free-time phase',
  );
  source = replaceOrThrow(
    source,
    "    const slaveTrack = trackById(slave.trackId);\n    const min = slaveTrack.bpm * (1 - TEMPO_RANGE);\n",
    "    const slaveTrack = trackById(slave.trackId);\n    const masterTrack = trackById(master.trackId);\n    if (slaveTrack.freeTime || masterTrack.freeTime) {\n      ui?.warning?.('Free-time recordings do not have a fixed beat grid. Mix this one manually.');\n      return false;\n    }\n    const min = slaveTrack.bpm * (1 - TEMPO_RANGE);\n",
    'free-time sync guard',
  );
  source = source.replace("      const masterTrack = trackById(master.trackId);\n      sharedTempo = clamp(\n", "      sharedTempo = clamp(\n");
  fs.writeFileSync(path, source);
}

{
  const path = 'server/multiplayerServer.mjs';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOrThrow(
    source,
    "      low: clamp(deck.low, -1, 1),\n      high: clamp(deck.high, -1, 1),\n",
    "      low: clamp(deck.low, -1, 1),\n      mid: clamp(deck.mid, -1, 1),\n      high: clamp(deck.high, -1, 1),\n",
    'multiplayer mid EQ',
  );
  fs.writeFileSync(path, source);
}
