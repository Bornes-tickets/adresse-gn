import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeFr } from "@/lib/admin";
import {
  adminAgents,
  adminInstallationDetail,
  adminUpdateInstallation,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_guard/installations_/$id")({
  head: () => ({
    meta: [
      { title: "Édition d'installation — Administration Adresse GN" },
      {
        name: "description",
        content:
          "Corriger manuellement les champs d'une installation terrain avant sa clôture, avec journal d'audit.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditionInstallation,
});

/** Convertit un ISO en valeur acceptée par input[type=datetime-local]. */
function pourInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditionInstallation() {
  const { id } = Route.useParams();
  const charger = useServerFn(adminInstallationDetail);
  const modifier = useServerFn(adminUpdateInstallation);
  const listerAgents = useServerFn(adminAgents);
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["admin", "installation", id],
    queryFn: () => charger({ data: { id } }),
  });
  const agents = useQuery({ queryKey: ["admin", "agents"], queryFn: () => listerAgents() });

  const [form, setForm] = useState({
    agent_id: "aucun",
    gps_lat: "",
    gps_lng: "",
    accuracy_m: "",
    photo_url: "",
    installed_at: "",
  });
  const [motif, setMotif] = useState("");

  const inst = detail.data?.installation;

  useEffect(() => {
    if (!inst) return;
    setForm({
      agent_id: inst.agent_id ?? "aucun",
      gps_lat: inst.gps_lat != null ? String(inst.gps_lat) : "",
      gps_lng: inst.gps_lng != null ? String(inst.gps_lng) : "",
      accuracy_m: inst.accuracy_m != null ? String(inst.accuracy_m) : "",
      photo_url: inst.photo_url ?? "",
      installed_at: pourInputLocal(inst.installed_at),
    });
  }, [inst?.id, inst?.agent_id, inst?.gps_lat, inst?.gps_lng, inst?.accuracy_m, inst?.photo_url, inst?.installed_at]);

  const muter = useMutation({
    mutationFn: () =>
      modifier({
        data: {
          id,
          motif,
          patch: {
            agent_id: form.agent_id === "aucun" ? null : form.agent_id,
            gps_lat: form.gps_lat,
            gps_lng: form.gps_lng,
            accuracy_m: form.accuracy_m,
            photo_url: form.photo_url,
            installed_at: form.installed_at,
          },
        },
      }),
    onSuccess: (r) => {
      if (r.modifies === 0) toast.info("Aucun changement à enregistrer.");
      else toast.success(`${r.modifies} champ(s) modifié(s) et journalisé(s).`);
      setMotif("");
      qc.invalidateQueries({ queryKey: ["admin", "installation", id] });
      qc.invalidateQueries({ queryKey: ["admin", "installations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cloturee = inst?.cloturee ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/installations">
              <ArrowLeft className="mr-1 h-4 w-4" /> Installations
            </Link>
          </Button>
          <h1 className="mt-1 text-xl font-semibold">
            Installation{" "}
            <span className="font-mono text-base">{inst?.beacon_number ?? "—"}</span>
          </h1>
        </div>
        {cloturee ? (
          <Badge variant="secondary">Clôturée le {formatDateTimeFr(inst?.validated_at ?? null)}</Badge>
        ) : (
          <Badge variant="outline">Modifiable — non clôturée</Badge>
        )}
      </div>

      {detail.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {(detail.error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Champs de l'installation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cloturee ? (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Cette installation est validée : les corrections manuelles ne sont plus possibles.
                Rejetez-la depuis la file de contrôle qualité pour la rouvrir.
              </p>
            ) : null}

            <div>
              <Label className="text-xs">Agent</Label>
              <Select
                value={form.agent_id}
                onValueChange={(v) => setForm((f) => ({ ...f, agent_id: v }))}
                disabled={cloturee}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aucun">Non attribué</SelectItem>
                  {(agents.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.badge_number} — {a.full_name ?? "Sans nom"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Latitude</Label>
                <Input
                  value={form.gps_lat}
                  onChange={(e) => setForm((f) => ({ ...f, gps_lat: e.target.value }))}
                  disabled={cloturee}
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="text-xs">Longitude</Label>
                <Input
                  value={form.gps_lng}
                  onChange={(e) => setForm((f) => ({ ...f, gps_lng: e.target.value }))}
                  disabled={cloturee}
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="text-xs">Précision (m)</Label>
                <Input
                  value={form.accuracy_m}
                  onChange={(e) => setForm((f) => ({ ...f, accuracy_m: e.target.value }))}
                  disabled={cloturee}
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="text-xs">Date d'installation</Label>
                <Input
                  type="datetime-local"
                  value={form.installed_at}
                  onChange={(e) => setForm((f) => ({ ...f, installed_at: e.target.value }))}
                  disabled={cloturee}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">URL de la photo</Label>
              <Input
                value={form.photo_url}
                onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
                disabled={cloturee}
                placeholder="https://…"
              />
            </div>

            <div>
              <Label className="text-xs">Motif de la correction (journalisé)</Label>
              <Textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                disabled={cloturee}
                rows={2}
                placeholder="Ex. GPS corrigé après revisite terrain"
              />
            </div>

            <Button
              onClick={() => muter.mutate()}
              disabled={cloturee || muter.isPending || detail.isLoading}
            >
              {muter.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mesures GPS relevées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(detail.data?.mesures ?? []).length === 0 ? (
                <p className="text-muted-foreground">Aucune mesure enregistrée.</p>
              ) : (
                (detail.data?.mesures ?? []).map((m) => (
                  <div key={m.id} className="flex justify-between gap-2 border-b border-border pb-1">
                    <span className="font-mono text-xs">
                      {Number(m.lat).toFixed(6)}, {Number(m.lng).toFixed(6)}
                    </span>
                    <span className="text-muted-foreground">
                      {m.accuracy_m != null ? `${Math.round(Number(m.accuracy_m))} m` : "—"} ·{" "}
                      {formatDateTimeFr(m.taken_at)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Journal d'audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(detail.data?.journal ?? []).length === 0 ? (
                <p className="text-muted-foreground">Aucune modification enregistrée.</p>
              ) : (
                (detail.data?.journal ?? []).map((l) => (
                  <div key={l.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{l.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {l.actor_name || "Système"} · {formatDateTimeFr(l.created_at)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                        {JSON.stringify(l.before ?? {}, null, 2)}
                      </pre>
                      <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                        {JSON.stringify(l.after ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
