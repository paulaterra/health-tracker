import { openDatabase, STORE_NAMES } from "./schema.js";
import { Repository } from "./repository.js";

async function readLocalStore(storeName) {
  const db = await openDatabase();
  if (!db.objectStoreNames.contains(storeName)) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function countLocalRecords() {
  let total = 0;
  for (const storeName of STORE_NAMES) total += (await readLocalStore(storeName)).length;
  return total;
}

export async function migrateLocalRecords(onProgress = () => {}) {
  let copied = 0;
  const total = await countLocalRecords();

  for (const storeName of STORE_NAMES) {
    const records = await readLocalStore(storeName);
    const repo = new Repository(storeName);
    for (const record of records) {
      await repo.put(record);
      copied += 1;
      onProgress({ copied, total, storeName });
    }
  }

  return { copied, total };
}
