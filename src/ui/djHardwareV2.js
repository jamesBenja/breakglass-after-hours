import { DJ_TRACKS } from '../dj/DjMixer.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const HOT_CUE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LOOP_BEATS = [1, 2, 4, 8, 16];
const A9_BEAT_FX = [
  'DELAY',
  'ECHO',
  'PING PONG',
  'SPIRAL',
  'HELIX',
  'REVERB',
  'FLANGER',
  'PHASER',
  'FILTER',
  'TRIPLET FILTER',
  'TRANS',
  'ROLL',
  'TRIPLET ROLL',
  'MOBIUS',
];

function trackById(tracks, id) {
  return tracks.find((track) => track.id === id) ?? tracks[0] ?? DJ_TRACKS[0];
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

function makeButton(document, label, className, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.onclick = (event) => {
    Promise.resolve(action?.(event)).catch((error) =>
      console.warn('DJ hardware control failed', error),
    );
  };
  return button;
}

function setPressed(button, active) {
  button.classList.toggle('active', active === true);
  button.setAttribute('aria-pressed', String(active === true));
}

function addRange(document, host, options) {
  const label = document.createElement('label');
  label.className = options.className || 'dj-hardware-range';
  const caption = document.createElement('span');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);
  input.setAttribute('aria-label', options.ariaLabel || options.label);
  const format = options.format || ((value) => Number(value).toFixed(2));
  const updateCaption = () => {
    caption.textContent =
      options.label + (options.hideValue ? '' : ' ' + format(Number(input.value)));
  };
  input.oninput = () => {
    updateCaption();
    options.onInput?.(Number(input.value), input);
  };
  if (options.disabled) input.disabled = true;
  updateCaption();
  label.append(caption, input);
  host.appendChild(label);
  return input;
}

function addKnob(document, host, options) {
  const control = document.createElement('div');
  control.className = 'a9-knob-control';
  const caption = document.createElement('span');
  caption.textContent = options.label;
  const face = document.createElement('span');
  face.className = 'a9-knob-face';
  const pointer = document.createElement('i');
  face.appendChild(pointer);
  const readout = document.createElement('small');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(options.min ?? -1);
  input.max = String(options.max ?? 1);
  input.step = String(options.step ?? 0.01);
  input.value = String(options.value ?? 0);
  input.setAttribute('aria-label', options.ariaLabel || options.label);

  const update = () => {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const normalized = clamp((value - min) / Math.max(0.0001, max - min), 0, 1);
    const degrees = -135 + normalized * 270;
    face.style.setProperty('--knob-angle', degrees + 'deg');
    readout.textContent = options.format ? options.format(value) : value.toFixed(2);
  };

  const commit = (value) => {
    const min = Number(input.min);
    const max = Number(input.max);
    const step = Math.max(0.000001, Number(input.step) || 0.01);
    const safe = clamp(value, min, max);
    const snapped = Math.round((safe - min) / step) * step + min;
    input.value = String(clamp(snapped, min, max));
    update();
    options.onInput?.(Number(input.value), input);
  };

  input.oninput = () => {
    update();
    options.onInput?.(Number(input.value), input);
  };

  let dragPointer = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartValue = 0;
  control.onpointerdown = (event) => {
    if (input.disabled || event.button > 0) return;
    event.preventDefault();
    dragPointer = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartValue = Number(input.value);
    control.setPointerCapture?.(event.pointerId);
    control.classList.add('dragging');
    input.focus?.({ preventScroll: true });
  };
  control.onpointermove = (event) => {
    if (dragPointer !== event.pointerId) return;
    event.preventDefault();
    const span = Number(input.max) - Number(input.min);
    const vertical = dragStartY - event.clientY;
    const horizontal = event.clientX - dragStartX;
    const deltaPixels = vertical + horizontal * 0.45;
    commit(dragStartValue + (deltaPixels / 150) * span);
  };
  const finishDrag = (event) => {
    if (dragPointer == null) return;
    if (event?.pointerId != null && event.pointerId !== dragPointer) return;
    dragPointer = null;
    control.classList.remove('dragging');
  };
  control.onpointerup = finishDrag;
  control.onpointercancel = finishDrag;

  if (options.disabled) input.disabled = true;
  update();
  control.append(caption, face, readout, input);
  host.appendChild(control);
  return input;
}

function createLedMeter(document, label, className = '') {
  const meter = document.createElement('div');
  meter.className = ('a9-led-meter ' + className).trim();
  const caption = document.createElement('span');
  caption.className = 'a9-led-label';
  caption.textContent = label;
  const track = document.createElement('div');
  track.className = 'a9-led-track';
  const segments = [];
  for (let index = 0; index < 12; index += 1) {
    const segment = document.createElement('i');
    track.appendChild(segment);
    segments.push(segment);
  }
  meter.append(caption, track);
  return { meter, segments };
}

function setLedMeter(segments, value) {
  const lit = Math.round(clamp(value, 0, 1) * segments.length);
  segments.forEach((segment, index) => segment.classList.toggle('lit', index < lit));
}

