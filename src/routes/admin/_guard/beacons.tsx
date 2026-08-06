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
  DialogDescription,
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
  adminAgents,
  adminAssignLot,
  adminBeaconDetail,
  adminBeacons,
  adminExportQrPdf,
  adminGenerateBeaconLot,
  adminLots,
  adminSetBeaconStatus,
  adminZones,
} from "@/lib/admin.functions";
import { BEACON_STATUSES, downloadBase64, formatDateFr, statusLabel } from "@/lib/admin";

export const Route = createFileRoute("/admin/_guard/beacons")({
  head: () => ({
    meta: [
      { title: "Balises — Administration Adresse GN" },
      { name: "description", content: "Génération, suivi et export des balises Adresse GN." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBeacons,
});

function AdminBeacons() {
  const lister = useServerFn(adminBeacons);
  const detail = useServerFn(adminBeaconDetail);
  const changerStatut = useServerFn(adminSetBeaconStatus);
  const genererLot = useServerFn(adminGenerateBeaconLot);
  const exporter = useServerFn(adminExportQrPdf);
  const affecter = useServerFn(adminAssignLot);
  const listerLots = useServerFn(adminLots);
  const listerAgents = useServerFn(adminAgents);
  const listerZones = useServerFn(adminZones);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [statut, setStatut] = useState<string>("tous");
  const [lotId, setLotId] = useState<string>("tous");
  const [recherche, setRecherche] = useState("");
  const [depuis, setDepuis] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [ouvrirGen, setOuvrirGen] = useState(false);
  const [ouvrirAffect, setOuvrirAffect] = useState(false);

  const [quantite, setQuantite] = useState("50");
  const [regionId, setRegionId] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [prix, setPrix] = useState("");
  const [affectLot, setAffectLot] = useState("");
  const [affectAgent, setAffectAgent] = useState("");

  const filtres = {
    page,
    pageSize: 20,
    statuses: statut === "tous" ? [] : [statut],
    lotId: lotId === "tous" ? null : lotId,
    from: depuis ? new Date(depuis).toISOString() : null,
    q: recherche.trim() || null,
  };

  const balises = useQuery({
    queryKey: ["admin", "beacons", filtres],
    queryFn: () => lister({ data: filtres }),
  });
  const lots = useQuery({ queryKey: ["admin", "lots"], queryFn: () => listerLots() });
  const agents = useQuery({ queryKey: ["admin", "agents"], queryFn: () => listerAgents() });
  const zones = useQuery({ queryKey: ["admin", "zones"], queryFn: () => listerZones() });
  const fiche = useQuery({
    queryKey: ["admin", "beacon", detailId],
    queryFn: () => detail({ data: { id: detailId! } }),
    enabled: !!detailId,
  });

  const muterStatut = useMutation({
    mutationFn: (v: { id: string; status: string }) => changerStatut({ data: v }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      void qc.invalidateQueries({ queryKey: ["admin", "beacons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterGen = useMutation({
    mutationFn: () =>
      genererLot({
        data: {
          quantity: Number(quantite),
          regionId,
          supplier: fournisseur || null,
          unitPriceGnf: prix ? Number(prix) : null,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Lot ${r.lotCode} créé : ${r.quantite} balises (${r.premier} → ${r.dernier}).`);
      setOuvrirGen(false);
      void qc.invalidateQueries({ queryKey: ["admin", "beacons"] });
      void qc.invalidateQueries({ queryKey: ["admin", "lots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterExport = useMutation({
    mutationFn: (id: string) =>
      exporter({ data: { lotId: id, origin: window.location.origin } }),
    onSuccess: (r) => {
      downloadBase64(r.base64, "planches-qr-adresse-gn.pdf", "application/pdf");
      toast.success(`${r.balises} QR exportés sur ${r.pages} page(s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterAffect = useMutation({
    mutationFn: () => affecter({ data: { lotId: affectLot, agentId: affectAgent } }),
    onSuccess: () => {
      toast.success("Lot affecté à l'agent.");
      setOuvrirAffect(false);
      void qc.invalidateQueries({ queryKey: ["admin", "beacons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof balises.data>["rows"][number];

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: "numero",
      entete: "Numéro",
      rendu: (l) => <span className="font-mono text-sm">{l.public_number}</span>,
    },
    { cle: "statut", entete: "Statut", rendu: (l) => <StatutBadge valeur={l.status} /> },
    { cle: "lot", entete: "Lot", rendu: (l) => l.lot_code ?? "—" },
    { cle: "creee", entete: "Créée le", rendu: (l) => formatDateFr(l.created_at) },
    { cle: "activee", entete: "Activée le", rendu: (l) => formatDateFr(l.activated_at) },
    {
      cle: "actions",
      entete: "Actions",
      rendu: (l) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => setDetailId(l.id)}>
            Détail
          </Button>
          {l.status !== "suspended" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => muterStatut.mutate({ id: l.id, status: "suspended" })}
            >
              Suspendre
            </Button>
          )}
          {l.status === "suspended" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => muterStatut.mutate({ id: l.id, status: "active" })}
            >
              Réactiver
            </Button>
          )}
          {l.status !== "cancelled" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => muterStatut.mutate({ id: l.id, status: "cancelled" })}
            >
              Annuler
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Label className="text-xs">Recherche par numéro</Label>
          <Input
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setPage(1);
            }}
            placeholder="GN-CKY-…"
          />
        </div>
        <div className="w-44">
          <Label className="text-xs">Statut</Label>
          <Select
            value={statut}
            onValueChange={(v) => {
              setStatut(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {BEACON_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-52">
          <Label className="text-xs">Lot</Label>
          <Select
            value={lotId}
            onValueChange={(v) => {
              setLotId(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {(lots.data ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label className="text-xs">Depuis le</Label>
          <Input
            type="date"
            value={depuis}
            onChange={(e) => {
              setDepuis(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => setOuvrirGen(true)}>Générer un lot</Button>
          <Button
            variant="outline"
            disabled={lotId === "tous" || muterExport.isPending}
            onClick={() => muterExport.mutate(lotId)}
          >
            {muterExport.isPending ? "Génération…" : "Exporter les QR (PDF)"}
          </Button>
          <Button variant="outline" onClick={() => setOuvrirAffect(true)}>
            Affecter à un agent
          </Button>
        </div>
      </div>

      <AdminTable
        colonnes={colonnes}
        lignes={balises.data?.rows ?? []}
        chargement={balises.isLoading}
        total={balises.data?.total ?? 0}
        page={page}
        pageSize={20}
        onPage={setPage}
      />

      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Détail de la balise</SheetTitle>
          </SheetHeader>
          {fiche.data && (
            <div className="space-y-4 px-4 pb-8 text-sm">
              <p className="font-mono text-lg">{fiche.data.beacon.public_number}</p>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Statut" valeur={statusLabel(fiche.data.beacon.status)} />
                <Info label="Lot" valeur={(fiche.data.beacon as any).lots?.code ?? "—"} />
                <Info label="Créée le" valeur={formatDateFr(fiche.data.beacon.created_at)} />
                <Info label="Activée le" valeur={formatDateFr(fiche.data.beacon.activated_at)} />
              </div>
              {fiche.data.adresse ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="font-medium">Adresse rattachée</p>
                  <p className="text-muted-foreground">{fiche.data.adresse.name ?? "Sans nom"}</p>
                  <p className="text-muted-foreground">
                    {statusLabel(fiche.data.adresse.visibility)} ·{" "}
                    {statusLabel(fiche.data.adresse.verification_level)}
                  </p>
                  {fiche.data.adresse.point && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {fiche.data.adresse.point.lat.toFixed(5)},{" "}
                      {fiche.data.adresse.point.lng.toFixed(5)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune adresse rattachée.</p>
              )}
              {fiche.data.installation && (
                <div className="rounded-lg border border-border p-3">
                  <p className="font-medium">Dernière installation</p>
                  <p className="text-muted-foreground">
                    {formatDateFr(fiche.data.installation.installed_at)} · précision{" "}
                    {fiche.data.installation.accuracy_m ?? "—"} m
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={ouvrirGen} onOpenChange={setOuvrirGen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer un lot de balises</DialogTitle>
            <DialogDescription>
              Les numéros sont attribués séquentiellement selon la zone choisie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Quantité (1 à 1000)</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
            </div>
            <div>
              <Label>Zone (région)</Label>
              <Select value={regionId} onValueChange={setRegionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une région" />
                </SelectTrigger>
                <SelectContent>
                  {(zones.data?.regions ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fournisseur (optionnel)</Label>
              <Input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
            </div>
            <div>
              <Label>Prix unitaire indicatif (GNF)</Label>
              <Input type="number" value={prix} onChange={(e) => setPrix(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!regionId || muterGen.isPending}
              onClick={() => muterGen.mutate()}
            >
              {muterGen.isPending ? "Génération…" : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ouvrirAffect} onOpenChange={setOuvrirAffect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Affecter un lot à un agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Lot</Label>
              <Select value={affectLot} onValueChange={setAffectLot}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un lot" />
                </SelectTrigger>
                <SelectContent>
                  {(lots.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code} ({l.quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agent</Label>
              <Select value={affectAgent} onValueChange={setAffectAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un agent" />
                </SelectTrigger>
                <SelectContent>
                  {(agents.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.badge_number} — {a.full_name ?? "Sans nom"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!affectLot || !affectAgent || muterAffect.isPending}
              onClick={() => muterAffect.mutate()}
            >
              Affecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{valeur}</p>
    </div>
  );
}
