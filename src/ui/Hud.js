export function interactionVerb(target) {
  if (!target) return 'ACTION';
  const action = String(target.action ?? '');
  const name = String(target.name ?? target.label ?? '').toLowerCase();
  const destination = String(target.target ?? '').toLowerCase();

  if (['dialogue', 'alleyGuest', 'remote-player', 'beaverBbq'].includes(action)) return 'TALK';
  if (['photoWall', 'photoFridge', 'liveArchive'].includes(action)) return 'VIEW';
  if (action === 'travel' || action === 'progressionDoor') {
    if (destination.startsWith('alley@') || name.includes('exit')) return 'EXIT';
    return 'ENTER';
  }
  if (action === 'storagePassage') return 'ENTER';
  if (action === 'storageExit') return 'EXIT';
  if (action === 'installation' || name.includes('lighting') || name.includes('visual'))
    return 'CONTROL';
  if (['arcade', 'livePlayback'].includes(action)) return 'PLAY';
  return 'USE';
}

export class Hud {
  constructor(document) {
    this.document = document;
    this.status = document.getElementById('status');
    this.panelElement = document.getElementById('panel');
    this.title = document.getElementById('pTitle');
    this.text = document.getElementById('pText');
    this.buttons = document.getElementById('buttons');
    this.floorTag = document.getElementById('floorTag');
    this.transition = document.getElementById('transition');
    this.gate = document.getElementById('gate');
    this.enter = document.getElementById('enter');
    this.touchPrimary = document.querySelector('[data-action="interact"]');
    this.debug = document.getElementById('debug');
    this.notice = document.getElementById('notice');
    this._spectraMeterTimer = null;
    this._spectraView = 'mixer';
    this.onPanelClose = null;
    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'panel-close';
    this.closeButton.setAttribute('aria-label', 'Close');
    this.closeButton.title = 'Close';
    this.closeButton.textContent = '×';
    this.closeButton.onclick = () => this.closePanel();
    this.panelElement?.appendChild(this.closeButton);
    this.avatar = {
      displayName: document.getElementById('avatarName'),
      identity: document.getElementById('avatarIdentity'),
      body: document.getElementById('avatarBody'),
      hair: document.getElementById('avatarHair'),
      skinTone: document.getElementById('avatarSkin'),
      outfit: document.getElementById('avatarOutfit'),
      role: document.getElementById('avatarRole'),
      photoConsent: document.getElementById('avatarPhotos'),
    };
  }

  setAvatarProfile(profile = {}) {
    for (const [key, input] of Object.entries(this.avatar)) {
      if (!input || profile[key] == null) continue;
      if (input.type === 'checkbox') input.checked = profile[key] !== false;
      else input.value = profile[key];
    }
  }

  avatarProfile() {
    const result = {};
    for (const [key, input] of Object.entries(this.avatar)) {
      if (!input) continue;
      result[key] = input.type === 'checkbox' ? input.checked : input.value;
    }
    return result;
  }

  ready(start) {
    this.enter.disabled = false;
    this.enter.onclick = async () => {
      this.enter.disabled = true;
      try {
        await start(this.avatarProfile());
        this.gate.hidden = true;
      } catch (error) {
        this.warning(`Could not start: ${error.message}`);
        this.enter.disabled = false;
      }
    };
  }

  closePanel() {
    this.stopSpectraMeters();
    this.document.body?.classList.remove(
      'mixer-active',
      'mixer-collapsed',
      'dj-mobile-active',
      'studio-mobile-active',
      'spectra-console-active',
      'performance-active',
    );
    try {
      this.onPanelClose?.();
    } catch (error) {
      console.warn('Panel close cleanup failed', error);
    }
    if (this.panelElement) {
      this.panelElement.hidden = true;
      this.panelElement.classList.remove('photo-review-open', 'spectra-console-panel');
    }
    this.document.querySelector('canvas')?.focus();
  }

  clearPanel(title, text) {
    this.stopSpectraMeters();
    if (this.panelElement) {
      this.panelElement.hidden = false;
      this.panelElement.classList.remove('photo-review-open', 'spectra-console-panel');
    }
    this.title.textContent = title;
    this.text.textContent = text;
    this.buttons.replaceChildren();
  }

  panel(title, text, actions = []) {
    this.clearPanel(title, text);
    for (const [label, action] of actions) {
      const button = this.document.createElement('button');
      button.textContent = label;
      button.onclick = (event) => {
        Promise.resolve()
          .then(action)
          .catch((error) => this.warning(error.message));
        if (event.detail > 0) this.document.querySelector('canvas')?.focus();
      };
      this.buttons.appendChild(button);
    }
  }

