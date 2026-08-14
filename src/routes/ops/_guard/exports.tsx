import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { QrCode, FileText, FileArchive, Package, Sparkles, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { opsLots, opsExportQrPdf, opsExportQrZip } from "@/lib/ops.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ops/_guard/exports")({ component: OpsExports });

function OpsExports() {
  const listerFn = useServerFn(opsLots);
  const pdfFn = useServerFn(opsExportQrPdf);
  const zipFn = useServerFn(opsExportQrZip);
  const [q, setQ] = useState("");

  const lots = useQuery({ queryKey: ["ops", "lots"], queryFn: () => listerFn() });

  const pdf = useMutation({
    mutationFn: (lotId: string) => pdfFn({ data: { lotId } }),
    onSuccess: (r: any) => {
      const blob = new Blob([Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `QR_${r.lotCode}.pdf`; a.click();
      toast.success(`${r.pages} page(s) PDF · ${r.balises} balises`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const zip = useMutation({
    mutationFn: (lotId: string) => zipFn({ data: { lotId } }),
    onSuccess: (r: any) => {
      const blob = new Blob([Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))], { type: "application/zip" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `QR_${r.lotCode}.zip`; a.click();
      toast.success(`${r.fichiers} PNG · ${r.cote}px`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = ((lots.data ?? []) as any[]).filter((l) => !q.trim() || l.code.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><QrCode className="h-3.5 w-3.5" /> Impression</div>
          <h1 className="mt-1 text-3xl font-bold">Exports QR</h1>
          <p className="mt-1 text-sm text-white/80">Génération PDF prêt à imprimer (12 QR/page A4) ou ZIP de PNG 600 DPI pour mail-merge fournisseur.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <Input placeholder="Rechercher un lot par code…" value={q} onChange={(e) => setQ(e.target.value)} />
        </CardContent>
      </Card>

      {lots.isLoading ? <Card><div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-amber-600 rounded-full animate-spin" /></div></Card>
        : rows.length === 0 ? <Card><div className="p-16 text-center"><QrCode className="h-12 w-12 mx-auto text-slate-300 mb-3" /><div className="text-slate-500">Aucun lot disponible.</div></div></Card>
        : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((l: any) => (
              <Card key={l.id} className="overflow-hidden hover:shadow-lg transition group">
                <div className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-600" />
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-sm font-semibold">{l.code}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{l.quantity} balises · {l.category ?? "—"}</div>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <Button size="sm" variant="outline" onClick={() => pdf.mutate(l.id)} disabled={pdf.isPending} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                      <FileText className="h-3.5 w-3.5 mr-1" />PDF A4
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => zip.mutate(l.id)} disabled={zip.isPending} className="border-orange-300 text-orange-700 hover:bg-orange-50">
                      <FileArchive className="h-3.5 w-3.5 mr-1" />ZIP PNG
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
