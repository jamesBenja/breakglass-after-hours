import { PerspectiveCamera, Vector3 } from 'three';

const SESSION_OBJECT = 'group-photo-session';
const JOIN_PREFIX = 'group-photo-join:';
const JOIN_WINDOW_MS = 6500;
const COUNTDOWN_MS = 3600;
const COMPLETE_AFTER_MS = 1500;

const nowFor = (game) => game.multiplayer?.serverNow?.() ?? Date.now();
const unique = (values) => [...new Set(values.filter(Boolean))];

export function groupPhotoCountdownLabel(now, captureAt) {
  const remaining = Math.max(0, Number(captureAt || 0) - Number(now || 0));
  if (remaining <= 180) return 'FLASH';
  return String(Math.max(1, Math.min(3, Math.ceil(remaining / 1000))));
}

function sessionFresh(session, now) {
  if (!session?.sessionId) return false;
  if (session.phase === 'complete' || session.phase === 'cancelled')
    return now - Number(session.updatedAt || 0) < 3500;
  const expiry = Number(session.captureAt || session.joinDeadline || session.createdAt || 0) + 8000;
  return !expiry || now <= expiry;
}

export class GroupPhotoSystem {
  constructor(game, ui, partyPhotos) {
    this.game = game;
    this.ui = ui;
    this.partyPhotos = partyPhotos;
    this.localSession = null;
    this.prompted = new Set();
    this.declined = new Set();
    this.captured = new Set();
    this.completed = new Set();
    this.lastLabel = '';
    this.overlay = this.makeOverlay();
    this.flash = this.makeFlash();
  }