  addMixerRange(strip, labelText, min, max, step, current, handler, formatter = null) {
    const label = this.document.createElement('label');
    const caption = this.document.createElement('span');
    const format = formatter ?? ((value) => Number(value).toFixed(step < 1 ? 2 : 0));
    caption.textContent = `${labelText}: ${format(current)}`;
    const range = this.document.createElement('input');
    range.type = 'range';
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(current);
    range.setAttribute('aria-label', labelText);
    range.oninput = () => {
      caption.textContent = `${labelText}: ${format(Number(range.value))}`;
      handler(Number(range.value));
    };
    label.append(caption, range);
    strip.appendChild(label);
    return range;
  }

  stopSpectraMeters() {
    const view = this.document?.defaultView ?? globalThis;
    if (this._spectraMeterTimer != null) view.clearInterval?.(this._spectraMeterTimer);
    this._spectraMeterTimer = null;
  }

  startSpectraMeters(provider, channelMeters = new Map(), masterMeters = null, playhead = null) {
    this.stopSpectraMeters();
    if (typeof provider !== 'function') return;
    const view = this.document?.defaultView ?? globalThis;
    const touch = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
    const update = () => {
      const snapshot = provider();
      if (!snapshot) return;
      for (const [stemId, element] of channelMeters) {
        const level = Math.max(0, Math.min(1, Number(snapshot.channels?.[stemId]) || 0));
        element.style.height = `${Math.round(level * 100)}%`;
      }
      if (masterMeters) {
        const left = Math.max(0, Math.min(1, Number(snapshot.master?.left) || 0));
        const right = Math.max(0, Math.min(1, Number(snapshot.master?.right) || 0));
        masterMeters.left.style.height = `${Math.round(left * 100)}%`;
        masterMeters.right.style.height = `${Math.round(right * 100)}%`;
      }
      if (playhead && snapshot.transport) {
        const steps = Math.max(16, Number(snapshot.transport.loopBars || 4) * 16);
        const step = Math.max(0, Number(snapshot.transport.loopStep) || 0);
        playhead.style.left = `${Math.min(100, (step / steps) * 100)}%`;
      }
    };
    update();
    this._spectraMeterTimer = view.setInterval?.(update, touch ? 250 : 100) ?? null;
  }

