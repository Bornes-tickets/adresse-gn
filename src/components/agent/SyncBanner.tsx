import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/useOnline";
import { agentDb } from "@/lib/agent-db";
import { demarrerSyncAuto, syncQueue } from "@/lib/agent-sync";

/** Indicateur de connexion et de synchronisation en haut de l'espace agent. */
export function SyncBanner() {
  const isOnline = useOnline();
  const [enCours, setEnCours] = useState(false);

  useEffect(() => demarrerSyncAuto(), []);

  const enAttente = useLiveQuery(
    () => agentDb.install_queue.where("status").anyOf("pending", "syncing").count(),
    [],
    0,
  );
  const enErreur = useLiveQuery(
    () => agentDb.install_queue.where("status").equals("error").count(),
    [],
    0,
  );

  const synchroniser = async () => {
    setEnCours(true);
    try {
      await syncQueue({ force: true });
    } finally {
      setEnCours(false);
    }
  };

  if (enErreur > 0) {
    return (
      <Cadre classe="bg-destructive/12 text-destructive" icone={<AlertTriangle className="size-4" />}>
        <span className="flex-1">
          {enErreur} installation{enErreur > 1 ? "s" : ""} en erreur
        </span>
        <Link to="/agent/sync-issues" className="text-xs underline">
          Détails
        </Link>
        <Bouton onClick={synchroniser} enCours={enCours} libelle="Réessayer" />
      </Cadre>
    );
  }

  if (!isOnline) {
    return (
      <Cadre
        classe="bg-[oklch(0.72_0.16_65)]/15 text-[oklch(0.45_0.14_65)]"
        icone={<CloudOff className="size-4" />}
      >
        <span className="flex-1">
          Hors ligne{enAttente > 0 ? ` — ${enAttente} en attente` : ""}
        </span>
      </Cadre>
    );
  }

  if (enAttente > 0) {
    return (
      <Cadre classe="bg-primary/12 text-primary" icone={<RefreshCw className="size-4" />}>
        <span className="flex-1">En ligne — {enAttente} en attente</span>
        <Bouton onClick={synchroniser} enCours={enCours} libelle="Synchroniser" />
      </Cadre>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent">
      <Wifi className="size-3.5" />
      En ligne
    </span>
  );
}

function Cadre({
  classe,
  icone,
  children,
}: {
  classe: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${classe}`}
    >
      {icone}
      {children}
    </div>
  );
}

function Bouton({
  onClick,
  enCours,
  libelle,
}: {
  onClick: () => void | Promise<void>;
  enCours: boolean;
  libelle: string;
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className="h-6 px-2 text-xs"
      disabled={enCours}
      onClick={() => void onClick()}
    >
      {enCours ? <RefreshCw className="size-3 animate-spin" /> : null}
      {libelle}
    </Button>
  );
}
