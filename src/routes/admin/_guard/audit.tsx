import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { downloadCsv, formatDateTimeFr } from "@/lib/admin";
import { adminAudit } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_guard/audit")({
  head: () => ({
    meta: [
      { title: "Journal d'audit — Administration Adresse GN" },
      { name: "description", content: "Traçabilité des actions sensibles sur Adresse GN." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAudit,
});

function AdminAudit() {
  const lister = useServerFn(adminAudit);

  const [page, setPage] = useState(1);
  const [entite, setEntite] = useState("");
  const [action, setAction] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [diff, setDiff] = useState<{ before: unknown; after: unknown } | null>(null);

  const filtres = {
    page,
    pageSize: 25,
    entity: entite.trim() || null,
    action: action.trim() || null,
    from: du ? new Date(du).toISOString() : null,
    to: au ? new Date(`${au}T23:59:59`).toISOString() : null,
  };

  const journal = useQuery({
    queryKey: ["admin", "audit", filtres],
    queryFn: () => lister({ data: filtres }),
  });

  type Ligne = NonNullable<typeof journal.data>["rows"][number];

  const colonnes: Colonne<Ligne>[] = [
    { cle: "date", entete: "Date", rendu: (l) => formatDateTimeFr(l.created_at) },
    { cle: "acteur", entete: "Acteur", rendu: (l) => l.actor_name || l.actor_id || "Système" },
    { cle: "action", entete: "Action", rendu: (l) => l.action },
    { cle: "entite", entete: "Entité", rendu: (l) => l.entity },
    {
      cle: "id",
      entete: "Identifiant",
      rendu: (l) => <span className="font-mono text-xs">{l.entity_id ?? "—"}</span>,
    },
    {
      cle: "actions",
      entete: "",
      rendu: (l) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDiff({ before: l.before, after: l.after })}
        >
          Voir le diff
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Label className="text-xs">Entité</Label>
          <Input
            value={entite}
            onChange={(e) => {
              setEntite(e.target.value);
              setPage(1);
            }}
            placeholder="addresses"
          />
        </div>
        <div className="w-44">
          <Label className="text-xs">Action</Label>
          <Input
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            placeholder="UPDATE"
          />
        </div>
        <div className="w-40">
          <Label className="text-xs">Du</Label>
          <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
        </div>
        <div className="w-40">
          <Label className="text-xs">Au</Label>
          <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
        </div>
        <Button
          variant="outline"
          className="ml-auto"
          disabled={!journal.data?.rows.length}
          onClick={() =>
            downloadCsv(
              (journal.data?.rows ?? []).map((l) => ({
                date: l.created_at,
                acteur: l.actor_name ?? l.actor_id ?? "",
                action: l.action,
                entite: l.entity,
                entite_id: l.entity_id ?? "",
              })),
              "journal-audit.csv",
            )
          }
        >
          Exporter en CSV
        </Button>
      </div>

      <AdminTable
        colonnes={colonnes}
        lignes={journal.data?.rows ?? []}
        chargement={journal.isLoading}
        total={journal.data?.total ?? 0}
        page={page}
        pageSize={25}
        onPage={setPage}
      />

      <Sheet open={!!diff} onOpenChange={(o) => !o && setDiff(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Différentiel</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 px-4 pb-10 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Avant</p>
              <pre className="max-h-[70vh] overflow-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(diff?.before ?? null, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Après</p>
              <pre className="max-h-[70vh] overflow-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(diff?.after ?? null, null, 2)}
              </pre>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
