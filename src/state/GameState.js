import { normalizeAvatar } from '../avatar/profile.js';
import { normalizeStudioSession } from '../studio/StudioSession.js';
import { LEVEL_IDS } from '../world/levels.js';

export const SAVE_KEY = 'breakglass.after-hours.v1';
export const TRACK_IDS = [
  'night-bus',
  'glass-floor',
  '3am-tool',
  'got-you-dancin',
  'in-flux',
  'atrakar',
  'dubki',
  'diet-cake',
];
export const ARCHIVE_TAPE_IDS = ['two-inch-a', 'two-inch-b', 'quarter-inch-mix'];
export const LIVE_ARCHIVE_IDS = ['fieldnote-launch-2026'];
const CONTACT_IDS = [
  'nora',
  'james',
  'jace',
  'zander',
  'boogaloo',
  'jashim',
  'courtney',
  'simla',
  'devin',
  'bouncer',
];

const normalizePhoto = (photo) => {
  if (!photo || typeof photo !== 'object') return null;
  const dataUrl = typeof photo.dataUrl === 'string' ? photo.dataUrl : '';
  if (!dataUrl.startsWith('data:image/jpeg') || dataUrl.length > 350000) return null;
  return {
    id: typeof photo.id === 'string' ? photo.id.slice(0, 80) : `photo-${Date.now()}`,
    eventId: typeof photo.eventId === 'string' ? photo.eventId.slice(0, 48) : 'bg20-local',
    timestamp: typeof photo.timestamp === 'string' ? photo.timestamp.slice(0, 40) : null,
    photographerId:
      typeof photo.photographerId === 'string' ? photo.photographerId.slice(0, 32) : 'nora',
    roomId: typeof photo.roomId === 'string' ? photo.roomId.slice(0, 48) : null,
    avatarIds: Array.isArray(photo.avatarIds)
      ? photo.avatarIds.filter((id) => typeof id === 'string').slice(0, 12)
      : [],
    partyEnergy: Math.max(0, Math.min(1, Number(photo.partyEnergy) || 0)),
    attendance:
      Number.isFinite(Number(photo.attendance)) && photo.attendance != null
        ? Math.max(0, Math.round(Number(photo.attendance)))
        : null,
    lightingPreset:
      typeof photo.lightingPreset === 'string' ? photo.lightingPreset.slice(0, 32) : null,
    haze: photo.haze == null ? null : Math.max(0, Math.min(1, Number(photo.haze) || 0)),
    tags: Array.isArray(photo.tags)
      ? photo.tags.filter((tag) => typeof tag === 'string').slice(0, 12).map((tag) => tag.slice(0, 32))
      : [],
    approvedForSharing: photo.approvedForSharing === true,
    dataUrl,
  };
};

const defaults = () => ({
  version: 1,
  sceneId: 'upstairs',
  position: null,
  visited: ['upstairs'],
  contacts: [],
  lastTrack: null,
  debug: false,
  avatar: normalizeAvatar(),
  avatarConfigured: false,
  studio: normalizeStudioSession(),
  candy: 0,
  devinFavor: 0,
  archiveTape: null,
  threadedTape: null,
  liveRoomArchive: null,
  photos: [],
});

export function validateSave(value) {
  const state = defaults();
  if (!value || value.version !== 1) return state;
  if (LEVEL_IDS.includes(value.sceneId)) {
    state.sceneId = value.sceneId;
    if (
      Array.isArray(value.position) &&
      value.position.length === 3 &&
      value.position.every(
        (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 10000,
      )
    ) {
      state.position = [...value.position];
    }
  }
  if (Array.isArray(value.visited)) {
    state.visited = [...new Set(value.visited.filter((id) => LEVEL_IDS.includes(id)))];
  }
  if (Array.isArray(value.contacts)) {
    state.contacts = [...new Set(value.contacts.filter((id) => CONTACT_IDS.includes(id)))];
  }
  if (TRACK_IDS.includes(value.lastTrack)) state.lastTrack = value.lastTrack;
  state.debug = value.debug === true;
  state.layoutRevision = typeof value.layoutRevision === 'string' ? value.layoutRevision : null;
  state.avatar = normalizeAvatar(value.avatar);
  state.avatarConfigured = value.avatarConfigured === true;
  state.studio = normalizeStudioSession(value.studio);
  state.candy = Math.max(0, Math.min(9, Math.floor(Number(value.candy) || 0)));
  state.devinFavor = Math.max(0, Math.min(99, Math.floor(Number(value.devinFavor) || 0)));
  if (ARCHIVE_TAPE_IDS.includes(value.archiveTape)) state.archiveTape = value.archiveTape;
  if (ARCHIVE_TAPE_IDS.includes(value.threadedTape)) state.threadedTape = value.threadedTape;
  if (LIVE_ARCHIVE_IDS.includes(value.liveRoomArchive)) state.liveRoomArchive = value.liveRoomArchive;
  if (Array.isArray(value.photos)) {
    state.photos = value.photos.map(normalizePhoto).filter(Boolean).slice(-6);
  }
  return state;
}

export class GameState {
  constructor(storage, onWarning = () => {}) {
    this.storage = storage;
    this.onWarning = onWarning;
    this.warningShown = false;
    this.data = defaults();
    try {
      this.data = validateSave(JSON.parse(storage?.getItem(SAVE_KEY) ?? 'null'));
    } catch {
      this.warn('Saved progress could not be read. Starting a fresh visit.');
    }
  }

  warn(message) {
    if (this.warningShown) return;
    this.warningShown = true;
    this.onWarning(message);
  }

  visit(sceneId) {
    if (!this.data.visited.includes(sceneId)) this.data.visited.push(sceneId);
    this.data.sceneId = sceneId;
  }

  meet(id) {
    if (CONTACT_IDS.includes(id) && !this.data.contacts.includes(id)) this.data.contacts.push(id);
  }

  save(sceneId, position, layoutRevision = null) {
    if (sceneId && position) {
      this.visit(sceneId);
      this.data.layoutRevision = layoutRevision;
      this.data.position = [position.x, position.y, position.z];
    }
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      this.warn('Saving is unavailable in this browser. This visit can continue.');
      return false;
    }
  }
}
