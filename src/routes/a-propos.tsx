import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos — Adresse GN" },
      {
        name: "description",
        content:
          "Adresse GN construit un système d'adressage national : un numéro unique par lieu, une localisation vérifiée, un itinéraire fiable.",
      },
      { property: "og:title", content: "À propos — Adresse GN" },
      {
        property: "og:description",
        content: "La mission d'Adresse GN et son système d'adressage.",
      },
    ],
  }),
  component: APropos,
});

function APropos() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-foreground">À propos</h1>
      <p className="mt-4 text-muted-foreground">
        Adresse GN attribue à chaque lieu un numéro unique matérialisé par une
        balise physique. Ce numéro suffit à retrouver la localisation exacte du
        lieu et à générer un itinéraire.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Page en cours de rédaction.
      </p>
    </div>
  );
}