function addTrackSelect(document, host, mixer, tracks, deckId, onChange, refresh) {
  const state = mixer.snapshot().decks[deckId];
  const select = document.createElement('select');
  select.className = 'dj-track-browser';
  select.setAttribute('aria-label', 'Deck ' + deckId + ' track');
  for (const track of tracks) {
    const option = document.createElement('option');
    option.value = track.id;
    option.selected = track.id === state.trackId;
    option.textContent =
      track.label + (track.freeTime ? ' · FREE' : ' · ' + Math.round(track.bpm) + ' BPM');
    select.appendChild(option);
  }
  select.onchange = () => {
    mixer.load(deckId, select.value);
    onChange();
    refresh();
  };
  host.appendChild(select);
  return select;
}

function pitchPercent(state, track) {
  if (!track?.bpm) return 0;
  return (Number(state.bpm) / Number(track.bpm) - 1) * 100;
}

function setPitchPercent(mixer, deckId, track, percent) {
  if (!track?.bpm || track.freeTime) return;
  mixer.setBpm(deckId, track.bpm * (1 + Number(percent) / 100));
}

function createWaveform(document, state, track) {
  const host = document.createElement('div');
  host.className = 'cdj-waveform';
  let seed = 0;
  const source = String(track?.id || state.trackId || 'deck');
  for (let i = 0; i < source.length; i += 1) seed = (seed * 31 + source.charCodeAt(i)) >>> 0;
  for (let i = 0; i < 72; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const bar = document.createElement('i');
    bar.style.height = 18 + (seed % 76) + '%';
    host.appendChild(bar);
  }
  const playhead = document.createElement('b');
  playhead.className = 'cdj-waveform-playhead';
  host.appendChild(playhead);
  return { host, playhead };
}

