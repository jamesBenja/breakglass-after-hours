const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};
const MAX_RTC_PEERS = 8;

function button(document, label, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.onclick = action;
  return element;
}

export class RealtimeMedia {
  constructor(client) {
    this.client = client;
    this.game = client.game;
    this.ui = client.ui;
    this.document = client.ui.document;
    this.messages = [];
    this.peers = new Map();
    this.remoteMedia = new Map();
    this.audioTrack = null;
    this.videoTrack = null;
    this.audioEnabled = false;
    this.videoEnabled = false;
    this.buildUi();
  }

  buildUi() {
    const dock = this.document.createElement('section');
    dock.id = 'liveSocialDock';
    dock.className = 'live-social-dock collapsed';

    const toggle = button(this.document, 'CHAT', () => {
      dock.classList.toggle('collapsed');
      if (!dock.classList.contains('collapsed')) this.input?.focus();
    });
    toggle.className = 'live-social-toggle';

    const panel = this.document.createElement('div');
    panel.className = 'live-social-panel';
    const header = this.document.createElement('div');
    header.className = 'live-social-header';
    const title = this.document.createElement('strong');
    title.textContent = 'BREAKGLASS LIVE';
    this.voiceButton = button(this.document, 'VOICE OFF', () => void this.toggleAudio());
    this.videoButton = button(this.document, 'VIDEO OFF', () => void this.toggleVideo());
    header.append(title, this.voiceButton, this.videoButton);

    this.log = this.document.createElement('div');
    this.log.className = 'live-chat-log';
    this.log.setAttribute('aria-live', 'polite');

    const form = this.document.createElement('form');
    form.className = 'live-chat-form';
    this.input = this.document.createElement('input');
    this.input.type = 'text';
    this.input.maxLength = 240;
    this.input.placeholder = 'Say something…';
    this.input.autocomplete = 'off';
    const send = button(this.document, 'SEND', () => {});
    send.type = 'submit';
    form.append(this.input, send);
    form.onsubmit = (event) => {
      event.preventDefault();
      const text = this.input.value.trim();
      if (!text) return;
      this.client.send({ type: 'chat', text });
      this.input.value = '';
    };
    for (const eventName of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'touchstart']) {
      panel.addEventListener(eventName, (event) => event.stopPropagation());
    }

