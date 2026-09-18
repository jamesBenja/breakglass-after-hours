const LOCKED_ACTIONS = new Set([
  'dj',
  'clubLighting',
  'ledWall',
  'drums',
  'piano',
  'synth',
  'modularSynth',
  'instruments',
  'amps',
  'mics',
  'console',
  'neveConsole',
  'tapeMachine',
  'arcade',
]);

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export class SharedWorld {
  constructor(client) {
    this.client = client;
    this.game = client.game;
    this.ui = client.ui;
    this.resources = new Map();
    this.objects = new Map();
    this.pendingClaims = new Map();
    this.localClaims = new Map();
    this.applyingDj = false;
    this.applyingLighting = false;
    this.applyingInstallation = false;
    this.authoritativeParty = false;
    this.lastLocalEvacuationStarted = false;
    this.partyResetPending = false;
    this.djPublishTimer = null;
    this.lightingPublishTimer = null;
    this.installationPublishTimer = null;
    this.patchDj();
  }

  send(payload) {
    return this.client.send(payload);
  }

  owns(resourceId) {
    return this.resources.get(resourceId)?.ownerId === this.client.localId;
  }

  resourceForTarget(target) {
    if (!target || !LOCKED_ACTIONS.has(target.action)) return null;
    if (target.action === 'dj') return 'dj-booth';
    if (target.action === 'clubLighting') return 'lighting-desk';
    if (target.action === 'ledWall') return 'led-wall-controller';
    const sceneId = this.game.sceneManager.current?.definition?.id ?? 'unknown';
    const id = String(target.id || target.action)
      .replace(/[^a-z0-9:._-]/gi, '-')
      .slice(0, 72);
    return `${sceneId}:${id}`;
  }

  async claim(resourceId, target = null) {
    if (!this.client.joined) return true;
    const current = this.resources.get(resourceId);
    if (current?.ownerId === this.client.localId) return true;
    if (current?.ownerId && current.ownerId !== this.client.localId) {
      this.ui.warning?.(`${current.ownerName || 'Another player'} is using that right now.`);
      return false;
    }
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const result = new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingClaims.delete(requestId);
        resolve(false);
      }, 3500);
      this.pendingClaims.set(requestId, { resolve, timer, resourceId, target });
    });
    this.send({
      type: 'resource_claim',
      requestId,
      resourceId,
      sceneId: this.game.sceneManager.current?.definition?.id,
    });
    return result;
  }

  release(resourceId) {
    if (!resourceId) return;
    if (this.owns(resourceId)) this.send({ type: 'resource_release', resourceId });
    this.resources.delete(resourceId);
    this.localClaims.delete(resourceId);
  }

  async useTarget(target, action) {
    const resourceId = this.resourceForTarget(target);
    if (!resourceId) {
      action();
      return true;
    }
    if (!(await this.claim(resourceId, target))) return false;
    this.localClaims.set(resourceId, {
      sceneId: this.game.sceneManager.current?.definition?.id,
      position: Array.isArray(target.position) ? [...target.position] : null,
    });
    action();
    if (resourceId === 'dj-booth') this.publishDj(true);
    if (resourceId === 'lighting-desk') this.publishLighting(true);
    return true;
  }

  handleResourceResult(message) {
    const pending = this.pendingClaims.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingClaims.delete(message.requestId);
    if (message.resource?.id) this.resources.set(message.resource.id, message.resource);
    if (message.ok) {
      this.localClaims.set(pending.resourceId, {
        sceneId: this.game.sceneManager.current?.definition?.id,
        position: Array.isArray(pending.target?.position) ? [...pending.target.position] : null,
      });
    } else if (message.resource) {
      this.ui.warning?.(
        `${message.resource.ownerName || 'Another player'} is using that right now.`,
      );
    }
    pending.resolve(message.ok === true);
  }

  handleResource(message) {
    const resource = message.resource;
    if (!resource?.id) return;
    if (!resource.ownerId) {
      this.resources.delete(resource.id);
      this.localClaims.delete(resource.id);
    } else this.resources.set(resource.id, resource);
  }

  hydrate(world = {}) {
    this.resources.clear();
    for (const resource of world.resources ?? []) this.resources.set(resource.id, resource);
    this.objects = new Map(Object.entries(world.objects ?? {}));
    this.patchWorldObjects();
    if (world.dj) void this.applyDj(world.dj);
    if (world.lighting) this.applyLighting(world.lighting);
    if (world.party) this.applyParty(world.party);
    const installation = this.objects.get('take-a-break-installation');
    if (installation) this.applyInstallation(installation);
    const jamesResponse = this.objects.get('police-james-response');
    if (jamesResponse) this.game.policeResponse?.applySharedJamesResponse?.(jamesResponse);
    const ledWall = this.objects.get('dj-led-wall');
    if (ledWall) this.game.ledWall?.apply?.(ledWall, { remote: true });
  }

  patchWorldObjects() {
    this.patchLighting();
    this.patchParty();
    this.patchInstallation();
    this.patchSeats();
  }

  patchDj() {
    const dj = this.game.dj;
    if (!dj || dj._multiplayerSharedPatched) return;
    dj._multiplayerSharedPatched = true;
    for (const method of [
      'load',
      'setLevel',
      'setEq',
      'setCrossfader',
      'setBpm',
      'sync',
      'playDeck',
      'stopDeck',
      'setFilter',
      'setReverb',
      'setEcho',
      'setLoop',
      'setPreciseLoop',
      'hotCue',
      'setHotCue',
      'triggerHotCue',
      'beatJump',
      'jog',
      'setDeviceMode',
      'setVinylRpm',
      'toggleMotor',
      'setPlatterHeld',
    ]) {
      if (typeof dj[method] !== 'function') continue;
      const base = dj[method].bind(dj);
      dj[method] = (...args) => {
        const result = base(...args);
        if (result?.then) {
          return result.finally(() => {
            if (!this.applyingDj) this.publishDj();
          });
        }
        if (!this.applyingDj) this.publishDj();
        return result;
      };
    }
  }

  djSnapshot() {
    const snapshot = this.game.dj.snapshot();
    for (const deckId of ['A', 'B']) {
      snapshot.decks[deckId].position = this.game.dj.deckPosition?.(deckId) ?? 0;
    }
    return snapshot;
  }

  publishDj(immediate = false) {
    if (!this.client.joined || !this.owns('dj-booth') || this.applyingDj) return;
    const send = () => {
      this.djPublishTimer = null;
      this.send({ type: 'dj_update', state: this.djSnapshot() });
    };
    if (immediate) {
      if (this.djPublishTimer) clearTimeout(this.djPublishTimer);
      send();
    } else if (!this.djPublishTimer) this.djPublishTimer = setTimeout(send, 70);
  }

  async applyDj(state) {
    if (!state || this.owns('dj-booth')) return;
    const dj = this.game.dj;
    this.applyingDj = true;
    try {
      dj.setCrossfader?.(state.crossfader ?? 0);
      for (const deckId of ['A', 'B']) {
        const target = state.decks?.[deckId];
        const deck = dj.decks?.[deckId];
        if (!target || !deck) continue;
        if (target.trackId && deck.trackId !== target.trackId) {
          dj.stopDeck(deckId);
          dj.load(deckId, target.trackId);
        }
        dj.setBpm?.(deckId, target.bpm);
        dj.setLevel?.(deckId, target.level);
        dj.setEq?.(deckId, 'low', target.low);
        dj.setEq?.(deckId, 'high', target.high);
        dj.setFilter?.(deckId, target.filter);
        dj.setReverb?.(deckId, target.reverb);
        dj.setEcho?.(deckId, target.echo);
        if (target.deviceMode) dj.setDeviceMode?.(deckId, target.deviceMode);
        if (target.deviceMode === 'vinyl' && target.vinylRpm)
          dj.setVinylRpm?.(deckId, target.vinylRpm);
        const targetMotorOn = target.motorOn !== false;
        if (typeof dj.toggleMotor === 'function' && deck.motorOn !== targetMotorOn)
          dj.toggleMotor(deckId);
        else deck.motorOn = targetMotorOn;
        const targetHeld = target.platterHeld === true;
        if (typeof dj.setPlatterHeld === 'function' && deck.platterHeld !== targetHeld)
          dj.setPlatterHeld(deckId, targetHeld);
        else deck.platterHeld = targetHeld;
        if (Array.isArray(target.cuePoints)) deck.cuePoints = target.cuePoints.slice(0, 8);
        if (target.playing && !deck.playing) await dj.playDeck(deckId);
        else if (!target.playing && deck.playing) dj.stopDeck(deckId);
        if (target.playing && deck.playing && typeof dj.restartDeckAt === 'function') {
          const baseBpm = Math.max(1, deck.baseBpm || target.bpm || 120);
          const serverNow = this.client.serverNow?.() ?? Date.now();
          const elapsed = Math.max(0, serverNow - Number(state.updatedAt || serverNow)) / 1000;
          const expected =
            Math.max(0, Number(target.position) || 0) + elapsed * (target.bpm / baseBpm);
          const current = dj.deckPosition?.(deckId) ?? expected;
          if (Math.abs(current - expected) > 0.055) await dj.restartDeckAt(deckId, expected);
        }
        if (
          typeof dj.setLoop === 'function' &&
          Number(target.loopBeats) !== Number(deck.loopBeats || 0)
        ) {
          if (target.loopBeats)
            (dj.setPreciseLoop ?? dj.setLoop).call(dj, deckId, target.loopBeats);
          else if (deck.loopBeats) {
            if (typeof dj.setPreciseLoop === 'function') dj.setPreciseLoop(deckId, 0);
            else dj.setLoop(deckId, deck.loopBeats);
          }
        }
      }
    } finally {
      this.applyingDj = false;
    }
  }

  patchLighting() {
    const rig = this.game.scenes.get('downstairs')?.lighting;
    if (!rig || rig._multiplayerSharedPatched) return;
    rig._multiplayerSharedPatched = true;
    for (const method of [
      'applyPreset',
      'applyPalette',
      'setHaze',
      'adjustHaze',
      'setLasers',
      'toggleLasers',
    ]) {
      if (typeof rig[method] !== 'function') continue;
      const base = rig[method].bind(rig);
      rig[method] = (...args) => {
        const result = base(...args);
        if (!this.applyingLighting) this.publishLighting();
        return result;
      };
    }
  }

  publishLighting(immediate = false) {
    if (!this.client.joined || !this.owns('lighting-desk') || this.applyingLighting) return;
    const send = () => {
      this.lightingPublishTimer = null;
      const rig = this.game.scenes.get('downstairs')?.lighting;
      if (rig) this.send({ type: 'lighting_update', state: rig.snapshot() });
    };
    if (immediate) {
      if (this.lightingPublishTimer) clearTimeout(this.lightingPublishTimer);
      send();
    } else if (!this.lightingPublishTimer) this.lightingPublishTimer = setTimeout(send, 80);
  }

  applyLighting(state) {
    const rig = this.game.scenes.get('downstairs')?.lighting;
    if (!rig || !state || this.owns('lighting-desk')) return;
    this.applyingLighting = true;
    try {
      rig.applyPreset?.(state.preset);
      rig.applyPalette?.(state.palette);
      rig.setHaze?.(state.haze);
      rig.setLasers?.(state.lasers);
    } finally {
      this.applyingLighting = false;
    }
  }

  patchParty() {
    const alley = this.game.scenes.get('alley')?.alley;
    if (!alley || alley._multiplayerSharedPatched) return;
    alley._multiplayerSharedPatched = true;
    const baseUpdate = alley.update.bind(alley);
    const baseSetContext = alley.setPartyContext?.bind(alley);
    const baseChat = alley.chat.bind(alley);
    const baseQuiet = alley.quiet.bind(alley);
    const baseResolvePolice = alley.resolvePolice.bind(alley);
    alley.update = (dt, metrics) => {
      if (!this.client.joined || !this.authoritativeParty) return baseUpdate(dt, metrics);
      alley.elapsed += dt;
      alley.updatePoliceLights?.();
    };
    if (baseSetContext)
      alley.setPartyContext = (...args) =>
        this.client.joined && this.authoritativeParty ? undefined : baseSetContext(...args);
    alley.chat = (amount = 0.08) => {
      if (!this.client.joined || !this.authoritativeParty) return baseChat(amount);
      this.send({ type: 'party_action', action: amount >= 0.08 ? 'rowdy' : 'smoke' });
    };
    alley.quiet = (amount = 0.18) => {
      if (!this.client.joined || !this.authoritativeParty) return baseQuiet(amount);
      this.send({ type: 'party_action', action: 'quiet', amount });
    };
    alley.resolvePolice = (response) => {
      if (!this.client.joined || !this.authoritativeParty) return baseResolvePolice(response);
      const suffix =
        response === 'cooperate'
          ? 'cooperate'
          : response === 'brushOff'
            ? 'brushOff'
            : response === 'ticket'
              ? 'ticket'
              : 'argue';
      this.send({ type: 'party_action', action: `police-${suffix}` });
      return 'Your response is sent to the officers. Everyone in the live room will see what happens next.';
    };
  }

  applyParty(state) {
    const alley = this.game.scenes.get('alley')?.alley;
    if (!alley || !state) return;
    this.authoritativeParty = true;
    for (const key of [
      'occupancy',
      'conversationLevel',
      'rowdyLevel',
      'disturbance',
      'spillOutPressure',
      'clubAttendance',
      'clubCapacity',
      'clubDanceShare',
      'clubMixQuality',
      'highNoiseTime',
      'staffWarningLevel',
      'policePresent',
      'policeVisits',
      'policeResponseTime',
      'policeCooldown',
      'evacuationRequired',
      'evacuationStarted',
      'lastPoliceOutcome',
      'policeStrictness',
    ]) {
      if (key in state) alley[key] = state[key];
    }
    alley.setPoliceVisible?.(state.policePresent || state.evacuationStarted);
    if (state.evacuationRequired && !this.game.evacuationStarted) this.game.beginEvacuation?.();
    if (!state.evacuationRequired && !state.evacuationStarted) {
      this.partyResetPending = false;
      this.lastLocalEvacuationStarted = false;
    }
  }

  patchInstallation() {
    const spatial = this.game.spatialAudio;
    if (!spatial || spatial._multiplayerSharedPatched) return;
    spatial._multiplayerSharedPatched = true;
    for (const method of ['adjustInstallation', 'resetInstallationMix', 'toggleInstallation']) {
      if (typeof spatial[method] !== 'function') continue;
      const base = spatial[method].bind(spatial);
      spatial[method] = (...args) => {
        const result = base(...args);
        if (!this.applyingInstallation) this.publishInstallation();
        return result;
      };
    }
  }

  publishInstallation() {
    if (!this.client.joined || this.applyingInstallation) return;
    if (this.installationPublishTimer) return;
    this.installationPublishTimer = setTimeout(() => {
      this.installationPublishTimer = null;
      const snapshot = this.game.spatialAudio?.snapshot?.() ?? {};
      this.send({
        type: 'object_update',
        objectId: 'take-a-break-installation',
        data: { enabled: snapshot.enabled !== false, mix: snapshot.mix ?? {} },
      });
    }, 90);
  }

  applyInstallation(data) {
    const spatial = this.game.spatialAudio;
    if (!spatial || !data) return;
    this.applyingInstallation = true;
    try {
      if (typeof data.enabled === 'boolean' && data.enabled !== spatial.installationEnabled)
        spatial.toggleInstallation?.();
      if (data.mix && typeof data.mix === 'object') {
        for (const key of ['low', 'texture', 'air', 'motion', 'space']) {
          if (!(key in data.mix)) continue;
          spatial.installationMix[key] = clamp(data.mix[key]);
        }
        spatial.applyInstallationMix?.();
      }
    } finally {
      this.applyingInstallation = false;
    }
  }

  handleObjectState(message) {
    if (!message.objectId) return;
    this.objects.set(message.objectId, message.data);
    if (message.objectId === 'take-a-break-installation') this.applyInstallation(message.data);
    if (message.objectId === 'police-james-response')
      this.game.policeResponse?.applySharedJamesResponse?.(message.data);
    if (message.objectId === 'dj-led-wall')
      this.game.ledWall?.apply?.(message.data, { remote: true });
  }

  patchSeats() {
    const system = this.game.roomExperience?.takeABreak;
    if (!system || system._multiplayerSharedPatched) return;
    system._multiplayerSharedPatched = true;
    const baseSit = system.sit.bind(system);
    const baseStand = system.stand.bind(system);
    system.sit = async (index) => {
      const resourceId = `seat:take-a-break:${index}`;
      if (!(await this.claim(resourceId))) return false;
      this.localClaims.set(resourceId, {
        sceneId: 'downstairs',
        position: null,
        stickyWhileSeated: true,
      });
      system._sharedSeatResource = resourceId;
      return baseSit(index);
    };
    system.stand = (...args) => {
      const result = baseStand(...args);
      if (system._sharedSeatResource) this.release(system._sharedSeatResource);
      system._sharedSeatResource = null;
      return result;
    };
  }

  handleMessage(message) {
    if (message.type === 'resource_result') this.handleResourceResult(message);
    else if (message.type === 'resource') this.handleResource(message);
    else if (message.type === 'object_state') this.handleObjectState(message);
    else if (message.type === 'dj_state') void this.applyDj(message.state);
    else if (message.type === 'lighting_state') this.applyLighting(message.state);
    else if (message.type === 'party_state') this.applyParty(message.state);
  }

  update() {
    if (!this.client.joined) return;

    if (this.game.evacuationStarted) this.lastLocalEvacuationStarted = true;
    else if (
      this.authoritativeParty &&
      this.lastLocalEvacuationStarted &&
      !this.partyResetPending
    ) {
      // The local raid UI only clears evacuationStarted when the player presses "Try the party
      // again". Turn that local action into a canonical room reset so another client's next
      // party packet cannot immediately put everyone back into the finished raid.
      this.partyResetPending = true;
      this.send({ type: 'party_action', action: 'reset-party' });
    }

    const sceneId = this.game.sceneManager.current?.definition?.id;
    const position = this.game.player.position;
    for (const [resourceId, claim] of [...this.localClaims.entries()]) {
      if (!this.owns(resourceId)) {
        this.localClaims.delete(resourceId);
        continue;
      }
      if (claim.stickyWhileSeated && this.game.player.seated) continue;
      if (claim.sceneId && claim.sceneId !== sceneId) {
        this.release(resourceId);
        continue;
      }
      if (claim.position && position.distanceTo) {
        const dx = position.x - claim.position[0];
        const dz = position.z - claim.position[2];
        if (Math.hypot(dx, dz) > (resourceId === 'dj-booth' ? 5.5 : 4.2)) this.release(resourceId);
      }
    }
  }

  dispose() {
    for (const pending of this.pendingClaims.values()) {
      clearTimeout(pending.timer);
      pending.resolve(false);
    }
    this.pendingClaims.clear();
    for (const resourceId of [...this.localClaims.keys()]) this.release(resourceId);
    if (this.djPublishTimer) clearTimeout(this.djPublishTimer);
    if (this.lightingPublishTimer) clearTimeout(this.lightingPublishTimer);
    if (this.installationPublishTimer) clearTimeout(this.installationPublishTimer);
  }
}
