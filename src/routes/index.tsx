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
  ShieldCheck,
  Truck,
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
      "Un agent agréé pose une balise chez vous. Elle porte un numéro unique, qui devient votre adresse.",
  },
  {
    icone: Search,
    titre: "Vous partagez ce numéro",
    texte:
      "Par message, par téléphone ou de vive voix : six chiffres suffisent, sans explication ni repère.",
  },
  {
    icone: Navigation,
    titre: "On guide jusqu'à votre porte",
    texte:
      "Le numéro ouvre la position GPS exacte et lance l'itinéraire dans l'application de navigation.",
  },
];

const USAGES = [
  {
    icone: HomeIcon,
    titre: "Particuliers",
    tag: "Domicile",
    texte:
      "Recevez visiteurs, colis et dépannages sans passer dix minutes au téléphone.",
  },
  {
    icone: UtensilsCrossed,
    titre: "Restaurants et hôtels",
    tag: "Commerce",
    texte:
      "Une fiche publique avec horaires, photos et itinéraire : vos clients arrivent seuls.",
  },
  {
    icone: Bike,
    titre: "Livreurs et taxis",
    tag: "Mobilité",
    texte:
      "Un numéro saisi, la navigation démarre. Moins de kilomètres perdus, plus de courses.",
  },
  {
    icone: Building2,
    titre: "Entreprises et institutions",
    tag: "Réseaux",
    texte:
      "Intégrez des adresses vérifiées à vos tournées, vos relevés et vos systèmes via l'API.",
  },
];

