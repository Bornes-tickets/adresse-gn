import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Search,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  RotateCcw,
  User,
  Phone,
  Package,
  Filter,
  Clock,
  ArrowRight,
  AlertCircle,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTimeFr } from "@/lib/admin";
import {
  adminAffecterInstallation,
  adminInstallationsAPlanifier,
  adminStatutInstallationAttente,
} from "@/lib/payment.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/installations-attente")({
  head: () => ({
    meta: [
      { title: "Installations à planifier — Administration Adresse GN" },
      { name: "description", content: "Gestion des demandes d'installation créées après confirmation de paiement." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminInstallationsAttente,
});

const STATUTS = [
  { valeur: "pending", label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  { valeur: "assigned", label: "Assignée", cls: "bg-sky-100 text-sky-700 border-sky-200", icon: User },
  {
    valeur: "planned",
    label: "Planifiée",
    cls: "bg-violet-100 text-violet-700 border-violet-200",
    icon: CalendarClock,
  },
  { valeur: "done", label: "Terminée", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  { valeur: "cancelled", label: "Annulée", cls: "bg-slate-200 text-slate-700 border-slate-300", icon: XCircle },
] as const;

function AdminInstallationsAttente() {
  const lister = useServerFn(adminInstallationsAPlanifier);
  const affecterFn = useServerFn(adminAffecterInstallation);
  const statuerFn = useServerFn(adminStatutInstallationAttente);
  const qc = useQueryClient();

  const [statut, setStatut] = useState("tous");
  const [agent, setAgent] = useState("tous");
  const [q, setQ] = useState("");

  const filtres = {
    statut: statut === "tous" ? null : statut,
    agentId: agent === "tous" ? null : agent,
  };

  const demandes = useQuery({
    queryKey: ["admin", "pending-installations", filtres],
    queryFn: () => lister({ data: filtres }),
  });

  const rafraichir = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "pending-installations"] });
    toast.success("Liste actualisée.");
  };

  const affecter = useMutation({
    mutationFn: (v: { id: string; agentId: string }) => affecterFn({ data: v }),
    onSuccess: () => {
      toast.success("Agent assigné.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statuer = useMutation({
    mutationFn: (v: { id: string; statut: string }) => statuerFn({ data: v }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agents = demandes.data?.agents ?? [];
  const lignes = demandes.data?.lignes ?? [];

  const filteredLignes = useMemo(() => {
    if (!q.trim()) return lignes;
    const t = q.toLowerCase();
    return lignes.filter(
      (l: any) =>
        (l.public_number ?? "").toLowerCase().includes(t) ||
        (l.client ?? "").toLowerCase().includes(t) ||
        (l.order_ref ?? "").toLowerCase().includes(t) ||
        (l.phone ?? "").includes(t),
    );
  }, [lignes, q]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, assigned: 0, planned: 0, done: 0, cancelled: 0 };
    for (const l of lignes) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  }, [lignes]);

  return (
    <div className="space-y-6">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <CalendarClock className="h-3.5 w-3.5" /> Administration
            </div>
            <h1 className="mt-1 text-3xl font-bold">Installations à planifier</h1>
            <p className="mt-1 text-sm text-white/80">
              Demandes générées après paiement — assignez un agent et suivez la pose.
            </p>
          </div>
          <Button
            variant="secondary"
            className="bg-white/15 hover:bg-white/25 text-white border-white/20"
            onClick={rafraichir}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
          </Button>
        </div>
      </div>

      {/* KPIs par statut */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUTS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.valeur}
              onClick={() => setStatut(statut === s.valeur ? "tous" : s.valeur)}
              className={cn(
                "text-left p-4 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5",
                statut === s.valeur ? "border-slate-900 shadow-md bg-white" : "border-slate-200 bg-white",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{s.label}</div>
                  <div className="text-2xl font-bold mt-1">{stats[s.valeur] ?? 0}</div>
                </div>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.cls)}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filtres */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-end">
            <div className="flex-1 min-w-0">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                Recherche
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="N° balise, client, commande, téléphone…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full lg:w-44">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                Statut
              </Label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  {STATUTS.map((s) => (
                    <SelectItem key={s.valeur} value={s.valeur}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full lg:w-64">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                Agent
              </Label>
              <Select value={agent} onValueChange={setAgent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="aucun">Non assignées</SelectItem>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card className="border-slate-200 overflow-hidden">
        {demandes.isLoading ? (
          <div className="p-16 text-center">
            <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-orange-600 rounded-full animate-spin mb-3" />
            <div className="text-sm text-slate-500">Chargement…</div>
          </div>
        ) : filteredLignes.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Aucune demande</h3>
            <p className="text-sm text-slate-600 mt-1">Aucune demande d'installation ne correspond aux filtres.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 font-semibold">Balise</th>
                  <th className="text-left p-3 font-semibold">Client</th>
                  <th className="text-left p-3 font-semibold">Commande</th>
                  <th className="text-left p-3 font-semibold">Créée</th>
                  <th className="text-left p-3 font-semibold">Statut</th>
                  <th className="text-left p-3 font-semibold">Agent</th>
                  <th className="text-right p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLignes.map((l: any) => (
                  <LigneAttente
                    key={l.id}
                    l={l}
                    agents={agents}
                    onAssigner={affecter.mutate}
                    onStatuer={statuer.mutate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function LigneAttente({
  l,
  agents,
  onAssigner,
  onStatuer,
}: {
  l: any;
  agents: any[];
  onAssigner: (v: { id: string; agentId: string }) => void;
  onStatuer: (v: { id: string; statut: string }) => void;
}) {
  const statutInfo = STATUTS.find((s) => s.valeur === l.status) ?? STATUTS[0];
  const StatutIcon = statutInfo.icon;
  const isClose = l.status === "done" || l.status === "cancelled";

  return (
    <tr className="border-t border-slate-100 hover:bg-orange-50/30 transition group">
      <td className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
            <Package className="h-4 w-4 text-orange-600" />
          </div>
          <span className="font-mono text-xs font-medium">
            {l.public_number ?? <span className="text-slate-400 italic">Non attribuée</span>}
          </span>
        </div>
      </td>
      <td className="p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{l.client}</div>
          {l.phone && (
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {l.phone}
            </div>
          )}
        </div>
      </td>
      <td className="p-3">
        <div className="min-w-0">
          <div className="font-mono text-xs">{l.order_ref ?? "—"}</div>
          {l.offer_code && (
            <Badge variant="outline" className="text-[10px] mt-0.5">
              {l.offer_code}
            </Badge>
          )}
        </div>
      </td>
      <td className="p-3 text-xs text-slate-500">{formatDateTimeFr(l.created_at)}</td>
      <td className="p-3">
        <Badge className={cn("gap-1", statutInfo.cls)}>
          <StatutIcon className="h-3 w-3" /> {statutInfo.label}
        </Badge>
      </td>
      <td className="p-3">
        <Select
          value={l.assigned_agent_id ?? ""}
          onValueChange={(agentId) => onAssigner({ id: l.id, agentId })}
          disabled={isClose}
        >
          <SelectTrigger className="w-52 h-9 text-xs bg-white">
            <SelectValue placeholder="Assigner un agent…" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1 justify-end opacity-80 group-hover:opacity-100 transition">
          {l.status !== "planned" && l.status !== "done" && l.status !== "cancelled" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-violet-600 hover:bg-violet-50"
              onClick={() => onStatuer({ id: l.id, statut: "planned" })}
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1" /> Planifier
            </Button>
          )}
          {l.status !== "done" && (
            <Button
              size="sm"
              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onStatuer({ id: l.id, statut: "done" })}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Terminer
            </Button>
          )}
          {l.status !== "cancelled" && l.status !== "done" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-rose-600 hover:bg-rose-50"
              onClick={() => onStatuer({ id: l.id, statut: "cancelled" })}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          {(l.status === "cancelled" || l.status === "done") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-slate-600 hover:bg-slate-100"
              onClick={() => onStatuer({ id: l.id, statut: "pending" })}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Réouvrir
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
