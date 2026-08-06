import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Confidentialité — Adresse GN" },
      {
        name: "description",
        content:
          "Comment Adresse GN collecte, protège et utilise les données liées aux adresses et aux comptes utilisateurs.",
      },
      { property: "og:title", content: "Confidentialité — Adresse GN" },
      {
        property: "og:description",
        content: "Politique de confidentialité d'Adresse GN.",
      },
    ],
  }),
  component: Confidentialite,
});

function Confidentialite() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-foreground">Confidentialité</h1>
      <p className="mt-4 text-muted-foreground">
        Les adresses privées ne sont jamais exposées publiquement. Seules les
        adresses marquées comme publiques et actives sont consultables sans
        compte.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Page en cours de rédaction.
      </p>
    </div>
  );
}