    this.mediaGrid = this.document.createElement('div');
    this.mediaGrid.className = 'live-media-grid';
    panel.append(header, this.mediaGrid, this.log, form);
    dock.append(toggle, panel);
    this.document.body.appendChild(dock);
    this.dock = dock;
  }

  hydrate(chat = []) {
    this.messages = [];
    this.log?.replaceChildren();
    for (const message of chat.slice(-40)) this.addChat(message);
  }

  addChat(message) {
    if (!message?.text) return;
    this.messages.push(message);
    if (this.messages.length > 40) this.messages.shift();
    const line = this.document.createElement('div');
    line.className = 'live-chat-line';
    const name = this.document.createElement('strong');
    name.textContent = `${message.name || 'Guest'}: `;
    const text = this.document.createElement('span');
    text.textContent = message.text;
    line.append(name, text);
    this.log.appendChild(line);
    while (this.log.childElementCount > 40) this.log.firstElementChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }

  async requestTrack(kind) {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.ui.warning?.('This browser does not support live microphone/camera chat.');
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'audio'
          ? { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
          : { audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } },
      );
      return stream.getTracks().find((track) => track.kind === kind) ?? null;
    } catch (error) {
      this.ui.warning?.(`${kind === 'audio' ? 'Microphone' : 'Camera'} permission: ${error.message}`);
      return null;
    }
  }

  async toggleAudio() {
    if (this.audioEnabled) {
      this.audioEnabled = false;
      this.audioTrack?.stop();
      this.audioTrack = null;
      await this.removeLocalKind('audio');
    } else {
      const track = await this.requestTrack('audio');
      if (!track) return;
      this.audioTrack = track;
      this.audioEnabled = true;
      await this.addLocalTrack(track);
    }
    this.syncButtons();
    this.sendMediaStatus();
  }

  async toggleVideo() {
    if (this.videoEnabled) {
      this.videoEnabled = false;
      this.videoTrack?.stop();
      this.videoTrack = null;
      await this.removeLocalKind('video');
    } else {
      const track = await this.requestTrack('video');
      if (!track) return;
      this.videoTrack = track;
      this.videoEnabled = true;
      await this.addLocalTrack(track);
    }
    this.syncButtons();
    this.sendMediaStatus();
  }

  syncButtons() {
    this.voiceButton.textContent = this.audioEnabled ? 'VOICE ON' : 'VOICE OFF';
    this.videoButton.textContent = this.videoEnabled ? 'VIDEO ON' : 'VIDEO OFF';
    this.voiceButton.classList.toggle('active', this.audioEnabled);
    this.videoButton.classList.toggle('active', this.videoEnabled);
  }

  sendMediaStatus() {
    this.client.send({
      type: 'media_status',
      audio: this.audioEnabled,
      video: this.videoEnabled,
    });
  }

  async addLocalTrack(track) {
    for (const peer of this.peers.values()) {
      if (peer.pc.getSenders().some((sender) => sender.track?.kind === track.kind)) continue;
      peer.pc.addTrack(track, new MediaStream([track]));
    }
  }

  async removeLocalKind(kind) {
    for (const peer of this.peers.values()) {
      for (const sender of peer.pc.getSenders()) {
        if (sender.track?.kind === kind) peer.pc.removeTrack(sender);
      }
    }
  }

  ensurePeer(id) {
    if (!id || id === this.client.localId) return null;
    let peer = this.peers.get(id);
    if (peer) return peer;
    if (this.peers.size >= MAX_RTC_PEERS) return null;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peer = {
      id,
      pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      polite: String(this.client.localId) > String(id),
      stream: new MediaStream(),
    };
    this.peers.set(id, peer);
    if (this.audioTrack) pc.addTrack(this.audioTrack, new MediaStream([this.audioTrack]));
    if (this.videoTrack) pc.addTrack(this.videoTrack, new MediaStream([this.videoTrack]));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.client.send({ type: 'signal', targetId: id, data: { candidate } });
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        this.client.send({
          type: 'signal',
          targetId: id,
          data: { description: pc.localDescription },
        });
      } catch (error) {
        console.warn('WebRTC negotiation', error);
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.ontrack = ({ track, streams }) => {
      const stream = streams?.[0];
      if (stream) {
        for (const incoming of stream.getTracks()) {
          if (!peer.stream.getTracks().some((existing) => existing.id === incoming.id))
            peer.stream.addTrack(incoming);
        }
      } else if (!peer.stream.getTracks().some((existing) => existing.id === track.id))
        peer.stream.addTrack(track);
      this.renderRemoteMedia(id, peer.stream);
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) this.removePeer(id);
    };
    return peer;
  }

  async handleSignal(fromId, data = {}) {
    const peer = this.ensurePeer(fromId);
    if (!peer) return;
    const { pc } = peer;
    try {
      if (data.description) {
        const description = data.description;
        const readyForOffer =
          !peer.makingOffer &&
          (pc.signalingState === 'stable' || peer.isSettingRemoteAnswerPending);
        const offerCollision = description.type === 'offer' && !readyForOffer;
        peer.ignoreOffer = !peer.polite && offerCollision;
        if (peer.ignoreOffer) return;
        peer.isSettingRemoteAnswerPending = description.type === 'answer';
        await pc.setRemoteDescription(description);
        peer.isSettingRemoteAnswerPending = false;
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          this.client.send({
            type: 'signal',
            targetId: fromId,
            data: { description: pc.localDescription },
          });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (error) {
          if (!peer.ignoreOffer) throw error;
        }
      }
    } catch (error) {
      console.warn('WebRTC signal', error);
    }
  }

  updatePlayerMedia(id, media = {}) {
    if (!id || id === this.client.localId) return;
    if (media.audio || media.video) this.ensurePeer(id);
    const entry = this.remoteMedia.get(id);
    if (entry) {
      entry.tile.classList.toggle('audio-live', media.audio === true);
      entry.video.hidden = media.video !== true || !entry.video.srcObject;
      entry.status.textContent = [media.audio ? 'mic' : '', media.video ? 'camera' : '']
        .filter(Boolean)
        .join(' + ');
    }
  }

  renderRemoteMedia(id, stream) {
    let entry = this.remoteMedia.get(id);
    if (!entry) {
      const tile = this.document.createElement('div');
      tile.className = 'live-media-tile';
      const video = this.document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = false;
      const audio = this.document.createElement('audio');
      audio.autoplay = true;
      const label = this.document.createElement('small');
      const remote = this.client.remotePlayers.get(id);
      label.textContent = remote?.avatar?.displayName ?? 'Guest';
      const status = this.document.createElement('small');
      status.className = 'live-media-status';
      tile.append(video, audio, label, status);
      this.mediaGrid.appendChild(tile);
      entry = { tile, video, audio, label, status };
      this.remoteMedia.set(id, entry);
    }
    entry.video.srcObject = stream;
    entry.audio.srcObject = stream;
    const hasVideo = stream.getVideoTracks().some((track) => track.readyState === 'live');
    entry.video.hidden = !hasVideo;
    void entry.video.play().catch(() => {});
    void entry.audio.play().catch(() => {});
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (peer) {
      peer.pc.close();
      this.peers.delete(id);
    }
    const entry = this.remoteMedia.get(id);
    if (entry) {
      entry.tile.remove();
      this.remoteMedia.delete(id);
    }
  }

  playerJoined(player) {
    if (player?.media?.audio || player?.media?.video) this.ensurePeer(player.id);
    this.updatePlayerMedia(player?.id, player?.media);
  }

  playerLeft(id) {
    this.removePeer(id);
  }

  dispose() {
    this.audioTrack?.stop();
    this.videoTrack?.stop();
    for (const id of [...this.peers.keys()]) this.removePeer(id);
    this.dock?.remove();
  }
}