  studioMixer(
    session,
    {
      onMix = () => {},
      onPlay = () => {},
      onStop = () => {},
      onRecord = null,
      recordStatus = null,
      onTempo = null,
      onClick = null,
      onLoopBars = null,
      meterProvider = null,
      onAudibility = null,
      onRecordVocal,
      onAudition = null,
    } = {},
  ) {
    this.clearPanel(
      'SPECTRA CONSOLE',
      `${session.name} · ${session.stems.length} channels · input monitoring is always on. Arm individual channels, then use the master RECORD control.`,
    );
    this.panelElement?.classList.add('spectra-console-panel');

    const toolbar = this.document.createElement('div');
    toolbar.className = 'spectra-console-toolbar';

    const transport = this.document.createElement('div');
    transport.className = 'spectra-console-transport';
    const makeTransportButton = (label, className, action) => {
      const button = this.document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      if (className) button.className = className;
      button.onclick = () =>
        Promise.resolve(action?.())
          .then(() => {
            if (action === onRecord) {
              this.studioMixer(session, {
                onMix,
                onPlay,
                onStop,
                onRecord,
                recordStatus,
                onTempo,
                onClick,
                onLoopBars,
                meterProvider,
                onAudibility,
                onRecordVocal,
                onAudition,
              });
            }
          })
          .catch((error) => this.warning(error.message));
      return button;
    };

    transport.append(
      makeTransportButton('▶ PLAY', 'spectra-transport-play', onPlay),
      makeTransportButton('■ STOP', 'spectra-transport-stop', onStop),
    );
    if (onRecord) {
      const recording = recordStatus?.armed === true;
      const record = makeTransportButton(
        recording ? '■ STOP RECORD' : '● RECORD',
        `spectra-transport-record${recording ? ' active' : ''}`,
        onRecord,
      );
      record.setAttribute('aria-pressed', String(recording));
      transport.appendChild(record);
    }
    toolbar.appendChild(transport);

    const global = this.document.createElement('div');
    global.className = 'spectra-console-global';

    const tempoLabel = this.document.createElement('span');
    tempoLabel.className = 'spectra-global-label';
    tempoLabel.textContent = 'TEMPO';

    const tempoDown = this.document.createElement('button');
    tempoDown.type = 'button';
    tempoDown.textContent = '−';
    tempoDown.className = 'spectra-tempo-step';

    const tempoInput = this.document.createElement('input');
    tempoInput.type = 'number';
    tempoInput.min = '50';
    tempoInput.max = '220';
    tempoInput.step = '1';
    tempoInput.value = String(Math.round(Number(session.bpm) || 118));
    tempoInput.className = 'spectra-tempo-input';
    tempoInput.setAttribute('aria-label', 'Spectra global tempo');

    const tempoUp = this.document.createElement('button');
    tempoUp.type = 'button';
    tempoUp.textContent = '+';
    tempoUp.className = 'spectra-tempo-step';

    const applyTempo = (next) => {
      const bpm = Math.max(50, Math.min(220, Math.round(Number(next) || 118)));
      tempoInput.value = String(bpm);
      if (onTempo) onTempo(bpm);
      else session.bpm = bpm;
    };
    tempoDown.onclick = () => applyTempo((Number(tempoInput.value) || session.bpm || 118) - 1);
    tempoUp.onclick = () => applyTempo((Number(tempoInput.value) || session.bpm || 118) + 1);
    tempoInput.onchange = () => applyTempo(tempoInput.value);

    const bpmUnit = this.document.createElement('span');
    bpmUnit.className = 'spectra-tempo-unit';
    bpmUnit.textContent = 'BPM';

    const click = this.document.createElement('button');
    click.type = 'button';
    click.className = `spectra-click-toggle${session.clickEnabled ? ' active' : ''}`;
    click.textContent = session.clickEnabled ? 'CLICK ON' : 'CLICK OFF';
    click.setAttribute('aria-pressed', String(session.clickEnabled === true));
    click.onclick = () => {
      session.clickEnabled = !session.clickEnabled;
      onClick?.(session.clickEnabled);
      click.classList.toggle('active', session.clickEnabled);
      click.textContent = session.clickEnabled ? 'CLICK ON' : 'CLICK OFF';
      click.setAttribute('aria-pressed', String(session.clickEnabled));
    };

    global.append(tempoLabel, tempoDown, tempoInput, tempoUp, bpmUnit, click);
    toolbar.appendChild(global);

    const status = this.document.createElement('div');
    status.className = 'spectra-console-status';
    const armedCount = session.stems.filter((stem) => stem.recordArm === true).length;
    const liveText = recordStatus?.recording
      ? `RECORDING · ${recordStatus.lanes ?? 0} INPUT${recordStatus?.lanes === 1 ? '' : 'S'}`
      : recordStatus?.armed
        ? 'RECORD READY'
        : 'READY';
    status.textContent = `${liveText} · ${armedCount} ARMED · MONITOR ALL`;
    toolbar.appendChild(status);

    if (onRecordVocal) {
      const vox = makeTransportButton('REC VOX', 'spectra-console-utility', onRecordVocal);
      toolbar.appendChild(vox);
    }

    const masterMeter = this.document.createElement('div');
    masterMeter.className = 'spectra-master-meter';
    const makeMasterLane = (label) => {
      const lane = this.document.createElement('div');
      lane.className = 'spectra-master-meter-lane';
      const fill = this.document.createElement('span');
      fill.className = 'spectra-master-meter-fill';
      const caption = this.document.createElement('small');
      caption.textContent = label;
      lane.append(fill, caption);
      masterMeter.appendChild(lane);
      return fill;
    };
    const masterMeters = {
      left: makeMasterLane('L'),
      right: makeMasterLane('R'),
    };
    toolbar.appendChild(masterMeter);
    this.buttons.appendChild(toolbar);

    const redraw = () =>
      this.studioMixer(session, {
        onMix,
        onPlay,
        onStop,
        onRecord,
        recordStatus,
        onTempo,
        onClick,
        onLoopBars,
        meterProvider,
        onAudibility,
        onRecordVocal,
        onAudition,
      });

    const views = this.document.createElement('div');
    views.className = 'spectra-view-switch';
    for (const [id, label] of [
      ['mixer', 'MIXER'],
      ['session', 'SESSION'],
    ]) {
      const button = this.document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.classList.toggle('active', this._spectraView === id);
      button.onclick = () => {
        this._spectraView = id;
        redraw();
      };
      views.appendChild(button);
    }
    this.buttons.appendChild(views);

    if (typeof session.addInputTrack === 'function') {
      const addTrack = this.document.createElement('button');
      addTrack.type = 'button';
      addTrack.className = 'spectra-add-track';
      addTrack.textContent = '+ ADD TRACK';
      addTrack.onclick = () => {
        this.stopSpectraMeters();
        this.clearPanel(
          'ADD SPECTRA TRACK',
          'Choose the live input for the new console channel. Input monitoring stays on; arm the new strip when you want it included in the next recording.',
        );

        const choices = [
          ['DRUM MACHINE', 'drum-machine'],
          ['DRUM KIT', 'drum-kit'],
          ['SYNTH / ORGAN', 'synth'],
          ['MODULAR SYNTH', 'modular'],
          ['GUITAR / BASS', 'guitar'],
          ['PIANO', 'piano'],
        ];
        for (const [label, inputKey] of choices) {
          const button = this.document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.onclick = () => {
            const stem = session.addInputTrack(inputKey);
            if (!stem) {
              this.warning('Spectra supports up to 12 tracks in the current session.');
              redraw();
              return;
            }
            this._spectraView = 'mixer';
            onMix(stem.id);
            redraw();
          };
          this.buttons.appendChild(button);
        }

        const cancel = this.document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'BACK TO MIXER';
        cancel.onclick = redraw;
        this.buttons.appendChild(cancel);
      };
      this.buttons.appendChild(addTrack);
    }

    if (this._spectraView === 'session') {
      const loopBars = Math.max(1, Number(session.loopBars) || 4);
      const loopSeconds = (loopBars * 4 * 60) / Math.max(1, Number(session.bpm) || 118);
      const sessionView = this.document.createElement('div');
      sessionView.className = 'spectra-session-view';

      const header = this.document.createElement('div');
      header.className = 'spectra-session-header';
      const summary = this.document.createElement('strong');
      summary.textContent = `LOOP · ${loopBars} BAR${loopBars === 1 ? '' : 'S'} · ${loopSeconds.toFixed(
        2,
      )} SEC · ${session.quantize || '1/16'} GRID`;
      const lengthControls = this.document.createElement('div');
      lengthControls.className = 'spectra-loop-length-controls';
      for (const bars of [1, 2, 4, 8, 16]) {
        const button = this.document.createElement('button');
        button.type = 'button';
        button.textContent = `${bars} BAR${bars === 1 ? '' : 'S'}`;
        button.classList.toggle('active', bars === loopBars);
        button.onclick = async () => {
          await onLoopBars?.(bars);
          session.loopBars = bars;
          session.loopEnabled = true;
          redraw();
        };
        lengthControls.appendChild(button);
      }
      header.append(summary, lengthControls);
      sessionView.appendChild(header);

      const timeline = this.document.createElement('div');
      timeline.className = 'spectra-session-timeline';
      const ruler = this.document.createElement('div');
      ruler.className = 'spectra-session-ruler';
      ruler.style.setProperty('--spectra-loop-bars', String(loopBars));
      for (let bar = 1; bar <= loopBars; bar += 1) {
        const marker = this.document.createElement('span');
        marker.textContent = `BAR ${bar}`;
        ruler.appendChild(marker);
      }
      const playheadTrack = this.document.createElement('div');
      playheadTrack.className = 'spectra-session-playhead-track';
      const playhead = this.document.createElement('div');
      playhead.className = 'spectra-session-playhead';
      playheadTrack.appendChild(playhead);
      timeline.append(ruler, playheadTrack);

      for (const stem of session.stems) {
        const row = this.document.createElement('div');
        row.className = 'spectra-session-track';
        const label = this.document.createElement('strong');
        label.textContent = stem.label;
        const lane = this.document.createElement('div');
        lane.className = 'spectra-session-lane';
        lane.style.setProperty('--spectra-loop-bars', String(loopBars));
        const eventCount = stem.performance?.events?.length ?? 0;
        const hasAudio = session.recordings?.has?.(stem.id) === true;
        const hasClip = eventCount > 0 || hasAudio || !!stem.assetId;
        if (hasClip) {
          const clip = this.document.createElement('div');
          clip.className = 'spectra-session-clip';
          clip.textContent = hasAudio
            ? `AUDIO LOOP · ${loopBars} BAR${loopBars === 1 ? '' : 'S'}${eventCount ? ` · SOURCE ${eventCount} EVENT${eventCount === 1 ? '' : 'S'}` : ''}`
            : eventCount
              ? `${eventCount} EVENT${eventCount === 1 ? '' : 'S'} · ${loopBars} BAR LOOP`
              : `AUDIO · ${loopBars} BAR LOOP`;
          lane.appendChild(clip);
        } else {
          const empty = this.document.createElement('span');
          empty.className = 'spectra-session-empty';
          empty.textContent = stem.recordArm ? 'ARMED · WAITING FOR RECORD' : 'EMPTY';
          lane.appendChild(empty);
        }
        row.append(label, lane);
        timeline.appendChild(row);
      }

      sessionView.appendChild(timeline);
      this.buttons.appendChild(sessionView);
      this.startSpectraMeters(meterProvider, new Map(), masterMeters, playhead);
      return;
    }

    const channelMeters = new Map();
    const desk = this.document.createElement('div');
    desk.className = 'spectra-console-desk';

    const addMiniRange = (strip, stem, key, labelText, min, max, value, handler) => {
      const control = this.document.createElement('label');
      control.className = 'spectra-console-mini';
      const caption = this.document.createElement('span');
      caption.textContent = labelText;
      const range = this.document.createElement('input');
      range.type = 'range';
      range.min = String(min);
      range.max = String(max);
      range.step = '0.01';
      range.value = String(value);
      range.setAttribute('aria-label', `${stem.label} ${labelText}`);
      range.dataset.parameter = key;
      range.oninput = () => {
        handler(Number(range.value));
        onMix(stem.id);
      };
      control.append(caption, range);
      strip.appendChild(control);
    };

    session.stems.forEach((stem, index) => {
      const strip = this.document.createElement('section');
      strip.className = 'spectra-console-channel';
      strip.dataset.stemId = stem.id;

      const channelNumber = this.document.createElement('div');
      channelNumber.className = 'spectra-channel-number';
      channelNumber.textContent = String(index + 1).padStart(2, '0');

      const input = this.document.createElement('div');
      input.className = 'spectra-channel-input';
      const inputName = this.document.createElement('strong');
      inputName.textContent = stem.label;
      const source = this.document.createElement('small');
      source.textContent = stem.inputKey
        ? stem.inputKey.replaceAll('-', ' ').toUpperCase()
        : (stem.source || stem.kind || 'audio').toUpperCase();
      input.append(inputName, source);

      const monitor = this.document.createElement('div');
      monitor.className = 'spectra-monitor on';
      monitor.textContent = 'MON';
      monitor.title = 'Input monitoring is always on';

      const arm = this.document.createElement('button');
      arm.type = 'button';
      arm.className = `spectra-arm${stem.recordArm ? ' active' : ''}`;
      arm.textContent = stem.recordArm ? 'ARMED' : 'ARM';
      arm.setAttribute('aria-pressed', String(stem.recordArm === true));
      arm.onclick = () => {
        session.toggleRecordArm?.(stem.id);
        arm.classList.toggle('active', stem.recordArm === true);
        arm.textContent = stem.recordArm ? 'ARMED' : 'ARM';
        arm.setAttribute('aria-pressed', String(stem.recordArm === true));
        onMix(stem.id);
        const count = session.stems.filter((item) => item.recordArm === true).length;
        status.textContent = `${recordStatus?.armed ? 'RECORD READY' : 'READY'} · ${count} ARMED · MONITOR ALL`;
      };

      strip.append(channelNumber, input, monitor, arm);

      const eq = this.document.createElement('div');
      eq.className = 'spectra-console-eq';
      addMiniRange(eq, stem, 'high', 'HIGH', -1, 1, stem.high ?? 0, (value) =>
        session.setEq(stem.id, 'high', value),
      );
      addMiniRange(eq, stem, 'low', 'LOW', -1, 1, stem.low ?? 0, (value) =>
        session.setEq(stem.id, 'low', value),
      );
      strip.appendChild(eq);

      const routing = this.document.createElement('div');
      routing.className = 'spectra-console-routing';
      addMiniRange(routing, stem, 'pan', 'PAN', -1, 1, stem.pan ?? 0, (value) =>
        session.setPan(stem.id, value),
      );
      addMiniRange(routing, stem, 'fx', 'FX', 0, 1, stem.fx ?? 0, (value) =>
        session.setFx(stem.id, value),
      );
      strip.appendChild(routing);

      const switches = this.document.createElement('div');
      switches.className = 'spectra-console-switches';
      const mute = this.document.createElement('button');
      const solo = this.document.createElement('button');
      const refreshSwitches = () => {
        mute.textContent = stem.mute ? 'MUTED' : 'MUTE';
        solo.textContent = stem.solo ? 'SOLO' : 'SOLO';
        mute.classList.toggle('active', stem.mute === true);
        solo.classList.toggle('active', stem.solo === true);
        mute.setAttribute('aria-pressed', String(stem.mute === true));
        solo.setAttribute('aria-pressed', String(stem.solo === true));
      };
      mute.onclick = () => {
        session.toggleMute(stem.id);
        refreshSwitches();
        onMix(stem.id);
        onAudibility?.();
      };
      solo.onclick = () => {
        session.toggleSolo(stem.id);
        refreshSwitches();
        onMix(stem.id);
        onAudibility?.();
      };
      refreshSwitches();
      switches.append(mute, solo);
      strip.appendChild(switches);

      const faderSection = this.document.createElement('div');
      faderSection.className = 'spectra-fader-section';
      const scale = this.document.createElement('div');
      scale.className = 'spectra-fader-scale';
      scale.innerHTML = '<span>+10</span><span>0</span><span>-10</span><span>-∞</span>';
      const fader = this.document.createElement('input');
      fader.type = 'range';
      fader.min = '0';
      fader.max = '1';
      fader.step = '0.01';
      fader.value = String(stem.level);
      fader.className = 'spectra-fader';
      fader.setAttribute('aria-label', `${stem.label} fader`);
      const meter = this.document.createElement('div');
      meter.className = 'spectra-channel-meter';
      const meterFill = this.document.createElement('span');
      meterFill.className = 'spectra-channel-meter-fill';
      meter.appendChild(meterFill);
      channelMeters.set(stem.id, meterFill);

      const readout = this.document.createElement('output');
      readout.className = 'spectra-fader-readout';
      const syncFader = () => {
        readout.textContent = String(Math.round(Number(fader.value) * 100));
      };
      fader.oninput = () => {
        session.setLevel(stem.id, Number(fader.value));
        syncFader();
        onMix(stem.id);
      };
      syncFader();
      faderSection.append(scale, fader, meter, readout);
      strip.appendChild(faderSection);

      if (onAudition) {
        const audition = this.document.createElement('button');
        audition.type = 'button';
        audition.className = 'spectra-audition';
        audition.textContent = 'PFL';
        audition.onclick = () =>
          Promise.resolve(onAudition(stem.id)).catch((error) => this.warning(error.message));
        strip.appendChild(audition);
      }

      desk.appendChild(strip);
    });

    this.buttons.appendChild(desk);

    const master = this.document.createElement('div');
    master.className = 'spectra-console-master';
    const clearMutes = this.document.createElement('button');
    clearMutes.textContent = 'CLEAR MUTES';
    clearMutes.onclick = () => {
      for (const stem of session.stems) stem.mute = false;
      onMix();
      onAudibility?.();
      this.studioMixer(session, {
        onMix,
        onPlay,
        onStop,
        onRecord,
        recordStatus,
        onTempo,
        onClick,
        onLoopBars,
        meterProvider,
        onAudibility,
        onRecordVocal,
        onAudition,
      });
    };
    const clearSolos = this.document.createElement('button');
    clearSolos.textContent = 'CLEAR SOLOS';
    clearSolos.onclick = () => {
      for (const stem of session.stems) stem.solo = false;
      onMix();
      onAudibility?.();
      this.studioMixer(session, {
        onMix,
        onPlay,
        onStop,
        onRecord,
        recordStatus,
        onTempo,
        onClick,
        onLoopBars,
        meterProvider,
        onAudibility,
        onRecordVocal,
        onAudition,
      });
    };
    master.append(clearMutes, clearSolos);
    this.buttons.appendChild(master);
    this.startSpectraMeters(meterProvider, channelMeters, masterMeters);
  }

