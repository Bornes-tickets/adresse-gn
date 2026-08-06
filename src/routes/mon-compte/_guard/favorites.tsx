import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryLabel, normalizeBeaconNumber } from "@/lib/geo";
import {
  ownerDeleteFavorite,
  ownerFavorites,
  ownerToggleFavorite,
  ownerUpdateFavorite,
} from "@/lib/owner.functions";

export const Route = createFileRoute("/mon-compte/_guard/favorites")({
  head: () => ({
    meta: [
      { title: "Mes favoris — Adresse GN" },
      {
        name: "description",
        content:
          "Retrouvez vos adresses favorites Adresse GN et donnez-leur un alias mémorisable (Maison, Bureau…).",
      },
      { property: "og:title", content: "Mes favoris — Adresse GN" },
      { property: "og:description", content: "Vos adresses enregistrées avec alias personnalisés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FavorisPage,
});

function FavorisPage() {
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState("");
  const [alias, setAlias] = useState("");
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [aliasEdite, setAliasEdite] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["owner-favorites"],
    queryFn: () => ownerFavorites(),
  });

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["owner-favorites"] });

  const ajouter = useMutation({
    mutationFn: () =>
      ownerToggleFavorite({
        data: { number: normalizeBeaconNumber(numero), alias: alias.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Favori enregistré.");
      setNumero("");
      setAlias("");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renommer = useMutation({
    mutationFn: (id: string) =>
      ownerUpdateFavorite({ data: { id, alias: aliasEdite.trim() || null } }),
    onSuccess: () => {
      toast.success("Alias mis à jour.");
      setEnEdition(null);
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const supprimer = useMutation({
    mutationFn: (id: string) => ownerDeleteFavorite({ data: { id } }),
    onSuccess: () => {
      toast.success("Favori retiré.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Mes favoris</h1>
        <p className="text-sm text-muted-foreground">
          Enregistrez les adresses que vous utilisez souvent.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <Input
            value={numero}
            onChange={(e) => setNumero(e.target.value.toUpperCase())}
            placeholder="GN-CKY-123456"
            className="font-mono sm:max-w-[12rem]"
          />
          <Input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Alias (Maison, Bureau…)"
            maxLength={60}
          />
          <Button onClick={() => ajouter.mutate()} disabled={!numero || ajouter.isPending}>
            <Heart className="size-4" />
            Ajouter
          </Button>
        </CardContent>
      </Card>

      {isPending && <Skeleton className="h-32 w-full" />}

      {!isPending && !data?.length && (
        <p className="text-sm text-muted-foreground">Aucun favori pour le moment.</p>
      )}

      <div className="space-y-3">
        {data?.map((f) => (
          <Card key={f.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div className="space-y-1">
                {enEdition === f.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={aliasEdite}
                      onChange={(e) => setAliasEdite(e.target.value)}
                      maxLength={60}
                      className="h-9 w-48"
                    />
                    <Button size="sm" onClick={() => renommer.mutate(f.id)}>
                      OK
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEnEdition(null)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <p className="font-medium text-foreground">
                    {f.alias ?? f.name ?? "Adresse enregistrée"}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/a/${f.public_number}`}
                    className="font-mono text-sm text-primary underline"
                  >
                    {f.public_number}
                  </a>
                  {f.category && <Badge variant="secondary">{categoryLabel(f.category)}</Badge>}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEnEdition(f.id);
                    setAliasEdite(f.alias ?? "");
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => supprimer.mutate(f.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
