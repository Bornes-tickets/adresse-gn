import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Bike,
  Building2,
  Home as HomeIcon,
  MapPin,
  Navigation,
  QrCode,
  Search,
  UtensilsCrossed,
} from "lucide-react";

import { Reveal } from "@/components/Reveal";
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
    icone: MapPin,
    titre: "Votre lieu reçoit un numéro",
    texte:
      "Un agent pose une balise chez vous. Elle porte un numéro unique, qui devient votre adresse.",
  },
  {
    icone: Search,
    titre: "Vous partagez ce numéro",
    texte:
      "Par message, par téléphone ou de vive voix : six chiffres suffisent, sans explication.",
  },
  {
    icone: Navigation,
    titre: "On vous guide jusqu'à la porte",
    texte:
      "Le numéro ouvre la position GPS exacte et lance l'itinéraire dans l'application de navigation.",
  },
];

const PUBLICS = [
  {
    icone: HomeIcon,
    titre: "Particuliers",
    texte: "Recevez visiteurs et livraisons sans expliquer.",
  },
  {
    icone: UtensilsCrossed,
    titre: "Restaurants et hôtels",
    texte: "Soyez trouvés en un numéro.",
  },
  {
    icone: Bike,
    titre: "Livreurs et taxis",
    texte: "Naviguez directement à destination.",
  },
  {
    icone: Building2,
    titre: "Entreprises",
    texte: "Intégrez les adresses vérifiées à vos systèmes.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADRESSE GN — Un lieu, un numéro, un itinéraire" },
      {
        name: "description",
        content:
          "Trouvez ou partagez n'importe quelle adresse en Guinée grâce à un simple numéro unique. Pour les livraisons, les visites, les taxis. Une balise, un numéro, une position GPS, un itinéraire immédiat.",
      },
      {
        property: "og:title",
        content: "ADRESSE GN — Un lieu, un numéro, un itinéraire",
      },
      {
        property: "og:description",
        content:
          "Envoyez votre adresse comme un numéro de téléphone. En Guinée, un numéro suffit pour être trouvé.",
      },
      { property: "og:url", content: "https://place-id-finder.lovable.app/" },
      {
        property: "og:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
      {
        name: "twitter:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
    ],
    links: [{ rel: "canonical", href: "https://place-id-finder.lovable.app/" }],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [numero, setNumero] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const rechercher = async (valeur: string) => {
    const propre = normalizeBeaconNumber(valeur, getDefaultZone());
    if (!propre) return;

    if (!isValidBeaconNumber(propre)) {
      setErreur(
        "Ce numéro semble incomplet — saisissez les 6 chiffres de la balise (ex. 582741) ou le numéro entier GN-CKY-582741.",
      );
      return;
    }

    setErreur(null);
    setEnCours(true);
    const reponse = await searchBeacon({ data: { number: propre } }).catch(() => null);
    setEnCours(false);

    if (reponse?.status === "rate_limited") {
      setErreur(
        reponse.message ??
          "Beaucoup de recherches d'un coup — patientez quelques secondes puis réessayez.",
      );
      return;
    }
    if (reponse?.status === "not_found") {
      setErreur(
        "Nous n'avons pas trouvé cette adresse — vérifiez le numéro ou contactez le propriétaire du lieu.",
      );
      return;
    }
    navigate({ to: "/a/$number", params: { number: propre } });
  };

  return (
    <div>
      {/* Héros */}
      <section className="relative overflow-hidden bg-linear-to-br from-primary to-[oklch(0.32_0.07_262)]">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full opacity-8"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="rues" width="88" height="88" patternUnits="userSpaceOnUse">
              <path
                d="M0 44H88M44 0V88M0 0L88 88"
                stroke="white"
                strokeWidth="1.5"
                fill="none"
              />
              <circle cx="44" cy="44" r="4" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rues)" />
        </svg>

        <div className="relative mx-auto max-w-3xl px-4 py-20 sm:py-28">
          <h1 className="text-center text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl">
            Envoyez votre adresse comme un numéro de téléphone.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-center text-lg text-primary-foreground/85">
            En Guinée, plus besoin d'expliquer le chemin. Un numéro suffit —
            votre livreur, votre visiteur, votre taxi arrivent directement chez
            vous.
          </p>

          <div className="mt-10 rounded-2xl border border-border/40 bg-card p-4 shadow-lg sm:p-6">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void rechercher(numero);
              }}
            >
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 focus-within:ring-2 focus-within:ring-ring">
                <input
                  value={numero}
                  onChange={(event) => {
                    setNumero(event.target.value);
                    setErreur(null);
                  }}
                  placeholder="GN-CKY-______"
                  aria-label="Numéro de balise"
                  aria-invalid={!!erreur}
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
                disabled={enCours}
                className="h-auto bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
              >
                <Search className="size-5" />
                {enCours ? "Recherche…" : "Trouver l'adresse"}
              </Button>
            </form>

            {erreur && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {erreur}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Essayez un exemple :</span>
              {EXEMPLES.map((exemple) => (
                <Link
                  key={exemple}
                  to="/a/$number"
                  params={{ number: exemple }}
                  className="rounded-md border border-border bg-card px-2 py-1 font-mono text-primary transition-colors hover:border-primary"
                >
                  {exemple}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="mx-auto max-w-5xl px-4 py-20">
        <Reveal>
          <h2 className="text-center text-3xl font-bold text-foreground">
            Comment ça marche
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Trois étapes, une seule fois. Ensuite, votre adresse tient dans un
            message.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {ETAPES.map((etape, index) => (
            <Reveal key={etape.titre} delay={index * 100}>
              <div className="h-full rounded-xl border border-border bg-card p-6 transition-transform duration-200 hover:scale-[1.02]">
                <span className="inline-flex size-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <etape.icone className="size-5" />
                </span>
                <span className="mt-4 block font-mono text-xs text-accent">
                  Étape 0{index + 1}
                </span>
                <h3 className="mt-1 text-lg font-semibold text-primary">
                  {etape.titre}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{etape.texte}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pour qui */}
      <section id="pour-qui" className="bg-muted/40 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <Reveal>
            <h2 className="text-center text-3xl font-bold text-foreground">
              Pour qui ?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Une adresse fiable change le quotidien — chez soi comme au travail.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PUBLICS.map((item, index) => (
              <Reveal key={item.titre} delay={index * 80}>
                <div className="h-full rounded-xl border border-border bg-card p-6 transition-transform duration-200 hover:scale-[1.02]">
                  <span className="inline-flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icone className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {item.titre}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.texte}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Appel à l'action */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <Reveal>
          <div className="rounded-2xl border border-border bg-linear-to-br from-primary to-[oklch(0.32_0.07_262)] px-6 py-12 text-center">
            <h2 className="text-3xl font-bold text-primary-foreground">
              Créez votre adresse dès aujourd'hui
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-primary-foreground/85">
              Un agent agréé pose votre balise, vérifie la position et vous
              remet votre numéro.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Link to="/tarifs">
                Créer votre adresse
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
