import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/a/$number")({
  head: () => ({
    meta: [
      { title: "Résultat de recherche — Adresse GN" },
      {
        name: "description",
        content:
          "Résultat de la recherche d'une adresse Adresse GN à partir de son numéro de balise.",
      },
      { property: "og:title", content: "Résultat de recherche — Adresse GN" },
      {
        property: "og:description",
        content: "Localisation et informations publiques liées à une balise.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BeaconResult,
});

function BeaconResult() {
  const { number } = Route.useParams();

  const { data, error, isPending } = useQuery({
    queryKey: ["search_by_number", number],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_by_number", {
        p_number: number,
      });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-mono text-2xl font-bold text-primary">{number}</h1>

      {isPending && (
        <p className="mt-4 text-muted-foreground">Recherche en cours…</p>
      )}

      {error && (
        <p className="mt-4 text-destructive">
          Erreur de recherche : {error.message}
        </p>
      )}

      {!isPending && !error && (
        <>
          {(data?.length ?? 0) === 0 && (
            <p className="mt-4 text-muted-foreground">
              Aucune balise active ne correspond à ce numéro.
            </p>
          )}
          <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm text-foreground">
            {JSON.stringify(data, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}
