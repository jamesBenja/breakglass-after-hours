import { Hud } from './Hud.js';

const isTouchDevice = () => {
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  return globalThis.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches === true;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const baseClearPanel = Hud.prototype.clearPanel;
const baseDjMixer = Hud.prototype.djMixer;
const baseStudioMixer = Hud.prototype.studioMixer;

function clearMobileMixerClasses(document) {
  document?.body?.classList.remove(
    'mixer-active',
    'mixer-collapsed',
    'dj-mobile-active',
    'studio-mobile-active',
  );
}

Hud.prototype.clearPanel = function clearPanel(title, text) {
  clearMobileMixerClasses(this.document);
  return baseClearPanel.call(this, title, text);
};

function makeButton(document, label, className = '', action = () => {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.onclick = (event) => {
    event.preventDefault();
    Promise.resolve(action(event)).catch((error) => console.warn(error));
  };
  return button;
}

function addRange(document, host, { label, min, max, step, value, onInput, format }) {
  const wrapper = document.createElement('label');
  wrapper.className = 'mobile-mixer-range';
  const caption = document.createElement('span');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute('aria-label', label);
  const formatter = format ?? ((current) => Number(current).toFixed(step < 1 ? 2 : 0));
  const syncCaption = () => {
    caption.textContent = `${label} ${formatter(Number(input.value))}`;
  };
  input.oninput = () => {
    syncCaption();
    onInput(Number(input.value));
  };
  syncCaption();
  wrapper.append(caption, input);
  host.appendChild(wrapper);
  return input;
}

function addHoldButton(document, host, label, className, onPress, onRelease) {
  const button = makeButton(document, label, className);
  let active = false;
  const press = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (active) return;
    active = true;
    button.classList.add('active');
    button.setPointerCapture?.(event.pointerId);
    onPress();
    globalThis.navigator?.vibrate?.(6);
  };
  const release = (event) => {
    event?.preventDefault?.();
    if (!active) return;
    active = false;
    button.classList.remove('active');
    onRelease();
  };
  button.onclick = null;
  button.addEventListener('pointerdown', press, { passive: false });
  button.addEventListener('pointerup', release, { passive: false });
  button.addEventListener('pointercancel', release, { passive: false });
  host.appendChild(button);
  return button;
}

function buildShell(ui, mode, titleText, statusText) {
  const { document } = ui;
  clearMobileMixerClasses(document);
  baseClearPanel.call(ui, titleText, statusText);
  document.body?.classList.add('mixer-active', `${mode}-mobile-active`);

  const shell = document.createElement('section');
  shell.className = `mobile-mixer-shell mobile-${mode}-shell`;

  const top = document.createElement('div');
  top.className = 'mobile-mixer-top';
  const title = document.createElement('strong');
  title.textContent = mode === 'dj' ? 'BOOTH PERFORMANCE' : 'SPECTRA PERFORMANCE';
  const collapse = makeButton(document, 'MIN', 'mobile-mixer-min', () => {
    const collapsed = !shell.classList.contains('collapsed');
    shell.classList.toggle('collapsed', collapsed);
    document.body?.classList.toggle('mixer-collapsed', collapsed);
    collapse.textContent = collapsed ? 'OPEN' : 'MIN';
  });
  top.append(title, collapse);
  shell.appendChild(top);

  const body = document.createElement('div');
  body.className = 'mobile-mixer-body';
  shell.appendChild(body);
  ui.buttons.appendChild(shell);
  return { shell, body };
}

Hud.prototype.djMixer = function mobileDjMixer(mixer, tracks, { onChange = () => {} } = {}) {
  if (!isTouchDevice()) return baseDjMixer.call(this, mixer, tracks, { onChange });

  const initial = mixer.snapshot();
  mixer._mobileFocusDeck ??= 'A';
  const { shell, body } = buildShell(
    this,
    'dj',
    'DJ BOOTH',
    'Touch-performance mode. Hold the punch controls, nudge a deck, blend, then minimize to move through the room.',
  );

  const meters = this.document.createElement('div');
  meters.className = 'mobile-dj-meters';
  const quality = this.document.createElement('span');
  const vibe = this.document.createElement('span');
  meters.append(quality, vibe);
  body.appendChild(meters);

  const refreshMetrics = () => {
    const snapshot = mixer.snapshot();
    quality.textContent = `MIX ${snapshot.metrics.playing ? Math.round(snapshot.metrics.mixQuality * 100) : 0}%`;
    vibe.textContent = `FLOOR ${snapshot.metrics.playing ? Math.round(snapshot.metrics.vibe * 100) : 0}%`;
    onChange();
  };
  refreshMetrics();

  const tabs = this.document.createElement('div');
  tabs.className = 'mobile-deck-tabs';
  const deckBody = this.document.createElement('div');
  deckBody.className = 'mobile-deck-body';
  body.append(tabs, deckBody);

  const renderDeckTabs = () => {
    tabs.replaceChildren();
    const snapshot = mixer.snapshot();
    for (const deckId of ['A', 'B']) {
      const state = snapshot.decks[deckId];
      const button = makeButton(
        this.document,
        `${deckId} ${state.playing ? '●' : '○'}`,
        deckId === mixer._mobileFocusDeck ? 'active' : '',
        () => {
          mixer._mobileFocusDeck = deckId;
          renderDeckTabs();
          renderFocusedDeck();
        },
      );
      tabs.appendChild(button);
    }
  };

  const renderFocusedDeck = () => {
    deckBody.replaceChildren();
    const deckId = mixer._mobileFocusDeck;
    const snapshot = mixer.snapshot();
    const state = snapshot.decks[deckId];
    const selectedTrack = tracks.find((track) => track.id === state.trackId) ?? tracks[0];

    const trackRow = this.document.createElement('div');
    trackRow.className = 'mobile-track-row';
    const select = this.document.createElement('select');
    select.setAttribute('aria-label', `Deck ${deckId} track`);
    for (const track of tracks) {
      const option = this.document.createElement('option');
      option.value = track.id;
      option.textContent = `${track.label} · ${track.bpm}`;
      option.selected = track.id === state.trackId;
      select.appendChild(option);
    }
    select.onchange = () => {
      mixer.load(deckId, select.value);
      refreshMetrics();
      renderDeckTabs();
      renderFocusedDeck();
    };
    trackRow.appendChild(select);
    deckBody.appendChild(trackRow);

    const transport = this.document.createElement('div');
    transport.className = 'mobile-dj-transport';
    const play = makeButton(this.document, state.playing ? 'STOP' : 'PLAY', 'primary', async () => {
      if (mixer.decks[deckId].playing) mixer.stopDeck(deckId);
      else await mixer.playDeck(deckId);
      refreshMetrics();
      renderDeckTabs();
      renderFocusedDeck();
    });
    const sync = makeButton(this.document, 'SYNC', '', () => {
      mixer.sync(deckId);
      refreshMetrics();
      renderFocusedDeck();
    });
    transport.append(play, sync);
    deckBody.appendChild(transport);

    const tempoHost = this.document.createElement('div');
    tempoHost.className = 'mobile-dj-tempo';
    const tempo = addRange(this.document, tempoHost, {
      label: 'TEMPO',
      min: selectedTrack.bpm * 0.92,
      max: selectedTrack.bpm * 1.08,
      step: 0.1,
      value: state.bpm,
      format: (value) => `${value.toFixed(1)} BPM`,
      onInput: (value) => {
        mixer.setBpm(deckId, value);
        refreshMetrics();
      },
    });
    deckBody.appendChild(tempoHost);

    const performance = this.document.createElement('div');
    performance.className = 'mobile-dj-performance-pads';
    let nudgeBase = state.bpm;
    addHoldButton(
      this.document,
      performance,
      'NUDGE −',
      'nudge',
      () => {
        nudgeBase = mixer.decks[deckId].bpm;
        mixer.setBpm(deckId, nudgeBase - 0.7);
        refreshMetrics();
      },
      () => {
        mixer.setBpm(deckId, nudgeBase);
        tempo.value = String(mixer.decks[deckId].bpm);
        tempo.dispatchEvent(new Event('input'));
      },
    );
    addHoldButton(
      this.document,
      performance,
      'NUDGE +',
      'nudge',
      () => {
        nudgeBase = mixer.decks[deckId].bpm;
        mixer.setBpm(deckId, nudgeBase + 0.7);
        refreshMetrics();
      },
      () => {
        mixer.setBpm(deckId, nudgeBase);
        tempo.value = String(mixer.decks[deckId].bpm);
        tempo.dispatchEvent(new Event('input'));
      },
    );

    let savedLevel = state.level;
    addHoldButton(
      this.document,
      performance,
      'CUT',
      'punch',
      () => {
        savedLevel = mixer.decks[deckId].level;
        mixer.setLevel(deckId, 0);
        refreshMetrics();
      },
      () => {
        mixer.setLevel(deckId, savedLevel);
        refreshMetrics();
      },
    );

    let savedLow = state.low;
    addHoldButton(
      this.document,
      performance,
      'BASS CUT',
      'punch',
      () => {
        savedLow = mixer.decks[deckId].low;
        mixer.setEq(deckId, 'low', -1);
        refreshMetrics();
      },
      () => {
        mixer.setEq(deckId, 'low', savedLow);
        refreshMetrics();
      },
    );

    let savedHigh = state.high;
    addHoldButton(
      this.document,
      performance,
      'AIR',
      'punch',
      () => {
        savedHigh = mixer.decks[deckId].high;
        mixer.setEq(deckId, 'high', clamp(savedHigh + 0.72, -1, 1));
        refreshMetrics();
      },
      () => {
        mixer.setEq(deckId, 'high', savedHigh);
        refreshMetrics();
      },
    );
    deckBody.appendChild(performance);

    const eq = this.document.createElement('div');
    eq.className = 'mobile-dj-eq';
    addRange(this.document, eq, {
      label: 'LOW',
      min: -1,
      max: 1,
      step: 0.01,
      value: state.low,
      onInput: (value) => {
        mixer.setEq(deckId, 'low', value);
        refreshMetrics();
      },
    });
    addRange(this.document, eq, {
      label: 'HIGH',
      min: -1,
      max: 1,
      step: 0.01,
      value: state.high,
      onInput: (value) => {
        mixer.setEq(deckId, 'high', value);
        refreshMetrics();
      },
    });
    deckBody.appendChild(eq);
  };

  renderDeckTabs();
  renderFocusedDeck();

  const cross = this.document.createElement('div');
  cross.className = 'mobile-crossfader mobile-mixer-always';
  addRange(this.document, cross, {
    label: 'A  ↔  B',
    min: -1,
    max: 1,
    step: 0.01,
    value: initial.crossfader,
    format: () => '',
    onInput: (value) => {
      mixer.setCrossfader(value);
      refreshMetrics();
    },
  });
  shell.appendChild(cross);
};

Hud.prototype.studioMixer = function mobileStudioMixer(session, options = {}) {
  const result = baseStudioMixer.call(this, session, options);
  if (isTouchDevice()) {
    clearMobileMixerClasses(this.document);
    this.document.body?.classList.add('mixer-active', 'studio-mobile-active', 'spectra-console-active');
  }
  return result;
};
