import { openDatabase } from "./schema.js";

/** Genera un identificador únic sense dependències externes. */
export function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Repositori genèric per a un object store concret d'IndexedDB. */
export class Repository {
  constructor(storeName) {
    this.storeName = storeName;
  }

  async #tx(mode) {
    const db = await openDatabase();
    const tx = db.transaction(this.storeName, mode);
    return { tx, store: tx.objectStore(this.storeName) };
  }

  /** Insereix o sobreescriu un registre. Afegeix id/createdAt/updatedAt si falten. */
  async put(record) {
    const now = new Date().toISOString();
    const withMeta = {
      ...record,
      id: record.id ?? makeId(),
      createdAt: record.createdAt ?? now,
      updatedAt: now,
    };
    const { tx, store } = await this.#tx("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(withMeta);
      req.onsuccess = () => resolve(withMeta);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(id) {
    const { store } = await this.#tx("readonly");
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll() {
    const { store } = await this.#tx("readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getByIndex(indexName, value) {
    const { store } = await this.#tx("readonly");
    return new Promise((resolve, reject) => {
      const req = store.index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(id) {
    const { tx, store } = await this.#tx("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Retorna els N registres més recents segons un camp de data/hora. */
  async getRecent(dateField, limit = 7) {
    const all = await this.getAll();
    return all
      .sort((a, b) => new Date(b[dateField]) - new Date(a[dateField]))
      .slice(0, limit);
  }
}