function createCdj(document, mixer, tracks, deckId, side, onChange, refresh, liveRefs) {
  const snapshot = mixer.snapshot();
  const state = snapshot.decks[deckId];
  const track = trackById(tracks, state.trackId);
  const unit = document.createElement('section');
  unit.className = 'dj-device cdj3000 source-active';
  unit.dataset.device = side + '-cdj';

  const brand = document.createElement('header');
  brand.className = 'dj-device-brand';
  const title = document.createElement('strong');
  title.textContent = 'CDJ-3000';
  const deckTag = document.createElement('span');
  deckTag.textContent = 'PLAYER ' + deckId;
  brand.append(title, deckTag);
  unit.appendChild(brand);

  const screen = document.createElement('div');
  screen.className = 'cdj-screen';
  const top = document.createElement('div');
  top.className = 'cdj-screen-top';
  const bpm = document.createElement('strong');
  bpm.textContent = state.freeTime ? 'FREE' : Number(state.bpm).toFixed(1) + ' BPM';
  const tempo = document.createElement('span');
  tempo.textContent = state.freeTime
    ? 'NO GRID'
    : (pitchPercent(state, track) >= 0 ? '+' : '') + pitchPercent(state, track).toFixed(2) + '%';
  top.append(bpm, tempo);
  const browser = document.createElement('div');
  browser.className = 'cdj-browser';
  addTrackSelect(document, browser, mixer, tracks, deckId, onChange, refresh);
  const wave = createWaveform(document, state, track);
  const timing = document.createElement('div');
  timing.className = 'cdj-timing';
  const elapsed = document.createElement('span');
  elapsed.textContent = formatTime(mixer.deckPosition?.(deckId));
  const phase = document.createElement('span');
  phase.textContent = 'PHASE ' + Math.round(Number(state.phaseErrorMs) || 0) + ' ms';
  timing.append(elapsed, phase);
  screen.append(top, browser, wave.host, timing);
  unit.appendChild(screen);

  const hotCues = document.createElement('div');
  hotCues.className = 'cdj-hotcues';
  HOT_CUE_LABELS.forEach((label, index) => {
    const cueSet = Number.isFinite(state.cuePoints?.[index]);
    let longPressed = false;
    const button = makeButton(document, label, 'cdj-hotcue' + (cueSet ? ' set' : ''), () => {
      if (longPressed) {
        longPressed = false;
        return;
      }
      if (Number.isFinite(mixer.decks[deckId]?.cuePoints?.[index]))
        mixer.triggerHotCue?.(deckId, index);
      else mixer.setHotCue?.(deckId, index);
      onChange();
      refresh();
    });
    let holdTimer = null;
    button.onpointerdown = () => {
      longPressed = false;
      holdTimer = globalThis.setTimeout?.(() => {
        longPressed = true;
        if (mixer.decks[deckId]?.cuePoints) mixer.decks[deckId].cuePoints[index] = null;
        holdTimer = null;
        onChange();
        refresh();
      }, 650);
    };
    const cancelHold = () => {
      if (holdTimer != null) globalThis.clearTimeout?.(holdTimer);
      holdTimer = null;
    };
    button.onpointerup = cancelHold;
    button.onpointercancel = cancelHold;
    button.title = cueSet ? 'Tap to recall. Hold to clear.' : 'Set hot cue ' + label;
    hotCues.appendChild(button);
  });
  unit.appendChild(hotCues);

  const center = document.createElement('div');
  center.className = 'cdj-center';
  const loop = document.createElement('div');
  loop.className = 'cdj-loop-bank';
  LOOP_BEATS.forEach((beats) => {
    const button = makeButton(document, String(beats), 'cdj-loop-button', () => {
      mixer.setPreciseLoop?.(deckId, state.loopBeats === beats ? 0 : beats);
      onChange();
      refresh();
    });
    setPressed(button, Number(state.loopBeats) === beats);
    loop.appendChild(button);
  });
  const exitLoop = makeButton(document, 'EXIT', 'cdj-loop-exit', () => {
    mixer.setPreciseLoop?.(deckId, 0);
    onChange();
    refresh();
  });
  loop.appendChild(exitLoop);

  const jogWrap = document.createElement('div');
  jogWrap.className = 'cdj-jog-wrap';
  const jog = document.createElement('button');
  jog.type = 'button';
  jog.className = 'cdj-jog';
  jog.setAttribute(
    'aria-label',
    'CDJ ' + deckId + ' jog wheel. Tap an edge to nudge, or hold and rotate for vinyl/backspin.',
  );
  let jogPointer = null;
  let jogLastAngle = 0;
  let jogDragged = false;
  const jogAngle = (event) => {
    const rect = jog.getBoundingClientRect();
    return Math.atan2(
      event.clientY - (rect.top + rect.height / 2),
      event.clientX - (rect.left + rect.width / 2),
    );
  };
  jog.onpointerdown = (event) => {
    event.preventDefault();
    jogPointer = event.pointerId;
    jogLastAngle = jogAngle(event);
    jogDragged = false;
    jog.setPointerCapture?.(event.pointerId);
    mixer.setJogHeld?.(deckId, true);
    jog.classList.add('held');
    onChange();
  };
  jog.onpointermove = (event) => {
    if (jogPointer !== event.pointerId) return;
    event.preventDefault();
    const angle = jogAngle(event);
    let delta = angle - jogLastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    jogLastAngle = angle;
    if (Math.abs(delta) > 0.002) jogDragged = true;
    const secondsPerRevolution = 1.8;
    mixer.scrubJog?.(deckId, (delta / (Math.PI * 2)) * secondsPerRevolution);
    onChange();
  };
  const releaseJog = (event) => {
    if (jogPointer == null || (event?.pointerId != null && event.pointerId !== jogPointer)) return;
    const wasDragged = jogDragged;
    jogPointer = null;
    jogDragged = false;
    jog.classList.remove('held');
    mixer.setJogHeld?.(deckId, false);
    if (!wasDragged && event) {
      const rect = jog.getBoundingClientRect();
      const direction = event.clientX < rect.left + rect.width / 2 ? -1 : 1;
      mixer.jog?.(deckId, direction * 0.125);
    }
    onChange();
  };
  jog.onpointerup = releaseJog;
  jog.onpointercancel = releaseJog;
  const jogScreen = document.createElement('span');
  jogScreen.className = 'cdj-jog-screen';
  jogScreen.textContent = state.playing ? '▶' : 'Ⅱ';
  jog.appendChild(jogScreen);
  const nudge = document.createElement('div');
  nudge.className = 'cdj-nudge-row';
  nudge.append(
    makeButton(document, '−4', '', () => {
      mixer.beatJump?.(deckId, -4);
      onChange();
    }),
    makeButton(document, '+4', '', () => {
      mixer.beatJump?.(deckId, 4);
      onChange();
    }),
  );
  jogWrap.append(jog, nudge);

  center.append(loop, jogWrap);
  unit.appendChild(center);

  const transport = document.createElement('div');
  transport.className = 'cdj-transport';
  const cue = makeButton(document, 'CUE', 'cdj-cue', () => {
    mixer.setHotCue?.(deckId, 0);
    onChange();
    refresh();
  });
  const play = makeButton(document, state.playing ? 'Ⅱ' : '▶', 'cdj-play', async () => {
    if (mixer.decks[deckId].playing) mixer.stopDeck(deckId);
    else await mixer.playDeck(deckId);
    onChange();
    refresh();
  });
  const sync = makeButton(document, 'SYNC', 'cdj-sync', () => {
    mixer.sync(deckId);
    onChange();
    refresh();
  });
  sync.disabled = state.freeTime === true;
  setPressed(sync, Boolean(state.syncedTo));
  const channel = deckId === 'A' ? 2 : 3;
  const source = makeButton(document, 'CH ' + channel, 'cdj-source-select', () => {});
  source.disabled = true;
  setPressed(source, true);
  transport.append(cue, play, sync, source);
  unit.appendChild(transport);

  const pitch = document.createElement('div');
  pitch.className = 'cdj-pitch';
  const pitchInput = addRange(document, pitch, {
    label: 'TEMPO',
    ariaLabel: 'CDJ ' + deckId + ' tempo',
    min: -16,
    max: 16,
    step: 0.05,
    value: clamp(pitchPercent(state, track), -16, 16),
    format: (value) => (value >= 0 ? '+' : '') + value.toFixed(2) + '%',
    disabled: state.freeTime === true,
    onInput: (value) => {
      setPitchPercent(mixer, deckId, track, value);
      onChange();
    },
  });
  unit.appendChild(pitch);

  liveRefs.push({
    type: 'cdj',
    deckId,
    elapsed,
    bpm,
    tempo,
    phase,
    wavehead: wave.playhead,
    jog,
    pitchInput,
    track,
  });
  return unit;
}