  djMixer(mixer, tracks, { onChange = () => {} } = {}) {
    const snapshot = mixer.snapshot();
    const quality = snapshot.metrics.playing ? Math.round(snapshot.metrics.mixQuality * 100) : 0;
    const vibe = snapshot.metrics.playing ? Math.round(snapshot.metrics.vibe * 100) : 0;
    this.clearPanel(
      'DJ BOOTH',
      `Two decks · mix quality ${quality}% · floor vibe ${vibe}%. Bad blends now visibly send people toward the edges; clean transitions pull them back in.`,
    );
    const decks = this.document.createElement('div');
    decks.className = 'dj-decks';

    for (const deckId of ['A', 'B']) {
      const state = snapshot.decks[deckId];
      const deck = this.document.createElement('div');
      deck.className = 'dj-deck control-grid';
      const heading = this.document.createElement('strong');
      heading.textContent = `DECK ${deckId}`;
      deck.appendChild(heading);

      const selectLabel = this.document.createElement('label');
      selectLabel.textContent = 'Track';
      const select = this.document.createElement('select');
      for (const track of tracks) {
        const option = this.document.createElement('option');
        option.value = track.id;
        option.textContent = `${track.label} · ${track.bpm}`;
        option.selected = track.id === state.trackId;
        select.appendChild(option);
      }
      select.onchange = () => {
        mixer.load(deckId, select.value);
        onChange();
        this.djMixer(mixer, tracks, { onChange });
      };
      selectLabel.appendChild(select);
      deck.appendChild(selectLabel);

      const addRange = (labelText, min, max, step, current, handler) => {
        const label = this.document.createElement('label');
        const caption = this.document.createElement('span');
        caption.textContent = `${labelText}: ${Number(current).toFixed(step < 1 ? 2 : 0)}`;
        const range = this.document.createElement('input');
        range.type = 'range';
        range.min = String(min);
        range.max = String(max);
        range.step = String(step);
        range.value = String(current);
        range.oninput = () => {
          caption.textContent = `${labelText}: ${Number(range.value).toFixed(step < 1 ? 2 : 0)}`;
          handler(Number(range.value));
          onChange();
        };
        label.append(caption, range);
        deck.appendChild(label);
      };
      const selectedTrack = tracks.find((track) => track.id === state.trackId) ?? tracks[0];
      addRange(
        'Tempo',
        selectedTrack.bpm * 0.92,
        selectedTrack.bpm * 1.08,
        0.1,
        state.bpm,
        (value) => mixer.setBpm(deckId, value),
      );
      addRange('Level', 0, 1, 0.01, state.level, (value) => mixer.setLevel(deckId, value));
      addRange('Low EQ', -1, 1, 0.01, state.low, (value) => mixer.setEq(deckId, 'low', value));
      addRange('High EQ', -1, 1, 0.01, state.high, (value) => mixer.setEq(deckId, 'high', value));

      const row = this.document.createElement('div');
      row.className = 'row';
      const play = this.document.createElement('button');
      play.textContent = state.playing ? 'Stop' : 'Play';
      play.onclick = async () => {
        if (state.playing) mixer.stopDeck(deckId);
        else await mixer.playDeck(deckId);
        onChange();
        this.djMixer(mixer, tracks, { onChange });
      };
      const sync = this.document.createElement('button');
      sync.textContent = 'Sync';
      sync.onclick = () => {
        mixer.sync(deckId);
        onChange();
        this.djMixer(mixer, tracks, { onChange });
      };
      row.append(play, sync);
      deck.appendChild(row);
      decks.appendChild(deck);
    }
    this.buttons.appendChild(decks);

    const cross = this.document.createElement('label');
    cross.className = 'control-grid';
    const crossText = this.document.createElement('span');
    crossText.textContent = 'Crossfader A ↔ B';
    const range = this.document.createElement('input');
    range.type = 'range';
    range.min = '-1';
    range.max = '1';
    range.step = '0.01';
    range.value = String(snapshot.crossfader);
    range.oninput = () => {
      mixer.setCrossfader(Number(range.value));
      onChange();
    };
    cross.append(crossText, range);
    this.buttons.appendChild(cross);
  }

