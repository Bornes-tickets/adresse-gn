import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Radio, Search, RefreshCw, Download, Package, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTimeFr } from "@/lib/admin";
import { opsBeacons } from "@/lib/ops.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ops/_guard/beacons")({ component: OpsBeacons });

const STATUSES = [
  { v: "generated", l: "Générées", cls: "bg-slate-100 text-slate-700" },
  { v: "assigned", l: "Assignées", cls: "bg-sky-100 text-sky-700" },
  { v: "active", l: "Actives", cls: "bg-emerald-100 text-emerald-700" },
  { v: "suspended", l: "Suspendues", cls: "bg-amber-100 text-amber-700" },
  { v: "cancelled", l: "Annulées", cls: "bg-rose-100 text-rose-700" },
];

function OpsBeacons() {
  const fn = useServerFn(opsBeacons);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const beacons = useQuery({
    queryKey: ["ops", "beacons", { q, status, page }],
    queryFn: () => fn({ data: { q: q || null, statuses: status === "all" ? [] : [status], page, pageSize: 50 } }),
  });

  useRealtimeInvalidate({ table: "beacons", invalidate: [["ops", "beacons"]] });

  const rows = beacons.data?.rows ?? [];
  const stats = useMemo(() => {
    const counts: Record<string, number> = { generated: 0, assigned: 0, active: 0, suspended: 0, cancelled: 0 };
    for (const b of rows) counts[b.status] = (counts[b.status] ?? 0) + 1;
    return counts;
  }, [rows]);

  const csvUrl = useMemo(() => {
    if (!rows.length) return null;
    const header = "numero,categorie,statut,lot,cree,activee\n";
    const lines = rows.map((b: any) => [b.public_number, b.category ?? "", b.status, b.lot_code ?? "", b.created_at, b.activated_at ?? ""].map((v) => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + lines], { type: "text/csv;charset=utf-8" }));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><Radio className="h-3.5 w-3.5" /> Stock</div>
            <h1 className="mt-1 text-3xl font-bold">Balises</h1>
            <p className="mt-1 text-sm text-white/80">Inventaire complet, statut par balise.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={() => { qc.invalidateQueries({ queryKey: ["ops", "beacons"] }); toast.success("Actualisé."); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Rafraîchir
            </Button>
            {csvUrl && <a href={csvUrl} download="balises.csv"><Button variant="secondary" className="bg-white text-orange-700"><Download className="h-4 w-4 mr-1.5" />Export</Button></a>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUSES.map((s) => (
          <button key={s.v} onClick={() => { setStatus(status === s.v ? "all" : s.v); setPage(1); }}
            className={cn("text-left p-4 rounded-xl border bg-white transition hover:shadow-md",
              status === s.v ? "border-amber-600 ring-2 ring-amber-200" : "border-slate-200")}>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{s.l}</div>
            <div className="text-2xl font-bold mt-1">{stats[s.v] ?? 0}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="N° de balise (GN-XXX-…)" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {beacons.isLoading ? <div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-amber-600 rounded-full animate-spin" /></div>
          : rows.length === 0 ? <div className="p-16 text-center text-slate-500">Aucune balise.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Numéro</th>
                    <th className="text-left p-3 font-semibold">Catégorie</th>
                    <th className="text-left p-3 font-semibold">Lot</th>
                    <th className="text-left p-3 font-semibold">Statut</th>
                    <th className="text-left p-3 font-semibold">Créée</th>
                    <th className="text-left p-3 font-semibold">Activée</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b: any) => {
                    const st = STATUSES.find((s) => s.v === b.status);
                    return (
                      <tr key={b.id} className="border-t border-slate-100 hover:bg-amber-50/30 transition">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center"><Radio className="h-4 w-4 text-orange-600" /></div>
                            <span className="font-mono text-xs font-medium">{b.public_number}</span>
                          </div>
                        </td>
                        <td className="p-3"><Badge variant="outline">{b.category ?? "—"}</Badge></td>
                        <td className="p-3 font-mono text-xs">{b.lot_code ?? "—"}</td>
                        <td className="p-3"><Badge className={st?.cls}>{st?.l ?? b.status}</Badge></td>
                        <td className="p-3 text-xs text-slate-500">{formatDateTimeFr(b.created_at)}</td>
                        <td className="p-3 text-xs text-slate-500">{b.activated_at ? formatDateTimeFr(b.activated_at) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {beacons.data && beacons.data.total > 50 && (
        <div className="flex justify-between text-sm text-slate-600">
          <span>Page {page} · {beacons.data.total} résultats</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button size="sm" variant="outline" disabled={page * 50 >= beacons.data.total} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </div>
  );
}
