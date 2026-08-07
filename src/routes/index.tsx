import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bike,
  Building2,
  Check,
  Home as HomeIcon,
  MapPin,
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

const ATOUTS = [
  "Fonctionne aussi via QR code",
  "Compatible avec toutes les apps de navigation",
  "Aucune installation requise pour rechercher",
];

const USAGES = [
  { icone: HomeIcon, titre: "Particuliers", texte: "Recevoir visiteurs et livraisons." },
  { icone: UtensilsCrossed, titre: "Commerces", texte: "Être trouvés sans expliquer." },
  { icone: Bike, titre: "Livraisons", texte: "Livrer sans appels d'orientation." },
  { icone: Building2, titre: "Entreprises", texte: "Intégrer les adresses par API." },
];


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADRESSE GN — Un lieu, un numéro, un itinéraire" },
      {
        name: "description",
        content:
          "Trouvez ou partagez n'importe quelle adresse en Guinée grâce à un simple numéro unique. Une balise, un numéro, une position GPS, un itinéraire immédiat.",
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-center text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
      {children}
    </p>
  );
}

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
    const reponse = await searchBeacon({ data: { number: propre } }).catch(
      () => null,
    );
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
    <div className="overflow-x-hidden bg-white">
      {/* Héros — seule section colorée de la page */}
      <section className="gradient-signature-soft px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <h1
            className="text-display text-center text-4xl font-extrabold leading-[1.1] text-white md:whitespace-nowrap md:text-5xl lg:text-6xl"
            style={{ textShadow: "0 1px 12px rgb(15 23 42 / 0.18)" }}
          >
            Trouvez une adresse en un numéro
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-center text-base leading-relaxed text-white/85 md:text-lg lg:max-w-none">
            Chaque lieu en Guinée reçoit un numéro unique. Saisissez-le pour
            obtenir sa localisation.
          </p>

          <div className="mt-10 rounded-2xl bg-white p-3 shadow-2xl">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void rechercher(numero);
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-4 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
                <input
                  value={numero}
                  onChange={(event) => {
                    setNumero(event.target.value);
                    setErreur(null);
                  }}
                  placeholder="GN-CKY-______"
                  aria-label="Numéro de balise"
                  aria-invalid={!!erreur}
                  className="h-14 w-full min-w-0 bg-transparent font-mono text-lg font-semibold tracking-[0.08em] text-slate-900 outline-hidden placeholder:font-normal placeholder:text-slate-400 sm:text-xl"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0">
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
                disabled={enCours}
                className="h-14 w-full bg-accent px-8 text-base font-medium text-accent-foreground transition-colors hover:bg-accent-dark sm:w-auto"
              >
                <Search className="size-5" />
                {enCours ? "Recherche…" : "Trouver l'adresse"}
              </Button>
            </form>

            {erreur && (
              <p role="alert" className="mt-3 px-1 text-sm text-destructive">
                {erreur}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            {EXEMPLES.map((exemple) => (
              <Link
                key={exemple}
                to="/a/$number"
                params={{ number: exemple }}
                className="rounded-full border border-white/25 px-3 py-1 font-mono text-xs text-white/80 transition-colors hover:border-white/60 hover:text-white"
              >
                {exemple}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Processus */}
      <section
        id="comment-ca-marche"
        className="bg-white px-4 py-16 sm:px-6 md:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <Eyebrow>Processus</Eyebrow>
            <h2 className="text-display mt-4 text-center text-3xl font-bold leading-[1.1] text-slate-900 md:text-4xl">
              Trois étapes, aucune friction
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {ETAPES.map((etape, index) => (
              <Reveal key={etape.titre} delay={index * 100}>
                <div className="h-full rounded-2xl border border-slate-200/60 bg-white p-8 transition-all duration-200 hover:-translate-y-[2px] hover:border-accent/30 hover:shadow-md">
                  <span className="font-mono text-xs tracking-[0.2em] text-slate-400">
                    0{index + 1}
                  </span>
                  <span className="mt-5 flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <etape.icone className="size-6" />
                  </span>
                  <h3 className="text-display mt-5 text-lg font-bold text-slate-900">
                    {etape.titre}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {etape.texte}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Usages */}
      <section
        id="usages"
        className="bg-slate-50 px-4 py-16 sm:px-6 md:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <Eyebrow>Usages</Eyebrow>
            <h2 className="text-display mt-4 text-center text-3xl font-bold leading-[1.1] text-slate-900 md:text-4xl">
              Une balise, mille usages
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {USAGES.map((item, index) => (
              <Reveal key={item.titre} delay={index * 80}>
                <div className="h-full rounded-xl bg-white p-6 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md">
                  <item.icone className="size-8 text-slate-700" />
                  <h3 className="text-display mt-4 text-base font-bold text-slate-900">
                    {item.titre}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {item.texte}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Garanties */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          {GARANTIES.map((item, index) => (
            <Reveal
              key={item.titre}
              delay={index * 80}
              className={
                index === 0 ? "" : "sm:border-l sm:border-slate-200 sm:pl-8"
              }
            >
              <div className="flex items-start gap-3">
                <item.icone className="mt-0.5 size-5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">
                    {item.titre}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">{item.texte}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-white px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-display text-3xl font-bold leading-[1.1] text-slate-900 md:text-4xl">
            Prêt à obtenir votre adresse ?
          </h2>
          <p className="mt-4 text-slate-600">
            Un agent vient chez vous, pose la plaque, active le numéro.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-12 bg-accent px-8 text-base font-medium text-accent-foreground transition-colors hover:bg-accent-dark"
            >
              <Link to="/tarifs">Voir les tarifs</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 border-slate-300 bg-transparent px-8 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              <Link to="/a-propos">Découvrir le projet</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