  photoGallery(photos = [], title = 'TAKE A BREAK · PHOTO WALL') {
    this.clearPanel(
      title,
      photos.length
        ? `${photos.length} recent shot${photos.length === 1 ? '' : 's'} from this save. Nora's camera is rendering from her position in the room, not from the player camera.`
        : 'No saved photos yet. Find Nora and ask for a portrait.',
    );
    if (!photos.length) return;
    const grid = this.document.createElement('div');
    grid.className = 'control-grid';
    for (const photo of [...photos].reverse()) {
      const card = this.document.createElement('figure');
      card.className = 'mixer-strip';
      const image = this.document.createElement('img');
      image.src = photo.dataUrl;
      image.alt = `Breakglass photo by ${photo.photographerId ?? 'Nora'}`;
      image.style.width = '100%';
      image.style.height = 'auto';
      image.style.display = 'block';
      const caption = this.document.createElement('figcaption');
      const time = photo.timestamp
        ? new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      caption.textContent = `${photo.photographerId === 'nora' ? 'Nora' : (photo.photographerId ?? 'Breakglass')} · ${photo.roomId ?? 'Breakglass'}${time ? ` · ${time}` : ''}`;
      card.append(image, caption);
      grid.appendChild(card);
    }
    this.buttons.appendChild(grid);
  }

