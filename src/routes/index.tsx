import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { QrCode, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getDefaultZone,
  isValidBeaconNumber,
  normalizeBeaconNumber,
} from "@/lib/geo";
import { searchBeacon } from "@/lib/search.functions";


const EXEMPLES = ["GN-CKY-582741", "GN-CKY-152963", "GN-CKY-759482"];

const ETAPES = [
  {
    titre: "Numéro",
    texte:
      "Chaque lieu possède un numéro unique, inscrit sur sa balise physique.",
  },
  {
    titre: "Localisation",
    texte:
      "Le numéro est associé à des coordonnées GPS précises et vérifiées.",
  },
  {
    titre: "Itinéraire",
    texte: "Partagez le numéro : on vous guide jusqu'à la porte.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adresse GN — Trouvez une adresse en un numéro" },
      {
        name: "description",
        content:
          "Adresse GN attribue un numéro unique à chaque lieu en Guinée : recherchez un numéro de balise et obtenez la localisation exacte et l'itinéraire.",
      },
      {
        property: "og:title",
        content: "Adresse GN — Trouvez une adresse en un numéro",
      },
      {
        property: "og:description",
        content:
          "Un lieu · Un numéro · Un itinéraire. Recherchez une adresse guinéenne à partir de son numéro de balise.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [numero, setNumero] = useState("");

  const rechercher = (valeur: string) => {
    const propre = valeur.trim().toUpperCase();
    if (!propre) return;
    navigate({ to: "/a/$number", params: { number: propre } });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Trouvez une adresse en un numéro
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted-foreground">
        Chaque lieu en Guinée reçoit un numéro unique. Saisissez-le pour obtenir
        sa localisation exacte et votre itinéraire.
      </p>

      <form
        className="mt-10 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          rechercher(numero);
        }}
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 shadow-xs focus-within:ring-2 focus-within:ring-ring">
          <input
            value={numero}
            onChange={(event) => setNumero(event.target.value)}
            placeholder="GN-CKY-______"
            aria-label="Numéro de balise"
            className="w-full bg-transparent py-2 font-mono text-xl tracking-[0.12em] text-foreground outline-hidden placeholder:text-muted-foreground/70 sm:text-2xl"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled
                  aria-label="Scanner un QR code"
                >
                  <QrCode className="size-5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Bientôt disponible</TooltipContent>
          </Tooltip>
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-auto bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
        >
          <Search className="size-5" />
          Rechercher
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-muted-foreground">Exemples :</span>
        {EXEMPLES.map((exemple) => (
          <Link
            key={exemple}
            to="/a/$number"
            params={{ number: exemple }}
            className="rounded-md border border-border bg-card px-2 py-1 font-mono text-primary hover:border-primary"
          >
            {exemple}
          </Link>
        ))}
      </div>

      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        {ETAPES.map((etape, index) => (
          <div
            key={etape.titre}
            className="rounded-lg border border-border bg-card p-6"
          >
            <span className="font-mono text-sm text-accent">
              0{index + 1}
            </span>
            <h2 className="mt-2 text-lg font-semibold text-primary">
              {etape.titre}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{etape.texte}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
