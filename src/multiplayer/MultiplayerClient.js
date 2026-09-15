import { multiplayerAvatar } from '../avatar/profile.js';
import { RemotePlayer } from './RemotePlayer.js';
import { RealtimeMedia } from './RealtimeMedia.js';
import { SharedWorld } from './SharedWorld.js';

const DEFAULT_ROOM = 'breakglass-main';
const DEFAULT_SERVER = 'https://multiplayer-phase2-production.up.railway.app';
const SEND_INTERVAL_MS = 1000 / 15;
const RECONNECT_MAX_MS = 10_000;

function websocketUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, location.href);
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (!['ws:', 'wss:'].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function resolveMultiplayerConfig() {
  const params = new URLSearchParams(location.search);
  if (params.get('offline') === '1') return { url: null, room: DEFAULT_ROOM };
  const room =
    (params.get('room') || DEFAULT_ROOM).replace(/[^a-z0-9-_]/gi, '').slice(0, 48) || DEFAULT_ROOM;
  const queryServer = params.get('server');
  if (queryServer) {
    try {
      localStorage.setItem('breakglass.multiplayer.server', queryServer);
    } catch {
      // Private mode may block storage; the query parameter still works for this session.
    }
  }
  let stored = null;
  try {
    stored = localStorage.getItem('breakglass.multiplayer.server');
  } catch {
    // Multiplayer remains optional when storage is blocked.
  }
  const configured =
    queryServer ||
    globalThis.BREAKGLASS_MULTIPLAYER_URL ||
    import.meta.env?.VITE_MULTIPLAYER_URL ||
    stored ||
    DEFAULT_SERVER;
  return { url: websocketUrl(configured), room };
}

function safeSend(socket, payload) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function buildPresence(document) {
  const element = document.createElement('div');
  element.id = 'multiplayerPresence';
  element.hidden = true;
  element.setAttribute('aria-live', 'polite');
  document.body.appendChild(element);
  return element;
}

export class MultiplayerClient {
  constructor({ game, ui, url, room = DEFAULT_ROOM }) {
    this.game = game;
    this.ui = ui;
    this.url = url;
    this.room = room;
    this.socket = null;
    this.localId = null;
    this.remotePlayers = new Map();
    this.connected = false;
    this.joined = false;
    this.disposed = false;
    this.avatar = null;
    this.lastSentAt = 0;
    this.lastSnapshot = '';
    this.lastFrameAt = null;
    this.reconnectDelay = 800;
    this.reconnectTimer = null;
    this.presence = buildPresence(ui.document);
    this.world = new SharedWorld(this);
    this.media = new RealtimeMedia(this);
    this.updatePresence();
  }

  send(payload) {
    return safeSend(this.socket, payload);
  }

  start(avatar) {
    // Selfie sharing remains opt-in. multiplayerAvatar strips the processed texture unless
    // shareFaceMultiplayer was explicitly enabled by the player.
    this.avatar = multiplayerAvatar(avatar);
    if (!this.url) {
      this.updatePresence('SOLO · multiplayer server not configured');
      return false;
    }
    this.open();
    return true;
  }

  open() {
    if (this.disposed || !this.url || !this.avatar) return;
    if (this.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.socket.readyState))
      return;
    this.clearReconnect();
    this.updatePresence('CONNECTING · Breakglass live');
    let socket;
    try {
      socket = new WebSocket(this.url);
    } catch (error) {
      this.updatePresence(`OFFLINE · ${error.message}`);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (socket !== this.socket || this.disposed) return;
      this.connected = true;
      this.reconnectDelay = 800;
      this.send({
        type: 'join',
        room: this.room,
        avatar: this.avatar,
        state: this.localState(),
      });
      this.updatePresence('JOINING · Breakglass live');
    });
    socket.addEventListener('message', (event) => {
      if (socket !== this.socket || this.disposed) return;
      this.handleMessage(event.data);
    });
    socket.addEventListener('close', () => {
      if (socket !== this.socket) return;
      this.connected = false;
      this.joined = false;
      this.localId = null;
      this.socket = null;
      this.clearRemotes();
      if (!this.disposed) {
        this.updatePresence('RECONNECTING · Breakglass live');
        this.scheduleReconnect();
      }
    });
    socket.addEventListener('error', () => {
      if (socket === this.socket) this.updatePresence('CONNECTION LOST · retrying');
    });
  }

  scheduleReconnect() {
    if (this.disposed || !this.url || this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(RECONNECT_MAX_MS, Math.round(this.reconnectDelay * 1.7));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  handleMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;

    if (message.type === 'welcome') {
      this.localId = message.id;
      this.joined = true;
      for (const player of message.players ?? []) {
        this.addRemote(player);
        this.media.playerJoined(player);
      }
      this.world.hydrate(message.world ?? {});
      this.media.hydrate(message.world?.chat ?? []);
      this.updatePresence();
      this.ui.warning?.(
        `LIVE ROOM · ${this.remotePlayers.size + 1} ${this.remotePlayers.size ? 'people' : 'person'} connected`,
      );
      return;
    }
    if (message.type === 'player_joined') {
      this.addRemote(message.player);
      this.media.playerJoined(message.player);
      this.updatePresence();
      const name = message.player?.avatar?.displayName ?? 'Someone';
      this.ui.warning?.(`${name} entered Breakglass.`);
      return;
    }
    if (message.type === 'player_left') {
      const remote = this.remotePlayers.get(message.id);
      if (remote) this.ui.warning?.(`${remote.avatar.displayName} left Breakglass.`);
      this.media.playerLeft(message.id);
      this.removeRemote(message.id);
      this.updatePresence();
      return;
    }
    if (message.type === 'state') {
      this.remotePlayers.get(message.id)?.applyState(message.state);
      return;
    }
    if (message.type === 'emote') {
      this.handleEmote(message);
      return;
    }
    if (message.type === 'chat') {
      this.media.addChat(message.message);
      return;
    }
    if (message.type === 'media_status') {
      this.media.updatePlayerMedia(message.id, message.media);
      return;
    }
    if (message.type === 'signal') {
      void this.media.handleSignal(message.fromId, message.data);
      return;
    }
    if (
      ['resource_result', 'resource', 'object_state', 'dj_state', 'lighting_state', 'party_state'].includes(
        message.type,
      )
    ) {
      this.world.handleMessage(message);
      return;
    }
    if (message.type === 'error') {
      this.ui.warning?.(`Multiplayer: ${message.message || 'server error'}`);
    }
  }

  addRemote(player) {
    if (!player?.id || player.id === this.localId) return null;
    let remote = this.remotePlayers.get(player.id);
    if (!remote) {
      remote = new RemotePlayer({
        id: player.id,
        avatar: player.avatar,
        state: player.state,
        scenes: this.game.scenes,
      });
      this.remotePlayers.set(player.id, remote);
    } else remote.applyState(player.state, { immediate: true });
    return remote;
  }

  removeRemote(id) {
    const remote = this.remotePlayers.get(id);
    if (!remote) return;
    remote.dispose();
    this.remotePlayers.delete(id);
  }

  clearRemotes() {
    for (const remote of this.remotePlayers.values()) remote.dispose();
    this.remotePlayers.clear();
  }

  localState() {
    const player = this.game.player;
    const sceneId = this.game.sceneManager.current?.definition?.id ?? 'alley';
    return {
      sceneId,
      position: player.position.toArray(),
      rotationY: player.object.rotation.y,
      moving: Math.hypot(player.velocity.x, player.velocity.z) > 0.15,
      dancing: player.danceRemaining > 0,
      seated: player.seated === true,
      grounded: player.grounded !== false,
    };
  }

  maybeSendState(now) {
    if (!this.joined || now - this.lastSentAt < SEND_INTERVAL_MS) return;
    const state = this.localState();
    const signature = JSON.stringify([
      state.sceneId,
      ...state.position.map((value) => Math.round(value * 100) / 100),
      Math.round(state.rotationY * 100) / 100,
      state.moving,
      state.dancing,
      state.seated,
      state.grounded,
    ]);
    // Send a heartbeat state at least every 1.2s even while perfectly still.
    if (signature === this.lastSnapshot && now - this.lastSentAt < 1200) return;
    if (this.send({ type: 'state', state })) {
      this.lastSnapshot = signature;
      this.lastSentAt = now;
    }
  }

  update(now = performance.now()) {
    const dt =
      this.lastFrameAt == null ? 0 : Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;
    for (const remote of this.remotePlayers.values()) remote.update(dt);
    this.world.update();
    this.maybeSendState(now);
  }

  interactionTargets() {
    const sceneId = this.game.sceneManager.current?.definition?.id;
    if (!sceneId) return [];
    const targets = [];
    for (const remote of this.remotePlayers.values()) {
      if (remote.sceneId === sceneId) targets.push(remote.interactionTarget());
    }
    return targets;
  }

  faceRemote(remote) {
    if (!remote) return;
    const player = this.game.player;
    const dx = remote.object.position.x - player.position.x;
    const dz = remote.object.position.z - player.position.z;
    if (Math.hypot(dx, dz) > 0.01) player.object.rotation.y = Math.atan2(dx, dz);
    remote.facePosition(player.position);
  }

  showInteraction(target) {
    const remote = this.remotePlayers.get(target.multiplayerId);
    if (!remote) return false;
    const name = remote.avatar.displayName;
    const role = remote.avatar.role;
    this.ui.panel(name, `${role.toUpperCase()} · a real player in this Breakglass room.`, [
      ['Wave', () => this.sendEmote('wave', remote.id)],
      [
        'Dance together',
        () => {
          this.game.player.dance(1.8);
          this.sendEmote('dance', remote.id);
        },
      ],
      ['High five', () => this.sendEmote('highfive', remote.id)],
    ]);
    return true;
  }

  sendEmote(kind, targetId = null) {
    if (!this.joined) return false;
    const remote = targetId ? this.remotePlayers.get(targetId) : null;
    if (remote) this.faceRemote(remote);
    const sent = this.send({ type: 'emote', kind, targetId });
    if (!sent) return false;
    if (kind === 'dance') this.game.player.dance(1.8);
    else this.game.player.performMultiplayerGesture?.(kind);
    if (kind === 'highfive') remote?.emote('highfive');
    return true;
  }

  handleEmote(message) {
    if (message.fromId === this.localId) return;
    const remote = this.remotePlayers.get(message.fromId);
    if (!remote) return;
    remote.emote(message.kind);
    if (message.targetId === this.localId) {
      this.faceRemote(remote);
      const labels = {
        wave: 'waves at you',
        dance: 'starts dancing with you',
        highfive: 'high-fives you',
      };
      this.ui.warning?.(
        `${remote.avatar.displayName} ${labels[message.kind] ?? 'interacts with you'}.`,
      );
      if (message.kind === 'dance') this.game.player.dance(1.8);
      else if (message.kind === 'highfive') this.game.player.performMultiplayerGesture?.('highfive');
    }
  }

  updatePresence(override = null) {
    if (!this.presence) return;
    this.presence.hidden = false;
    if (override) {
      this.presence.textContent = override;
      this.presence.dataset.state = 'offline';
      return;
    }
    if (!this.url) {
      this.presence.textContent = 'SOLO';
      this.presence.dataset.state = 'offline';
      return;
    }
    if (!this.joined) {
      this.presence.textContent = 'CONNECTING';
      this.presence.dataset.state = 'connecting';
      return;
    }
    const count = this.remotePlayers.size + 1;
    this.presence.textContent = `LIVE · ${count} HERE`;
    this.presence.dataset.state = 'live';
  }

  dispose() {
    this.disposed = true;
    this.clearReconnect();
    this.world.dispose();
    this.media.dispose();
    this.clearRemotes();
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close(1000, 'leaving');
    this.socket = null;
    this.presence?.remove();
    this.presence = null;
  }
}
