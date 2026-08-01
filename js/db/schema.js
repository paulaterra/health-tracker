/**
 * schema.js — Definició de la base de dades IndexedDB.
 *
 * Es defineixen TOTS els object stores del projecte complet des d'ara,
 * encara que la Fase 0 només n'utilitzi un (daily_checkin). Així, quan
 * es construeixin les fases següents, no calen migracions de versió.
 */
export const DB_NAME = "health_tracker_db";
export const DB_VERSION = 2;

// [nom store, keyPath, índexs addicionals a crear]
export const STORES = [
  { name: "daily_checkin",      keyPath: "id", indexes: [["date", "date", { unique: true }]] },
  { name: "pain_events",        keyPath: "id", indexes: [["timestamp", "timestamp"]] },
  { name: "headache_events",    keyPath: "id", indexes: [["timestamp", "timestamp"]] },
  { name: "vertigo_events",     keyPath: "id", indexes: [["timestamp", "timestamp"]] },
  { name: "digestive_events",   keyPath: "id", indexes: [["timestamp", "timestamp"]] },
  { name: "bowel_movements",    keyPath: "id", indexes: [["timestamp", "timestamp"]] },
  { name: "sleep_log",          keyPath: "id", indexes: [["date", "date", { unique: true }]] },
  { name: "nutrition_log",      keyPath: "id", indexes: [["timestamp", "timestamp"]] },
  { name: "exercise_log",       keyPath: "id", indexes: [["timestamp", "timestamp"]] },
  { name: "mood_stress_log",    keyPath: "id", indexes: [["timestamp", "timestamp"]] },
  { name: "cycle_log",          keyPath: "id", indexes: [["date", "date", { unique: true }]] },
  { name: "skin_episodes",      keyPath: "id", indexes: [["dataInici", "dataInici"]] },
  { name: "medications",        keyPath: "id", indexes: [] },
  { name: "vitals",             keyPath: "id", indexes: [["timestamp", "timestamp"]] },
  { name: "episodes",           keyPath: "id", indexes: [["timestampInici", "timestampInici"]] },
  { name: "hypotheses",         keyPath: "id", indexes: [] },
  { name: "patterns_detected",  keyPath: "id", indexes: [] },
  { name: "medical_docs",       keyPath: "id", indexes: [["data", "data"]] },
];

let dbPromise = null;

/** Obre (o crea) la base de dades. Retorna una Promise<IDBDatabase>. */
export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store.name)) {
          const os = db.createObjectStore(store.name, { keyPath: store.keyPath });
          for (const [idxName, idxKey, opts] of store.indexes) {
            os.createIndex(idxName, idxKey, opts || {});
          }
        }
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
    request.onblocked = () => reject(new Error("Base de dades bloquejada: tanca altres pestanyes de l'app."));
  });

  return dbPromise;
}

export const STORE_NAMES = STORES.map((store) => store.name);
