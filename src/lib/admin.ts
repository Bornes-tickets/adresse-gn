/** Types et libellés partagés du back-office (sûrs côté navigateur). */

export const ADMIN_ROLES = ["admin", "super_admin"] as const;

export const BEACON_STATUSES = ["generated", "assigned", "active", "suspended", "cancelled"] as const;
export const ADDRESS_STATUSES = ["active", "suspended", "deleted"] as const;
export const VERIFICATION_LEVELS = ["unverified", "declared", "verified", "certified"] as const;
export const VISIBILITIES = ["public", "private"] as const;
export const REPORT_STATUSES = ["new", "in_review", "resolved", "rejected"] as const;
export const USER_ROLES = ["user", "agent", "supervisor", "admin", "super_admin"] as const;
export const LOT_STATUSES = ["generated", "ordered", "received", "in_use", "active", "suspended", "cancelled", "depleted", "recalled"] as const;

export const STATUS_LABELS: Record<string, string> = {
  generated: "Générée",
  assigned: "Affectée",
  active: "Active",
  suspended: "Suspendue",
  cancelled: "Annulée",
  deleted: "Supprimée",
  unverified: "Non vérifiée",
  declared: "Déclarée",
  verified: "Vérifiée",
  certified: "Certifiée",
  public: "Publique",
  private: "Privée",
  new: "Nouveau",
  in_review: "En cours",
  resolved: "Résolu",
  rejected: "Rejeté",
  created: "Créé",
  received: "Reçu",
  distributed: "Distribué",
  closed: "Clôturé",
  ordered: "Commandé",
  in_use: "En utilisation",
  depleted: "Épuisé",
  recalled: "Rappelé",
  user: "Utilisateur",
  agent: "Agent",
  supervisor: "Superviseur",
  admin: "Administrateur",
  super_admin: "Super administrateur",
};

export function statusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return STATUS_LABELS[value] ?? value;
}

export function statusTone(value: string | null | undefined): "ok" | "warn" | "bad" | "neutral" {
  switch (value) {
    case "active":
    case "verified":
    case "certified":
    case "resolved":
      return "ok";
    case "generated":
    case "assigned":
    case "new":
    case "in_review":
    case "declared":
      return "warn";
    case "suspended":
    case "cancelled":
    case "deleted":
    case "rejected":
      return "bad";
    default:
      return "neutral";
  }
}

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function formatDateFr(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTimeFr(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Déclenche le téléchargement d'un fichier depuis une chaîne base64. */
export function downloadBase64(base64: string, filename: string, mime: string) {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([octets], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Déclenche le téléchargement d'un CSV construit côté client. */
export function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const colonnes = Object.keys(rows[0]!);
  const echappe = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    colonnes.join(";"),
    ...rows.map((r) => colonnes.map((c) => echappe(r[c])).join(";")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