function createTurntable(document, mixer, tracks, deckId, side, onChange, refresh, liveRefs) {
  const snapshot = mixer.snapshot();
  const state = snapshot.decks[deckId];
  const track = trackById(tracks, state.trackId);
  const unit = document.createElement('section');
  unit.className = 'dj-device sl1200 source-active';
  unit.dataset.device = side + '-vinyl';

  const brand = document.createElement('header');
  brand.className = 'dj-device-brand sl-brand';
  const title = document.createElement('strong');
  title.textContent = 'SL-1200';
  const deckTag = document.createElement('span');
  deckTag.textContent = side === 'left' ? 'LEFT PHONO · CH 1' : 'RIGHT PHONO · CH 4';
  brand.append(title, deckTag);
  unit.appendChild(brand);

  const crate = document.createElement('div');
  crate.className = 'sl-crate';
  addTrackSelect(document, crate, mixer, tracks, deckId, onChange, refresh);
  unit.appendChild(crate);

  const tempoReadout = document.createElement('div');
  tempoReadout.className = 'sl-tempo-readout';
  const tempoBpm = document.createElement('strong');
  tempoBpm.textContent = state.freeTime ? 'FREE' : Number(state.bpm).toFixed(1) + ' BPM';
  const tempoPercent = document.createElement('span');
  const initialPitch = pitchPercent(state, track);
  tempoPercent.textContent = state.freeTime
    ? 'NO GRID'
    : (initialPitch >= 0 ? '+' : '') + initialPitch.toFixed(2) + '%';
  tempoReadout.append(tempoBpm, tempoPercent);
  unit.appendChild(tempoReadout);

  const deckSurface = document.createElement('div');
  deckSurface.className = 'sl-surface';
  const platter = document.createElement('button');
  platter.type = 'button';
  platter.className = 'sl-platter';
  platter.setAttribute(
    'aria-label',
    'SL-1200 ' + deckId + ' platter. Hold and drag to cue the record.',
  );
  const record = document.createElement('span');
  record.className = 'sl-record';
  const recordLabel = document.createElement('b');
  recordLabel.textContent = String(track?.label || 'RECORD').slice(0, 22);
  record.appendChild(recordLabel);
  platter.appendChild(record);

  let pointerId = null;
  let lastAngle = 0;
  const platterAngle = (event) => {
    const rect = platter.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    return Math.atan2(y, x);
  };
  platter.onpointerdown = (event) => {
    event.preventDefault();
    pointerId = event.pointerId;
    lastAngle = platterAngle(event);
    platter.setPointerCapture?.(event.pointerId);
    mixer.setDeviceMode?.(deckId, 'vinyl');
    mixer.setPlatterHeld?.(deckId, true);
    platter.classList.add('held');
    onChange();
  };
  platter.onpointermove = (event) => {
    if (pointerId !== event.pointerId || !mixer.decks[deckId]?.platterHeld) return;
    event.preventDefault();
    const angle = platterAngle(event);
    let angleDelta = angle - lastAngle;
    if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    lastAngle = angle;
    const rpm = Math.max(1, Number(mixer.decks[deckId]?.vinylRpm) || 33.333);
    const secondsPerRevolution = 60 / rpm;
    mixer.scrubVinyl?.(deckId, (angleDelta / (Math.PI * 2)) * secondsPerRevolution);
    onChange();
  };
  const release = (event) => {
    if (pointerId != null && event?.pointerId != null && event.pointerId !== pointerId) return;
    pointerId = null;
    platter.classList.remove('held');
    mixer.setPlatterHeld?.(deckId, false);
    onChange();
  };
  platter.onpointerup = release;
  platter.onpointercancel = release;

  const pitch = document.createElement('div');
  pitch.className = 'sl-pitch';
  const pitchInput = addRange(document, pitch, {
    label: 'PITCH',
    className: 'dj-hardware-range sl-pitch-range',
    ariaLabel: 'SL-1200 ' + deckId + ' pitch',
    min: -8,
    max: 8,
    step: 0.05,
    value: clamp(pitchPercent(state, track), -8, 8),
    format: (value) => (value >= 0 ? '+' : '') + value.toFixed(2) + '%',
    disabled: state.freeTime === true,
    onInput: (value) => {
      setPitchPercent(mixer, deckId, track, value);
      onChange();
    },
  });
  const pitchZero = makeButton(document, '0', 'sl-pitch-zero', () => {
    pitchInput.value = '0';
    pitchInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  pitchZero.title = 'Reset pitch to 0%';
  pitch.appendChild(pitchZero);
  deckSurface.append(platter, pitch);
  unit.appendChild(deckSurface);

  const controls = document.createElement('div');
  controls.className = 'sl-controls';
  const needle = makeButton(document, state.playing ? 'LIFT' : 'NEEDLE', 'sl-needle', async () => {
    mixer.setDeviceMode?.(deckId, 'vinyl');
    if (mixer.decks[deckId].playing) mixer.stopDeck(deckId);
    else await mixer.playDeck(deckId);
    onChange();
    refresh();
  });
  const motor = makeButton(document, state.motorOn === false ? 'START' : 'STOP', 'sl-motor', () => {
    mixer.setDeviceMode?.(deckId, 'vinyl');
    mixer.toggleMotor?.(deckId);
    onChange();
    refresh();
  });
  const rpm33 = makeButton(document, '33', 'sl-rpm', () => {
    mixer.setVinylRpm?.(deckId, 33.333);
    onChange();
    refresh();
  });
  const rpm45 = makeButton(document, '45', 'sl-rpm', () => {
    mixer.setVinylRpm?.(deckId, 45);
    onChange();
    refresh();
  });
  setPressed(rpm33, Math.abs(Number(state.vinylRpm || 33.333) - 33.333) < 1);
  setPressed(rpm45, Math.abs(Number(state.vinylRpm || 33.333) - 45) < 1);
  const channel = deckId === 'C' ? 1 : 4;
  const source = makeButton(document, 'CH ' + channel, 'sl-source-select', () => {});
  source.disabled = true;
  setPressed(source, true);
  controls.append(needle, motor, rpm33, rpm45, source);
  unit.appendChild(controls);

  liveRefs.push({
    type: 'vinyl',
    deckId,
    platter,
    record,
    pitchInput,
    track,
    tempoBpm,
    tempoPercent,
  });
  return unit;
}

function channelDefinition(number) {
  if (number === 1) return { deckId: 'C', label: 'PHONO L' };
  if (number === 2) return { deckId: 'A', label: 'DIGITAL L' };
  if (number === 3) return { deckId: 'B', label: 'DIGITAL R' };
  return { deckId: 'D', label: 'PHONO R' };
}

function createA9(document, mixer, onChange, refresh, liveRefs) {
  const snapshot = mixer.snapshot();
  const unit = document.createElement('section');
  unit.className = 'dj-device djm-a9';
  unit.dataset.device = 'mixer';

  const brand = document.createElement('header');
  brand.className = 'dj-device-brand a9-brand';
  const title = document.createElement('strong');
  title.textContent = 'DJM-A9';
  const tag = document.createElement('span');
  tag.textContent = '4 CHANNEL MIXER';
  brand.append(title, tag);
  unit.appendChild(brand);

  const master = document.createElement('div');
  master.className = 'a9-master-top';
  const meters = document.createElement('div');
  meters.className = 'a9-master-meters';
  const masterTitle = document.createElement('strong');
  masterTitle.textContent = 'MASTER';
  const masterPair = document.createElement('div');
  masterPair.className = 'a9-master-pair';
  const masterLeft = createLedMeter(document, 'L', 'master-left');
  const masterRight = createLedMeter(document, 'R', 'master-right');
  masterPair.append(masterLeft.meter, masterRight.meter);
  meters.append(masterTitle, masterPair);
  const fx = document.createElement('div');
  fx.className = 'a9-fx-panel';
  const fxHeader = document.createElement('div');
  fxHeader.className = 'a9-fx-header';
  const fxLabel = document.createElement('strong');
  fxLabel.textContent = 'BEAT FX';
  const fxOn = makeButton(document, snapshot.beatFx?.enabled ? 'ON' : 'OFF', 'a9-fx-on', () => {
    mixer.setBeatFxEnabled?.(!mixer.snapshot().beatFx?.enabled);
    onChange();
    refresh();
  });
  setPressed(fxOn, snapshot.beatFx?.enabled === true);
  fxHeader.append(fxLabel, fxOn);

  const target = document.createElement('select');
  target.className = 'a9-fx-select';
  target.setAttribute('aria-label', 'Beat FX channel selector');
  for (const value of ['CH1', 'CH2', 'CH3', 'CH4', 'MASTER']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value === 'MASTER' ? 'MST' : value;
    option.selected = value === (snapshot.beatFx?.target ?? 'MASTER');
    target.appendChild(option);
  }
  target.onchange = () => {
    mixer.setBeatFxTarget?.(target.value);
    onChange();
    refresh();
  };

  const effect = document.createElement('select');
  effect.className = 'a9-fx-select a9-fx-effect';
  effect.setAttribute('aria-label', 'Beat FX effect selector');
  for (const value of A9_BEAT_FX) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = value === (snapshot.beatFx?.effect ?? 'ECHO');
    effect.appendChild(option);
  }
  effect.onchange = () => {
    mixer.setBeatFxEffect?.(effect.value);
    onChange();
    refresh();
  };

  const beatRow = document.createElement('div');
  beatRow.className = 'a9-fx-beats';
  for (const value of [0.25, 0.5, 1, 2, 4]) {
    const label = value === 0.25 ? '1/4' : value === 0.5 ? '1/2' : String(value);
    const button = makeButton(document, label, 'a9-fx-beat', () => {
      mixer.setBeatFxBeat?.(value);
      onChange();
      refresh();
    });
    setPressed(button, Math.abs(Number(snapshot.beatFx?.beat ?? 0.5) - value) < 0.001);
    beatRow.appendChild(button);
  }

  const fxAmount = document.createElement('div');
  fxAmount.className = 'a9-fx-amount';
  addKnob(document, fxAmount, {
    label: 'LEVEL/DEPTH',
    ariaLabel: 'Beat FX level depth',
    min: 0,
    max: 1,
    step: 0.01,
    value: snapshot.beatFx?.amount ?? 0.35,
    format: (value) => Math.round(value * 100) + '%',
    onInput: (value) => {
      mixer.setBeatFxAmount?.(value);
      onChange();
    },
  });

  fx.append(fxHeader, target, effect, beatRow, fxAmount);
  master.append(meters, fx);
  unit.appendChild(master);

  const channels = document.createElement('div');
  channels.className = 'a9-channels';
  for (let number = 1; number <= 4; number += 1) {
    const definition = channelDefinition(number);
    const state = snapshot.decks[definition.deckId];
    const strip = document.createElement('div');
    strip.className = 'a9-channel active';
    const top = document.createElement('div');
    top.className = 'a9-channel-top';
    const numberLabel = document.createElement('b');
    numberLabel.textContent = 'CH ' + number;
    const input = makeButton(document, definition.label, 'a9-input-select', () => {});
    input.disabled = true;
    setPressed(input, true);
    top.append(numberLabel, input);
    strip.appendChild(top);

    const channelMeter = createLedMeter(document, 'LEVEL', 'a9-channel-meter');
    strip.appendChild(channelMeter.meter);
    liveRefs.push({
      type: 'a9-channel',
      deckId: definition.deckId,
      channel: number,
      segments: channelMeter.segments,
    });

    const eq = document.createElement('div');
    eq.className = 'a9-eq';
    addKnob(document, eq, {
      label: 'HI',
      ariaLabel: 'A9 channel ' + number + ' high EQ',
      value: state.high,
      onInput: (value) => {
        mixer.setEq(definition.deckId, 'high', value);
        onChange();
      },
    });
    addKnob(document, eq, {
      label: 'MID',
      ariaLabel: 'A9 channel ' + number + ' mid EQ',
      value: state.mid ?? 0,
      onInput: (value) => {
        mixer.setEq(definition.deckId, 'mid', value);
        onChange();
      },
    });
    addKnob(document, eq, {
      label: 'LOW',
      ariaLabel: 'A9 channel ' + number + ' low EQ',
      value: state.low,
      onInput: (value) => {
        mixer.setEq(definition.deckId, 'low', value);
        onChange();
      },
    });
    addKnob(document, eq, {
      label: 'FILTER',
      ariaLabel: 'A9 channel ' + number + ' filter',
      value: state.filter ?? 0,
      format: (value) => {
        if (Math.abs(value) < 0.02) return 'OFF';
        return value < 0 ? 'LPF' : 'HPF';
      },
      onInput: (value) => {
        mixer.setFilter?.(definition.deckId, value);
        onChange();
      },
    });
    strip.appendChild(eq);

    const cue = makeButton(document, 'CUE', 'a9-cue', () => {
      mixer._hardwareV2Pfl ??= {};
      mixer._hardwareV2Pfl[number] = !mixer._hardwareV2Pfl[number];
      setPressed(cue, mixer._hardwareV2Pfl[number]);
    });
    cue.title =
      'PFL state is represented in the hardware UI; a separate headphone output bus is not simulated yet.';
    setPressed(cue, mixer._hardwareV2Pfl?.[number] === true);
    strip.appendChild(cue);

    const fader = document.createElement('div');
    fader.className = 'a9-fader-wrap';
    const level = document.createElement('input');
    level.type = 'range';
    level.min = '0';
    level.max = '1';
    level.step = '0.01';
    level.value = String(state.level);
    level.className = 'a9-channel-fader';
    level.setAttribute('aria-label', 'A9 channel ' + number + ' fader');
    level.oninput = () => {
      mixer.setLevel(definition.deckId, Number(level.value));
      onChange();
    };
    fader.appendChild(level);
    strip.appendChild(fader);
    channels.appendChild(strip);
  }
  unit.appendChild(channels);

  const cross = document.createElement('div');
  cross.className = 'a9-crossfader';
  const left = document.createElement('span');
  left.textContent = 'A';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '-1';
  input.max = '1';
  input.step = '0.01';
  input.value = String(snapshot.crossfader);
  input.setAttribute('aria-label', 'DJM-A9 crossfader');
  input.oninput = () => {
    mixer.setCrossfader(Number(input.value));
    onChange();
  };
  const right = document.createElement('span');
  right.textContent = 'B';
  cross.append(left, input, right);
  unit.appendChild(cross);

  liveRefs.push({
    type: 'a9-master',
    leftSegments: masterLeft.segments,
    rightSegments: masterRight.segments,
  });
  return unit;
}

function applyFocus(shell, focus) {
  shell.dataset.focus = focus;
  for (const unit of shell.querySelectorAll('.dj-device')) {
    unit.classList.toggle('focused', unit.dataset.device === focus);
  }
  for (const button of shell.querySelectorAll('.dj-hardware-device-tab')) {
    button.classList.toggle('active', button.dataset.focus === focus);
  }
}

function startLiveUi(ui, mixer, refs, metricsRefs) {
  if (ui._djHardwareTimer != null) globalThis.clearInterval?.(ui._djHardwareTimer);
  const tick = () => {
    if (
      !ui.panelElement ||
      ui.panelElement.hidden ||
      !ui.panelElement.classList.contains('dj-hardware-panel')
    ) {
      if (ui._djHardwareTimer != null) globalThis.clearInterval?.(ui._djHardwareTimer);
      ui._djHardwareTimer = null;
      return;
    }
    const snapshot = mixer.snapshot();
    const quality = snapshot.metrics?.playing
      ? Math.round((snapshot.metrics.mixQuality ?? 0) * 100)
      : 0;
    const vibe = snapshot.metrics?.playing ? Math.round((snapshot.metrics.vibe ?? 0) * 100) : 0;
    metricsRefs.quality.textContent = 'MIX ' + quality + '%';
    metricsRefs.vibe.textContent = 'FLOOR ' + vibe + '%';
    metricsRefs.phase.textContent =
      'PHASE ' + Math.round(Number(snapshot.decks?.B?.phaseErrorMs) || 0) + ' ms';

    for (const ref of refs) {
      const state = snapshot.decks?.[ref.deckId];
      if (ref.type === 'cdj' && state) {
        const position = mixer.deckPosition?.(ref.deckId) ?? 0;
        ref.elapsed.textContent = formatTime(position);
        ref.bpm.textContent = state.freeTime ? 'FREE' : Number(state.bpm).toFixed(1) + ' BPM';
        const percent = pitchPercent(state, ref.track);
        ref.tempo.textContent = state.freeTime
          ? 'NO GRID'
          : (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%';
        ref.phase.textContent = 'PHASE ' + Math.round(Number(state.phaseErrorMs) || 0) + ' ms';
        const duration = Number(
          mixer.decks[ref.deckId]?.source?.buffer?.duration ||
            mixer.decks[ref.deckId]?.media?.duration ||
            0,
        );
        const progress =
          duration > 0
            ? (position % duration) / duration
            : ((Number(state.beatIndex) || 0) % 64) / 64;
        ref.wavehead.style.left = clamp(progress, 0, 1) * 100 + '%';
        ref.jog.style.setProperty('--jog-angle', ((position * 72) % 360) + 'deg');
      } else if (ref.type === 'vinyl' && state) {
        const position = mixer.deckPosition?.(ref.deckId) ?? 0;
        const rpm = Number(state.vinylRpm || 33.333);
        ref.record.style.setProperty('--record-angle', ((position * rpm * 6) % 360) + 'deg');
        const percent = pitchPercent(state, ref.track);
        ref.tempoBpm.textContent = state.freeTime ? 'FREE' : Number(state.bpm).toFixed(1) + ' BPM';
        ref.tempoPercent.textContent = state.freeTime
          ? 'NO GRID'
          : (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%';
      } else if (ref.type === 'a9-channel') {
        const state = snapshot.decks?.[ref.deckId];
        const track = trackById(DJ_TRACKS, state?.trackId);
        const position = mixer.deckPosition?.(ref.deckId) ?? 0;
        const beatSeconds = 60 / Math.max(1, Number(state?.bpm) || Number(track?.bpm) || 120);
        const beatPhase = (position % beatSeconds) / beatSeconds;
        const pulse = 1 - Math.min(1, beatPhase * 2.6);
        const sourceLevel = state?.playing
          ? clamp(0.42 + (Number(track?.energy) || 0.7) * 0.38 + pulse * 0.2, 0, 1)
          : 0;
        setLedMeter(ref.segments, sourceLevel);
      } else if (ref.type === 'a9-master') {
        const a = snapshot.decks?.A;
        const b = snapshot.decks?.B;
        const c = snapshot.decks?.C;
        const d = snapshot.decks?.D;
        const x = (clamp(snapshot.crossfader, -1, 1) + 1) / 2;
        const leftCross = Math.cos(x * Math.PI * 0.5);
        const rightCross = Math.sin(x * Math.PI * 0.5);
        const leftOutput =
          leftCross *
          ((a?.playing ? Number(a.level) || 0 : 0) + (c?.playing ? Number(c.level) || 0 : 0)) *
          0.5;
        const rightOutput =
          rightCross *
          ((b?.playing ? Number(b.level) || 0 : 0) + (d?.playing ? Number(d.level) || 0 : 0)) *
          0.5;
        setLedMeter(ref.leftSegments, leftOutput);
        setLedMeter(ref.rightSegments, rightOutput);
      }
    }
  };
  tick();
  ui._djHardwareTimer = globalThis.setInterval?.(tick, 120) ?? null;
}

export function installDjHardwareV2(game, ui) {
  const mixer = game?.dj;
  if (!mixer || !ui || ui._djHardwareV2Installed) return mixer;
  ui._djHardwareV2Installed = true;

  const baseClearPanel = ui.clearPanel.bind(ui);
  ui.clearPanel = (...args) => {
    if (ui._djHardwareTimer != null) globalThis.clearInterval?.(ui._djHardwareTimer);
    ui._djHardwareTimer = null;
    ui.panelElement?.classList.remove('dj-hardware-panel');
    ui.document.body?.classList.remove('dj-hardware-active');
    return baseClearPanel(...args);
  };

  const baseClosePanel = ui.closePanel.bind(ui);
  ui.closePanel = (...args) => {
    if (ui._djHardwareTimer != null) globalThis.clearInterval?.(ui._djHardwareTimer);
    ui._djHardwareTimer = null;
    ui.panelElement?.classList.remove('dj-hardware-panel');
    ui.document.body?.classList.remove('dj-hardware-active');
    return baseClosePanel(...args);
  };

  ui.djMixer = (activeMixer, tracks = DJ_TRACKS, { onChange = () => {} } = {}) => {
    const snapshot = activeMixer.snapshot();
    const quality = snapshot.metrics?.playing
      ? Math.round((snapshot.metrics.mixQuality ?? 0) * 100)
      : 0;
    const vibe = snapshot.metrics?.playing ? Math.round((snapshot.metrics.vibe ?? 0) * 100) : 0;
    ui.clearPanel(
      'DJ BOOTH · HARDWARE V2',
      'CDJ-3000 · SL-1200 · DJM-A9. Four independent players feed four independent mixer channels.',
    );
    ui.panelElement?.classList.add('dj-hardware-panel');
    ui.document.body?.classList.add('dj-hardware-active');

    activeMixer._hardwareV2Focus ??= 'mixer';
    const liveRefs = [];
    const refresh = () => ui.djMixer(activeMixer, tracks, { onChange });
    const changed = () => onChange();

    const shell = ui.document.createElement('section');
    shell.className = 'dj-hardware-v2';

    const status = ui.document.createElement('div');
    status.className = 'dj-hardware-status';
    const name = ui.document.createElement('strong');
    name.textContent = 'BREAKGLASS DJ BOOTH';
    const qualityRef = ui.document.createElement('span');
    qualityRef.textContent = 'MIX ' + quality + '%';
    const vibeRef = ui.document.createElement('span');
    vibeRef.textContent = 'FLOOR ' + vibe + '%';
    const phaseRef = ui.document.createElement('span');
    phaseRef.textContent =
      'PHASE ' + Math.round(Number(snapshot.decks?.B?.phaseErrorMs) || 0) + ' ms';
    status.append(name, qualityRef, vibeRef, phaseRef);
    shell.appendChild(status);

    const tabs = ui.document.createElement('nav');
    tabs.className = 'dj-hardware-tabs';
    const tabDefs = [
      ['left-vinyl', 'L · 1200'],
      ['left-cdj', 'L · 3000'],
      ['mixer', 'A9'],
      ['right-cdj', 'R · 3000'],
      ['right-vinyl', 'R · 1200'],
    ];
    for (const [focus, label] of tabDefs) {
      const tab = makeButton(ui.document, label, 'dj-hardware-device-tab', () => {
        activeMixer._hardwareV2Focus = focus;
        applyFocus(shell, focus);
      });
      tab.dataset.focus = focus;
      tabs.appendChild(tab);
    }
    shell.appendChild(tabs);

    const rack = ui.document.createElement('div');
    rack.className = 'dj-hardware-rack';
    rack.append(
      createTurntable(ui.document, activeMixer, tracks, 'C', 'left', changed, refresh, liveRefs),
      createCdj(ui.document, activeMixer, tracks, 'A', 'left', changed, refresh, liveRefs),
      createA9(ui.document, activeMixer, changed, refresh, liveRefs),
      createCdj(ui.document, activeMixer, tracks, 'B', 'right', changed, refresh, liveRefs),
      createTurntable(ui.document, activeMixer, tracks, 'D', 'right', changed, refresh, liveRefs),
    );
    shell.appendChild(rack);

    const note = ui.document.createElement('div');
    note.className = 'dj-hardware-note';
    note.textContent =
      'FOUR SOURCES · CH1 left SL-1200 · CH2 left CDJ-3000 · CH3 right CDJ-3000 · CH4 right SL-1200. Every player has its own track and transport. Hold and rotate a record to cue it by ear.';
    shell.appendChild(note);

    ui.buttons.appendChild(shell);
    applyFocus(shell, activeMixer._hardwareV2Focus);
    startLiveUi(ui, activeMixer, liveRefs, {
      quality: qualityRef,
      vibe: vibeRef,
      phase: phaseRef,
    });
    return shell;
  };

  return mixer;
}
