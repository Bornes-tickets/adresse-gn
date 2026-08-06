/** Moteur de synchronisation de la file d'attente offline des installations. */
import { toast } from "sonner";

import { agentDb, type QueuedInstall } from "@/lib/agent-db";
import { blobVersDataUrl } from "@/lib/install";
import { submitInstallation } from "@/lib/install.functions";

/** Backoff exponentiel (ms) : 5s, 15s, 45s, 2min, 5min, plafond 15min. */
const BACKOFF_MS = [5_000, 15_000, 45_000, 120_000, 300_000, 900_000];

export function delaiBackoff(attempts: number): number {
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] ?? 900_000;
}

let enCours = false;

function estErreurReseau(erreur: unknown): boolean {
  const message = erreur instanceof Error ? erreur.message : String(erreur);
  return /network|fetch|Failed to fetch|load failed|timeout|offline/i.test(message);
}

async function synchroniserItem(item: QueuedInstall): Promise<void> {
  if (!item.id) return;
  await agentDb.install_queue.update(item.id, { status: "syncing" });

  try {
    const photo = item.photo_blob ? await blobVersDataUrl(item.photo_blob) : "";
    const reponse = await submitInstallation({
      data: {
        beacon_number: item.beacon_number,
        measures: item.measures,
        photo_base64: photo,
        category: item.category,
        name: item.name,
        visibility: item.visibility,
        access_point_note: item.access_point_note,
        owner_name: item.owner_name,
        owner_phone: item.owner_phone,
        consent: true,
        client_uuid: item.client_uuid,
      },
    });

    if (reponse.success) {
      // Succès : on libère l'espace occupé par la photo.
      await agentDb.install_queue.update(item.id, {
        status: "done",
        photo_blob: null,
        last_error: null,
        next_attempt_at: null,
      });
      return;
    }

    // Erreur métier définitive (balise invalide, non assignée, statut…).
    await agentDb.install_queue.update(item.id, {
      status: "error",
      attempts: item.attempts + 1,
      last_error: reponse.message ?? "Erreur inconnue",
      next_attempt_at: null,
    });
    toast.error(`Balise ${item.beacon_number} : ${reponse.message ?? "erreur de synchronisation"}`);
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : "Erreur réseau";
    const attempts = item.attempts + 1;
    await agentDb.install_queue.update(item.id, {
      status: "error",
      attempts,
      last_error: message,
      next_attempt_at: estErreurReseau(erreur)
        ? new Date(Date.now() + delaiBackoff(attempts)).toISOString()
        : null,
    });
  }
}

/** Synchronise toute la file d'attente. Verrou anti-concurrence intégré. */
export async function syncQueue(options?: { force?: boolean }): Promise<void> {
  if (enCours) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  enCours = true;
  try {
    const items = await agentDb.install_queue
      .where("status")
      .anyOf("pending", "error", "syncing")
      .toArray();

    const maintenant = Date.now();
    for (const item of items.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const attendre =
        !options?.force && item.next_attempt_at && Date.parse(item.next_attempt_at) > maintenant;
      if (attendre) continue;
      await synchroniserItem(item);
    }
    await agentDb.meta.put({ key: "last_sync_at", value: new Date().toISOString() });
    await agentDb.install_queue.where("status").equals("done").delete();
  } finally {
    enCours = false;
  }
}

let demarre = false;

/** Démarre la synchronisation automatique (démarrage, online, toutes les 60 s). */
export function demarrerSyncAuto(): () => void {
  if (demarre) return () => undefined;
  demarre = true;

  const lancer = () => void syncQueue();
  window.addEventListener("online", lancer);
  lancer();
  const timer = window.setInterval(async () => {
    const restants = await agentDb.install_queue
      .where("status")
      .anyOf("pending", "error")
      .count();
    if (restants > 0) void syncQueue();
  }, 60_000);

  return () => {
    demarre = false;
    window.clearInterval(timer);
    window.removeEventListener("online", lancer);
  };
}
