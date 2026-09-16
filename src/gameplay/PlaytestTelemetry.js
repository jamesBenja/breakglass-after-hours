const TELEMETRY_SERVER = 'https://multiplayer-phase2-live-production.up.railway.app';
const BROWSER_KEY = 'breakglass.playtest.browser.v1';
const HEARTBEAT_MS = 20_000;
const SAMPLE_MS = 500;

const PROGRESSION_FLAGS = [
  'guestlistApproved',
  'djAccessGranted',
  'studioAccessGranted',
  'studioInviteAccess',
  'houseDjDeskIntroduced',
  'storageAccessGranted',
  'tapeArchiveAccessGranted',
  'deadRoomAccessGranted',
  'roofSecretUnlocked',
  'mixingRewardKey',
  'alleyShortcutUnlocked',
  'maddoxCompanion',
];

const clean = (value, max = 64) =>
  typeof value === 'string' ? value.replace(/[^a-zA-Z0-9 _./:-]/g, '').trim().slice(0, max) : '';

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function playtestId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return `BG-${[...bytes].map((value) => alphabet[value % alphabet.length]).join('')}`;
}

function browserId() {
  try {
    const existing = globalThis.localStorage?.getItem(BROWSER_KEY);
    if (existing) return existing;
    const next = randomId();
    globalThis.localStorage?.setItem(BROWSER_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}

function deviceClass() {
  const width = Number(globalThis.innerWidth) || 1200;
  const coarse = globalThis.matchMedia?.('(pointer: coarse)')?.matches === true;
  if (coarse && width < 700) return 'mobile';
  if (coarse && width < 1100) return 'tablet';
  return 'desktop';
}

function contains(surface, position) {
  if (!surface || !position) return false;
  const x1 = Number(surface.x1);
  const x2 = Number(surface.x2);
  const z1 = Number(surface.z1);
  const z2 = Number(surface.z2);
  if (![x1, x2, z1, z2].every(Number.isFinite)) return false;
  return (
    position.x >= Math.min(x1, x2) &&
    position.x <= Math.max(x1, x2) &&
    position.z >= Math.min(z1, z2) &&
    position.z <= Math.max(z1, z2)
  );
}

function zoneFor(game) {
  const level = game?.sceneManager?.current;
  const sceneId = level?.definition?.id ?? null;
  const position = game?.player?.position;
  if (!sceneId || !position) return { sceneId, zoneId: sceneId };
  const surfaces = level.definition?.navigation?.surfaces ?? [];
  const matches = surfaces.filter((surface) => contains(surface, position));
  matches.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const surface = matches[0];
  const zone = clean(surface?.name || surface?.id || sceneId, 64) || sceneId;
  return { sceneId, zoneId: `${sceneId}:${zone}` };
}

function interactionData(target) {
  if (!target || typeof target !== 'object') return {};
  return {
    action: clean(target.action, 48),
    npcId: clean(target.npcId ?? (target.action === 'dialogue' ? target.id : ''), 48),
    targetId: clean(target.id, 64),
    progression: clean(target.progression, 64),
  };
}

export class PlaytestTelemetry {
  constructor({ invitation = null, godMode = false, server = TELEMETRY_SERVER } = {}) {
    this.server = server.replace(/\/$/, '');
    this.invitationType = godMode ? 'god' : invitation?.id || 'participant';
    this.sessionId = randomId();
    this.playtestId = playtestId();
    this.browserId = browserId();
    this.device = deviceClass();
    this.startedAt = Date.now();
    this.lastHeartbeatAt = 0;
    this.lastSampleAt = 0;
    this.lastSceneId = null;
    this.lastZoneId = null;
    this.lastDjPlaying = false;
    this.lastPolicePresent = false;
    this.lastPoliceOutcome = null;
    this.progression = new Map();
    this.callStartedAt = null;
    this.callMode = null;
    this.closed = false;
    this.game = null;
    this.ui = null;
    this.pageHide = () => this.end('pagehide');
    this.visibility = () => {
      if (!document.hidden) this.event('session_heartbeat', { source: 'visibility' });
    };
    this.event('session_start', { source: 'page' });
  }

  elapsedMs() {
    return Math.max(0, Date.now() - this.startedAt);
  }

  location() {
    return this.game ? zoneFor(this.game) : { sceneId: null, zoneId: null };
  }

  payload(event, data = {}) {
    const location = this.location();
    return {
      event,
      sessionId: this.sessionId,
      playtestId: this.playtestId,
      browserId: this.browserId,
      invitationType: this.invitationType,
      device: this.device,
      sceneId: location.sceneId,
      zoneId: location.zoneId,
      elapsedMs: this.elapsedMs(),
      data,
    };
  }

  post(payload, keepalive = false) {
    if (!globalThis.fetch) return;
    void globalThis
      .fetch(`${this.server}/telemetry/event`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-store',
        keepalive,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      .catch(() => {});
  }

  event(name, data = {}, { keepalive = false } = {}) {
    if (this.closed && name !== 'session_end') return;
    this.post(this.payload(name, data), keepalive);
  }

  mountNotice(documentRef = globalThis.document) {
    const card = documentRef?.querySelector?.('#gate .avatar-card');
    if (!card || card.querySelector('.playtest-telemetry-note')) return;
    const note = documentRef.createElement('div');
    note.className = 'playtest-telemetry-note';
    note.style.margin = '14px 0 0';
    note.style.padding = '10px 12px';
    note.style.border = '1px solid rgba(255,255,255,.16)';
    note.style.borderRadius = '8px';
    note.style.fontSize = '.78rem';
    note.style.lineHeight = '1.4';
    note.style.opacity = '.8';
    note.innerHTML = `<strong>PLAYTEST NOTE · ${this.playtestId}</strong><br>Anonymous gameplay actions and timing are collected to improve Breakglass: After Hours. Chat text, microphone audio, FaceTime/video, face images and screenshots are not recorded.`;
    card.appendChild(note);
  }

  attach(game, ui) {
    if (!game || this.game) return this;
    this.game = game;
    this.ui = ui;
    game.telemetry = this;

    for (const flag of PROGRESSION_FLAGS) this.progression.set(flag, game.state?.data?.[flag] === true);

    const baseReady = ui.ready.bind(ui);
    ui.ready = (start) =>
      baseReady(async (avatarProfile) => {
        const result = await start(avatarProfile);
        this.event('avatar_entered', { source: 'gate' });
        return result;
      });

    const baseDispatch = game.interactions.dispatch.bind(game.interactions);
    game.interactions.dispatch = (target) => {
      const data = interactionData(target);
      this.event('interaction', data);
      if (target?.action === 'dialogue' && data.npcId)
        this.event('npc_interaction', { npcId: data.npcId, targetId: data.targetId });
      if (target?.action === 'progressionDoor')
        this.event('locked_door', {
          targetId: data.targetId,
          progression: data.progression,
        });
      if (target?.action === 'travel')
        this.event('travel', { targetId: clean(target?.target, 64) });
      if (target?.action === 'arcade') this.event('arcade_start', { source: 'cabinet' });
      if (target?.action === 'coffee') this.event('coffee', { source: 'machine' });
      if (target?.action === 'beaverBbq') this.event('beaver_food', { source: 'bbq' });
      return baseDispatch(target);
    };

    if (game.arcade?.start && game.arcade?.stop) {
      const baseArcadeStart = game.arcade.start.bind(game.arcade);
      const baseArcadeStop = game.arcade.stop.bind(game.arcade);
      let arcadeStartedAt = null;
      game.arcade.start = (...args) => {
        if (!game.arcade.active) {
          arcadeStartedAt = Date.now();
          this.event('arcade_start', { source: 'cabinet' });
        }
        return baseArcadeStart(...args);
      };
      game.arcade.stop = (...args) => {
        if (game.arcade.active) {
          this.event('arcade_end', {
            durationMs: arcadeStartedAt ? Date.now() - arcadeStartedAt : 0,
            fighterId: clean(game.arcade.playerFighter?.id, 48),
          });
        }
        arcadeStartedAt = null;
        return baseArcadeStop(...args);
      };
    }

    if (game.photos?.startGroupPhoto) {
      const baseGroup = game.photos.startGroupPhoto.bind(game.photos);
      game.photos.startGroupPhoto = (...args) => {
        this.event('group_photo', { source: clean(args[0], 48) || 'nora' });
        return baseGroup(...args);
      };
    }

    this.attachMultiplayer(game.multiplayer);

    const baseUpdate = game.update.bind(game);
    game.update = (now, movementOverride = null) => {
      const result = baseUpdate(now, movementOverride);
      this.sample(now);
      return result;
    };

    const baseDispose = game.dispose.bind(game);
    game.dispose = async () => {
      this.end('dispose');
      this.detachWindow();
      return baseDispose();
    };

    globalThis.addEventListener?.('pagehide', this.pageHide);
    globalThis.document?.addEventListener?.('visibilitychange', this.visibility);
    this.sample(performance.now(), true);
    return this;
  }

  attachMultiplayer(multiplayer) {
    if (!multiplayer || multiplayer._telemetryAttached) return;
    multiplayer._telemetryAttached = true;

    const baseHandle = multiplayer.handleMessage.bind(multiplayer);
    multiplayer.handleMessage = (raw) => {
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Base handler owns malformed-message behavior.
      }
      const beforeJoined = multiplayer.joined;
      const result = baseHandle(raw);
      if (!beforeJoined && parsed?.type === 'welcome')
        this.event('multiplayer_join', { count: multiplayer.remotePlayers.size + 1 });
      if (parsed?.type === 'player_left')
        this.event('multiplayer_leave', { count: multiplayer.remotePlayers.size + 1 });
      return result;
    };

    const baseSend = multiplayer.send.bind(multiplayer);
    multiplayer.send = (payload) => {
      if (payload?.type === 'chat') this.event('chat_send', { count: 1 });
      return baseSend(payload);
    };

    const media = multiplayer.media;
    if (media) {
      const baseAudio = media.toggleAudio.bind(media);
      media.toggleAudio = async (...args) => {
        const result = await baseAudio(...args);
        this.event('voice_toggle', { enabled: media.audioEnabled === true });
        return result;
      };
      const baseVideo = media.toggleVideo.bind(media);
      media.toggleVideo = async (...args) => {
        const result = await baseVideo(...args);
        this.event('facetime_toggle', { enabled: media.videoEnabled === true });
        return result;
      };
    }

    const phone = multiplayer.phone;
    if (phone) {
      const baseActivate = phone.activateCall.bind(phone);
      phone.activateCall = async (...args) => {
        const result = await baseActivate(...args);
        if (phone.state.phase === 'active' && !this.callStartedAt) {
          this.callStartedAt = Date.now();
          this.callMode = phone.state.mode === 'video' ? 'video' : 'voice';
          this.event('phone_call_start', { callMode: this.callMode });
        }
        return result;
      };
      const baseEnd = phone.endCall.bind(phone);
      phone.endCall = (...args) => {
        if (phone.state.phase !== 'idle' && this.callStartedAt) {
          this.event('phone_call_end', {
            callMode: this.callMode || 'voice',
            durationMs: Date.now() - this.callStartedAt,
          });
          this.callStartedAt = null;
          this.callMode = null;
        }
        return baseEnd(...args);
      };
    }
  }

  sample(now = performance.now(), force = false) {
    if (!this.game || (!force && now - this.lastSampleAt < SAMPLE_MS)) return;
    this.lastSampleAt = now;
    const { sceneId, zoneId } = this.location();
    if (sceneId && sceneId !== this.lastSceneId) {
      this.lastSceneId = sceneId;
      this.event('scene_enter', { targetId: sceneId });
    }
    if (zoneId && zoneId !== this.lastZoneId) {
      this.lastZoneId = zoneId;
      this.event('zone_enter', { targetId: zoneId });
    }

    for (const flag of PROGRESSION_FLAGS) {
      const next = this.game.state?.data?.[flag] === true;
      const before = this.progression.get(flag) === true;
      if (next && !before) this.event('progression_unlock', { progression: flag });
      this.progression.set(flag, next);
    }

    const playing = this.game.dj?.metrics?.().playing === true;
    if (playing !== this.lastDjPlaying) {
      this.lastDjPlaying = playing;
      const snapshot = this.game.dj?.snapshot?.();
      const trackId =
        snapshot?.decks?.A?.playing === true
          ? snapshot.decks.A.trackId
          : snapshot?.decks?.B?.playing === true
            ? snapshot.decks.B.trackId
            : '';
      this.event(playing ? 'dj_start' : 'dj_end', { trackId: clean(trackId, 64) });
    }

    const alley = this.game.scenes?.get?.('alley')?.alley?.snapshot?.();
    if (alley) {
      const present = alley.policePresent === true;
      if (present && !this.lastPolicePresent)
        this.event('police_arrive', { count: Number(alley.policeVisits) || 1 });
      this.lastPolicePresent = present;
      const outcome = clean(alley.lastPoliceOutcome, 48);
      if (outcome && outcome !== this.lastPoliceOutcome) {
        this.lastPoliceOutcome = outcome;
        this.event('police_outcome', { outcome });
      }
    }

    const elapsed = this.elapsedMs();
    if (force || elapsed - this.lastHeartbeatAt >= HEARTBEAT_MS) {
      this.lastHeartbeatAt = elapsed;
      this.event('session_heartbeat', {
        count: this.game.multiplayer?.remotePlayers?.size != null
          ? this.game.multiplayer.remotePlayers.size + 1
          : 1,
      });
    }
  }

  end(reason = 'leave') {
    if (this.closed) return;
    this.event('session_end', { reason: clean(reason, 32) }, { keepalive: true });
    this.closed = true;
  }

  detachWindow() {
    globalThis.removeEventListener?.('pagehide', this.pageHide);
    globalThis.document?.removeEventListener?.('visibilitychange', this.visibility);
  }
}
