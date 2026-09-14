import { DJ_TRACKS } from '../dj/DjMixer.js';
import {
  AMPS,
  BASSES,
  DRUM_KITS,
  GUITARS,
  MICS,
  PROCESSORS,
  SYNTHS,
  gearById,
} from '../studio/gear.js';

export function createActions({
  audio,
  sceneManager,
  player,
  ui,
  state,
  studio,
  studioPlayback,
  micRecorder,
  dj,
  stopAll = () => audio.stop(),
  saveState = () => {},
  canAct,
}) {
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

  const rememberStudio = () => {
    state.data.studio = studio.snapshot();
    saveState();
  };

  const choose = (title, collection, current, onSelect, back) =>
    panel(
      title,
      `Current: ${gearById(collection, current).label}`,
      [
        ...collection.map((item) => [
          `${item.id === current ? '✓ ' : ''}${item.label}`,
          () => {
            onSelect(item);
            rememberStudio();
            back();
          },
        ]),
        ['Back', back],
      ],
    );

  const previewInstrument = () => {
    if (studio.setup.instrumentType === 'bass') {
      const bass = gearById(BASSES, studio.setup.bass);
      const amp = gearById(AMPS, studio.setup.amp);
      const freq = bass.voice === 'round' ? 73.4 : bass.voice === 'woody' ? 65.4 : 82.4;
      const volume = amp.id === 'bass-stack' ? 0.11 : 0.075;
      audio.tone(freq, 0.55, 'sawtooth', volume);
      audio.tone(freq * 2, 0.32, 'triangle', volume * 0.25, 0.03);
    } else {
      const guitar = gearById(GUITARS, studio.setup.guitar);
      const amp = gearById(AMPS, studio.setup.amp);
      const root = guitar.voice === 'warm' ? 196 : guitar.voice === 'acoustic' ? 220 : 247;
      const type = amp.character === 'crunch' ? 'sawtooth' : 'triangle';
      audio.tone(root, 0.42, type, 0.055);
      audio.tone(root * 1.25, 0.45, type, 0.04, 0.018);
      audio.tone(root * 1.5, 0.48, type, 0.035, 0.035);
    }
  };

  const instrumentPanel = () => {
    const type = studio.setup.instrumentType;
    const instrument =
      type === 'bass'
        ? gearById(BASSES, studio.setup.bass)
        : gearById(GUITARS, studio.setup.guitar);
    const amp = gearById(AMPS, studio.setup.amp);
    const mic = gearById(MICS, studio.setup.mic);
    panel(
      'DEAD ROOM · INSTRUMENT RACK',
      `Carrying: ${instrument.label}. Amp: ${amp.label}. Mic: ${mic.label}. Choose an instrument, then walk it over to the amp wall or record the current chain.`,
      [
        [
          'Choose guitar',
          () =>
            choose('CHOOSE A GUITAR', GUITARS, studio.setup.guitar, (item) => {
              studio.select('guitar', item.id);
              studio.setup.instrumentType = 'guitar';
            }, instrumentPanel),
        ],
        [
          'Choose bass',
          () =>
            choose('CHOOSE A BASS', BASSES, studio.setup.bass, (item) => {
              studio.select('bass', item.id);
              studio.setup.instrumentType = 'bass';
            }, instrumentPanel),
        ],
        ['Play current chain', previewInstrument],
        [
          'Record part → console',
          () => {
            const kind = studio.setup.instrumentType;
            const current =
              kind === 'bass'
                ? gearById(BASSES, studio.setup.bass)
                : gearById(GUITARS, studio.setup.guitar);
            studio.addTake(
              kind,
              `${current.label} · ${gearById(AMPS, studio.setup.amp).label}`,
              'generated-performance',
              {
                amp: studio.setup.amp,
                mic: studio.setup.mic,
                eq: studio.setup.eq,
                compressor: studio.setup.compressor,
              },
            );
            rememberStudio();
            instrumentPanel();
          },
        ],
      ],
    );
  };

  const ampPanel = () => {
    const amp = gearById(AMPS, studio.setup.amp);
    const type = studio.setup.instrumentType;
    const instrument =
      type === 'bass'
        ? gearById(BASSES, studio.setup.bass)
        : gearById(GUITARS, studio.setup.guitar);
    panel('DEAD ROOM · AMP WALL', `${instrument.label} is plugged into ${amp.label}.`, [
      [
        'Choose amp',
        () => choose('CHOOSE AN AMP', AMPS, studio.setup.amp, (item) => studio.select('amp', item.id), ampPanel),
      ],
      ['Play through amp', previewInstrument],
      [
        'Record current chain',
        () => {
          studio.addTake(type, `${instrument.label} → ${amp.label}`, 'generated-performance', {
            amp: studio.setup.amp,
            mic: studio.setup.mic,
            eq: studio.setup.eq,
            compressor: studio.setup.compressor,
          });
          rememberStudio();
          ampPanel();
        },
      ],
    ]);
  };

  const micPanel = () => {
    const mic = gearById(MICS, studio.setup.mic);
    const eq = gearById(PROCESSORS.eq, studio.setup.eq);
    const compressor = gearById(PROCESSORS.compressor, studio.setup.compressor);
    panel(
      'MIC LOCKER',
      `Selected: ${mic.label} · ${eq.label} · ${compressor.label}. The mic choice follows you to instrument and vocal recording stations.`,
      [
        [
          'Choose microphone',
          () => choose('CHOOSE A MICROPHONE', MICS, studio.setup.mic, (item) => studio.select('mic', item.id), micPanel),
        ],
        [
          'Choose EQ',
          () => choose('CHOOSE EQ', PROCESSORS.eq, studio.setup.eq, (item) => studio.select('eq', item.id), micPanel),
        ],
        [
          'Choose compressor',
          () =>
            choose(
              'CHOOSE COMPRESSOR',
              PROCESSORS.compressor,
              studio.setup.compressor,
              (item) => studio.select('compressor', item.id),
              micPanel,
            ),
        ],
      ],
    );
  };

  const drumsPanel = () => {
    const kit = gearById(DRUM_KITS, studio.setup.drums);
    panel('LIVE ROOM · DRUM STATION', `Current kit: ${kit.label}.`, [
      [
        'Choose drum kit',
        () => choose('CHOOSE A DRUM KIT', DRUM_KITS, studio.setup.drums, (item) => studio.select('drums', item.id), drumsPanel),
      ],
      [
        'Play kit',
        () => {
          const open = kit.character === 'open';
          audio.kick();
          audio.hat(0.11);
          if (open) audio.hat(0.23);
          if (kit.character === 'electronic') audio.tone(110, 0.12, 'square', 0.06, 0.18);
        },
      ],
      [
        'Record drum take → console',
        () => {
          studio.addTake('drums', kit.label, 'generated-performance', {
            mic: studio.setup.mic,
            eq: studio.setup.eq,
            compressor: studio.setup.compressor,
          });
          rememberStudio();
          drumsPanel();
        },
      ],
    ]);
  };

  const synthPanel = () => {
    const synth = gearById(SYNTHS, studio.setup.synth);
    panel('LIVE ROOM · SYNTH + ORGAN STATION', `Current instrument: ${synth.label}.`, [
      [
        'Choose synth / organ',
        () => choose('CHOOSE KEYS', SYNTHS, studio.setup.synth, (item) => studio.select('synth', item.id), synthPanel),
      ],
      [
        'Play',
        () => {
          const root = synth.id === 'mono-bass' ? 82.4 : synth.id === 'organ' ? 196 : 261.6;
          audio.tone(root, 0.5, synth.wave, 0.065);
          audio.tone(root * 1.25, 0.45, synth.wave, 0.04, 0.03);
          if (synth.id === 'organ') audio.tone(root * 2, 0.6, 'sine', 0.025, 0.05);
        },
      ],
      [
        'Record keys take → console',
        () => {
          studio.addTake('synth', synth.label, 'generated-performance', {
            eq: studio.setup.eq,
            compressor: studio.setup.compressor,
          });
          rememberStudio();
          synthPanel();
        },
      ],
    ]);
  };

  const recordVocal = async () => {
    if (!micRecorder.supported) {
      ui.warning('This browser cannot record the computer microphone here.');
      return;
    }
    await micRecorder.start();
    const mic = gearById(MICS, studio.setup.mic);
    panel(
      'VOCAL TAKE · RECORDING',
      `Recording through your computer microphone, modeled as ${mic.label} → ${gearById(PROCESSORS.eq, studio.setup.eq).label} → ${gearById(PROCESSORS.compressor, studio.setup.compressor).label}.`,
      [
        [
          'Stop + add take',
          async () => {
            const result = await micRecorder.stop();
            if (!result) return;
            const stem = studio.addTake('vocal', `Vocal take ${studio.takeCounter + 1}`, 'browser-microphone', {
              mic: studio.setup.mic,
              eq: studio.setup.eq,
              compressor: studio.setup.compressor,
            });
            if (result.buffer) studio.attachRecording(stem.id, result.buffer);
            else ui.warning('Vocal captured, but this browser could not decode it for in-game playback yet.');
            rememberStudio();
            consolePanel();
          },
        ],
        [
          'Cancel',
          () => {
            micRecorder.cancel();
            consolePanel();
          },
        ],
      ],
    );
  };

  const consolePanel = () => {
    ui.studioMixer(studio, {
      onMix: () => {
        studioPlayback.updateMix(studio);
        rememberStudio();
      },
      onPlay: async () => {
        dj.stop();
        audio.stop();
        await studioPlayback.play(studio);
      },
      onStop: () => studioPlayback.stop(),
      onRecordVocal: recordVocal,
    });
  };

  const appendButton = (label, action) => {
    const button = ui.document.createElement('button');
    button.textContent = label;
    button.onclick = () => Promise.resolve(action()).catch((error) => ui.warning(error.message));
    ui.buttons.appendChild(button);
  };

  const djPanel = () => {
    studioPlayback.stop();
    audio.stop();
    const rig = sceneManager.current.lighting;
    ui.djMixer(dj, DJ_TRACKS, {
      onChange: () => {
        dj.updateVibe();
      },
    });
    if (!rig) return;
    const row = ui.document.createElement('div');
    row.className = 'row';
    ui.buttons.appendChild(row);
    const lightingButton = (label, action) => {
      const button = ui.document.createElement('button');
      button.textContent = label;
      button.onclick = () => {
        action();
        djPanel();
      };
      row.appendChild(button);
    };
    lightingButton('Warmup', () => rig.applyPreset('warmup'));
    lightingButton('Party', () => rig.applyPreset('party'));
    lightingButton('Peak', () => rig.applyPreset('peak'));
    lightingButton('Lasers', () => rig.toggleLasers());
    lightingButton('Haze +', () => rig.adjustHaze(0.15));
    lightingButton('Haze −', () => rig.adjustHaze(-0.15));
    appendButton('Stop both decks', () => {
      dj.stop();
      djPanel();
    });
  };

  const actions = {
    drums: drumsPanel,
    piano: () =>
      panel('LIVE ROOM · PIANO', 'Play the piano or send a new piano part to the session.', [
        ['Play chord', () => audio.chord(220)],
        [
          'Record piano take → console',
          () => {
            studio.addTake('keys', 'Piano', 'generated-performance', {
              mic: studio.setup.mic,
              eq: studio.setup.eq,
              compressor: studio.setup.compressor,
            });
            rememberStudio();
          },
        ],
      ]),
    synth: synthPanel,
    instruments: instrumentPanel,
    amps: ampPanel,
    mics: micPanel,
    console: consolePanel,
    dj: djPanel,
    installation: () =>
      panel(
        'TAKE A BREAK · INSTALLATION',
        'A persistent immersive work lives here even when Below is in rehearsal/off-hours mode. Spatial-media playback comes next.',
        [['Stay a minute', () => player.dance(35 / 60)]],
      ),
    travel: (target) => sceneManager.request(target.target),
    dialogue: (target) => {
      const dialogue = sceneManager.current.npcs.dialogue(target.id);
      if (!dialogue) return;
      state.meet(target.id);
      saveState();
      panel(dialogue.title, dialogue.text, [['Dance', () => player.dance(80 / 60)]]);
    },
  };

  return (target) => {
    if (canAct()) actions[target.action]?.(target);
  };
}
