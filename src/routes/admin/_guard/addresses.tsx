import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable, StatutBadge, type Colonne } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ADDRESS_STATUSES,
  VERIFICATION_LEVELS,
  VISIBILITIES,
  formatDateFr,
  formatDateTimeFr,
  statusLabel,
} from "@/lib/admin";
import {
  adminAddressDetail,
  adminAddresses,
  adminReassignOwner,
  adminUpdateAddress,
  adminZones,
} from "@/lib/admin.functions";
import { CATEGORY_LABELS, categoryLabel } from "@/lib/geo";

export const Route = createFileRoute("/admin/_guard/addresses")({
  head: () => ({
    meta: [
      { title: "Adresses — Administration Adresse GN" },
      { name: "description", content: "Modération et vérification des adresses Adresse GN." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAddresses,
});

function AdminAddresses() {
  const lister = useServerFn(adminAddresses);
  const detail = useServerFn(adminAddressDetail);
  const majAdresse = useServerFn(adminUpdateAddress);
  const reassigner = useServerFn(adminReassignOwner);
  const listerZones = useServerFn(adminZones);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [visibilite, setVisibilite] = useState("tous");
  const [categorie, setCategorie] = useState("tous");
  const [verification, setVerification] = useState("tous");
  const [commune, setCommune] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [ouvrirProprio, setOuvrirProprio] = useState(false);
  const [email, setEmail] = useState("");

  const filtres = {
    page,
    pageSize: 20,
    visibility: visibilite === "tous" ? null : visibilite,
    category: categorie === "tous" ? null : categorie,
    verification: verification === "tous" ? null : verification,
    communeId: commune === "tous" ? null : commune,
    q: recherche.trim() || null,
  };

  const adresses = useQuery({
    queryKey: ["admin", "addresses", filtres],
    queryFn: () => lister({ data: filtres }),
  });
  const zones = useQuery({ queryKey: ["admin", "zones"], queryFn: () => listerZones() });
  const fiche = useQuery({
    queryKey: ["admin", "address", detailId],
    queryFn: () => detail({ data: { id: detailId! } }),
    enabled: !!detailId,
  });

  const muter = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown> }) => majAdresse({ data: v }),
    onSuccess: () => {
      toast.success("Adresse mise à jour.");
      void qc.invalidateQueries({ queryKey: ["admin", "addresses"] });
      void qc.invalidateQueries({ queryKey: ["admin", "address"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterProprio = useMutation({
    mutationFn: () => reassigner({ data: { addressId: detailId!, email } }),
    onSuccess: () => {
      toast.success("Propriétaire réassigné.");
      setOuvrirProprio(false);
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof adresses.data>["rows"][number];

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: "balise",
      entete: "Numéro balise",
      rendu: (l) => <span className="font-mono text-sm">{l.beacon_number ?? "—"}</span>,
    },
    { cle: "nom", entete: "Nom", rendu: (l) => l.name ?? "—" },
    { cle: "cat", entete: "Catégorie", rendu: (l) => categoryLabel(l.category) },
    { cle: "vis", entete: "Visibilité", rendu: (l) => <StatutBadge valeur={l.visibility} /> },
    {
      cle: "verif",
      entete: "Vérification",
      rendu: (l) => <StatutBadge valeur={l.verification_level} />,
    },
    { cle: "commune", entete: "Commune", rendu: (l) => l.commune_name ?? "—" },
    { cle: "creee", entete: "Créée le", rendu: (l) => formatDateFr(l.created_at) },
    {
      cle: "actions",
      entete: "Actions",
      rendu: (l) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => setDetailId(l.id)}>
            Détail
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => muter.mutate({ id: l.id, patch: { verification_level: "verified" } })}
          >
            Valider
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => muter.mutate({ id: l.id, patch: { status: "suspended" } })}
          >
            Suspendre
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => muter.mutate({ id: l.id, patch: { status: "deleted" } })}
          >
            Supprimer
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Label className="text-xs">Recherche (nom)</Label>
          <Input
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setPage(1);
            }}
            placeholder="Nom d'établissement…"
          />
        </div>
        <Filtre label="Visibilité" valeur={visibilite} set={setVisibilite} options={[...VISIBILITIES]} />
        <Filtre
          label="Vérification"
          valeur={verification}
          set={setVerification}
          options={[...VERIFICATION_LEVELS]}
        />
        <div className="w-44">
          <Label className="text-xs">Catégorie</Label>
          <Select value={categorie} onValueChange={setCategorie}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Toutes</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Label className="text-xs">Commune</Label>
          <Select value={commune} onValueChange={setCommune}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Toutes</SelectItem>
              {(zones.data?.communes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <AdminTable
        colonnes={colonnes}
        lignes={adresses.data?.rows ?? []}
        chargement={adresses.isLoading}
        total={adresses.data?.total ?? 0}
        page={page}
        pageSize={20}
        onPage={setPage}
      />

      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Détail de l'adresse</SheetTitle>
          </SheetHeader>
          {fiche.data && (
            <div className="space-y-4 px-4 pb-10 text-sm">
              <p className="font-mono text-lg">
                {(fiche.data.adresse as any).beacons?.public_number ?? "—"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Nom" valeur={fiche.data.adresse.name ?? "—"} />
                <Champ label="Catégorie" valeur={categoryLabel(fiche.data.adresse.category)} />
                <Champ label="Visibilité" valeur={statusLabel(fiche.data.adresse.visibility)} />
                <Champ
                  label="Vérification"
                  valeur={statusLabel(fiche.data.adresse.verification_level)}
                />
                <Champ label="Statut" valeur={statusLabel(fiche.data.adresse.status)} />
                <Champ
                  label="Commune"
                  valeur={(fiche.data.adresse as any).communes?.name ?? "—"}
                />
              </div>
              {fiche.data.adresse.point && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Coordonnées</p>
                  <p className="font-mono">
                    {fiche.data.adresse.point.lat.toFixed(6)},{" "}
                    {fiche.data.adresse.point.lng.toFixed(6)}
                  </p>
                  <a
                    className="text-xs text-primary underline"
                    href={`https://www.openstreetmap.org/?mlat=${fiche.data.adresse.point.lat}&mlon=${fiche.data.adresse.point.lng}#map=18/${fiche.data.adresse.point.lat}/${fiche.data.adresse.point.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Voir sur la carte
                  </a>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Select
                  value={fiche.data.adresse.status ?? "active"}
                  onValueChange={(v) => muter.mutate({ id: detailId!, patch: { status: v } })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDRESS_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={fiche.data.adresse.verification_level ?? "unverified"}
                  onValueChange={(v) =>
                    muter.mutate({ id: detailId!, patch: { verification_level: v } })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFICATION_LEVELS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setOuvrirProprio(true)}>
                  Réassigner à un utilisateur
                </Button>
              </div>

              <div>
                <p className="mb-2 font-medium">Historique (journal d'audit)</p>
                <div className="space-y-2">
                  {fiche.data.journal.length === 0 && (
                    <p className="text-muted-foreground">Aucun évènement.</p>
                  )}
                  {fiche.data.journal.map((j) => (
                    <div key={j.id} className="rounded border border-border p-2 text-xs">
                      <p className="font-medium">
                        {j.action} · {formatDateTimeFr(j.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={ouvrirProprio} onOpenChange={setOuvrirProprio}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réassigner le propriétaire</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Email de l'utilisateur</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button disabled={!email || muterProprio.isPending} onClick={() => muterProprio.mutate()}>
              Réassigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filtre({
  label,
  valeur,
  set,
  options,
}: {
  label: string;
  valeur: string;
  set: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="w-40">
      <Label className="text-xs">{label}</Label>
      <Select value={valeur} onValueChange={set}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Tous</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {statusLabel(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Champ({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{valeur}</p>
    </div>
  );
}
