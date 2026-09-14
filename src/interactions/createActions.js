export function createActions({ audio, sceneManager, player, ui, state, canAct }) {
  const panel = (title, text, actions = []) => {
    const sceneId = sceneManager.current.definition.id;
    ui.panel(
      title,
      text,
      actions.map(([label, action]) => [
        label,
        () => {
          if (canAct() && sceneManager.current.definition.id === sceneId) return action();
        },
      ]),
    );
  };

  const djPanel = () => {
    const rig = sceneManager.current.lighting;
    const lighting = rig?.snapshot();
    const lightStatus = lighting
      ? ` Lighting: ${lighting.preset}, haze ${Math.round(lighting.haze * 100)}%, lasers ${lighting.lasers ? 'on' : 'off'}.`
      : '';
    panel('DJ BOOTH', `Pick a selection. The floor reacts.${lightStatus}`, [
      ['Glass Floor', () => audio.play('glass-floor')],
      ['3AM Tool', () => audio.play('3am-tool')],
      ['Stop decks', () => audio.stop()],
      ...(rig
        ? [
            ['Warmup lights', () => { rig.applyPreset('warmup'); djPanel(); }],
            ['Party lights', () => { rig.applyPreset('party'); djPanel(); }],
            ['Peak lights', () => { rig.applyPreset('peak'); djPanel(); }],
            ['Toggle lasers', () => { rig.toggleLasers(); djPanel(); }],
            ['Haze +', () => { rig.adjustHaze(0.12); djPanel(); }],
            ['Haze −', () => { rig.adjustHaze(-0.12); djPanel(); }],
          ]
        : []),
    ]);
  };

  const actions = {
    drums: () => {
      audio.kick();
      audio.hat(0.11);
    },
    piano: () => audio.chord(220),
    synth: () => {
      audio.tone(329, 0.35, 'sawtooth', 0.07);
      audio.tone(493, 0.27, 'square', 0.04, 0.08);
    },
    console: () =>
      panel('CONTROL ROOM', 'Load a session and hear the room become active.', [
        ['Play Night Bus', () => audio.play('night-bus')],
        ['Stop', () => audio.stop()],
      ]),
    dj: djPanel,
    travel: (target) => sceneManager.request(target.target),
    dialogue: (target) => {
      const dialogue = sceneManager.current.npcs.dialogue(target.id);
      if (!dialogue) return;
      state.meet(target.id);
      panel(dialogue.title, dialogue.text, [['Dance', () => player.dance(80 / 60)]]);
    },
  };

  return (target) => {
    if (canAct()) actions[target.action]?.(target);
  };
}