  downloadPhoto(photo) {
    if (!photo?.dataUrl) return false;
    const link = this.document.createElement('a');
    const parsed = photo.timestamp ? new Date(photo.timestamp) : new Date();
    const stamp = Number.isNaN(parsed.getTime())
      ? String(Date.now())
      : parsed.toISOString().replace(/[:.]/g, '-');
    link.href = photo.dataUrl;
    link.download = `breakglass-nora-${stamp}.jpg`;
    link.rel = 'noopener';
    link.hidden = true;
    this.document.body.appendChild(link);
    if ('download' in link) link.click();
    else globalThis.open?.(photo.dataUrl, '_blank', 'noopener');
    link.remove();
    return true;
  }

  photoReview(photo, { onLove = null, onRetake = null } = {}) {
    if (!photo?.dataUrl) return;
    this.clearPanel('NORA · YOUR PHOTO', 'Nora shows you the shot right away.');
    this.panelElement?.classList.add('photo-review-open');

    const figure = this.document.createElement('figure');
    figure.className = 'photo-review';
    const image = this.document.createElement('img');
    image.src = photo.dataUrl;
    image.alt = 'Your Breakglass photo taken by Nora';
    const caption = this.document.createElement('figcaption');
    const time = photo.timestamp
      ? new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    caption.textContent = `Nora · ${photo.roomId ?? 'Breakglass'}${time ? ` · ${time}` : ''}`;
    figure.append(image, caption);
    this.buttons.appendChild(figure);

    const row = this.document.createElement('div');
    row.className = 'photo-review-actions';
    const addButton = (label, action) => {
      const button = this.document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.onclick = () =>
        Promise.resolve(action?.()).catch((error) => this.warning(error.message));
      row.appendChild(button);
    };

    addButton('I love it', () => {
      this.warning('Nora saved the shot to your Breakglass photos.');
      if (onLove) return onLove(photo);
      this.closePanel();
      return null;
    });
    if (onRetake) addButton('Take another one please', () => onRetake(photo));
    addButton('Download photo', () => this.downloadPhoto(photo));
    this.buttons.appendChild(row);
  }

