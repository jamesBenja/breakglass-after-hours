import { ARCHIVE_TAPE_IDS } from '../archive/tapeArchive.js';
import { LIVE_ARCHIVE_IDS } from '../archive/liveArchive.js';
import { normalizeAvatar } from '../avatar/profile.js';
import { normalizeDifficulty } from '../gameplay/guidance.js';
import { normalizeModularPatchState } from '../gameplay/ModularSynthSystem.js';
import { MIXING_CHALLENGE_IDS } from '../studio/MixingChallenge.js';
import { normalizeStudioSession } from '../studio/StudioSession.js';
import { LEVEL_IDS } from '../world/levels.js';

export const SAVE_KEY = 'breakglass.after-hours.v1';
export const TRACK_IDS = [
  'night-bus',
  'glass-floor',
  '3am-tool',
  'got-you-dancin',
  'in-flux',
  'in-flux-just-be',
  'in-flux-breath',
  'in-flux-break',
  'in-flux-gingele',
  'atrakar',
  'dubki',
  'paharpur',
  'fakir',
  'bhab',
  'diet-cake',
];
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
  'david',
  'beaver',
  'sam',
  'malaika',
  'dave',
  'bouncer',
];
const HOUSE_DJ_IDS = [
  'lunice',
  'kaytranada',
  'james-benjamin',
  'siren-mars',
  'monib',
  'hydra',
  'bootyspoon',
  'marie-davidson',
  'frankie-teardrop',
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
      ? photo.tags
          .filter((tag) => typeof tag === 'string')
          .slice(0, 12)
          .map((tag) => tag.slice(0, 32))
      : [],
    approvedForSharing: photo.approvedForSharing === true,
    dataUrl,
  };
};

const normalizeGameStats = (value = {}) => {
  const djLongestByName = {};
  if (value.djLongestByName && typeof value.djLongestByName === 'object') {
    for (const [rawKey, rawEntry] of Object.entries(value.djLongestByName).slice(0, 32)) {
      if (typeof rawKey !== 'string' || !rawKey.trim()) continue;
      const key = rawKey.trim().slice(0, 48);
      const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
      djLongestByName[key] = {
        label:
          typeof entry.label === 'string' && entry.label.trim()
            ? entry.label.trim().slice(0, 32)
            : key.slice(0, 32),
        seconds: Math.max(0, Math.min(86400, Number(entry.seconds) || 0)),
      };
    }
  }
  return {
    walkingMeters: Math.max(0, Math.min(10000000, Number(value.walkingMeters) || 0)),
    peakCrowdEngagement: Math.max(
      0,
      Math.min(100, Math.round(Number(value.peakCrowdEngagement) || 0)),
    ),
    peakDanceFloorCount: Math.max(
      0,
      Math.min(999, Math.floor(Number(value.peakDanceFloorCount) || 0)),
    ),
    djLongestByName,
  };
};

