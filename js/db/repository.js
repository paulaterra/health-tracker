import { supabase, getCurrentUser } from "./supabase.js";
import { isViewerMode, getViewerToken } from "../view-mode.js";

/** Genera un identificador únic sense dependències externes. */
export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function throwIfError(error, context) {
  if (!error) return;
  console.error(context, error);
  throw new Error(`${context}: ${error.message}`);
}

/** Repositori genèric al núvol, compatible amb l'API anterior d'IndexedDB. */
export class Repository {
  constructor(storeName) {
    this.storeName = storeName;
  }

  async #user() {
    if (isViewerMode()) return null;
    const user = await getCurrentUser();
    if (!user) throw new Error("La sessió ha caducat. Torna a iniciar sessió.");
    return user;
  }

  async #viewerRows(recordId = null) {
    const token = getViewerToken();
    if (!token) throw new Error("La sessió de consulta ha caducat. Torna a introduir la contrasenya.");
    const { data, error } = await supabase.rpc("professional_records", {
      p_token: token,
      p_store_name: this.storeName,
      p_record_id: recordId,
    });
    throwIfError(error, "No s'han pogut carregar les dades en mode consulta");
    return data ?? [];
  }

  #fromRow(row) {
    if (!row) return null;
    return {
      ...row.record_data,
      id: row.id,
      createdAt: row.record_data?.createdAt ?? row.created_at,
      updatedAt: row.record_data?.updatedAt ?? row.updated_at,
    };
  }

  /** Insereix o sobreescriu un registre. */
  async put(record) {
    if (isViewerMode()) throw new Error("Mode consulta: no es poden modificar les dades.");
    const user = await this.#user();
    const now = new Date().toISOString();
    const withMeta = {
      ...record,
      id: record.id ?? makeId(),
      createdAt: record.createdAt ?? now,
      updatedAt: now,
    };

    const { error } = await supabase
      .from("health_records")
      .upsert({
        id: withMeta.id,
        user_id: user.id,
        store_name: this.storeName,
        record_data: withMeta,
        created_at: withMeta.createdAt,
        updated_at: withMeta.updatedAt,
      }, { onConflict: "user_id,store_name,id" });

    throwIfError(error, "No s'ha pogut desar el registre");
    return withMeta;
  }

  async get(id) {
    if (isViewerMode()) {
      const rows = await this.#viewerRows(id);
      return this.#fromRow(rows[0] ?? null);
    }
    const user = await this.#user();
    const { data, error } = await supabase
      .from("health_records")
      .select("id, record_data, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("store_name", this.storeName)
      .eq("id", id)
      .maybeSingle();

    throwIfError(error, "No s'ha pogut llegir el registre");
    return this.#fromRow(data);
  }

  async getAll() {
    if (isViewerMode()) {
      const rows = await this.#viewerRows();
      return rows.map((row) => this.#fromRow(row));
    }
    const user = await this.#user();
    const { data, error } = await supabase
      .from("health_records")
      .select("id, record_data, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("store_name", this.storeName);

    throwIfError(error, "No s'han pogut carregar les dades");
    return (data ?? []).map((row) => this.#fromRow(row));
  }

  async getByIndex(indexName, value) {
    const all = await this.getAll();
    return all.filter((record) => record?.[indexName] === value);
  }

  async delete(id) {
    if (isViewerMode()) throw new Error("Mode consulta: no es poden modificar les dades.");
    const user = await this.#user();
    const { error } = await supabase
      .from("health_records")
      .delete()
      .eq("user_id", user.id)
      .eq("store_name", this.storeName)
      .eq("id", id);

    throwIfError(error, "No s'ha pogut eliminar el registre");
    return true;
  }

  /** Retorna els N registres més recents segons un camp de data/hora. */
  async getRecent(dateField, limit = 7) {
    const all = await this.getAll();
    return all
      .sort((a, b) => new Date(b[dateField]) - new Date(a[dateField]))
      .slice(0, limit);
  }
}
