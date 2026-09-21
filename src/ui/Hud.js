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
    if (this.panelElement) {
      this.panelElement.hidden = true;
      this.panelElement.classList.remove('photo-review-open');
    }
    this.document.querySelector('canvas')?.focus();
  }

  clearPanel(title, text) {
    if (this.panelElement) {
      this.panelElement.hidden = false;
      this.panelElement.classList.remove('photo-review-open');
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

  studioMixer(
    session,
    {
      onMix = () => {},
      onPlay = () => {},
      onStop = () => {},
      onRecord = null,
      recordStatus = null,
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
    this.buttons.appendChild(toolbar);

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
        onMix();
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
        onMix();
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
        onMix();
      };
      solo.onclick = () => {
        session.toggleSolo(stem.id);
        refreshSwitches();
        onMix();
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
      const readout = this.document.createElement('output');
      readout.className = 'spectra-fader-readout';
      const syncFader = () => {
        readout.textContent = String(Math.round(Number(fader.value) * 100));
      };
      fader.oninput = () => {
        session.setLevel(stem.id, Number(fader.value));
        syncFader();
        onMix();
      };
      syncFader();
      faderSection.append(scale, fader, readout);
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
      this.studioMixer(session, {
        onMix,
        onPlay,
        onStop,
        onRecord,
        recordStatus,
        onRecordVocal,
        onAudition,
      });
    };
    const clearSolos = this.document.createElement('button');
    clearSolos.textContent = 'CLEAR SOLOS';
    clearSolos.onclick = () => {
      for (const stem of session.stems) stem.solo = false;
      onMix();
      this.studioMixer(session, {
        onMix,
        onPlay,
        onStop,
        onRecord,
        recordStatus,
        onRecordVocal,
        onAudition,
      });
    };
    master.append(clearMutes, clearSolos);
    this.buttons.appendChild(master);
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
