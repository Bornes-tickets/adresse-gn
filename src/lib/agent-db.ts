/** Base locale IndexedDB (Dexie) de l'app agent : file d'attente offline + cache. */
import Dexie, { type Table } from "dexie";

import type { InstallMeasure } from "@/lib/install";

export type QueueStatus = "pending" | "syncing" | "error" | "done";

export interface QueuedInstall {
  id?: number;
  client_uuid: string;
  beacon_number: string;
  measures: InstallMeasure[];
  photo_blob: Blob | null;
  category: string;
  name: string | null;
  visibility: "private" | "public";
  access_point_note: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  consent: true;
  created_at: string;
  status: QueueStatus;
  attempts: number;
  last_error: string | null;
  next_attempt_at?: string | null;
}

export interface CachedTask {
  beacon_number: string;
  category_hint: string | null;
  updated_at: string;
}

export interface MetaEntry {
  key: string;
  value: string;
}

class AgentDatabase extends Dexie {
  install_queue!: Table<QueuedInstall, number>;
  cached_tasks!: Table<CachedTask, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super("adresse-gn-agent");
    this.version(1).stores({
      install_queue: "++id, client_uuid, beacon_number, status, created_at",
      cached_tasks: "beacon_number, updated_at",
      meta: "key",
    });
  }
}

export const agentDb = new AgentDatabase();

/** Ajoute une installation à la file d'attente locale. */
export async function enfilerInstallation(
  item: Omit<QueuedInstall, "id" | "status" | "attempts" | "last_error" | "client_uuid"> & {
    client_uuid?: string;
  },
): Promise<string> {
  const client_uuid = item.client_uuid ?? crypto.randomUUID();
  await agentDb.install_queue.add({
    ...item,
    client_uuid,
    status: "pending",
    attempts: 0,
    last_error: null,
    next_attempt_at: null,
  });
  return client_uuid;
}

/** Enregistre la liste des tâches en cache pour consultation hors ligne. */
export async function mettreEnCacheTaches(taches: Omit<CachedTask, "updated_at">[]) {
  const updated_at = new Date().toISOString();
  await agentDb.transaction("rw", agentDb.cached_tasks, agentDb.meta, async () => {
    await agentDb.cached_tasks.clear();
    await agentDb.cached_tasks.bulkPut(taches.map((t) => ({ ...t, updated_at })));
    await agentDb.meta.put({ key: "tasks_cached_at", value: updated_at });
  });
}

export async function lireMeta(key: string): Promise<string | null> {
  const entree = await agentDb.meta.get(key);
  return entree?.value ?? null;
}
