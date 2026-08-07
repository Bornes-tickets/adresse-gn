import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { proApiKeys, proCreateApiKey, proRevokeApiKey } from "@/lib/pro.functions";

export const Route = createFileRoute("/pro/_guard/api")({
  head: () => ({
    meta: [
      { title: "Clés API — Espace pro Adresse GN" },
      {
        name: "description",
        content:
          "Générez et révoquez vos clés API Adresse GN pour interroger les adresses depuis vos propres applications.",
      },
      { property: "og:title", content: "Clés API — Espace pro Adresse GN" },
      { property: "og:description", content: "Gestion des accès API de votre entreprise." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [nouvelleCle, setNouvelleCle] = useState<string | null>(null);

  const cles = useQuery({ queryKey: ["pro-api-keys"], queryFn: () => proApiKeys() });

  const creer = useMutation({
    mutationFn: () => proCreateApiKey(),
    onSuccess: (res: { key?: string }) => {
      setNouvelleCle(res?.key ?? null);
      queryClient.invalidateQueries({ queryKey: ["pro-api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoquer = useMutation({
    mutationFn: (id: string) => proRevokeApiKey({ data: { id } }),
    onSuccess: () => {
      toast.success("Clé révoquée.");
      queryClient.invalidateQueries({ queryKey: ["pro-api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clés API</h1>
          <p className="text-sm text-muted-foreground">
            Interrogez les adresses publiques depuis vos applications.
          </p>
        </div>
        <Button onClick={() => creer.mutate()} disabled={creer.isPending} className="w-full sm:w-auto">
          <Plus className="size-4" />
          Générer une clé
        </Button>
      </div>

      {cles.isPending && <Skeleton className="h-32 w-full" />}
      {!cles.isPending && !cles.data?.length && (
        <p className="text-sm text-muted-foreground">Aucune clé active.</p>
      )}

      <div className="space-y-3">
        {cles.data?.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-mono text-sm text-foreground">
                  <KeyRound className="size-4 text-primary" />
                  {c.prefix ? `${c.prefix}••••••••` : "clé masquée"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Créée le {new Date(c.created_at).toLocaleDateString("fr-FR")} ·{" "}
                  {c.usage_month} appel(s) ce mois
                  {c.quota_month ? ` / ${c.quota_month}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.active ? "default" : "secondary"}>
                  {c.active ? "Active" : "Révoquée"}
                </Badge>
                {c.active && (
                  <Button variant="outline" size="sm" onClick={() => revoquer.mutate(c.id)}>
                    Révoquer
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Utilisation</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
{`GET /api/public/v1/address/GN-CKY-123456
Header: x-api-key: <votre clé>`}
          </pre>
        </CardContent>
      </Card>

      <Dialog open={!!nouvelleCle} onOpenChange={(o) => !o && setNouvelleCle(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>Votre nouvelle clé API</DialogTitle>
            <DialogDescription>
              Copiez-la maintenant : elle ne sera plus affichée par la suite.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all rounded-md bg-muted p-3 font-mono text-sm">{nouvelleCle}</p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              onClick={async () => {
                if (!nouvelleCle) return;
                await navigator.clipboard.writeText(nouvelleCle);
                toast.success("Clé copiée.");
              }}
              className="w-full sm:w-auto"
            >
              <Copy className="size-4" />
              Copier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
