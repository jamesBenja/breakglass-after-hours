export class Hud {
  constructor(document) {
    this.document = document;
    this.status = document.getElementById('status');
    this.title = document.getElementById('pTitle');
    this.text = document.getElementById('pText');
    this.buttons = document.getElementById('buttons');
    this.floorTag = document.getElementById('floorTag');
    this.transition = document.getElementById('transition');
    this.gate = document.getElementById('gate');
    this.enter = document.getElementById('enter');
    this.debug = document.getElementById('debug');
    this.notice = document.getElementById('notice');
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

  clearPanel(title, text) {
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

  studioMixer(session, { onMix = () => {}, onPlay = () => {}, onStop = () => {}, onRecordVocal } = {}) {
    this.clearPanel(
      'SPECTRA CONSOLE',
      `${session.name} · ${session.stems.length} stems. Move the faders: these levels feed the actual prototype session mix.`,
    );
    const grid = this.document.createElement('div');
    grid.className = 'control-grid';
    for (const stem of session.stems) {
      const strip = this.document.createElement('div');
      strip.className = 'mixer-strip';
      const name = this.document.createElement('span');
      name.textContent = stem.label;
      const range = this.document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = '1';
      range.step = '0.01';
      range.value = String(stem.level);
      range.setAttribute('aria-label', `${stem.label} level`);
      const value = this.document.createElement('span');
      value.className = 'mixer-meter';
      value.textContent = `${Math.round(stem.level * 100)}`;
      range.oninput = () => {
        session.setLevel(stem.id, Number(range.value));
        value.textContent = `${Math.round(Number(range.value) * 100)}`;
        onMix();
      };
      const mute = this.document.createElement('button');
      mute.textContent = stem.mute ? 'Unmute' : 'Mute';
      mute.onclick = () => {
        session.toggleMute(stem.id);
        mute.textContent = stem.mute ? 'Unmute' : 'Mute';
        onMix();
      };
      strip.append(name, range, value, mute);
      grid.appendChild(strip);
    }
    this.buttons.appendChild(grid);
    const transport = this.document.createElement('div');
    transport.className = 'row';
    for (const [label, action] of [
      ['Play mix', onPlay],
      ['Stop', onStop],
      ...(onRecordVocal ? [['Record vocal', onRecordVocal]] : []),
    ]) {
      const button = this.document.createElement('button');
      button.textContent = label;
      button.onclick = () => Promise.resolve(action()).catch((error) => this.warning(error.message));
      transport.appendChild(button);
    }
    this.buttons.appendChild(transport);
  }

  djMixer(mixer, tracks, { onChange = () => {} } = {}) {
    const snapshot = mixer.snapshot();
    const quality = snapshot.metrics.playing ? Math.round(snapshot.metrics.mixQuality * 100) : 0;
    const vibe = snapshot.metrics.playing ? Math.round(snapshot.metrics.vibe * 100) : 0;
    this.clearPanel('DJ BOOTH', `Two decks · mix quality ${quality}% · floor vibe ${vibe}%. Selection and transitions now feed the crowd state.`);
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
      addRange('Tempo', selectedTrack.bpm * 0.92, selectedTrack.bpm * 1.08, 0.1, state.bpm, (value) => mixer.setBpm(deckId, value));
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
      ...(crowd ? [`Crowd: ${crowd.attendance}/${crowd.capacity} → ${crowd.targetAttendance}`] : []),
      ...(djState?.metrics?.playing
        ? [`DJ: vibe ${djState.metrics.vibe.toFixed(2)} | mix ${djState.metrics.mixQuality.toFixed(2)}`]
        : []),
      `Avatar: ${state.avatar?.displayName ?? 'Guest'} · ${state.avatar?.role ?? 'explorer'}`,
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
    this.buttons.replaceChildren();
  }
}