const CHIFFRES = [
  { valeur: "6", label: "quartiers pilotes à Conakry" },
  { valeur: "500+", label: "adresses en cours de construction" },
  { valeur: "< 3 s", label: "pour retrouver une adresse" },
  { valeur: "2026", label: "année de déploiement pilote" },
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
    <div className="overflow-x-hidden">
      {/* Héros */}
      <section className="gradient-signature relative flex min-h-[auto] items-center overflow-hidden py-16 md:py-24 lg:py-28">
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 text-white opacity-[0.06]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-24 size-[520px] rounded-full bg-white/5 blur-3xl"
        />

        <div className="relative mx-auto w-full max-w-[900px] px-4 md:px-8 lg:px-12">
          <h1 className="text-display text-center text-3xl font-extrabold leading-[1.08] text-white sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
            Trouvez une adresse en un numéro
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-white/75">
            Chaque lieu en Guinée reçoit un numéro unique. Saisissez-le pour
            obtenir sa localisation exacte et votre itinéraire.
          </p>


          <div className="mt-12 rounded-2xl border border-white/20 bg-card p-4 shadow-brand-lg sm:p-8">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void rechercher(numero);
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-background px-4 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
                <input
                  value={numero}
                  onChange={(event) => {
                    setNumero(event.target.value);
                    setErreur(null);
                  }}
                  placeholder="GN-CKY-______"
                  aria-label="Numéro de balise"
                  aria-invalid={!!erreur}
                  className="h-14 w-full min-w-0 bg-transparent font-mono text-xl font-semibold tracking-[0.1em] text-foreground outline-hidden placeholder:font-normal placeholder:text-muted-foreground/60 sm:h-16 sm:text-2xl"
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
                className="h-14 w-full bg-accent px-8 text-base font-medium text-accent-foreground transition-all duration-200 hover:scale-[1.02] hover:bg-accent-dark active:scale-[0.98] sm:h-16 sm:w-auto"
              >
                <Search className="size-5" />
                {enCours ? "Recherche…" : "Trouver l'adresse"}
              </Button>
            </form>

            {erreur && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {erreur}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-white/60">Essayez un exemple :</span>
            {EXEMPLES.map((exemple) => (
              <Link
                key={exemple}
                to="/a/$number"
                params={{ number: exemple }}
                className="rounded-full border border-white/20 px-3 py-1 font-mono text-xs text-white/80 transition-colors hover:border-white/50 hover:text-white"
              >
                {exemple}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section
        id="comment-ca-marche"
        className="bg-card px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center font-mono text-xs uppercase tracking-[0.22em] text-accent">
              Le principe
            </p>
            <h2 className="text-display mx-auto mt-4 max-w-2xl text-center text-3xl font-extrabold leading-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
              Comment ça marche
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base leading-relaxed text-slate-500">
              Trois étapes, une seule fois. Ensuite, votre adresse tient dans un
              message.
            </p>
          </Reveal>

          <div className="relative mt-16 grid gap-8 md:grid-cols-3">
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[16%] top-16 hidden md:block"
              height="2"
              width="68%"
            >
              <line
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="6 8"
                className="text-slate-200"
              />
            </svg>

            {ETAPES.map((etape, index) => (
              <Reveal key={etape.titre} delay={index * 120}>
                <div className="relative h-full rounded-2xl border border-slate-200/60 bg-card p-6 transition-shadow duration-200 hover:shadow-brand sm:p-8">
                  <span
                    aria-hidden="true"
                    className="text-display pointer-events-none absolute right-5 top-3 text-6xl font-extrabold text-slate-100"
                  >
                    0{index + 1}
                  </span>
                  <span className="relative inline-flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <etape.icone className="size-6" />
                  </span>
                  <h3 className="text-display relative mt-6 text-xl font-bold text-foreground sm:text-2xl">
                    {etape.titre}
                  </h3>
                  <p className="relative mt-3 text-sm leading-relaxed text-slate-500">
                    {etape.texte}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Usages */}
      <section id="usages" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center font-mono text-xs uppercase tracking-[0.22em] text-accent">
              Les usages
            </p>
            <h2 className="text-display mx-auto mt-4 max-w-2xl text-center text-3xl font-extrabold leading-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
              Une balise, mille usages
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base leading-relaxed text-slate-500">
              Une adresse fiable change le quotidien — chez soi comme au
              travail.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {USAGES.map((item, index) => (
              <Reveal key={item.titre} delay={index * 90}>
                <div className="group h-full rounded-2xl border border-slate-200/60 border-t-2 border-t-accent bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-t-4 hover:shadow-brand sm:p-8">
                  <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <item.icone className="size-6" />
                  </span>
                  <span className="mt-5 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {item.tag}
                  </span>
                  <h3 className="text-display mt-3 text-xl font-bold text-foreground">
                    {item.titre}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {item.texte}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Chiffres */}
      <section className="bg-primary-dark px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="text-display text-center text-3xl font-extrabold text-white sm:text-4xl">
              Le déploiement en cours
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-white/60">
              Chiffres du programme pilote, mis à jour au fil des campagnes
              d'adressage.
            </p>
          </Reveal>
          <dl className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {CHIFFRES.map((item, index) => (
              <Reveal key={item.label} delay={index * 80} className="text-center">
                <dt className="text-display text-4xl font-extrabold text-white sm:text-5xl">
                  {item.valeur}
                </dt>
                <dd className="mt-3 text-sm text-white/60">{item.label}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* Confiance */}
      <section className="bg-card px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          {[
            {
              icone: ShieldCheck,
              titre: "Adresses vérifiées",
              texte: "Chaque position est relevée sur place par un agent agréé.",
            },
            {
              icone: Truck,
              titre: "Prêt pour la livraison",
              texte: "Itinéraire direct dans Google Maps, Waze ou OpenStreetMap.",
            },
            {
              icone: Building2,
              titre: "Ouvert aux institutions",
              texte: "Export de données et API pour les réseaux et les communes.",
            },
          ].map((item, index) => (
            <Reveal key={item.titre} delay={index * 80}>
              <div className="flex gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <item.icone className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">{item.titre}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {item.texte}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Appel à l'action */}
      <section className="gradient-signature relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28">
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 text-white opacity-[0.06]"
        />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-display text-3xl font-extrabold leading-tight text-white sm:text-[2.75rem]">
            Prêt à obtenir votre adresse numérique ?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75">
            Un agent agréé pose votre balise, vérifie la position et vous remet
            votre numéro.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-12 bg-white px-8 text-base font-medium text-primary transition-transform duration-200 hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98]"
            >
              <Link to="/tarifs">
                Voir les offres
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 border-white/40 bg-transparent px-8 text-base font-medium text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/a-propos">Découvrir le projet</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
