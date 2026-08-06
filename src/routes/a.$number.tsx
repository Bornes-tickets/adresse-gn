import { createFileRoute } from "@tanstack/react-router";

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-mono text-2xl font-bold text-primary">{number}</h1>
      <p className="mt-4 text-muted-foreground">
        La base de données n'est pas encore initialisée : la recherche par numéro
        sera branchée sur la fonction <code>search_by_number</code> dès la
        création du schéma.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm text-foreground">
        {JSON.stringify({ number, status: "en attente du schéma" }, null, 2)}
      </pre>
    </div>
  );
}
