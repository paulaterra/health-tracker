import { Repository } from "../db/repository.js";
import { isViewerMode } from "../view-mode.js";

const SCALE_VERSION = 2;
const clamp = value => Math.max(0, Math.min(10, Number(value) || 0));
const invert = value => 10 - clamp(value);

async function migrateStore(storeName, fields) {
  const repo = new Repository(storeName);
  const rows = await repo.getAll();
  let changed = 0;
  for (const row of rows) {
    if (Number(row.scoreScaleVersion || 1) >= SCALE_VERSION) continue;
    const next = { ...row, scoreScaleVersion: SCALE_VERSION };
    fields.forEach(field => {
      if (row[field] !== undefined && row[field] !== null && row[field] !== "") next[field] = invert(row[field]);
    });
    await repo.put(next);
    changed += 1;
  }
  return changed;
}

export async function migrateUnifiedScoreDirection() {
  if (isViewerMode()) return { migrated: 0 };
  try {
    const [checkins, sleeps] = await Promise.all([
      migrateStore("daily_checkin", ["sonQualitat", "energiaFisica", "energiaMental"]),
      migrateStore("sleep_log", ["qualitat"]),
    ]);
    return { migrated: checkins + sleeps };
  } catch (error) {
    console.error("No s'han pogut unificar les escales 0–10", error);
    return { migrated: 0, error };
  }
}
