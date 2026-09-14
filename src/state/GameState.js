import { LEVEL_IDS } from '../world/levels.js';

export const SAVE_KEY = 'breakglass.after-hours.v1';
export const TRACK_IDS = ['night-bus', 'glass-floor', '3am-tool'];
const defaults = () => ({
  version: 1,
  sceneId: 'upstairs',
  position: null,
  visited: ['upstairs'],
  contacts: [],
  lastTrack: null,
  debug: false,
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
    state.contacts = [...new Set(value.contacts.filter((id) => ['nora', 'jashim'].includes(id)))];
  }
  if (TRACK_IDS.includes(value.lastTrack)) state.lastTrack = value.lastTrack;
  state.debug = value.debug === true;
  state.layoutRevision = typeof value.layoutRevision === 'string' ? value.layoutRevision : null;
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
    if (!this.data.contacts.includes(id)) this.data.contacts.push(id);
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
