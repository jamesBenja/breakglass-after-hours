// Large recorded takes live outside the JSON save so song projects remain lightweight.
const DB_NAME = 'breakglass-spectra-projects';
const DB_VERSION = 1;
const STORE = 'recordings';

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

/**
 * Stores large browser-recorded audio separately from the JSON game save.
 *
 * Spectra project metadata remains in GameState/localStorage. Audio blobs use IndexedDB so a
 * vocal or microphone take can survive reloads without risking localStorage quota/corruption.
 */
export class SpectraProjectStore {
  constructor(indexedDB = globalThis.indexedDB) {
    this.indexedDB = indexedDB ?? null;
    this.dbPromise = null;
    this.memory = new Map();
  }

  get supported() {
    return !!this.indexedDB;
  }

  async db() {
    if (!this.indexedDB) return null;
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = this.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        let store;
        if (!db.objectStoreNames.contains(STORE)) {
          store = db.createObjectStore(STORE, { keyPath: 'key' });
        } else {
          store = request.transaction.objectStore(STORE);
        }
        if (!store.indexNames.contains('projectId')) {
          store.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Could not open Spectra project audio store.'));
    }).catch((error) => {
      this.dbPromise = null;
      throw error;
    });
    return this.dbPromise;
  }

  key(projectId, stemId) {
    return `${String(projectId)}::${String(stemId)}`;
  }

  async put(projectId, stemId, blob) {
    if (!projectId || !stemId || !blob) return false;
    const item = {
      key: this.key(projectId, stemId),
      projectId: String(projectId),
      stemId: String(stemId),
      blob,
      savedAt: Date.now(),
    };
    this.memory.set(item.key, item);
    if (!this.indexedDB) return true;
    const db = await this.db();
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(item);
    await transactionPromise(transaction);
    return true;
  }

  async list(projectId) {
    const id = String(projectId);
    if (!this.indexedDB) {
      return [...this.memory.values()].filter((item) => item.projectId === id);
    }
    const db = await this.db();
    const transaction = db.transaction(STORE, 'readonly');
    const index = transaction.objectStore(STORE).index('projectId');
    const items = await requestPromise(index.getAll(id));
    await transactionPromise(transaction);
    return Array.isArray(items) ? items : [];
  }

  async deleteProject(projectId) {
    const id = String(projectId);
    for (const [key, item] of this.memory) {
      if (item.projectId === id) this.memory.delete(key);
    }
    if (!this.indexedDB) return true;
    const db = await this.db();
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const index = store.index('projectId');
    const keys = await requestPromise(index.getAllKeys(id));
    for (const key of keys) store.delete(key);
    await transactionPromise(transaction);
    return true;
  }

  async delete(projectId, stemId) {
    const key = this.key(projectId, stemId);
    this.memory.delete(key);
    if (!this.indexedDB) return true;
    const db = await this.db();
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(key);
    await transactionPromise(transaction);
    return true;
  }

  async saveSession(projectId, session) {
    if (!projectId || !session) return { saved: 0, missing: 0 };
    const persistedStems = (session.stems ?? []).filter(
      (stem) => stem.source === 'browser-microphone' || stem.renderedAudio === true,
    );
    const currentIds = new Set(persistedStems.map((stem) => String(stem.id)));
    const existing = await this.list(projectId);
    for (const item of existing) {
      if (!currentIds.has(String(item.stemId))) await this.delete(projectId, item.stemId);
    }

    let saved = 0;
    let missing = 0;
    for (const stem of persistedStems) {
      const blob = session.recordingBlobs?.get?.(stem.id);
      if (blob) {
        await this.put(projectId, stem.id, blob);
        saved += 1;
        continue;
      }
      const alreadyStored = existing.some((item) => item.stemId === stem.id);
      if (session.recordings?.has?.(stem.id) && !alreadyStored) missing += 1;
    }
    return { saved, missing };
  }

  async copyProject(fromProjectId, toProjectId) {
    const source = await this.list(fromProjectId);
    await this.deleteProject(toProjectId);
    for (const item of source) await this.put(toProjectId, item.stemId, item.blob);
    return source.length;
  }

  async restoreSession(projectId, session, audioContext) {
    if (!projectId || !session || !audioContext) return { restored: 0, failed: 0 };
    const items = await this.list(projectId);
    let restored = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const data = await item.blob.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(data);
        session.attachRecording(item.stemId, buffer, item.blob);
        restored += 1;
      } catch {
        failed += 1;
      }
    }
    return { restored, failed };
  }

  dispose() {
    this.memory.clear();
    this.dbPromise?.then?.((db) => db?.close?.()).catch?.(() => {});
    this.dbPromise = null;
  }
}