  makeOverlay() {
    const doc = this.ui.document;
    if (!doc) return null;
    const el = doc.createElement('div');
    el.id = 'groupPhotoCountdown';
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      display: 'none',
      placeItems: 'center',
      pointerEvents: 'none',
      zIndex: '10020',
      fontFamily: 'system-ui, sans-serif',
      fontWeight: '900',
      fontSize: 'clamp(72px, 20vw, 220px)',
      letterSpacing: '-0.04em',
      color: '#fff',
      textShadow: '0 4px 30px rgba(0,0,0,.7)',
      background: 'rgba(0,0,0,.08)',
    });
    doc.body.appendChild(el);
    return el;
  }

  makeFlash() {
    const doc = this.ui.document;
    if (!doc) return null;
    const el = doc.createElement('div');
    el.id = 'groupPhotoFlash';
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '10030',
      background: '#fff',
      opacity: '0',
      transition: 'opacity 260ms ease-out',
    });
    doc.body.appendChild(el);
    return el;
  }

  showCountdown(label) {
    if (!this.overlay) return;
    if (!label) {
      this.overlay.style.display = 'none';
      this.lastLabel = '';
      return;
    }
    if (label === this.lastLabel) return;
    this.lastLabel = label;
    this.overlay.textContent = label;
    this.overlay.style.display = 'grid';
  }

  pulseFlash() {
    if (this.flash) {
      this.flash.style.transition = 'none';
      this.flash.style.opacity = '0.96';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.flash.style.transition = 'opacity 320ms ease-out';
          this.flash.style.opacity = '0';
        });
      });
    }
    this.game.audio?.hat?.(0.18);
  }

  multiplayer() {
    return this.game.multiplayer ?? null;
  }

  objects() {
    return this.multiplayer()?.world?.objects ?? null;
  }

  setObject(objectId, data) {
    const multiplayer = this.multiplayer();
    multiplayer?.world?.objects?.set?.(objectId, data);
    return multiplayer?.send?.({ type: 'object_update', objectId, data }) ?? false;
  }

  currentSession() {
    const shared = this.objects()?.get?.(SESSION_OBJECT);
    return shared ?? this.localSession;
  }

  localParticipantId() {
    return this.multiplayer()?.localId ?? 'local-player';
  }

  localName() {
    return this.game.state?.data?.avatar?.displayName || 'Guest';
  }

  localSceneId() {
    return this.game.sceneManager.current?.definition?.id ?? null;
  }

  photographerPosition(session = this.currentSession()) {
    const level = this.game.sceneManager.current;
    if (!level || level.definition.id !== session?.sceneId) return null;
    return level.npcs?.positionOf?.(session.photographerId || 'nora') ?? null;
  }

  nearPhotographer(session = this.currentSession(), maxDistance = 6.2) {
    const source = this.photographerPosition(session);
    if (!source) return false;
    const p = this.game.player.position;
    return Math.hypot(p.x - source.x, p.z - source.z) <= maxDistance;
  }

  canJoin(session = this.currentSession()) {
    if (!session || session.phase !== 'joining') return false;
    if (this.localSceneId() !== session.sceneId) return false;
    if (this.game.state?.data?.avatar?.photoConsent === false) return false;
    if (!this.nearPhotographer(session)) return false;
    return nowFor(this.game) < Number(session.joinDeadline || 0);
  }

  isParticipant(session = this.currentSession()) {
    return !!session?.participantIds?.includes?.(this.localParticipantId());
  }

  start(photographerId = 'nora') {
    const level = this.game.sceneManager.current;
    if (!level?.npcs?.has?.(photographerId)) {
      this.ui.warning?.('Nora needs to be nearby to start a group photo.');
      return false;
    }
    if (this.game.state?.data?.avatar?.photoConsent === false) {
      this.ui.warning?.('Photography is turned off in your avatar profile.');
      return false;
    }
    const now = nowFor(this.game);
    const active = this.currentSession();
    if (sessionFresh(active, now) && !['complete', 'cancelled'].includes(active.phase)) {
      this.ui.warning?.('A group photo is already getting set up.');
      return false;
    }
    const localId = this.localParticipantId();
    const session = {
      sessionId: `photo-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      phase: 'joining',
      sceneId: level.definition.id,
      photographerId,
      hostId: localId,
      hostName: this.localName(),
      participantIds: [localId],
      participantNames: { [localId]: this.localName() },
      createdAt: now,
      joinDeadline: now + JOIN_WINDOW_MS,
      captureAt: null,
      updatedAt: now,
    };
    this.localSession = session;
    this.setObject(SESSION_OBJECT, session);
    this.ui.warning?.('GROUP PHOTO · nearby players have 6 seconds to join.');
    this.posePhotoCrew(session);
    return true;
  }

  join() {
    const session = this.currentSession();
    if (!this.canJoin(session)) return false;
    const localId = this.localParticipantId();
    const data = {
      sessionId: session.sessionId,
      playerId: localId,
      name: this.localName(),
      sceneId: session.sceneId,
      joinedAt: nowFor(this.game),
    };
    this.setObject(`${JOIN_PREFIX}${session.sessionId}:${localId}`, data);
    this.ui.warning?.('You joined the group photo. Get in close — countdown is coming.');
    this.prompted.add(session.sessionId);
    return true;
  }

  decline() {
    const session = this.currentSession();
    if (!session?.sessionId) return;
    this.declined.add(session.sessionId);
    this.prompted.add(session.sessionId);
    this.ui.warning?.('You sit this photo out.');
  }

  promptJoin(session) {
    if (!this.canJoin(session) || this.isParticipant(session)) return;
    if (this.prompted.has(session.sessionId) || this.declined.has(session.sessionId)) return;
    this.prompted.add(session.sessionId);
    this.ui.panel(
      'GROUP PHOTO?',
      `${session.hostName || 'Someone'} is getting a photo with Nora and Malaika. Join the shot?`,
      [
        ['Join photo', () => this.join()],
        ['Skip this one', () => this.decline()],
      ],
    );
  }

  gatherJoins(session) {
    const ids = [...(session.participantIds ?? [])];
    const names = { ...(session.participantNames ?? {}) };
    const prefix = `${JOIN_PREFIX}${session.sessionId}:`;
    for (const [objectId, entry] of this.objects()?.entries?.() ?? []) {
      if (!objectId.startsWith(prefix) || entry?.sessionId !== session.sessionId) continue;
      if (entry.sceneId !== session.sceneId || !entry.playerId) continue;
      ids.push(entry.playerId);
      names[entry.playerId] = entry.name || 'Guest';
    }
    return { ids: unique(ids), names };
  }

  beginCountdown(session) {
    const now = nowFor(this.game);
    const joined = this.gatherJoins(session);
    const next = {
      ...session,
      phase: 'countdown',
      participantIds: joined.ids,
      participantNames: joined.names,
      captureAt: now + COUNTDOWN_MS,
      updatedAt: now,
    };
    this.localSession = next;
    this.setObject(SESSION_OBJECT, next);
    this.posePhotoCrew(next);
  }

  participantPositions(session) {
    const positions = [];
    const multiplayer = this.multiplayer();
    const localId = this.localParticipantId();
    if (session.participantIds?.includes(localId) && this.localSceneId() === session.sceneId)
      positions.push(this.game.player.position.clone());
    for (const id of session.participantIds ?? []) {
      if (id === localId) continue;
      const remote = multiplayer?.remotePlayers?.get?.(id);
      if (remote?.sceneId === session.sceneId) positions.push(remote.object.position.clone());
    }
    return positions;
  }

  groupCenter(session) {
    const positions = this.participantPositions(session);
    if (!positions.length) return this.game.player.position.clone();
    const center = new Vector3();
    for (const position of positions) center.add(position);
    return center.multiplyScalar(1 / positions.length);
  }

  posePhotoCrew(session) {
    const level = this.game.sceneManager.current;
    if (!level || level.definition.id !== session.sceneId) return;
    const center = this.groupCenter(session);
    level.npcs?.triggerPhoto?.(session.photographerId || 'nora', center, 4.2);
    const malaika = level.npcs?.get?.('malaika');
    if (!malaika) return;
    malaika.photoPulse = Math.max(malaika.photoPulse || 0, 4.2);
    malaika.photoJoinCamera =
      level.npcs.positionOf?.(session.photographerId || 'nora')?.clone?.() ?? null;
    // Malaika hypes every shot and jumps into roughly two out of three group photos.
    const sum = [...session.sessionId].reduce((value, char) => value + char.charCodeAt(0), 0);
    if (sum % 3 !== 0) malaika.photoJoinTarget = center.clone().add(new Vector3(0.9, 0, 0.15));
    else {
      malaika.photoJoinTarget = center.clone().add(new Vector3(1.55, 0, -0.45));
      malaika.photoJoinCamera = center.clone();
    }
  }

  faceCamera(session) {
    if (!this.isParticipant(session) || this.localSceneId() !== session.sceneId) return;
    const source = this.photographerPosition(session);
    if (!source) return;
    const p = this.game.player.position;
    const dx = source.x - p.x;
    const dz = source.z - p.z;
    if (Math.hypot(dx, dz) > 0.02) this.game.player.object.rotation.y = Math.atan2(dx, dz);
  }

  cameraFor(session) {
    const level = this.game.sceneManager.current;
    const source = this.photographerPosition(session);
    if (!level || !source) return null;
    const target = this.groupCenter(session);
    const participantCount = Math.max(1, session.participantIds?.length ?? 1);
    return this.game.photos.cameraForTarget(level, session.photographerId || 'nora', target, {
      fov: participantCount > 3 ? 56 : 52,
      minDistance: Math.min(4.8, 3.0 + Math.max(0, participantCount - 1) * 0.38),
      targetHeight: 1.02,
    });
  }

  capture(session) {
    if (this.captured.has(session.sessionId)) return;
    this.captured.add(session.sessionId);
    this.showCountdown('');
    this.pulseFlash();
    if (!this.isParticipant(session) || this.localSceneId() !== session.sceneId) return;
    if (this.game.state?.data?.avatar?.photoConsent === false) return;
    const level = this.game.sceneManager.current;
    const camera = this.cameraFor(session);
    if (!level || !camera) return;
    this.posePhotoCrew(session);
    const result = this.partyPhotos.saveCapture(
      level,
      session.photographerId || 'nora',
      camera,
      ['group-photo', level.definition.id, 'multiplayer'],
      session.participantIds ?? [],
    );
    if (result?.saved) this.ui.warning?.('GROUP PHOTO · got it.');
  }

  complete(session) {
    if (this.completed.has(session.sessionId)) return;
    this.completed.add(session.sessionId);
    const now = nowFor(this.game);
    const next = { ...session, phase: 'complete', updatedAt: now };
    this.localSession = next;
    this.setObject(SESSION_OBJECT, next);
  }

  update() {
    const now = nowFor(this.game);
    const session = this.currentSession();
    if (!session || !sessionFresh(session, now)) {
      this.showCountdown('');
      return;
    }
    this.localSession = session;
    if (session.phase === 'joining') {
      this.posePhotoCrew(session);
      if (session.hostId === this.localParticipantId() && now >= Number(session.joinDeadline || 0))
        this.beginCountdown(session);
      else this.promptJoin(session);
      return;
    }
    if (session.phase === 'countdown') {
      this.posePhotoCrew(session);
      this.faceCamera(session);
      const captureAt = Number(session.captureAt || 0);
      if (now < captureAt) {
        if (this.isParticipant(session))
          this.showCountdown(groupPhotoCountdownLabel(now, captureAt));
        return;
      }
      this.capture(session);
      if (session.hostId === this.localParticipantId() && now >= captureAt + COMPLETE_AFTER_MS)
        this.complete(session);
      return;
    }
    this.showCountdown('');
  }

  dispose() {
    this.overlay?.remove();
    this.flash?.remove();
    this.overlay = null;
    this.flash = null;
  }
}
