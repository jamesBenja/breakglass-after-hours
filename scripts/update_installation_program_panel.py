from pathlib import Path

path = Path('src/interactions/createActions.js')
text = path.read_text()
start = text.index('  const installationPanel = () => {')
end = text.index('\n\n  const actions = {', start)
replacement = r'''  const installationPanel = () => {
    const spatial = spatialAudio?.snapshot?.();
    const enabled = spatial?.enabled !== false;
    const program = spatial?.program;
    const level = Math.round((spatial?.level ?? 1) * 100);
    panel(
      'TAKE A BREAK · IMMERSIVE INSTALLATION',
      `Now playing: ${program?.label ?? 'Abstract Drift'}${program?.artist ? ` · ${program.artist}` : ''}. Eight HRTF virtual speakers surround the room and the club is reduced to distant filtered wall bleed. Installation level: ${level}%${enabled ? '.' : ' · MUTED.'}`,
      [
        ['Choose spatial experience', installationProgramPanel],
        [
          'Installation louder',
          () => {
            spatialAudio?.adjustInstallationLevel?.(0.12);
            installationPanel();
          },
        ],
        [
          'Installation quieter',
          () => {
            spatialAudio?.adjustInstallationLevel?.(-0.12);
            installationPanel();
          },
        ],
        [
          spatial?.focus ? 'Exit focus listening' : 'Focus listening mode',
          () => {
            spatialAudio?.setInstallationFocus?.(!spatial?.focus);
            installationPanel();
          },
        ],
        [
          enabled ? 'Mute installation' : 'Activate installation',
          () => {
            spatialAudio?.toggleInstallation?.();
            installationPanel();
          },
        ],
        ...(player ? [['Stay and listen', () => player.dance(35 / 60)]] : []),
      ],
    );
  };

  const installationProgramPanel = () => {
    const spatial = spatialAudio?.snapshot?.();
    const current = spatial?.program;
    const playable = spatial?.programs ?? [];
    const catalogSlots = spatial?.catalogSlots ?? [];
    panel(
      'TAKE A BREAK · SPATIAL PROGRAMS',
      `${current?.label ?? 'Abstract Drift'} is currently loaded. Every program uses the same eight-speaker virtual array, but each has its own sound material, spectral shape and spatial movement.`,
      [
        ...playable.map((program) => [
          `${program.id === current?.id ? '✓ ' : ''}${program.label}${program.artist ? ` · ${program.artist}` : ''}`,
          () => {
            spatialAudio?.setInstallationProgram?.(program.id);
            installationProgramPanel();
          },
        ]),
        ...catalogSlots.map((slot) => [
          `${slot.label} · program bank`,
          () =>
            panel(
              `TAKE A BREAK · ${slot.label.toUpperCase()}`,
              `${slot.description} The playback architecture is ready for these pieces; the actual works still need to be attached.`,
              [['Back to spatial programs', installationProgramPanel]],
            ),
        ]),
        ['Back to installation controls', installationPanel],
      ],
    );
  };'''
path.write_text(text[:start] + replacement + text[end:])
