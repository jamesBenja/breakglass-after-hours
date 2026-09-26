import { showLiveArchivePlayer } from '../archive/LiveArchivePlayer.js';
import { LIVE_FROM_BREAKGLASS, liveArchiveById } from '../archive/liveArchive.js';
import { TAPE_ARCHIVE, tapeArchiveById } from '../archive/tapeArchive.js';
import { DJ_TRACKS } from '../dj/DjMixer.js';
import { progressionHint } from '../gameplay/guidance.js';
import {
  MIXING_CHALLENGES,
  createReferenceMix,
  feedbackForMix,
  mixingChallengeById,
  mixingGameComplete,
  nextMixingChallenge,
  scoreMix,
  startMixingChallenge,
} from '../studio/MixingChallenge.js';
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
  let activeMixChallengeId = null;

  const syncProgression = () => sceneManager.current?.progressionGates?.sync?.(state?.data ?? {});

  const escortToGuide = (guideId, npcId) => {
    const level = sceneManager.current;
    const guide = level?.definition?.guidePoints?.[guideId];
    if (!level || !guide || !player) return false;
    player.spawn(guide.player, level.collision);
    const npc = level.npcs?.get?.(npcId);
    if (npc?.group) {
      npc.group.position.fromArray(guide.npc);
      npc.group.rotation.y = Math.atan2(
        player.position.x - npc.group.position.x,
        player.position.z - npc.group.position.z,
      );
    }
    return true;
  };

  const progressionDoorPanel = (target) =>
    panel(
      (target?.name ?? 'LOCKED').toUpperCase(),
      progressionHint(target?.progression, state?.data?.difficulty),
    );

  const appendButton = (label, action) => {
    if (!ui.document || !ui.buttons) return;
    const button = ui.document.createElement('button');
    button.textContent = label;
    button.onclick = () => Promise.resolve(action()).catch((error) => ui.warning?.(error.message));
    ui.buttons.appendChild(button);
  };

  let studioSaveTimer = null;
  const rememberStudio = ({ defer = false } = {}) => {
    if (!studio || !state) return;
    const write = () => {
      studioSaveTimer = null;
      state.data.studio = studio.snapshot();
      saveState();
    };
    if (!defer) {
      if (studioSaveTimer != null) globalThis.clearTimeout?.(studioSaveTimer);
      write();
      return;
    }
    if (studioSaveTimer != null) globalThis.clearTimeout?.(studioSaveTimer);
    studioSaveTimer = globalThis.setTimeout?.(write, 180) ?? null;
  };

  const monitorStudio = async (stemId = null) => {
    if (!studio || !studioPlayback) return false;

    if (!audio.context) await audio.init?.();
    await audio.recoverAfterMicrophoneCapture?.();

    return studioPlayback.play(studio, 0, {
      ...(stemId ? { stemId } : {}),
      restartTransport: true,
    });
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
        volume: synth.id === 'mono-bass' ? 0.1 : synth.id === 'organ' ? 0.095 : 0.09,
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

  const startPerformance = (kind, { back = () => {}, stemKind = kind } = {}) => {
    if (!keyboardPerformance) return;
    dj?.stop?.();
    const inputKey =
      kind === 'drums'
        ? 'drum-kit'
        : kind === 'piano' || stemKind === 'keys'
          ? 'piano'
          : kind === 'guitar' || kind === 'bass'
            ? 'guitar'
            : 'synth';
    const config = {
      ...performanceConfig(kind),
      stemKind,
      inputKey,
      processing: performanceProcessing(stemKind),
    };
    keyboardPerformance.start(config, { record: false });
    panel(
      `${config.label.toUpperCase()} · PLAY`,
      `${keyboardPerformance.instructions}. Input monitoring is always on. To record this instrument, arm its Spectra console channel and use the master RECORD button on the console.`,
      [
        [
          'Stop playing',
          () => {
            keyboardPerformance.stop(false);
            back();
          },
        ],
        [
          'Spectra mixer',
          () => {
            keyboardPerformance.stop(false);
            consolePanel();
          },
        ],
      ],
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
        ['Spectra mixer', consolePanel],
      ],
    );
  };

  const openGuitarPanel = () => {
    studio.setup.instrumentType = 'guitar';
    rememberStudio();
    instrumentPanel();
  };

  const openBassPanel = () => {
    studio.setup.instrumentType = 'bass';
    rememberStudio();
    instrumentPanel();
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
      ['Spectra mixer', consolePanel],
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
        ['Spectra mixer', consolePanel],
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
      ['Spectra mixer', consolePanel],
    ]);
  };

  const pianoPanel = () => {
    if (!hasStudio) return audio.chord(220);
    panel('LIVE ROOM · PIANO', 'The piano is playable from the computer keyboard.', [
      ['Play piano', () => startPerformance('piano', { back: pianoPanel, stemKind: 'keys' })],
      ['Spectra mixer', consolePanel],
    ]);
  };

  let connectedVocalStemId = null;
  let selectedVocalStemId = null;

  const vocalTracks = () => studio?.stems?.filter((stem) => stem.inputKey === 'vocal') ?? [];

  const ensureVocalTrack = () => {
    const existing =
      vocalTracks().find((stem) => stem.id === 'input-vocal') ?? vocalTracks()[0] ?? null;
    if (existing) return existing;
    const added = studio?.addInputTrack?.('vocal') ?? null;
    if (added) {
      connectedVocalStemId = added.id;
      selectedVocalStemId = added.id;
      rememberStudio();
      studioPlayback?.updateMix?.(studio, { immediate: true });
    }
    return added;
  };

  const connectedVocalTrack = () => {
    const connected = vocalTracks().find((stem) => stem.id === connectedVocalStemId);
    if (connected) return connected;
    const fallback = ensureVocalTrack();
    if (fallback) connectedVocalStemId = fallback.id;
    return fallback;
  };

  const recordingVocalTrack = () => {
    const armed = vocalTracks().find((stem) => stem.recordArm === true);
    return armed ?? connectedVocalTrack();
  };

  const selectedVocalTrack = () => {
    const selected = vocalTracks().find((stem) => stem.id === selectedVocalStemId);
    if (selected) return selected;
    const connected = connectedVocalTrack();
    if (connected) selectedVocalStemId = connected.id;
    return connected;
  };

  const vocalConnectionPanel = () => {
    const tracks = vocalTracks();
    const connected = connectedVocalTrack();
    panel(
      'SPECTRA VOCAL · CONNECTION',
      `Phone/computer microphone input. Connected destination: ${connected?.label ?? 'none'}. An armed Vocal channel takes priority over the selected connection.`,
      [
        ...tracks.map((stem) => [
          `${stem.id === connected?.id ? '✓ ' : ''}Connect to ${stem.label}`,
          () => {
            connectedVocalStemId = stem.id;
            selectedVocalStemId = stem.id;
            vocalPanel();
          },
        ]),
        [
          '+ New Vocal track',
          () => {
            const stem = studio.addInputTrack('vocal');
            if (!stem) {
              ui.warning?.('Could not add another Vocal track.');
              return;
            }
            connectedVocalStemId = stem.id;
            selectedVocalStemId = stem.id;
            rememberStudio();
            studioPlayback?.updateMix?.(studio, { immediate: true });
            vocalPanel();
          },
        ],
        ['Back to Vocal station', vocalPanel],
        ['Back to Spectra mixer', consolePanel],
      ],
    );
  };

  const startVocalRecording = async () => {
    if (!micRecorder?.supported) {
      ui.warning?.('This browser cannot record its microphone here.');
      return;
    }
    const target = recordingVocalTrack();
    if (!target) {
      ui.warning?.('Add a Vocal track before recording.');
      return;
    }

    // Vocal recording is an overdub operation. The Spectra mix and shared transport must stay
    // alive so the vocalist can perform to the existing track. Only the separate raw-take
    // audition is stopped here; no mixer source, Vocal loop, or transport is torn down.
    const spectraWasPlaying = studioPlayback?.playing === true;
    studioPlayback?.stopRawAudition?.();

    try {
      const started = await micRecorder.start();
      if (!started) return;

      // Opening the mic can move iOS/Safari onto a new hardware route. Keep the transport and
      // backing mix running, but rebuild recorded Vocal BufferSource nodes against that new route;
      // Safari can leave the old nodes logically alive while they produce no sound.
      if (spectraWasPlaying) {
        await studioPlayback?.resyncRecordedVocalPlayback?.(studio, { settleMs: 120 });
      }
    } catch (error) {
      ui.warning?.(`Microphone recording could not start: ${error?.message ?? 'unknown error'}`);
      return;
    }

    panel(
      'SPECTRA VOCAL MIC · RECORDING',
      `Recording the phone/computer microphone directly to ${target.label} while the Spectra mix continues playing. Headphones are recommended to keep the backing track out of the microphone.`,
      [
        [
          `Stop + commit to ${target.label}`,
          async () => {
            let result = null;
            try {
              result = await micRecorder.stop();
            } catch (error) {
              await audio.recoverAfterMicrophoneCapture?.({ settleMs: 0 });
              if (spectraWasPlaying) await studioPlayback?.ensureLivePlaybackRunning?.(studio);
              ui.warning?.(`Vocal recording failed: ${error?.message ?? 'unknown error'}`);
              vocalPanel();
              return;
            }

            await audio.recoverAfterMicrophoneCapture?.({ settleMs: 0 });
            if (spectraWasPlaying) await studioPlayback?.ensureLivePlaybackRunning?.(studio);

            const bytes = Number(result?.blob?.size) || 0;
            if (!bytes) {
              if (spectraWasPlaying) {
                await studioPlayback?.resyncRecordedVocalPlayback?.(studio, { settleMs: 120 });
              }
              ui.warning?.(
                'The microphone opened, but the browser returned a 0-byte recording. Nothing was written to the Vocal track.',
              );
              vocalPanel();
              return;
            }

            const destination =
              studio.stems.find((stem) => stem.id === target.id) ?? recordingVocalTrack();
            if (!destination) {
              if (spectraWasPlaying) {
                await studioPlayback?.resyncRecordedVocalPlayback?.(studio, { settleMs: 120 });
              }
              ui.warning?.('The Vocal destination track no longer exists.');
              vocalPanel();
              return;
            }

            destination.kind = 'vocal';
            destination.inputKey = 'vocal';
            destination.source = 'browser-microphone';
            destination.assetId = null;
            destination.performance = null;
            destination.clipActive = true;
            destination.clipStart = 0;
            destination.sourceOffset = 0;
            destination.sourceDuration = Math.max(
              0,
              Number(result.buffer?.duration) ||
                Number(result.pcmDuration) ||
                Number(result.duration) ||
                0,
            );
            destination.processing = {
              mic: studio.setup.mic,
              eq: studio.setup.eq,
              compressor: studio.setup.compressor,
            };

            // Replace only the destination Vocal source after capture is finished. All other
            // Spectra tracks, including earlier Vocal takes, remain on their existing nodes.
            studioPlayback?.stopRecordedStemPlayback?.(destination.id);
            const committed = studio.replaceRecording?.(
              destination.id,
              result.buffer ?? null,
              result.blob,
            );
            if (!committed || studio.recordingBlobs?.get?.(destination.id) !== result.blob) {
              if (spectraWasPlaying) {
                await studioPlayback?.resyncRecordedVocalPlayback?.(studio, { settleMs: 120 });
              }
              ui.warning?.(
                'The Vocal take was captured but could not be committed to the scrubber.',
              );
              vocalPanel();
              return;
            }

            destination.renderedAudio = !!result.buffer;
            destination.renderedAudioAt = result.buffer ? Date.now() : null;
            destination.vocalCaptureMode =
              result.captureMode ?? (result.buffer ? 'direct-pcm' : 'raw-only');
            destination.vocalRawDuration = Math.max(0, Number(result.duration) || 0);
            destination.vocalPcmDuration = Math.max(
              0,
              Number(result.pcmDuration) || Number(result.buffer?.duration) || 0,
            );
            destination.vocalPcmPeak = Math.max(0, Number(result.pcmPeak) || 0);
            destination.vocalPcmRms = Math.max(0, Number(result.pcmRms) || 0);
            connectedVocalStemId = destination.id;
            selectedVocalStemId = destination.id;
            rememberStudio();
            studioPlayback?.updateMix?.(studio, { immediate: true });

            // Closing the microphone switches iOS back to the playback route. Rebuild all
            // recorded Vocal sources together on that final route, each from its own PCM scrubber
            // start. This repairs older Vocal nodes without restarting any backing track or transport.
            let joinedLiveMix = false;
            let resyncedVocals = 0;
            if (spectraWasPlaying && result.buffer?.duration) {
              resyncedVocals =
                (await studioPlayback?.resyncRecordedVocalPlayback?.(studio, {
                  settleMs: 120,
                })) ?? 0;
              joinedLiveMix = resyncedVocals > 0;
            }

            const pcmSeconds = Math.max(
              0,
              Number(result.pcmDuration) || Number(result.buffer?.duration) || 0,
            );
            const peak = Math.max(0, Number(result.pcmPeak) || 0);
            const signal = peak < 0.001 ? 'near-silent' : `${Math.round(peak * 100)}% peak`;
            ui.warning?.(
              pcmSeconds > 0
                ? `Recorded ${Math.max(1, Math.round(bytes / 1024))} KB to ${destination.label}. Raw file: ${destination.vocalRawDuration.toFixed(2)}s. PCM take: ${pcmSeconds.toFixed(2)}s. Mic signal: ${signal}. Scrubber and Spectra both use the captured PCM.${spectraWasPlaying ? (joinedLiveMix ? ` ${resyncedVocals} Vocal loop${resyncedVocals === 1 ? '' : 's'} rebuilt while the Spectra transport kept running.` : ' The backing mix stayed running; press PLAY only if Vocal playback did not recover automatically.') : ''}`
                : `Recorded ${Math.max(1, Math.round(bytes / 1024))} KB to ${destination.label}, but direct PCM capture was unavailable. The raw MediaRecorder file is retained as fallback.`,
            );
            vocalPanel();
          },
        ],
        [
          'Cancel recording',
          async () => {
            micRecorder.cancel();
            await audio.recoverAfterMicrophoneCapture?.({ settleMs: 0 });
            if (spectraWasPlaying) {
              await studioPlayback?.resyncRecordedVocalPlayback?.(studio, { settleMs: 120 });
            }
            vocalPanel();
          },
        ],
      ],
    );
  };
  const renderVocalSourceEditor = (target) => {
    if (!target || !ui.document || !ui.buttons) return;
    const bufferDuration = Number(studio.recordings?.get?.(target.id)?.duration) || 0;
    const rawDuration = Math.max(
      0,
      Number(target.vocalRawDuration) || Number(target.sourceDuration) || 0,
    );
    const duration = bufferDuration > 0 ? bufferDuration : rawDuration;
    if (!(duration > 0)) return;
    const minimumPlayable = Math.min(0.05, Math.max(0.01, duration * 0.05));
    const maxOffset = Math.max(0, duration - minimumPlayable);
    const requestedOffset = Math.max(0, Number(target.sourceOffset) || 0);
    const selectedOffset = requestedOffset >= duration ? 0 : Math.min(maxOffset, requestedOffset);
    target.sourceOffset = selectedOffset;
    const editor = ui.document.createElement('div');
    editor.className = 'vocal-source-editor';
    const title = ui.document.createElement('strong');
    title.textContent = `${target.label.toUpperCase()} TAKE → SPECTRA LOOP`;
    const readout = ui.document.createElement('span');
    const sessionLoopSeconds =
      (Math.max(1, Number(studio.loopBars) || 4) * 4 * 60) / Math.max(1, Number(studio.bpm) || 118);
    const updateReadout = (value) => {
      const offset = Math.min(maxOffset, Math.max(0, Number(value) || 0));
      const pcmLabel = bufferDuration > 0 ? `${bufferDuration.toFixed(2)}s` : 'UNAVAILABLE';
      const rawLabel = rawDuration > 0 ? `${rawDuration.toFixed(2)}s` : 'UNAVAILABLE';
      const vocalLoopSeconds = Math.max(minimumPlayable, duration - offset);
      readout.textContent = `RAW ${rawLabel} · SPECTRA PCM ${pcmLabel} · START ${offset.toFixed(
        2,
      )}s · VOCAL LOOP ${vocalLoopSeconds.toFixed(2)}s · SESSION ${sessionLoopSeconds.toFixed(2)}s`;
    };
    updateReadout(selectedOffset);
    const slider = ui.document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = String(maxOffset);
    slider.step = '0.01';
    slider.value = String(selectedOffset);
    slider.setAttribute('aria-label', `${target.label} loop start`);
    slider.oninput = () => updateReadout(slider.value);
    slider.onchange = async () => {
      target.sourceOffset = Math.min(maxOffset, Math.max(0, Number(slider.value) || 0));
      rememberStudio();
      updateReadout(target.sourceOffset);

      // A scrubber edit changes only this Vocal clip. Keep the shared Spectra transport, every
      // other instrument, mixer state, FX and spatial routing alive, and restart this Vocal from
      // the newly selected PCM point without adding the song transport phase.
      if (studioPlayback?.playing) {
        const rebuilt = studioPlayback.rebuildRecordedStemPlayback?.(studio, target.id);
        if (rebuilt === false) {
          ui.warning?.('The Vocal loop could not be rebuilt from this take.');
        }
      }
    };
    const help = ui.document.createElement('small');
    help.textContent =
      'Spectra loops the captured PCM continuously from the selected start point to the end of the take. The song transport keeps running independently. The raw MediaRecorder file is retained only as a fallback.';
    const controls = ui.document.createElement('div');
    controls.className = 'vocal-source-editor-controls';
    const auditionFromStart = ui.document.createElement('button');
    auditionFromStart.type = 'button';
    auditionFromStart.textContent = '▶ AUDITION TAKE FROM START';
    auditionFromStart.onclick = async () => {
      await studioPlayback?.auditionRawRecording?.(studio, target.id, 0);
    };
    const auditionSelected = ui.document.createElement('button');
    auditionSelected.type = 'button';
    auditionSelected.textContent = '▶ AUDITION TAKE FROM SELECTED POINT';
    auditionSelected.onclick = async () => {
      const offset = Math.min(maxOffset, Math.max(0, Number(slider.value) || 0));
      target.sourceOffset = offset;
      rememberStudio();
      await studioPlayback?.auditionRawRecording?.(studio, target.id, offset);
    };
    const useCurrent = ui.document.createElement('button');
    useCurrent.type = 'button';
    useCurrent.textContent = 'SET LOOP START TO CURRENT AUDITION';
    useCurrent.onclick = async () => {
      const position = studioPlayback?.rawAuditionPosition?.();
      if (!Number.isFinite(Number(position))) return;
      const offset = Math.min(maxOffset, Math.max(0, Number(position) || 0));
      target.sourceOffset = offset;
      slider.value = String(offset);
      updateReadout(offset);
      rememberStudio();
      const wasSpectraPlaying = studioPlayback?.playing === true;
      studioPlayback?.stopRawAudition?.();
      if (wasSpectraPlaying) {
        const rebuilt = studioPlayback.rebuildRecordedStemPlayback?.(studio, target.id);
        if (rebuilt === false) {
          ui.warning?.('The Vocal loop could not be rebuilt from this take.');
          return;
        }
      } else {
        await monitorStudio(target.id);
      }
      ui.warning?.(`Vocal loop source now starts at ${offset.toFixed(2)}s.`);
    };
    const stopAudition = ui.document.createElement('button');
    stopAudition.type = 'button';
    stopAudition.textContent = '■ STOP TAKE AUDITION';
    stopAudition.onclick = () => studioPlayback?.stopRawAudition?.();
    controls.append(auditionFromStart, auditionSelected, useCurrent, stopAudition);
    editor.append(title, readout, slider, help, controls);
    ui.buttons.prepend(editor);
  };
  const vocalTrackEditorPanel = () => {
    const tracks = vocalTracks();
    const selected = selectedVocalTrack();
    panel(
      'SPECTRA VOCAL · TRACKS',
      'Choose a Vocal track to edit its take and loop start. Changing the editor selection does not mute, solo, reconnect, or restart any Vocal track.',
      [
        ...tracks.map((stem) => {
          const hasTake =
            studio.recordings?.has?.(stem.id) === true ||
            studio.recordingBlobs?.has?.(stem.id) === true;
          return [
            `${stem.id === selected?.id ? '✓ ' : ''}${stem.label}${hasTake ? ' · recorded' : ' · empty'}`,
            () => {
              selectedVocalStemId = stem.id;
              vocalPanel();
            },
          ];
        }),
        ['Back to Vocal station', vocalPanel],
      ],
    );
  };

  const vocalPanel = () => {
    const target = selectedVocalTrack();
    const recordTarget = recordingVocalTrack();
    const mic = gearById(MICS, studio.setup.mic);
    const hasTake =
      !!target &&
      (studio.recordings?.has?.(target.id) === true ||
        studio.recordingBlobs?.has?.(target.id) === true);
    panel(
      'SPECTRA VOCAL STATION · RCA 44',
      `Editing: ${target?.label ?? 'Vocal'}. Phone/computer microphone destination: ${recordTarget?.label ?? 'Vocal'}. Modeled mic chain: ${mic.label} → ${gearById(PROCESSORS.eq, studio.setup.eq).label} → ${gearById(PROCESSORS.compressor, studio.setup.compressor).label}. ${hasTake ? 'This track has a recorded take and its scrubber is shown below.' : 'This track has no take yet.'}`,
      [
        [`Record to ${recordTarget?.label ?? 'Vocal'}`, startVocalRecording],
        ...(vocalTracks().length > 1 ? [['Edit / scrub Vocal track…', vocalTrackEditorPanel]] : []),
        ...(hasTake && target
          ? [
              [
                `▶ Preview ${target.label} in Spectra loop`,
                async () => {
                  await monitorStudio(target.id);
                  vocalPanel();
                },
              ],
              [
                '■ Stop Spectra preview',
                () => {
                  studioPlayback?.stop?.();
                  vocalPanel();
                },
              ],
            ]
          : []),
        ['Connect Vocal mic to track…', vocalConnectionPanel],
        [
          '+ New Vocal track',
          () => {
            const stem = studio.addInputTrack('vocal');
            if (!stem) {
              ui.warning?.('Could not add another Vocal track.');
              return;
            }
            connectedVocalStemId = stem.id;
            selectedVocalStemId = stem.id;
            rememberStudio();
            studioPlayback?.updateMix?.(studio, { immediate: true });
            vocalPanel();
          },
        ],
        ['Spectra mixer', consolePanel],
      ],
    );
    if (hasTake && target) renderVocalSourceEditor(target);
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

  const mixChallengeMenu = () => {
    if (!studio || !studioPlayback) return;
    const completed = new Set(state?.data?.mixingChallengeCompleted ?? []);
    const available = MIXING_CHALLENGES.filter(
      (challenge, index) =>
        index === 0 ||
        completed.has(challenge.id) ||
        completed.has(MIXING_CHALLENGES[index - 1].id),
    );
    const reward = state?.data?.mixingRewardKey === true;
    panel(
      'SPECTRA · MIX MATCH',
      reward
        ? 'All current mix levels are complete. The Spectra master key has opened the direct service stair between the studio and alley.'
        : 'Match the hidden reference mixes by ear. Each level adds another part of the console. Dance Shoes is the temporary multitrack source until more Breakglass stem folders are attached.',
      [
        ...available.map((challenge) => [
          (completed.has(challenge.id) ? '✓ ' : '') +
            'Level ' +
            challenge.level +
            ' · ' +
            challenge.label,
          () => beginMixChallenge(challenge.id),
        ]),
        ['Back to console', consolePanel],
      ],
    );
  };

  const beginMixChallenge = (id) => {
    const challenge = startMixingChallenge(studio, id);
    if (!challenge) return;
    studioPlayback.stop();
    activeMixChallengeId = challenge.id;
    rememberStudio();
    mixChallengeConsolePanel();
  };

  const listenMixReference = async () => {
    const challenge = mixingChallengeById(activeMixChallengeId);
    const reference = createReferenceMix(activeMixChallengeId);
    if (!challenge || !reference) return;
    studioPlayback.stop();
    await studioPlayback.play(reference);
    panel(
      'REFERENCE MIX · LEVEL ' + challenge.level,
      'Listen to the target. The reference uses a separate console snapshot, so your working faders and settings are not overwritten.',
      [
        [
          'Return to my mix',
          () => {
            studioPlayback.stop();
            mixChallengeConsolePanel();
          },
        ],
      ],
    );
  };

  const checkMixChallenge = () => {
    const challenge = mixingChallengeById(activeMixChallengeId);
    if (!challenge) return mixChallengeMenu();
    const result = scoreMix(studio, challenge.id);
    if (!result.pass) {
      const feedback = feedbackForMix(result, state?.data?.difficulty).join(' ');
      panel(
        'MIX CHECK · ' + result.score + '%',
        (feedback || 'The mix is not close enough yet.') +
          ' Listen again, make a few changes and resubmit.',
        [
          ['Keep mixing', mixChallengeConsolePanel],
          ['Hear reference again', listenMixReference],
          ['Restart level', () => beginMixChallenge(challenge.id)],
        ],
      );
      return;
    }

    const completed = state.data.mixingChallengeCompleted ?? [];
    if (!completed.includes(challenge.id)) completed.push(challenge.id);
    state.data.mixingChallengeCompleted = completed;
    const finished = mixingGameComplete(completed);
    if (finished) {
      state.data.mixingRewardKey = true;
      state.data.alleyShortcutUnlocked = true;
      syncProgression();
      saveState();
      panel(
        'SPECTRA MASTER KEY',
        'All mix levels passed. A green service key releases from beneath the console. It unlocks the direct service stair beside Storage, giving you a new route between the studio floor and the alley.',
        [
          [
            'Pocket the key',
            () => {
              activeMixChallengeId = null;
              consolePanel();
            },
          ],
        ],
      );
      return;
    }

    saveState();
    const next = nextMixingChallenge(completed);
    panel(
      'LEVEL ' + challenge.level + ' PASSED · ' + result.score + '%',
      'That mix matches. The next Spectra challenge is now unlocked.',
      [
        ...(next ? [['Start next level', () => beginMixChallenge(next.id)]] : []),
        ['Challenge menu', mixChallengeMenu],
      ],
    );
  };

  const mixChallengeConsolePanel = () => {
    const challenge = mixingChallengeById(activeMixChallengeId);
    if (!challenge || !studio || !studioPlayback || typeof ui.studioMixer !== 'function') {
      mixChallengeMenu();
      return;
    }
    ui.studioMixer(studio, {
      onMix: (stemId = null) => {
        if (stemId) studioPlayback.updateStemMix?.(studio, stemId, { immediate: true });
        else studioPlayback.applyLiveMix?.(studio) ?? studioPlayback.updateMix(studio);
        rememberStudio({ defer: true });
      },
      onPlay: async () => {
        await monitorStudio();
      },
      onStop: () => studioPlayback.stop(),
      onAudition: async (stemId) => monitorStudio(stemId),
    });
    if (ui.title) ui.title.textContent = 'SPECTRA MIX CHALLENGE · LEVEL ' + challenge.level;
    if (ui.text) {
      ui.text.textContent =
        challenge.label +
        '. Match the reference by ear, then submit the mix. Scored controls: ' +
        challenge.parameters.join(', ') +
        '.';
    }
    appendButton('Hear reference mix', listenMixReference);
    appendButton('Check my mix', checkMixChallenge);
    appendButton('Restart level', () => beginMixChallenge(challenge.id));
    appendButton('Exit challenge', () => {
      studioPlayback.stop();
      activeMixChallengeId = null;
      consolePanel();
    });
  };

  const addSpectraTrackPanel = () => {
    if (!studio?.addInputTrack) {
      ui.warning?.('Additional Spectra tracks are unavailable in this session.');
      consolePanel();
      return;
    }
    if ((studio.stems?.length ?? 0) >= 12) {
      panel(
        'SPECTRA · ADD TRACK',
        'This session already has the maximum 12 tracks. Remove or reuse a track before adding another.',
        [['Back to Spectra mixer', consolePanel]],
      );
      return;
    }

    const add = (inputKey, label) => {
      const stem = studio.addInputTrack(inputKey);
      if (!stem) {
        ui.warning?.('Could not add another Spectra track.');
        return;
      }
      rememberStudio();
      studioPlayback?.updateMix?.(studio, { immediate: true });
      ui.warning?.(
        `${stem.label} added with ${label} input monitoring on. Arm that channel when you want to record it.`,
      );
      consolePanel();
    };

    panel(
      'SPECTRA · ADD TRACK',
      'Choose the input for the new channel. The new track is input-monitored immediately and starts unarmed.',
      [
        ['Drum Machine input', () => add('drum-machine', 'Drum Machine')],
        ['Drum Kit input', () => add('drum-kit', 'Drum Kit')],
        ['Synth / Organ input', () => add('synth', 'Synth / Organ')],
        ['Modular Synth input', () => add('modular', 'Modular Synth')],
        ['Guitar / Bass input', () => add('guitar', 'Guitar / Bass')],
        ['Piano input', () => add('piano', 'Piano')],
        ['Vocal / phone mic input', () => add('vocal', 'Vocal / phone mic')],
        ['Back to Spectra mixer', consolePanel],
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

    const external = ui._spectraExternalInstruments ?? {};
    const workspace = ui._spectraWorkspaceNavigation ?? {};
    const renderConsoleFooter = () => {
      appendButton('+ ADD TRACK · CHOOSE INPUT', addSpectraTrackPanel);
      appendButton('DRUM MACHINE', () => external.drumMachine?.());
      appendButton('DRUM KIT', drumsPanel);
      appendButton('SYNTH / ORGAN', synthPanel);
      appendButton('GUITAR', openGuitarPanel);
      appendButton('BASS', openBassPanel);
      appendButton('PIANO', pianoPanel);
      appendButton('VOCAL / MIC', vocalPanel);
      appendButton('MODULAR SYNTH', () => external.modularSynth?.());

      appendButton('SPECTRA SESSIONS · CREATE / SAVE / LOAD', () => workspace.sessions?.());
      appendButton('ADVANCED SPECTRA SETTINGS', () => workspace.advanced?.());
      appendButton('8CH SPATIAL MIXER', () => workspace.spatial?.());
      appendButton('EXPORT TRACK', () => workspace.exportMix?.());
      appendButton('Spectra mix challenge', mixChallengeMenu);
      appendButton('Breakglass session templates', sessionLibraryPanel);
    };

    ui.studioMixer(studio, {
      onMix: (stemId = null) => {
        if (stemId) studioPlayback.updateStemMix?.(studio, stemId, { immediate: true });
        else studioPlayback.applyLiveMix?.(studio) ?? studioPlayback.updateMix(studio);
        rememberStudio({ defer: true });
      },
      onPlay: async () => {
        await monitorStudio();
      },
      onStop: () => studioPlayback.stop(),
      onDeleteTrack: async (stemId) => {
        const removed =
          studioPlayback.removeStem?.(studio, stemId) ?? studio.removeTrack?.(stemId) ?? null;
        if (removed) rememberStudio();
        return removed;
      },
      renderFooter: renderConsoleFooter,
    });
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
    if (played) {
      if (typeof CustomEvent === 'function' && globalThis.dispatchEvent)
        globalThis.dispatchEvent(
          new CustomEvent('breakglass:archive-audio', {
            detail: {
              action: 'play',
              assetId: tape.assetId,
              label: `Tape · ${tape.label}`,
              loop: true,
              vibe: 0.3,
              baseVolume: 0.82,
            },
          }),
        );
      return true;
    }

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
      if (index % 2 === 0) audio.tone(tape.root * ratio * 2, 0.25, 'triangle', 0.018, when + 0.03);
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
                  if (typeof CustomEvent === 'function' && globalThis.dispatchEvent)
                    globalThis.dispatchEvent(
                      new CustomEvent('breakglass:archive-audio', { detail: { action: 'stop' } }),
                    );
                },
              ],
              [
                'Take reel off machine',
                () => {
                  state.data.archiveTape = threaded.id;
                  state.data.threadedTape = null;
                  audio.stopAsset?.('archive');
                  if (typeof CustomEvent === 'function' && globalThis.dispatchEvent)
                    globalThis.dispatchEvent(
                      new CustomEvent('breakglass:archive-audio', { detail: { action: 'stop' } }),
                    );
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
        live
          ? `${live.label} is loaded for Live Room screening.`
          : 'No Live From Breakglass session is loaded.',
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
    // PartyLifePhotoSystem presents the fresh photo immediately with keep/retake/download controls.
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
  };

  ui._spectraStudioNavigation = {
    mixer: consolePanel,
    drumKit: drumsPanel,
    synth: synthPanel,
    guitar: openGuitarPanel,
    bass: openBassPanel,
    piano: pianoPanel,
    vocal: vocalPanel,
    instruments: instrumentPanel,
  };

  const actions = {
    drums: drumsPanel,
    piano: pianoPanel,
    synth: synthPanel,
    vocal: vocalPanel,
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
    progressionDoor: progressionDoorPanel,
    travel: (target) => sceneManager.request(target.target),
    dialogue: (target) => {
      const id = target.npcId ?? target.id;
      const dialogue = sceneManager.current.npcs?.dialogue?.(id);
      if (!dialogue) return;
      const level = sceneManager.current;
      const sceneId = level.definition.id;
      state?.meet?.(id);
      saveState();

      if (id === 'zander' && sceneId === 'downstairs') {
        const admitted = state?.data?.studioAccessGranted === true;
        panel(
          'ZANDER · STUDIO DOOR',
          admitted
            ? '“You already told me what you are here for. Studio is upstairs. Go make something.”'
            : '“Upstairs is the studio, not another party room. What are you actually here to do?”',
          admitted
            ? []
            : [
                [
                  'I want to make music, not just party.',
                  () => {
                    state.data.studioAccessGranted = true;
                    saveState();
                    panel(
                      'ZANDER · STUDIO ACCESS',
                      '“Good answer. Head through this doorway and take the Clark stair up. We will get deeper into the studio once you are there.”',
                    );
                  },
                ],
                [
                  'Honestly, I am just here to party.',
                  () =>
                    panel(
                      'ZANDER · STUDIO DOOR',
                      '“Then stay down here for now. Come back when you actually want to make something.”',
                    ),
                ],
              ],
        );
        return;
      }

      const characterActions = [];
      if (id === 'nora' && photos) characterActions.push(['Pose for a photo', takeNoraPhoto]);
      if (id === 'jace' && sceneManager.current.definition.id === 'upstairs') {
        const storageUnlocked = state?.data?.tapeArchiveAccessGranted === true;
        characterActions.push([
          storageUnlocked
            ? 'Take me back to the tape archive'
            : 'Tell me about the studio tape archives',
          () => {
            state.data.tapeArchiveAccessGranted = true;
            syncProgression();
            saveState();
            escortToGuide('storage', 'jace');
            panel(
              'JACE · TAPE ARCHIVE',
              storageUnlocked
                ? '“Here it is again. Storage is open now, so you can come back whenever you want.”'
                : '“The tape archive is in Storage. I keep that room closed when nobody is using it. Come on — I will open it and show you where the reels live.”',
            );
          },
        ]);
        characterActions.push(['Ask about the Neve room', neveConsolePanel]);
      }
      if (id === 'james' && sceneManager.current.definition.id === 'upstairs') {
        characterActions.push([
          state?.data?.tapeArchiveAccessGranted
            ? 'Where are the tape archives again?'
            : 'Where are the tape archives?',
          () =>
            panel(
              'JAMES · BREAKGLASS TAPES',
              state?.data?.tapeArchiveAccessGranted
                ? '“Storage is open now. The reels are in there; bring one to the historic Neve room if you want to hear it.”'
                : '“Jace looks after the tape room. Ask him about the archive and he can open Storage for you.”',
            ),
        ]);
        characterActions.push([
          state?.data?.houseDjDeskIntroduced
            ? 'Take me back to the downstairs DJ producer table'
            : 'How do you decide who DJs downstairs?',
          () => {
            const desk = level.definition.anchors?.houseDjDesk;
            if (!desk || !player) return;
            state.data.houseDjDeskIntroduced = true;
            saveState();
            const [x, y, z] = desk.position;
            player.spawn([x, y, z + 1.35], level.collision);
            const james = level.npcs?.get?.('james');
            if (james?.group) {
              james.group.position.set(x - 0.82, y, z + 0.62);
              james.group.rotation.y = Math.PI;
            }
            panel(
              'JAMES · PRODUCER TABLE',
              '“This is the table. We use it to decide who is holding down the booth downstairs. Pick somebody here, then go hear what they do in the club.”',
            );
          },
        ]);
      }
      if (id === 'zander' && sceneManager.current.definition.id === 'upstairs')
        characterActions.push(['Check the tape machine', tapeMachinePanel]);
      if (id === 'boogaloo' && sceneManager.current.definition.id === 'upstairs') {
        const deadRoomUnlocked = state?.data?.deadRoomAccessGranted === true;
        characterActions.push([
          deadRoomUnlocked
            ? 'Take me back to the guitars and amps'
            : 'Which amps should I pair with which guitars?',
          () => {
            state.data.deadRoomAccessGranted = true;
            syncProgression();
            saveState();
            escortToGuide('deadRoom', 'boogaloo');
            panel(
              'BOOGALOO · DEAD ROOM',
              deadRoomUnlocked
                ? '“Dead Room is still open. Try another chain.”'
                : '“Start with the instrument, then pick the amp for what you want it to do. Come on — I will open the Dead Room and you can actually try the combinations.”',
            );
          },
        ]);
        characterActions.push(['Play the synth', synthPanel]);
      }
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
