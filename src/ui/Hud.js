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
    if (this.panelElement) this.panelElement.hidden = true;
    this.document.querySelector('canvas')?.focus();
  }

  clearPanel(title, text) {
    if (this.panelElement) this.panelElement.hidden = false;
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
      onRecordVocal,
      onAudition = null,
    } = {},
  ) {
    this.clearPanel(
      'SPECTRA CONSOLE',
      `${session.name} · ${session.stems.length} stems. Fader, pan, shelves, FX send, mute and solo all feed the actual WebAudio channel strips.`,
    );
    const grid = this.document.createElement('div');
    grid.className = 'control-grid';
    for (const stem of session.stems) {
      const strip = this.document.createElement('div');
      strip.className = 'mixer-strip';
      const name = this.document.createElement('strong');
      name.textContent = stem.label;
      const source = this.document.createElement('small');
      const eventCount = stem.performance?.events?.length ?? 0;
      const recordingSeconds = session.recordings?.get?.(stem.id)?.duration;
      const material = eventCount
        ? ` · ${eventCount} event${eventCount === 1 ? '' : 's'}`
        : Number.isFinite(recordingSeconds)
          ? ` · ${recordingSeconds.toFixed(1)}s audio`
          : stem.assetId
            ? ' · audio asset'
            : ' · generated';
      source.textContent = `${stem.source ? ` · ${stem.source}` : ''}${material}`;
      name.appendChild(source);
      strip.appendChild(name);

      this.addMixerRange(
        strip,
        `${stem.label} level`,
        0,
        1,
        0.01,
        stem.level,
        (value) => {
          session.setLevel(stem.id, value);
          onMix();
        },
        (value) => String(Math.round(Number(value) * 100)),
      );
      this.addMixerRange(strip, 'Pan', -1, 1, 0.01, stem.pan ?? 0, (value) => {
        session.setPan(stem.id, value);
        onMix();
      });
      this.addMixerRange(strip, 'Low shelf', -1, 1, 0.01, stem.low ?? 0, (value) => {
        session.setEq(stem.id, 'low', value);
        onMix();
      });
      this.addMixerRange(strip, 'High shelf', -1, 1, 0.01, stem.high ?? 0, (value) => {
        session.setEq(stem.id, 'high', value);
        onMix();
      });
      this.addMixerRange(strip, 'FX send', 0, 1, 0.01, stem.fx ?? 0, (value) => {
        session.setFx(stem.id, value);
        onMix();
      });

      const row = this.document.createElement('div');
      row.className = 'row';
      const mute = this.document.createElement('button');
      const solo = this.document.createElement('button');
      const audition = onAudition ? this.document.createElement('button') : null;
      const refresh = () => {
        mute.textContent = stem.mute ? 'MUTED' : 'MUTE';
        solo.textContent = stem.solo ? 'SOLOED' : 'SOLO';
        mute.setAttribute('aria-pressed', String(stem.mute === true));
        solo.setAttribute('aria-pressed', String(stem.solo === true));
        mute.classList.toggle('mixer-toggle-active', stem.mute === true);
        solo.classList.toggle('mixer-toggle-active', stem.solo === true);
        strip.classList.toggle('mixer-strip-muted', stem.mute === true);
        strip.classList.toggle('mixer-strip-solo', stem.solo === true);
      };
      refresh();
      mute.onclick = () => {
        session.toggleMute(stem.id);
        refresh();
        onMix();
      };
      solo.onclick = () => {
        session.toggleSolo(stem.id);
        refresh();
        onMix();
      };
      if (audition) {
        audition.textContent = 'Audition';
        audition.onclick = () =>
          Promise.resolve(onAudition(stem.id)).catch((error) => this.warning(error.message));
        row.append(mute, solo, audition);
      } else row.append(mute, solo);
      strip.appendChild(row);
      grid.appendChild(strip);
    }
    this.buttons.appendChild(grid);

    const mixState = this.document.createElement('div');
    mixState.className = 'row spectra-mix-state';
    const clearMutes = this.document.createElement('button');
    const clearSolos = this.document.createElement('button');
    const refreshMixState = () => {
      const muted = session.stems.filter((stem) => stem.mute).length;
      const soloed = session.stems.filter((stem) => stem.solo).length;
      clearMutes.textContent = muted ? `CLEAR MUTES · ${muted}` : 'CLEAR MUTES';
      clearSolos.textContent = soloed ? `CLEAR SOLOS · ${soloed}` : 'CLEAR SOLOS';
      clearMutes.disabled = muted === 0;
      clearSolos.disabled = soloed === 0;
    };
    clearMutes.onclick = () => {
      for (const stem of session.stems) stem.mute = false;
      onMix();
      this.studioMixer(session, { onMix, onPlay, onStop, onRecordVocal, onAudition });
    };
    clearSolos.onclick = () => {
      for (const stem of session.stems) stem.solo = false;
      onMix();
      this.studioMixer(session, { onMix, onPlay, onStop, onRecordVocal, onAudition });
    };
    refreshMixState();
    mixState.append(clearMutes, clearSolos);
    this.buttons.appendChild(mixState);

    const transport = this.document.createElement('div');
    transport.className = 'row';
    for (const [label, action] of [
      ['Play mix', onPlay],
      ['Stop', onStop],
      ...(onRecordVocal ? [['Record vocal', onRecordVocal]] : []),
    ]) {
      const button = this.document.createElement('button');
      button.textContent = label;
      button.onclick = () =>
        Promise.resolve(action()).catch((error) => this.warning(error.message));
      transport.appendChild(button);
    }
    this.buttons.appendChild(transport);
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
    const status =
      room + (target ? ` · E: ${target.name}` : '') + (audio.label ? ` · ${audio.label}` : '');
    if (this.status.textContent !== status) this.status.textContent = status;
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
