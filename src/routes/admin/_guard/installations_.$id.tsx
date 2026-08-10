import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, User, Camera, Calendar, Target, Edit3, History, Radio, Lock, Unlock, Save, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeFr } from "@/lib/admin";
import {
  adminAgents, adminInstallationDetail, adminUpdateInstallation,
} from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/installations_/$id")({
  head: () => ({
    meta: [
      { title: "Édition d'installation — Administration Adresse GN" },
      { name: "description", content: "Corriger manuellement les champs d'une installation avec journal d'audit." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditionInstallation,
});

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
    agent_id: "aucun", gps_lat: "", gps_lng: "", accuracy_m: "", photo_url: "", installed_at: "",
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
    mutationFn: () => modifier({
      data: {
        id, motif,
        patch: {
          agent_id: form.agent_id === "aucun" ? null : form.agent_id,
          gps_lat: form.gps_lat, gps_lng: form.gps_lng, accuracy_m: form.accuracy_m,
          photo_url: form.photo_url, installed_at: form.installed_at,
        },
      },
    }),
    onSuccess: (r: any) => {
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
    <div className="space-y-6">
      {/* Header hero */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl p-6 text-white shadow-xl",
        cloturee ? "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600" : "bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600",
      )}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Button asChild variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 -ml-3">
              <Link to="/admin/installations">
                <ArrowLeft className="mr-1 h-4 w-4" /> Retour aux installations
              </Link>
            </Button>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <div className="h-14 w-14 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur">
                <Radio className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  Installation <span className="font-mono">{inst?.beacon_number ?? "—"}</span>
                </h1>
                <p className="text-sm text-white/80 mt-0.5">
                  Édition manuelle avec journal d'audit
                </p>
              </div>
            </div>
          </div>
          <div>
            {cloturee ? (
              <Badge className="bg-white/20 text-white border-white/30 gap-1.5 backdrop-blur">
                <Lock className="h-3.5 w-3.5" /> Clôturée le {formatDateTimeFr(inst?.validated_at ?? null)}
              </Badge>
            ) : (
              <Badge className="bg-white/20 text-white border-white/30 gap-1.5 backdrop-blur">
                <Unlock className="h-3.5 w-3.5" /> Modifiable
              </Badge>
            )}
          </div>
        </div>
      </div>

      {detail.isError && (
        <Card className="border-rose-300 bg-rose-50">
          <CardContent className="p-4 text-sm text-rose-700 flex items-center gap-2">
            <Info className="h-4 w-4" /> {(detail.error as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Formulaire d'édition */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <CardTitle className="text-base flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-indigo-600" />
              Champs de l'installation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {cloturee && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  Cette installation est validée. Rejetez-la depuis la file de contrôle qualité pour la rouvrir.
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                <User className="h-3 w-3" /> Agent responsable
              </Label>
              <Select value={form.agent_id} onValueChange={(v) => setForm((f) => ({ ...f, agent_id: v }))} disabled={cloturee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aucun">— Non attribué —</SelectItem>
                  {(agents.data ?? []).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.badge_number} — {a.full_name ?? "?"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-emerald-500" /> Latitude
                </Label>
                <Input value={form.gps_lat} onChange={(e) => setForm((f) => ({ ...f, gps_lat: e.target.value }))} disabled={cloturee} inputMode="decimal" placeholder="9.5092" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-emerald-500" /> Longitude
                </Label>
                <Input value={form.gps_lng} onChange={(e) => setForm((f) => ({ ...f, gps_lng: e.target.value }))} disabled={cloturee} inputMode="decimal" placeholder="-13.7122" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Target className="h-3 w-3 text-sky-500" /> Précision (m)
                </Label>
                <Input value={form.accuracy_m} onChange={(e) => setForm((f) => ({ ...f, accuracy_m: e.target.value }))} disabled={cloturee} inputMode="decimal" placeholder="5" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-violet-500" /> Date d'installation
                </Label>
                <Input type="datetime-local" value={form.installed_at} onChange={(e) => setForm((f) => ({ ...f, installed_at: e.target.value }))} disabled={cloturee} />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                <Camera className="h-3 w-3 text-rose-500" /> URL de la photo
              </Label>
              <Input value={form.photo_url} onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))} disabled={cloturee} placeholder="https://…" />
              {form.photo_url && (
                <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 max-w-xs">
                  <img src={form.photo_url} alt="Aperçu" className="w-full h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                <Info className="h-3 w-3 text-amber-500" /> Motif de la correction (journalisé)
              </Label>
              <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} disabled={cloturee} rows={2} placeholder="Ex : GPS corrigé après revisite terrain" />
            </div>

            <Button
              onClick={() => muter.mutate()}
              disabled={cloturee || muter.isPending || detail.isLoading}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md"
              size="lg"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {muter.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </CardContent>
        </Card>

        {/* Colonne latérale */}
        <div className="space-y-4">
          {/* Mesures GPS */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" /> Mesures GPS
                <Badge variant="outline" className="text-[10px] ml-auto">{(detail.data?.mesures ?? []).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 max-h-64 overflow-y-auto">
              {(detail.data?.mesures ?? []).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Aucune mesure enregistrée.</p>
              ) : (
                <div className="space-y-1">
                  {(detail.data?.mesures ?? []).map((m: any) => (
                    <div key={m.id} className="flex justify-between text-xs p-2 rounded hover:bg-slate-50 transition">
                      <span className="font-mono text-slate-700">
                        {Number(m.lat).toFixed(6)}, {Number(m.lng).toFixed(6)}
                      </span>
                      <span className="text-slate-500 shrink-0 ml-2">
                        {m.accuracy_m != null ? `±${Math.round(Number(m.accuracy_m))}m` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Journal d'audit */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-violet-600" /> Journal d'audit
                <Badge variant="outline" className="text-[10px] ml-auto">{(detail.data?.journal ?? []).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 max-h-96 overflow-y-auto">
              {(detail.data?.journal ?? []).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Aucune modification enregistrée.</p>
              ) : (
                <div className="space-y-2">
                  {(detail.data?.journal ?? []).map((l: any) => (
                    <details key={l.id} className="rounded-lg border border-slate-200 group">
                      <summary className="p-2.5 cursor-pointer text-xs hover:bg-slate-50 transition flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{l.action}</div>
                          <div className="text-slate-500 mt-0.5">{l.actor_name || "Système"} · {formatDateTimeFr(l.created_at)}</div>
                        </div>
                      </summary>
                      <div className="p-2 border-t border-slate-100 grid gap-2 sm:grid-cols-2 bg-slate-50/50">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Avant</div>
                          <pre className="text-[10px] bg-white rounded p-1.5 overflow-x-auto border border-slate-200">
                            {JSON.stringify(l.before ?? {}, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Après</div>
                          <pre className="text-[10px] bg-white rounded p-1.5 overflow-x-auto border border-slate-200">
                            {JSON.stringify(l.after ?? {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
