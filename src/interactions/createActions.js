import { showLiveArchivePlayer } from '../archive/LiveArchivePlayer.js';
import { LIVE_FROM_BREAKGLASS, liveArchiveById } from '../archive/liveArchive.js';
import { TAPE_ARCHIVE, tapeArchiveById } from '../archive/tapeArchive.js';
import { DJ_TRACKS } from '../dj/DjMixer.js';
import { STUDIO_SESSION_TEMPLATES } from '../studio/sessionCatalog.js';
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
  spatialAudio,
  sceneManager,
  player,
  ui,
  state,
  studio,
  studioPlayback,
  micRecorder,
  keyboardPerformance,
  photos,
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

  const hasStudio = !!studio;
  const hasDj = !!dj && typeof ui.djMixer === 'function';

  const appendButton = (label, action) => {
    if (!ui.document || !ui.buttons) return;
    const button = ui.document.createElement('button');
    button.textContent = label;
    button.onclick = () => Promise.resolve(action()).catch((error) => ui.warning?.(error.message));
    ui.buttons.appendChild(button);
  };

  const rememberStudio = () => {
    if (!studio || !state) return;
    state.data.studio = studio.snapshot();
    saveState();
  };

  const choose = (title, collection, current, onSelect, back) =>
    panel(title, `Current: ${gearById(collection, current).label}`, [
      ...collection.map((item) => [
        `${item.id === current ? '✓ ' : ''}${item.label}`,
        () => {
          onSelect(item);
          rememberStudio();
          back();
        },
      ]),
      ['Back', back],
    ]);

  const performanceConfig = (kind) => {
    if (kind === 'drums') {
      const kit = gearById(DRUM_KITS, studio.setup.drums);
      return { mode: 'drums', label: kit.label };
    }
    if (kind === 'piano') {
      return {
        mode: 'piano',
        label: 'Piano',
        baseMidi: 48,
        wave: 'triangle',
        duration: 0.72,
        volume: 0.062,
      };
    }
    if (kind === 'synth') {
      const synth = gearById(SYNTHS, studio.setup.synth);
      const baseMidi = synth.id === 'mono-bass' ? 36 : 48;
      return {
        mode: 'synth',
        label: synth.label,
        baseMidi,
        wave: synth.wave,
        duration: synth.id === 'organ' ? 0.78 : 0.46,
        volume: synth.id === 'mono-bass' ? 0.08 : 0.065,
        octaveLayer: synth.id === 'organ',
      };
    }
    const instrumentType = studio.setup.instrumentType;
    const instrument =
      instrumentType === 'bass'
        ? gearById(BASSES, studio.setup.bass)
        : gearById(GUITARS, studio.setup.guitar);
    const amp = gearById(AMPS, studio.setup.amp);
    return {
      mode: instrumentType,
      label: `${instrument.label} → ${amp.label}`,
      baseMidi: instrumentType === 'bass' ? 31 : 43,
      wave:
        amp.character === 'crunch'
          ? 'sawtooth'
          : instrument.voice === 'warm'
            ? 'triangle'
            : 'sawtooth',
      duration: instrumentType === 'bass' ? 0.38 : 0.5,
      volume: amp.id === 'bass-stack' ? 0.085 : 0.06,
      octaveLayer: instrumentType === 'bass',
    };
  };

  const performanceProcessing = (kind) => ({
    ...(kind === 'guitar' || kind === 'bass' ? { amp: studio.setup.amp } : {}),
    ...(kind !== 'synth' ? { mic: studio.setup.mic } : {}),
    eq: studio.setup.eq,
    compressor: studio.setup.compressor,
  });

  const startPerformance = (kind, { record = false, back = () => {}, stemKind = kind } = {}) => {
    if (!keyboardPerformance) return;
    studioPlayback?.stop?.();
    dj?.stop?.();
    const config = performanceConfig(kind);
    keyboardPerformance.start(config, { record });
    const title = record
      ? `${config.label.toUpperCase()} · RECORDING`
      : `${config.label.toUpperCase()} · PLAY`;
    const actions = record
      ? [
          [
            'Finish + add take',
            () => {
              const performance = keyboardPerformance.stop();
              if (!performance?.events?.length) {
                ui.warning?.('No notes were played, so no take was added.');
                back();
                return;
              }
              const stem = studio.addTake(
                stemKind,
                `${config.label} · take ${studio.takeCounter + 1}`,
                'keyboard-performance',
                performanceProcessing(stemKind),
              );
              studio.attachPerformance(stem.id, performance);
              rememberStudio();
              back();
            },
          ],
          [
            'Cancel take',
            () => {
              keyboardPerformance.stop(false);
              back();
            },
          ],
        ]
      : [
          [
            'Stop playing',
            () => {
              keyboardPerformance.stop(false);
              back();
            },
          ],
        ];
    panel(
      title,
      `${keyboardPerformance.instructions}. Your movement controls are temporarily locked so the same keys behave like an instrument.`,
      actions,
    );
  };

  const previewInstrument = () => {
    if (!studio) return;
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
    if (!studio) return;
    const type = studio.setup.instrumentType;
    const instrument =
      type === 'bass'
        ? gearById(BASSES, studio.setup.bass)
        : gearById(GUITARS, studio.setup.guitar);
    const amp = gearById(AMPS, studio.setup.amp);
    const mic = gearById(MICS, studio.setup.mic);
    panel(
      'DEAD ROOM · INSTRUMENT RACK',
      `Carrying: ${instrument.label}. Amp: ${amp.label}. Mic: ${mic.label}. The rack is now playable, not just selectable.`,
      [
        [
          'Choose guitar',
          () =>
            choose(
              'CHOOSE A GUITAR',
              GUITARS,
              studio.setup.guitar,
              (item) => {
                studio.select('guitar', item.id);
                studio.setup.instrumentType = 'guitar';
              },
              instrumentPanel,
            ),
        ],
        [
          'Choose bass',
          () =>
            choose(
              'CHOOSE A BASS',
              BASSES,
              studio.setup.bass,
              (item) => {
                studio.select('bass', item.id);
                studio.setup.instrumentType = 'bass';
              },
              instrumentPanel,
            ),
        ],
        ['Quick audition', previewInstrument],
        [
          'Play with keyboard',
          () => startPerformance(type, { back: instrumentPanel, stemKind: type }),
        ],
        [
          'Record playable take → console',
          () => startPerformance(type, { record: true, back: instrumentPanel, stemKind: type }),
        ],
      ],
    );
  };

  const ampPanel = () => {
    if (!studio) return;
    const amp = gearById(AMPS, studio.setup.amp);
    const type = studio.setup.instrumentType;
    const instrument =
      type === 'bass'
        ? gearById(BASSES, studio.setup.bass)
        : gearById(GUITARS, studio.setup.guitar);
    panel('DEAD ROOM · AMP WALL', `${instrument.label} is plugged into ${amp.label}.`, [
      [
        'Choose amp',
        () =>
          choose(
            'CHOOSE AN AMP',
            AMPS,
            studio.setup.amp,
            (item) => studio.select('amp', item.id),
            ampPanel,
          ),
      ],
      ['Quick audition', previewInstrument],
      ['Play current chain', () => startPerformance(type, { back: ampPanel, stemKind: type })],
      [
        'Record current chain',
        () => startPerformance(type, { record: true, back: ampPanel, stemKind: type }),
      ],
    ]);
  };

  const micPanel = () => {
    if (!studio) return;
    const mic = gearById(MICS, studio.setup.mic);
    const eq = gearById(PROCESSORS.eq, studio.setup.eq);
    const compressor = gearById(PROCESSORS.compressor, studio.setup.compressor);
    panel(
      'MIC LOCKER',
      `Selected: ${mic.label} · ${eq.label} · ${compressor.label}. These choices follow recorded studio takes into the console channel strip.`,
      [
        [
          'Choose microphone',
          () =>
            choose(
              'CHOOSE A MICROPHONE',
              MICS,
              studio.setup.mic,
              (item) => studio.select('mic', item.id),
              micPanel,
            ),
        ],
        [
          'Choose EQ',
          () =>
            choose(
              'CHOOSE EQ',
              PROCESSORS.eq,
              studio.setup.eq,
              (item) => studio.select('eq', item.id),
              micPanel,
            ),
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
    if (!studio) {
      audio.kick();
      audio.hat(0.11);
      return;
    }
    const kit = gearById(DRUM_KITS, studio.setup.drums);
    panel(
      'LIVE ROOM · DRUM STATION',
      `Current kit: ${kit.label}. Play it as seven keyboard pads.`,
      [
        [
          'Choose drum kit',
          () =>
            choose(
              'CHOOSE A DRUM KIT',
              DRUM_KITS,
              studio.setup.drums,
              (item) => studio.select('drums', item.id),
              drumsPanel,
            ),
        ],
        [
          'Play kit with keyboard',
          () => startPerformance('drums', { back: drumsPanel, stemKind: 'drums' }),
        ],
        [
          'Record drum performance → console',
          () =>
            startPerformance('drums', {
              record: true,
              back: drumsPanel,
              stemKind: 'drums',
            }),
        ],
      ],
    );
  };

  const synthPanel = () => {
    if (!studio) {
      audio.tone(329, 0.35, 'sawtooth', 0.07);
      audio.tone(493, 0.27, 'square', 0.04, 0.08);
      return;
    }
    const synth = gearById(SYNTHS, studio.setup.synth);
    panel('LIVE ROOM · SYNTH + ORGAN STATION', `Current instrument: ${synth.label}.`, [
      [
        'Choose synth / organ',
        () =>
          choose(
            'CHOOSE KEYS',
            SYNTHS,
            studio.setup.synth,
            (item) => studio.select('synth', item.id),
            synthPanel,
          ),
      ],
      [
        'Play with keyboard',
        () => startPerformance('synth', { back: synthPanel, stemKind: 'synth' }),
      ],
      [
        'Record keys take → console',
        () =>
          startPerformance('synth', {
            record: true,
            back: synthPanel,
            stemKind: 'synth',
          }),
      ],
    ]);
  };

  const pianoPanel = () => {
    if (!hasStudio) return audio.chord(220);
    panel('LIVE ROOM · PIANO', 'The piano is playable from the computer keyboard.', [
      ['Play piano', () => startPerformance('piano', { back: pianoPanel, stemKind: 'keys' })],
      [
        'Record piano take → console',
        () => startPerformance('piano', { record: true, back: pianoPanel, stemKind: 'keys' }),
      ],
    ]);
  };

  const recordVocal = async () => {
    if (!micRecorder?.supported) {
      ui.warning?.('This browser cannot record the computer microphone here.');
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
            const stem = studio.addTake(
              'vocal',
              `Vocal take ${studio.takeCounter + 1}`,
              'browser-microphone',
              {
                mic: studio.setup.mic,
                eq: studio.setup.eq,
                compressor: studio.setup.compressor,
              },
            );
            if (result.buffer) studio.attachRecording(stem.id, result.buffer);
            else
              ui.warning?.(
                'Vocal captured, but this browser could not decode it for in-game playback yet.',
              );
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

  const sessionLibraryPanel = () => {
    panel(
      'SPECTRA · BREAKGLASS SESSION LIBRARY',
      'Load a Breakglass session onto the console. Multitracks open as separate faders where stems are available; released masters open as a single console channel.',
      [
        ...STUDIO_SESSION_TEMPLATES.map((template) => [
          `${studio.name === template.name ? '✓ ' : ''}${template.label}`,
          () => {
            studioPlayback?.stop?.();
            studio.loadTemplate(template.id);
            rememberStudio();
            consolePanel();
          },
        ]),
        ['Back to console', consolePanel],
      ],
    );
  };

  const consolePanel = () => {
    if (!studio || !studioPlayback || typeof ui.studioMixer !== 'function') {
      panel('CONTROL ROOM', 'Load a session and hear the room become active.', [
        ['Play Night Bus', () => audio.play('night-bus')],
        ['Stop', () => audio.stop()],
      ]);
      return;
    }
    ui.studioMixer(studio, {
      onMix: () => {
        studioPlayback.updateMix(studio);
        rememberStudio();
      },
      onPlay: async () => {
        dj?.stop?.();
        audio.stop();
        await studioPlayback.play(studio);
      },
      onStop: () => studioPlayback.stop(),
      onRecordVocal: recordVocal,
    });
    appendButton('Load Breakglass session', sessionLibraryPanel);
  };

  const djPanel = () => {
    if (!hasDj) {
      panel('DJ BOOTH', 'Pick a selection. The floor reacts.', [
        ['Glass Floor', () => audio.play('glass-floor')],
        ['3AM Tool', () => audio.play('3am-tool')],
        ['Stop decks', () => audio.stop()],
      ]);
      return;
    }
    studioPlayback?.stop?.();
    audio.stop();
    const rig = sceneManager.current.lighting;
    ui.djMixer(dj, DJ_TRACKS, {
      onChange: () => dj.updateVibe(),
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

  const tapeArchivePanel = () => {
    const carrying = tapeArchiveById(state?.data?.archiveTape);
    panel(
      'STORAGE · BREAKGLASS TAPE ARCHIVE',
      carrying
        ? `You are carrying ${carrying.label}. Take it to the tape machine in the historic Neve Suite.`
        : 'Choose a catalogued archive dub, carry the reel object to the Neve Suite and thread it on the tape machine.',
      [
        ...TAPE_ARCHIVE.map((tape) => [
          `${carrying?.id === tape.id ? '✓ ' : ''}Take ${tape.label}`,
          () => {
            state.data.archiveTape = tape.id;
            saveState();
            tapeArchivePanel();
          },
        ]),
        ...(carrying
          ? [
              [
                'Return carried reel',
                () => {
                  state.data.archiveTape = null;
                  saveState();
                  tapeArchivePanel();
                },
              ],
            ]
          : []),
      ],
    );
  };

  const playThreadedTape = async () => {
    const tape = tapeArchiveById(state?.data?.threadedTape);
    if (!tape) return false;
    studioPlayback?.stop?.();
    dj?.stop?.();
    const played = await audio.playAsset?.(tape.assetId, {
      owner: 'archive',
      label: `Tape · ${tape.label}`,
      loop: true,
      vibe: 0.3,
      baseVolume: 0.82,
    });
    if (played) return true;

    // Last-resort signal if the remote media host refuses browser playback. It is explicitly
    // labelled as a prototype rather than pretending to be the archived performance.
    audio.setExternalTransport?.('archive', `Tape · ${tape.label} · prototype signal`, 0.5, {
      vibe: 0.18,
      mixQuality: 0.9,
    });
    const pattern = [1, 1.5, 1.25, 2, 1.125, 1.5, 1.25, 1];
    pattern.forEach((ratio, index) => {
      const when = index * 0.42;
      audio.tone(tape.root * ratio, 0.5, index % 2 ? 'triangle' : 'sine', 0.045, when);
      if (index % 2 === 0)
        audio.tone(tape.root * ratio * 2, 0.25, 'triangle', 0.018, when + 0.03);
    });
    return false;
  };

  const tapeMachinePanel = () => {
    const carrying = tapeArchiveById(state?.data?.archiveTape);
    const threaded = tapeArchiveById(state?.data?.threadedTape);
    panel(
      'HISTORIC NEVE SUITE · TAPE MACHINE',
      threaded
        ? `${threaded.label} is threaded on the machine. Its linked Breakglass archive source is ready for playback.`
        : carrying
          ? `You brought ${carrying.label} from Storage. Thread it onto the machine.`
          : 'The machine is empty. Pick up a reel from the tape archive in Storage.',
      [
        ...(carrying && !threaded
          ? [
              [
                `Thread ${carrying.label}`,
                () => {
                  state.data.threadedTape = carrying.id;
                  state.data.archiveTape = null;
                  saveState();
                  tapeMachinePanel();
                },
              ],
            ]
          : []),
        ...(threaded
          ? [
              ['Play tape', playThreadedTape],
              [
                'Stop tape',
                () => {
                  audio.stopAsset?.('archive');
                  audio.clearExternalTransport?.('archive');
                },
              ],
              [
                'Take reel off machine',
                () => {
                  state.data.archiveTape = threaded.id;
                  state.data.threadedTape = null;
                  audio.stopAsset?.('archive');
                  saveState();
                  tapeMachinePanel();
                },
              ],
            ]
          : []),
      ],
    );
  };

  const liveArchivePanel = () => {
    const loaded = liveArchiveById(state?.data?.liveRoomArchive);
    panel(
      'NEVE · LIVE FROM BREAKGLASS ARCHIVE',
      loaded
        ? `${loaded.label} is loaded. Walk into the Live Room and use the Live From Breakglass screen to play it back.`
        : 'Load a real Live From Breakglass archive session on the Neve. The Live Room screen becomes the playback venue.',
      [
        ...LIVE_FROM_BREAKGLASS.map((session) => [
          `${loaded?.id === session.id ? '✓ ' : ''}${session.label}`,
          () => {
            state.data.liveRoomArchive = session.id;
            saveState();
            liveArchivePanel();
          },
        ]),
        ...(loaded
          ? [
              [
                'Unload session',
                () => {
                  state.data.liveRoomArchive = null;
                  saveState();
                  liveArchivePanel();
                },
              ],
            ]
          : []),
      ],
    );
  };

  const livePlaybackPanel = () => {
    const session = liveArchiveById(state?.data?.liveRoomArchive);
    if (!session) {
      panel(
        'LIVE ROOM · LIVE FROM BREAKGLASS',
        'Nothing is loaded. Go to the historic Neve Suite and choose a Live From Breakglass session from the archive station.',
      );
      return;
    }
    if (!session.youtubeId) {
      panel(
        'LIVE ROOM · LIVE FROM BREAKGLASS',
        `${session.label} is catalogued and loaded, but its playable media has not been attached to this build yet.`,
      );
      return;
    }
    studioPlayback?.stop?.();
    dj?.stop?.();
    audio.stop();
    showLiveArchivePlayer(ui, session, livePlaybackPanel);
  };

  const neveConsolePanel = () => {
    const threaded = tapeArchiveById(state?.data?.threadedTape);
    const live = liveArchiveById(state?.data?.liveRoomArchive);
    panel(
      'HISTORIC NEVE SUITE',
      [
        'The console now faces into the room.',
        threaded ? `${threaded.label} is on the tape machine.` : 'No tape is threaded.',
        live ? `${live.label} is loaded for Live Room screening.` : 'No Live From Breakglass session is loaded.',
      ].join(' '),
      [
        ...(threaded ? [['Monitor threaded tape', playThreadedTape]] : []),
        ['Live From Breakglass archive', liveArchivePanel],
      ],
    );
  };

  const takeNoraPhoto = async () => {
    if (!state?.data?.avatar?.photoConsent) {
      panel(
        'NORA · CAMERA',
        'Your avatar profile has photography turned off, so Nora does not save a persistent image.',
        [['Back', () => actions.dialogue({ id: 'nora', npcId: 'nora' })]],
      );
      return;
    }
    const result = await photos?.capture?.('nora');
    if (!result?.saved) {
      ui.warning?.(
        result?.reason === 'photographer-not-here'
          ? 'Nora needs to be in this room to take the photo.'
          : 'The photo could not be captured here.',
      );
      return;
    }
    ui.photoGallery?.(state.data.photos, 'NORA · NEW PHOTO');
  };

  const alleySocialPanel = () => {
    const alley = sceneManager.current.alley;
    if (!alley) return;
    const snapshot = alley.snapshot();
    panel('BREAKGLASS ALLEY', `${snapshot.occupancy} people are outside. ${snapshot.warning}`, [
      [
        'Talk quietly',
        () => {
          alley.chat(0.025);
          alleySocialPanel();
        },
      ],
      [
        'Get the group excited',
        () => {
          alley.chat(0.22);
          alleySocialPanel();
        },
      ],
      [
        'Remind everyone to keep it down',
        () => {
          alley.quiet(0.24);
          alleySocialPanel();
        },
      ],
    ]);
  };

  const installationPanel = () => {
    const spatial = spatialAudio?.snapshot?.();
    const enabled = spatial?.enabled !== false;
    panel(
      'TAKE A BREAK · IMMERSIVE INSTALLATION',
      `Four HRTF sound emitters occupy the room. Walk around them and the image changes with your position and camera orientation${enabled ? '.' : ' — the installation is currently muted.'} Headphones make the placement clearest, while phone/laptop speakers still reproduce the room-to-room level and filtering changes.`,
      [
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

  const actions = {
    drums: drumsPanel,
    piano: pianoPanel,
    synth: synthPanel,
    instruments: instrumentPanel,
    amps: ampPanel,
    mics: micPanel,
    console: consolePanel,
    dj: djPanel,
    tapeArchive: tapeArchivePanel,
    tapeMachine: tapeMachinePanel,
    neveConsole: neveConsolePanel,
    liveArchive: liveArchivePanel,
    livePlayback: livePlaybackPanel,
    photoWall: () => ui.photoGallery?.(state?.data?.photos ?? []),
    alleySocial: alleySocialPanel,
    installation: installationPanel,
    travel: (target) => sceneManager.request(target.target),
    dialogue: (target) => {
      const id = target.npcId ?? target.id;
      const dialogue = sceneManager.current.npcs?.dialogue?.(id);
      if (!dialogue) return;
      state?.meet?.(id);
      saveState();
      const characterActions = [];
      if (id === 'nora' && photos) characterActions.push(['Pose for a photo', takeNoraPhoto]);
      if (id === 'jace' && sceneManager.current.definition.id === 'upstairs')
        characterActions.push(['Ask about the Neve room', neveConsolePanel]);
      if (id === 'zander' && sceneManager.current.definition.id === 'upstairs')
        characterActions.push(['Check the tape machine', tapeMachinePanel]);
      if (id === 'boogaloo' && sceneManager.current.definition.id === 'upstairs')
        characterActions.push(['Play the synth', synthPanel]);
      panel(dialogue.title, dialogue.text, [
        ...characterActions,
        ...(player ? [['Dance', () => player.dance(80 / 60)]] : []),
      ]);
    },
  };

  return (target) => {
    if (canAct()) actions[target.action]?.(target);
  };
}