const normalizeStudioSong = (song, index) => {
  if (!song || typeof song !== 'object') return null;
  const session = normalizeStudioSession(song.session);
  return {
    id:
      typeof song.id === 'string' && song.id.trim()
        ? song.id.trim().slice(0, 64)
        : `studio-song-${index + 1}`,
    name:
      typeof song.name === 'string' && song.name.trim()
        ? song.name.trim().slice(0, 72)
        : `Studio song ${index + 1}`,
    savedAt: Math.max(0, Math.floor(Number(song.savedAt) || 0)),
    session,
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
  studioSongs: [],
  gameStats: normalizeGameStats(),
  candy: 0,
  devinFavor: 0,
  intoxication: 0,
  drinksServed: 0,
  caffeine: 0,
  coffeesMade: 0,
  maddoxAffection: 0,
  maddoxPets: 0,
  maddoxBellyUnlocked: false,
  maddoxBellyRubs: 0,
  roofSecretUnlocked: false,
  studioAccessGranted: false,
  houseDjDeskIntroduced: false,
  storageAccessGranted: false,
  tapeArchiveAccessGranted: false,
  deadRoomAccessGranted: false,
  difficulty: 'medium',
  mixingChallengeCompleted: [],
  mixingRewardKey: false,
  alleyShortcutUnlocked: false,
  hotDogsEaten: 0,
  tacosEaten: 0,
  maddoxCompanion: false,
  arcadeWins: 0,
  archiveTape: null,
  threadedTape: null,
  liveRoomArchive: null,
  houseDjId: null,
  smokesShared: 0,
  bathroomClogCleared: false,
  bathroomFlooded: false,
  bathroomPlungeWins: 0,
  bathroomFloods: 0,
  bathroomUses: 0,
  handsWashed: 0,
  modularSynth: normalizeModularPatchState(),
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
  state.gameStats = normalizeGameStats(value.gameStats);
  if (Array.isArray(value.studioSongs)) {
    state.studioSongs = value.studioSongs.map(normalizeStudioSong).filter(Boolean).slice(-8);
  }
  state.candy = Math.max(0, Math.min(9, Math.floor(Number(value.candy) || 0)));
  state.devinFavor = Math.max(0, Math.min(99, Math.floor(Number(value.devinFavor) || 0)));
  state.intoxication = Math.max(0, Math.min(1, Number(value.intoxication) || 0));
  state.drinksServed = Math.max(0, Math.min(999, Math.floor(Number(value.drinksServed) || 0)));
  state.caffeine = Math.max(0, Math.min(1, Number(value.caffeine) || 0));
  state.coffeesMade = Math.max(0, Math.min(999, Math.floor(Number(value.coffeesMade) || 0)));
  state.maddoxAffection = Math.max(0, Math.min(9, Math.floor(Number(value.maddoxAffection) || 0)));
  state.maddoxPets = Math.max(0, Math.min(999, Math.floor(Number(value.maddoxPets) || 0)));
  state.maddoxBellyUnlocked = value.maddoxBellyUnlocked === true;
  state.maddoxBellyRubs = Math.max(0, Math.min(999, Math.floor(Number(value.maddoxBellyRubs) || 0)));
  state.roofSecretUnlocked = value.roofSecretUnlocked === true;
  state.studioAccessGranted = value.studioAccessGranted === true;
  state.houseDjDeskIntroduced = value.houseDjDeskIntroduced === true;
  state.storageAccessGranted = value.storageAccessGranted === true;
  state.tapeArchiveAccessGranted = value.tapeArchiveAccessGranted === true;
  state.deadRoomAccessGranted = value.deadRoomAccessGranted === true;
  state.difficulty = normalizeDifficulty(value.difficulty);
  if (Array.isArray(value.mixingChallengeCompleted)) {
    state.mixingChallengeCompleted = [
      ...new Set(value.mixingChallengeCompleted.filter((id) => MIXING_CHALLENGE_IDS.includes(id))),
    ];
  }
  state.mixingRewardKey = value.mixingRewardKey === true;
  state.alleyShortcutUnlocked = value.alleyShortcutUnlocked === true || state.mixingRewardKey;
  state.hotDogsEaten = Math.max(0, Math.min(999, Math.floor(Number(value.hotDogsEaten) || 0)));
  state.tacosEaten = Math.max(0, Math.min(999, Math.floor(Number(value.tacosEaten) || 0)));
  state.maddoxCompanion = state.roofSecretUnlocked && value.maddoxCompanion === true;
  state.arcadeWins = Math.max(0, Math.min(999, Math.floor(Number(value.arcadeWins) || 0)));
  if (ARCHIVE_TAPE_IDS.includes(value.archiveTape)) state.archiveTape = value.archiveTape;
  if (ARCHIVE_TAPE_IDS.includes(value.threadedTape)) state.threadedTape = value.threadedTape;
  if (LIVE_ARCHIVE_IDS.includes(value.liveRoomArchive))
    state.liveRoomArchive = value.liveRoomArchive;
  if (HOUSE_DJ_IDS.includes(value.houseDjId)) state.houseDjId = value.houseDjId;
  state.smokesShared = Math.max(0, Math.min(999, Math.floor(Number(value.smokesShared) || 0)));
  state.bathroomClogCleared = value.bathroomClogCleared === true;
  state.bathroomFlooded = value.bathroomFlooded === true;
  state.bathroomPlungeWins = Math.max(
    0,
    Math.min(999, Math.floor(Number(value.bathroomPlungeWins) || 0)),
  );
  state.bathroomFloods = Math.max(0, Math.min(999, Math.floor(Number(value.bathroomFloods) || 0)));
  state.bathroomUses = Math.max(0, Math.min(999, Math.floor(Number(value.bathroomUses) || 0)));
  state.handsWashed = Math.max(0, Math.min(999, Math.floor(Number(value.handsWashed) || 0)));
  state.modularSynth = normalizeModularPatchState(value.modularSynth);
  if (Array.isArray(value.photos)) {
    state.photos = value.photos.map(normalizePhoto).filter(Boolean).slice(-18);
  }
  return state;
}

export class GameState {
  constructor(storage, onWarning = () => {}, saveKey = SAVE_KEY) {
    this.storage = storage;
    this.saveKey = saveKey || SAVE_KEY;
    this.onWarning = onWarning;
    this.warningShown = false;
    this.data = defaults();
    try {
      this.data = validateSave(JSON.parse(storage?.getItem(this.saveKey) ?? 'null'));
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
      this.storage.setItem(this.saveKey, JSON.stringify(this.data));
      return true;
    } catch {
      this.warn('Saving is unavailable in this browser. This visit can continue.');
      return false;
    }
  }
}