  warning(message) {
    this.notice.textContent = message;
    this.notice.hidden = false;
  }

  fade(active) {
    this.transition.classList.toggle('on', active);
    this.transition.setAttribute('aria-hidden', String(!active));
  }

  update({ level, player, target, audio, state, transitionPhase, fps, camera, dj }) {
    const ground = level.collision.surfaceAt(
      player.position.x,
      player.position.z,
      player.position.y + 0.25,
    );
    const room = ground?.surface.name ?? level.definition.id;
    const verb = interactionVerb(target);
    const targetName = target?.name ?? target?.label ?? 'interaction';
    const status =
      room +
      (target ? ` · E: ${verb.toLowerCase()} ${targetName}` : '') +
      (audio.label ? ` · ${audio.label}` : '');
    if (this.status.textContent !== status) this.status.textContent = status;
    if (this.touchPrimary) {
      if (this.touchPrimary.textContent !== verb) this.touchPrimary.textContent = verb;
      this.touchPrimary.setAttribute(
        'aria-label',
        target ? `${verb.toLowerCase()} ${targetName}` : 'Action',
      );
    }
    this.debug.hidden = !state.debug;
    if (!state.debug) return;
    const lighting = level.lighting?.snapshot();
    const crowd = level.crowd?.snapshot();
    const alley = level.alley?.snapshot?.();
    const djState = dj?.snapshot?.();
    this.debug.textContent = [
      `Scene: ${level.definition.id}${level.definition.pass ? ` / Pass ${level.definition.pass}` : ''} | transition: ${transitionPhase}`,
      `Position: ${player.position
        .toArray()
        .map((v) => v.toFixed(2))
        .join(', ')}`,
      `Collision region: ${ground?.surface.id ?? 'none'} | grounded: ${player.grounded}`,
      `Collision target: ${player.collisionTarget ?? 'none'} | ground: ${player.groundTarget ?? 'none'}`,
      `Camera: ${camera?.mode ?? 'follow'} | target ${camera?.collisionTarget ?? 'clear'} | boom: ${camera?.clearance.toFixed(2)} units`,
      `Interaction: ${target?.id ?? 'none'}`,
      `Geometry: ${level.geometrySource} (${level.definition.provenance.status})`,
      `Audio: ${audio.trackId ?? audio.label ?? 'stopped'} | ${audio.context?.state ?? 'not started'} | voices: ${audio.voices.size}`,
      ...(lighting
        ? [
            `Lighting: ${lighting.preset} | haze ${(lighting.haze * 100).toFixed(0)}% | fog ${lighting.fogNear?.toFixed(1)}→${lighting.fogFar?.toFixed(1)} | lasers ${lighting.lasers ? 'on' : 'off'}`,
            `Audio energy: ${lighting.energy.toFixed(2)} | bass ${lighting.bass.toFixed(2)} | beat ${lighting.beat.toFixed(2)}`,
          ]
        : []),
      ...(crowd
        ? [`Crowd: ${crowd.attendance}/${crowd.capacity} → ${crowd.targetAttendance}`]
        : []),
      ...(alley
        ? [
            `Alley: ${alley.occupancy} outside | disturbance ${Math.round(alley.disturbance * 100)}% | warning ${alley.staffWarningLevel}`,
          ]
        : []),
      ...(djState?.metrics?.playing
        ? [
            `DJ: vibe ${djState.metrics.vibe.toFixed(2)} | mix ${djState.metrics.mixQuality.toFixed(2)}`,
          ]
        : []),
      `Avatar: ${state.avatar?.displayName ?? 'Guest'} · ${state.avatar?.role ?? 'explorer'}`,
      `Photos: ${state.photos?.length ?? 0} | tape: ${state.archiveTape ?? 'none'} / threaded ${state.threadedTape ?? 'none'}`,
      `Contacts: ${state.contacts.join(', ') || 'none'} | last track: ${state.lastTrack ?? 'none'}`,
      `Visited: ${state.visited.join(', ')} | ${fps.toFixed(0)} fps`,
    ].join('\n');
  }

  fatal(error) {
    this.gate.hidden = false;
    this.gate.querySelector('.card p').textContent =
      `The game could not load: ${error.message}. Reload to try again.`;
    this.enter.disabled = true;
  }

  dispose() {
    this.enter.onclick = null;
    if (this.closeButton) this.closeButton.onclick = null;
    this.closeButton?.remove?.();
    this.buttons.replaceChildren();
  }
}
