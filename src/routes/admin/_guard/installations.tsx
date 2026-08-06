import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTimeFr } from "@/lib/admin";
import {
  adminAgentMetrics,
  adminAgents,
  adminDrawQc,
  adminInstallations,
  adminQcQueue,
  adminReviewInstallation,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_guard/installations")({
  head: () => ({
    meta: [
      { title: "Installations & contrôle qualité — Administration Adresse GN" },
      {
        name: "description",
        content: "Suivi des installations terrain et file de contrôle qualité Adresse GN.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminInstallations,
});

function AdminInstallations() {
  const lister = useServerFn(adminInstallations);
  const tirer = useServerFn(adminDrawQc);
  const file = useServerFn(adminQcQueue);
  const statuer = useServerFn(adminReviewInstallation);
  const listerAgents = useServerFn(adminAgents);
  const metriques = useServerFn(adminAgentMetrics);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [agentId, setAgentId] = useState("tous");
  const [validation, setValidation] = useState("tous");
  const [precisionMax, setPrecisionMax] = useState("");
  const [pourcentage, setPourcentage] = useState("10");
  const [motif, setMotif] = useState("");

  const filtres = {
    page,
    pageSize: 20,
    agentId: agentId === "tous" ? null : agentId,
    validation: validation === "tous" ? null : validation,
    accuracyMax: precisionMax ? Number(precisionMax) : null,
  };

  const installations = useQuery({
    queryKey: ["admin", "installations", filtres],
    queryFn: () => lister({ data: filtres }),
  });
  const agents = useQuery({ queryKey: ["admin", "agents"], queryFn: () => listerAgents() });
  const fileQc = useQuery({ queryKey: ["admin", "qc-queue"], queryFn: () => file() });
  const perfs = useQuery({ queryKey: ["admin", "agent-metrics"], queryFn: () => metriques() });

  const muterTirage = useMutation({
    mutationFn: () => tirer({ data: { percent: Number(pourcentage) } }),
    onSuccess: (r) => {
      toast.success(`${r.tirees} installation(s) versée(s) dans la file de contrôle.`);
      void qc.invalidateQueries({ queryKey: ["admin", "qc-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterDecision = useMutation({
    mutationFn: (v: {
      installationId: string | null;
      reportId: string | null;
      decision: "valider" | "rejeter";
    }) => statuer({ data: { ...v, motif: motif || null } }),
    onSuccess: () => {
      toast.success("Décision enregistrée.");
      setMotif("");
      void qc.invalidateQueries({ queryKey: ["admin", "qc-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin", "installations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof installations.data>["rows"][number];

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: "balise",
      entete: "Balise",
      rendu: (l) => <span className="font-mono text-sm">{l.beacon_number ?? "—"}</span>,
    },
    { cle: "agent", entete: "Agent", rendu: (l) => l.agent_badge ?? "—" },
    { cle: "date", entete: "Installée le", rendu: (l) => formatDateTimeFr(l.installed_at) },
    {
      cle: "precision",
      entete: "Précision",
      rendu: (l) => (
        <span className={Number(l.accuracy_m) > 15 ? "text-destructive" : undefined}>
          {l.accuracy_m != null ? `${Math.round(Number(l.accuracy_m))} m` : "—"}
        </span>
      ),
    },
    {
      cle: "photo",
      entete: "Photo",
      rendu: (l) =>
        l.photo_url ? (
          <a
            href={l.photo_url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Voir
          </a>
        ) : (
          "—"
        ),
    },
    {
      cle: "statut",
      entete: "Validation",
      rendu: (l) =>
        l.validated_at ? (
          <Badge variant="secondary">Validée</Badge>
        ) : (
          <Badge variant="outline">En attente</Badge>
        ),
    },
    {
      cle: "actions",
      entete: "Actions",
      rendu: (l) =>
        l.validated_at ? null : (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              muterDecision.mutate({
                installationId: l.id,
                reportId: null,
                decision: "valider",
              })
            }
          >
            Valider
          </Button>
        ),
    },
  ];

  return (
    <Tabs defaultValue="liste" className="space-y-4">
      <TabsList>
        <TabsTrigger value="liste">Installations</TabsTrigger>
        <TabsTrigger value="qc">File de contrôle ({fileQc.data?.length ?? 0})</TabsTrigger>
        <TabsTrigger value="perfs">Performance agents</TabsTrigger>
      </TabsList>

      <TabsContent value="liste" className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Label className="text-xs">Agent</Label>
            <Select
              value={agentId}
              onValueChange={(v) => {
                setAgentId(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous</SelectItem>
                {(agents.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.badge_number} — {a.full_name ?? "Sans nom"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">Validation</Label>
            <Select
              value={validation}
              onValueChange={(v) => {
                setValidation(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Toutes</SelectItem>
                <SelectItem value="validated">Validées</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">Précision max (m)</Label>
            <Input
              type="number"
              value={precisionMax}
              onChange={(e) => {
                setPrecisionMax(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="ml-auto flex items-end gap-2">
            <div className="w-28">
              <Label className="text-xs">Tirage QC (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={pourcentage}
                onChange={(e) => setPourcentage(e.target.value)}
              />
            </div>
            <Button onClick={() => muterTirage.mutate()} disabled={muterTirage.isPending}>
              Lancer le tirage
            </Button>
          </div>
        </div>

        <AdminTable
          colonnes={colonnes}
          lignes={installations.data?.rows ?? []}
          chargement={installations.isLoading}
          total={installations.data?.total ?? 0}
          page={page}
          pageSize={20}
          onPage={setPage}
        />
      </TabsContent>

      <TabsContent value="qc" className="space-y-4">
        <div className="max-w-md">
          <Label className="text-xs">Motif / commentaire de révision (optionnel)</Label>
          <Input value={motif} onChange={(e) => setMotif(e.target.value)} />
        </div>
        {(fileQc.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune installation en attente de contrôle. Lancez un tirage pour alimenter la file.
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {(fileQc.data ?? []).map((item) => (
            <Card key={item.report_id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="font-mono">{item.beacon_number ?? "—"}</span>
                  <Badge
                    variant={
                      item.coherence === "ok"
                        ? "secondary"
                        : item.coherence === "hors_zone"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {item.coherence === "ok"
                      ? "Cohérence géo OK"
                      : item.coherence === "hors_zone"
                        ? "Hors zone"
                        : "Cohérence indéterminée"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-3">
                  {item.photo_url && (
                    <img
                      src={item.photo_url}
                      alt={`Photo d'installation de la balise ${item.beacon_number ?? ""}`}
                      loading="lazy"
                      className="size-24 rounded-md object-cover"
                    />
                  )}
                  <div className="space-y-1 text-muted-foreground">
                    <p>Commune : {item.commune_name ?? "—"}</p>
                    <p>
                      GPS :{" "}
                      {item.gps_lat != null
                        ? `${Number(item.gps_lat).toFixed(5)}, ${Number(item.gps_lng).toFixed(5)}`
                        : "—"}
                    </p>
                    <p>
                      Précision : {item.accuracy_m != null ? `${Math.round(Number(item.accuracy_m))} m` : "—"} ·{" "}
                      {item.nb_mesures} mesure(s)
                    </p>
                    <p>Reçue le {formatDateTimeFr(item.created_at)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      muterDecision.mutate({
                        installationId: item.installation_id,
                        reportId: item.report_id,
                        decision: "valider",
                      })
                    }
                  >
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      muterDecision.mutate({
                        installationId: item.installation_id,
                        reportId: item.report_id,
                        decision: "rejeter",
                      })
                    }
                  >
                    Rejeter
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="perfs">
        <AdminTable
          cle={(l) => l.agent_id}
          colonnes={[
            { cle: "badge", entete: "Badge", rendu: (l) => l.badge_number },
            { cle: "total", entete: "Installations", rendu: (l) => String(l.total) },
            {
              cle: "valid",
              entete: "Taux de validation",
              rendu: (l) => `${l.taux_validation} %`,
            },
            {
              cle: "prec",
              entete: "Précision moyenne",
              rendu: (l) => (l.precision_moyenne != null ? `${l.precision_moyenne} m` : "—"),
            },
            {
              cle: "actif",
              entete: "Actif",
              rendu: (l) =>
                l.active ? (
                  <Badge variant="secondary">Oui</Badge>
                ) : (
                  <Badge variant="outline">Non</Badge>
                ),
            },
          ]}
          lignes={perfs.data ?? []}
          chargement={perfs.isLoading}
        />
      </TabsContent>
    </Tabs>
  );
}
