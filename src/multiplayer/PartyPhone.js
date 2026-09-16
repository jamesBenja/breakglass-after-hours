const CALL_TIMEOUT_MS = 25_000;

export function trackForPeer({ peerId, activePeerId = null, privateTrack = null, partyTrack = null }) {
  if (!activePeerId) return partyTrack ?? null;
  return peerId === activePeerId ? (privateTrack ?? null) : null;
}

function makeButton(document, label, action, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = className;
  element.onclick = action;
  return element;
}

function callId(client) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${client.localId || 'guest'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function floorLabel(sceneId) {
  return {
    alley: 'ALLEY',
    downstairs: 'BELOW',
    upstairs: 'STUDIO',
    roof: 'ROOF',
  }[sceneId] || String(sceneId || 'BREAKGLASS').toUpperCase();
}

export class PartyPhone {
  constructor(multiplayer) {
    this.multiplayer = multiplayer;
    this.media = multiplayer.media;
    this.document = multiplayer.ui.document;
    this.ui = multiplayer.ui;
    this.state = { phase: 'idle', peerId: null, mode: null, callId: null };
    this.ownedTracks = { audio: null, video: null };
    this.lastRosterSignature = '';
    this.lastRosterAt = 0;
    this.callTimer = null;
    this.patchMedia();
    this.buildUi();
  }

  get activePeerId() {
    return this.state.phase === 'active' ? this.state.peerId : null;
  }

  get activeCall() {
    return this.state.phase === 'active' ? { ...this.state } : null;
  }

  patchMedia() {
    this.baseHandleSignal = this.media.handleSignal.bind(this.media);
    this.media.handleSignal = async (fromId, data = {}) => {
      if (data.phoneCall) {
        await this.handlePhoneSignal(fromId, data.phoneCall);
        return;
      }
      return this.baseHandleSignal(fromId, data);
    };

    this.baseEnsurePeer = this.media.ensurePeer.bind(this.media);
    this.media.ensurePeer = (id) => {
      const peer = this.baseEnsurePeer(id);
      if (peer && this.activePeerId) void this.applyPeerTracks(id, peer);
      return peer;
    };

    this.basePlayerLeft = this.media.playerLeft.bind(this.media);
    this.media.playerLeft = (id) => {
      if (id === this.state.peerId) this.endCall({ notify: false, message: 'Call ended.' });
      return this.basePlayerLeft(id);
    };
  }

  restoreMediaPatches() {
    if (this.baseHandleSignal) this.media.handleSignal = this.baseHandleSignal;
    if (this.baseEnsurePeer) this.media.ensurePeer = this.baseEnsurePeer;
    if (this.basePlayerLeft) this.media.playerLeft = this.basePlayerLeft;
  }

  buildUi() {
    const phoneToggle = makeButton(this.document, 'PHONE', () => this.togglePhone(), 'party-phone-toggle');
    const socialDock = this.document.getElementById('liveSocialDock');
    if (socialDock) {
      let quickbar = socialDock.querySelector('.live-social-quickbar');
      const chatToggle = socialDock.querySelector('.live-social-toggle');
      if (!quickbar) {
        quickbar = this.document.createElement('div');
        quickbar.className = 'live-social-quickbar';
        if (chatToggle) quickbar.appendChild(chatToggle);
        socialDock.prepend(quickbar);
      }
      quickbar.appendChild(phoneToggle);
    } else this.document.body.appendChild(phoneToggle);
    this.phoneToggle = phoneToggle;

    const shell = this.document.createElement('section');
    shell.className = 'party-phone-shell';
    shell.hidden = true;
    shell.setAttribute('aria-label', 'Breakglass phone');

    const phone = this.document.createElement('div');
    phone.className = 'party-phone';
    const top = this.document.createElement('header');
    top.className = 'party-phone-header';
    const title = this.document.createElement('strong');
    title.textContent = 'BREAKGLASS PHONE';
    const close = makeButton(this.document, '×', () => this.closePhone(), 'party-phone-close');
    top.append(title, close);
    this.screen = this.document.createElement('div');
    this.screen.className = 'party-phone-screen';
    phone.append(top, this.screen);
    shell.appendChild(phone);
    this.document.body.appendChild(shell);
    this.shell = shell;

    for (const eventName of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'touchstart', 'touchend']) {
      shell.addEventListener(eventName, (event) => event.stopPropagation());
    }
    this.render();
  }

  togglePhone() {
    if (!this.shell.hidden) this.closePhone();
    else this.openPhone();
  }

  openPhone() {
    this.shell.hidden = false;
    this.render();
  }

  closePhone() {
    this.shell.hidden = true;
  }

  remoteName(id) {
    return this.multiplayer.remotePlayers.get(id)?.avatar?.displayName ?? 'Guest';
  }

  signal(peerId, phoneCall) {
    return this.multiplayer.send({ type: 'signal', targetId: peerId, data: { phoneCall } });
  }

  startCall(peerId, mode = 'voice') {
    if (!peerId || this.state.phase !== 'idle') return false;
    if (!this.multiplayer.remotePlayers.has(peerId)) return false;
    const id = callId(this.multiplayer);
    this.state = { phase: 'outgoing', peerId, mode, callId: id };
    this.signal(peerId, { type: 'invite', callId: id, mode });
    this.openPhone();
    this.render();
    this.clearCallTimer();
    this.callTimer = setTimeout(() => {
      if (this.state.phase !== 'outgoing' || this.state.callId !== id) return;
      this.signal(peerId, { type: 'cancel', callId: id });
      this.resetCall('No answer.');
    }, CALL_TIMEOUT_MS);
    return true;
  }

  async handlePhoneSignal(fromId, message = {}) {
    const type = message.type;
    if (!type || !fromId) return;

    if (type === 'invite') {
      if (this.state.phase !== 'idle') {
        this.signal(fromId, { type: 'busy', callId: message.callId });
        return;
      }
      this.state = {
        phase: 'incoming',
        peerId: fromId,
        mode: message.mode === 'video' ? 'video' : 'voice',
        callId: message.callId,
      };
      this.openPhone();
      this.render();
      this.ui.warning?.(`${this.remoteName(fromId)} is calling your Breakglass phone.`);
      return;
    }

    if (message.callId !== this.state.callId || fromId !== this.state.peerId) return;

    if (type === 'accept' && this.state.phase === 'outgoing') {
      this.clearCallTimer();
      await this.activateCall();
      return;
    }
    if (type === 'decline') {
      this.resetCall(`${this.remoteName(fromId)} declined the call.`);
      return;
    }
    if (type === 'busy') {
      this.resetCall(`${this.remoteName(fromId)} is already on a call.`);
      return;
    }
    if (type === 'cancel') {
      this.resetCall('Call cancelled.');
      return;
    }
    if (type === 'hangup') this.endCall({ notify: false, message: 'Call ended.' });
  }

  async answerCall() {
    if (this.state.phase !== 'incoming') return false;
    const { peerId, callId } = this.state;
    await this.activateCall();
    if (this.state.phase !== 'active') return false;
    this.signal(peerId, { type: 'accept', callId });
    return true;
  }

  declineCall() {
    if (this.state.phase !== 'incoming') return false;
    const { peerId, callId } = this.state;
    this.signal(peerId, { type: 'decline', callId });
    this.resetCall('Call declined.');
    return true;
  }

  async acquirePrivateTrack(kind) {
    const existing = kind === 'audio' ? this.media.audioTrack : this.media.videoTrack;
    if (existing?.readyState === 'live') return existing;
    const owned = this.ownedTracks[kind];
    if (owned?.readyState === 'live') return owned;
    const track = await this.media.requestTrack(kind);
    if (track) this.ownedTracks[kind] = track;
    return track;
  }

  async activateCall() {
    const peerId = this.state.peerId;
    if (!peerId || !this.multiplayer.remotePlayers.has(peerId)) {
      this.resetCall('Caller is no longer at the party.');
      return false;
    }
    const audio = await this.acquirePrivateTrack('audio');
    const video = this.state.mode === 'video' ? await this.acquirePrivateTrack('video') : null;
    this.privateTracks = { audio, video };
    this.media.ensurePeer(peerId);
    this.state = { ...this.state, phase: 'active' };
    await this.routePrivateTracks();
    this.openPhone();
    this.render();
    return true;
  }

  async applyPeerTracks(id, peer) {
    if (!peer) return;
    const activePeerId = this.activePeerId;
    const audioTrack = trackForPeer({
      peerId: id,
      activePeerId,
      privateTrack: this.privateTracks?.audio,
      partyTrack: this.media.audioEnabled ? this.media.audioTrack : null,
    });
    const videoTrack = trackForPeer({
      peerId: id,
      activePeerId,
      privateTrack: this.privateTracks?.video,
      partyTrack: this.media.videoEnabled ? this.media.videoTrack : null,
    });
    const tasks = [];
    if (peer.senders?.audio) tasks.push(peer.senders.audio.replaceTrack(audioTrack));
    if (peer.senders?.video) tasks.push(peer.senders.video.replaceTrack(videoTrack));
    await Promise.allSettled(tasks);
  }

  async routePrivateTracks() {
    await Promise.allSettled(
      [...this.media.peers.entries()].map(([id, peer]) => this.applyPeerTracks(id, peer)),
    );
  }

  async restorePartyTracks() {
    const tasks = [];
    for (const peer of this.media.peers.values()) {
      if (peer.senders?.audio)
        tasks.push(peer.senders.audio.replaceTrack(this.media.audioEnabled ? this.media.audioTrack : null));
      if (peer.senders?.video)
        tasks.push(peer.senders.video.replaceTrack(this.media.videoEnabled ? this.media.videoTrack : null));
    }
    await Promise.allSettled(tasks);
  }

  endCall({ notify = true, message = 'Call ended.' } = {}) {
    if (this.state.phase === 'idle') return false;
    const { peerId, callId } = this.state;
    if (notify && peerId) this.signal(peerId, { type: 'hangup', callId });
    void this.restorePartyTracks();
    this.stopOwnedTracks();
    this.clearCallTimer();
    this.state = { phase: 'idle', peerId: null, mode: null, callId: null };
    this.privateTracks = null;
    this.render();
    if (message) this.ui.warning?.(message);
    return true;
  }

  resetCall(message = '') {
    this.clearCallTimer();
    this.state = { phase: 'idle', peerId: null, mode: null, callId: null };
    this.privateTracks = null;
    this.stopOwnedTracks();
    this.render();
    if (message) this.ui.warning?.(message);
  }

  stopOwnedTracks() {
    for (const track of Object.values(this.ownedTracks)) track?.stop?.();
    this.ownedTracks = { audio: null, video: null };
  }

  clearCallTimer() {
    if (this.callTimer) clearTimeout(this.callTimer);
    this.callTimer = null;
  }

  render() {
    if (!this.screen) return;
    this.screen.replaceChildren();
    const phase = this.state.phase;
    if (phase === 'idle') return this.renderRoster();
    if (phase === 'incoming') return this.renderIncoming();
    if (phase === 'outgoing') return this.renderOutgoing();
    if (phase === 'active') return this.renderActive();
  }

  renderRoster() {
    const intro = this.document.createElement('p');
    intro.className = 'party-phone-copy';
    intro.textContent = 'People at the party · private calls work anywhere in Breakglass.';
    this.screen.appendChild(intro);
    const roster = this.document.createElement('div');
    roster.className = 'party-phone-roster';
    const remotes = [...this.multiplayer.remotePlayers.entries()];
    if (!remotes.length) {
      const empty = this.document.createElement('p');
      empty.className = 'party-phone-empty';
      empty.textContent = 'Nobody else is connected right now.';
      roster.appendChild(empty);
    }
    for (const [id, remote] of remotes) {
      const row = this.document.createElement('div');
      row.className = 'party-phone-contact';
      const identity = this.document.createElement('div');
      const name = this.document.createElement('strong');
      name.textContent = remote.avatar?.displayName ?? 'Guest';
      const where = this.document.createElement('small');
      where.textContent = floorLabel(remote.sceneId);
      identity.append(name, where);
      const actions = this.document.createElement('div');
      actions.className = 'party-phone-contact-actions';
      actions.append(
        makeButton(this.document, 'CALL', () => this.startCall(id, 'voice')),
        makeButton(this.document, 'FACETIME', () => this.startCall(id, 'video'), 'facetime'),
      );
      row.append(identity, actions);
      roster.appendChild(row);
    }
    this.screen.appendChild(roster);
  }

  renderIncoming() {
    const name = this.remoteName(this.state.peerId);
    const heading = this.document.createElement('h3');
    heading.textContent = `${name} is calling…`;
    const sub = this.document.createElement('p');
    sub.textContent = this.state.mode === 'video' ? 'Incoming FaceTime' : 'Incoming private voice call';
    const actions = this.document.createElement('div');
    actions.className = 'party-phone-call-actions';
    actions.append(
      makeButton(this.document, 'DECLINE', () => this.declineCall(), 'decline'),
      makeButton(this.document, 'ANSWER', () => void this.answerCall(), 'answer'),
    );
    this.screen.append(heading, sub, actions);
  }

  renderOutgoing() {
    const heading = this.document.createElement('h3');
    heading.textContent = `Calling ${this.remoteName(this.state.peerId)}…`;
    const sub = this.document.createElement('p');
    sub.textContent = this.state.mode === 'video' ? 'FaceTime · ringing' : 'Private voice call · ringing';
    this.screen.append(
      heading,
      sub,
      makeButton(this.document, 'CANCEL', () => {
        const { peerId, callId } = this.state;
        this.signal(peerId, { type: 'cancel', callId });
        this.resetCall('Call cancelled.');
      }, 'decline'),
    );
  }

  renderActive() {
    const peerId = this.state.peerId;
    const heading = this.document.createElement('h3');
    heading.textContent = this.remoteName(peerId);
    const status = this.document.createElement('p');
    status.textContent = this.state.mode === 'video' ? 'FACETIME · PRIVATE' : 'VOICE CALL · PRIVATE';
    this.screen.append(heading, status);

    if (this.state.mode === 'video') {
      const stage = this.document.createElement('div');
      stage.className = 'party-phone-video-stage';
      const remoteVideo = this.document.createElement('video');
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      remoteVideo.className = 'party-phone-remote-video';
      const localVideo = this.document.createElement('video');
      localVideo.autoplay = true;
      localVideo.playsInline = true;
      localVideo.muted = true;
      localVideo.className = 'party-phone-local-video';
      const peer = this.media.peers.get(peerId);
      if (peer?.stream) remoteVideo.srcObject = peer.stream;
      if (this.privateTracks?.video)
        localVideo.srcObject = new MediaStream([this.privateTracks.video]);
      stage.append(remoteVideo, localVideo);
      this.screen.appendChild(stage);
      void remoteVideo.play().catch(() => {});
      void localVideo.play().catch(() => {});
    }

    this.screen.appendChild(
      makeButton(this.document, 'HANG UP', () => this.endCall(), 'party-phone-hangup'),
    );
  }

  update(now = performance.now()) {
    if (this.state.phase === 'active' && !this.multiplayer.remotePlayers.has(this.state.peerId)) {
      this.endCall({ notify: false, message: 'Call ended.' });
      return;
    }
    if (this.shell?.hidden || this.state.phase !== 'idle') return;
    if (now - this.lastRosterAt < 900) return;
    this.lastRosterAt = now;
    const signature = [...this.multiplayer.remotePlayers.entries()]
      .map(([id, remote]) => `${id}:${remote.sceneId}:${remote.avatar?.displayName}`)
      .sort()
      .join('|');
    if (signature !== this.lastRosterSignature) {
      this.lastRosterSignature = signature;
      this.renderRoster();
    }
  }

  dispose() {
    if (this.state.phase !== 'idle') this.endCall({ notify: false, message: '' });
    this.restoreMediaPatches();
    this.clearCallTimer();
    this.stopOwnedTracks();
    this.shell?.remove();
    this.phoneToggle?.remove();
  }
}
