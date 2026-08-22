import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Bike,
  Building2,
  Check,
  ExternalLink,
  Home as HomeIcon,
  MapPin,
  MapPinned,
  Mic,
  MicOff,
  Navigation2,
  QrCode,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

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
import { InstallBanner } from "@/components/InstallBanner";
import { QrScanner } from "@/components/QrScanner";
import { cn } from "@/lib/utils";

const EXEMPLES = [
  "GN-CKY-582741",
  "GN-CKY-152963",
  "GN-CKY-759482",
];

const EXEMPLE_DEMO = "GN-CKY-582741";

/* =========================================================
   DÉMONSTRATION ITINÉRAIRE RÉEL
   ========================================================= */

const DEMO_ORIGIN = "Kaloum, Conakry, Guinea";
const DEMO_DESTINATION = "Hôtel Kaloum, Conakry, Guinea";

const GOOGLE_MAPS_EMBED_KEY = (
  import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY as string | undefined
)?.trim();

const GOOGLE_MAPS_EMBED_URL = GOOGLE_MAPS_EMBED_KEY
  ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(
      GOOGLE_MAPS_EMBED_KEY,
    )}&origin=${encodeURIComponent(
      DEMO_ORIGIN,
    )}&destination=${encodeURIComponent(
      DEMO_DESTINATION,
    )}&mode=driving&language=fr&region=GN`
  : null;

const GOOGLE_MAPS_ROUTE_URL = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
  DEMO_ORIGIN,
)}&destination=${encodeURIComponent(
  DEMO_DESTINATION,
)}&travelmode=driving`;

const WAZE_ROUTE_URL = `https://www.waze.com/ul?q=${encodeURIComponent(
  DEMO_DESTINATION,
)}&navigate=yes`;

const USAGES = [
  {
    icone: HomeIcon,
    cle: "individuals",
    grad: "from-emerald-500 to-teal-600",
  },
  {
    icone: UtensilsCrossed,
    cle: "shops",
    grad: "from-orange-500 to-rose-600",
  },
  {
    icone: Bike,
    cle: "delivery",
    grad: "from-violet-500 to-fuchsia-600",
  },
  {
    icone: Building2,
    cle: "companies",
    grad: "from-sky-500 to-blue-600",
  },
];

/* =========================================================
   COMMENT ÇA MARCHE
   ========================================================= */

const ETAPES = [
  {
    numero: "01",
    icone: MapPinned,
    titre: "Obtenez votre Adresse GN",
    texte:
      "Votre emplacement reçoit un numéro unique associé à sa localisation et à son QR Code.",
    tags: ["Numéro unique", "QR Code"],
  },
  {
    numero: "02",
    icone: Search,
    titre: "Saisissez ou scannez",
    texte:
      "Entrez le numéro ou scannez le QR Code pour retrouver instantanément l’adresse.",
    tags: ["Sans application", "Web & mobile"],
  },
  {
    numero: "03",
    icone: Navigation2,
    titre: "Lancez votre itinéraire",
    texte:
      "Choisissez votre application de navigation et laissez-vous guider jusqu’à destination.",
    tags: ["Google Maps", "Waze"],
  },
];

const AVANTAGES = [
  {
    icone: Zap,
    titre: "Localisation immédiate",
    texte: "Du numéro à la destination",
  },
  {
    icone: QrCode,
    titre: "QR Code intégré",
    texte: "Scannez pour ouvrir l’adresse",
  },
  {
    icone: Share2,
    titre: "Partage simplifié",
    texte: "Numéro, lien ou QR Code",
  },
  {
    icone: Smartphone,
    titre: "Accessible partout",
    texte: "Téléphone, tablette et ordinateur",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "ADRESSE GN — Votre adresse, enfin facile à trouver",
      },
      {
        name: "description",
        content:
          "Un numéro unique par lieu. Fini les explications, les repères et les appels perdus. Trouvez ou partagez n'importe quelle adresse en Guinée avec Adresse GN.",
      },
      {
        property: "og:title",
        content: "ADRESSE GN — Votre adresse, enfin facile à trouver",
      },
      {
        property: "og:description",
        content:
          "Un numéro unique par lieu. Localisez, partagez et rejoignez facilement chaque adresse.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        property: "og:url",
        content: "https://place-id-finder.lovable.app/",
      },
      {
        property: "og:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
      {
        name: "twitter:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://place-id-finder.lovable.app/",
      },
    ],
  }),
  component: Home,
});

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
      {children}
    </p>
  );
}

function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;

  return (
    "SpeechRecognition" in window ||
    "webkitSpeechRecognition" in window
  );
}

function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [numero, setNumero] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ecoute, setEcoute] = useState(false);

  const recognitionRef = useRef<any>(null);

  const rechercher = async (valeur: string) => {
    const propre = normalizeBeaconNumber(
      valeur,
      getDefaultZone(),
    );

    if (!propre) return;

    if (!isValidBeaconNumber(propre)) {
      setErreur(t("home.errors.incomplete"));
      return;
    }

    setErreur(null);
    setEnCours(true);

    const reponse = await searchBeacon({
      data: { number: propre },
    }).catch(() => null);

    setEnCours(false);

    if (reponse?.status === "rate_limited") {
      setErreur(
        reponse.message ??
          t("home.errors.rateLimited"),
      );
      return;
    }

    if (reponse?.status === "not_found") {
      setErreur(t("home.errors.notFound"));
      return;
    }

    navigate({
      to: "/a/$number",
      params: { number: propre },
    });
  };

  const gererScanQr = (contenu: string) => {
    setScannerOpen(false);

    const match = contenu.match(
      /GN-[A-Z]{3}-\d{6}/i,
    );

    if (match) {
      const valeur = match[0].toUpperCase();

      setNumero(valeur);
      void rechercher(valeur);
    } else {
      toast.error(
        "QR non reconnu — format attendu : GN-CKY-XXXXXX",
      );
    }
  };

  const demarrerVoix = () => {
    if (!hasSpeechRecognition()) {
      toast.error(
        "Reconnaissance vocale non supportée",
      );
      return;
    }

    const SR: any =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;

    const reco = new SR();

    reco.lang = "fr-FR";
    reco.interimResults = false;
    reco.maxAlternatives = 1;
    reco.continuous = false;

    reco.onstart = () => {
      setEcoute(true);

      try {
        navigator.vibrate?.(30);
      } catch {}
    };

    reco.onresult = (e: any) => {
      const brut = String(
        e.results[0][0].transcript || "",
      ).toUpperCase();

      const nettoye = brut
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9]/g, "");

      const match =
        nettoye.match(/GN[A-Z]{3}\d{6}/) ||
        nettoye.match(/\d{6}/);

      if (match) {
        const raw = match[0];

        const nombre =
          raw.length === 6
            ? `GN-CKY-${raw}`
            : `${raw.slice(0, 2)}-${raw.slice(
                2,
                5,
              )}-${raw.slice(5)}`;

        setNumero(nombre);
        void rechercher(nombre);
      } else {
        toast.error(
          `Non compris : "${brut}"`,
        );
      }
    };

    reco.onerror = (e: any) => {
      setEcoute(false);

      if (e.error === "not-allowed") {
        toast.error(
          "Autorisation micro refusée",
        );
      } else if (e.error !== "aborted") {
        toast.error(
          `Erreur voix : ${e.error}`,
        );
      }
    };

    reco.onend = () =>
      setEcoute(false);

    recognitionRef.current = reco;
    reco.start();
  };

  const arreterVoix = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}

    setEcoute(false);
  };

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort();
      } catch {}
    },
    [],
  );

  return (
    <div className="bg-white">
      {/* =====================================================
          HERO
          NE PAS MODIFIER
          ===================================================== */}

      <section className="relative overflow-hidden gradient-signature-soft">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative mx-auto w-full max-w-5xl px-5 pb-8 pt-6 sm:px-6 md:pb-16 md:pt-12 lg:px-8">
          <h1
            className="text-display whitespace-nowrap text-center font-extrabold leading-[1.05] text-white"
            style={{
              textShadow:
                "0 2px 20px rgb(15 23 42 / 0.25)",
              fontSize:
                "clamp(0.95rem, 4.7vw, 3.75rem)",
            }}
          >
            Votre adresse, enfin facile à trouver.
          </h1>

          <p className="mx-auto mt-4 max-w-md text-center text-base leading-relaxed text-white/90 md:mt-6 md:max-w-none md:whitespace-nowrap md:text-xl">
            Un numéro unique par lieu. Fini les
            explications, les repères et les appels
            perdus.
          </p>

          <div className="mt-8 rounded-3xl bg-white/95 p-2.5 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] ring-1 ring-white/50 backdrop-blur-xl md:mt-12">
            <form
              className="flex flex-col gap-2 md:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void rechercher(numero);
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl border border-transparent bg-slate-50/80 pl-4 pr-1.5 transition-all focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/20">
                <input
                  value={numero}
                  onChange={(e) => {
                    setNumero(
                      e.target.value,
                    );
                    setErreur(null);
                  }}
                  placeholder="GN-CKY-______"
                  aria-label={t(
                    "home.hero.inputLabel",
                  )}
                  aria-invalid={!!erreur}
                  className="h-14 w-full min-w-0 bg-transparent font-mono text-lg font-semibold tracking-[0.08em] text-slate-900 outline-hidden placeholder:font-normal placeholder:text-slate-400 sm:text-xl"
                />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={
                        ecoute
                          ? arreterVoix
                          : demarrerVoix
                      }
                      aria-label={
                        ecoute
                          ? "Arrêter"
                          : "Dicter"
                      }
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all active:scale-90",
                        ecoute
                          ? "animate-pulse bg-rose-500 text-white shadow-md shadow-rose-500/40"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                      )}
                    >
                      {ecoute ? (
                        <MicOff className="size-5" />
                      ) : (
                        <Mic className="size-5" />
                      )}
                    </button>
                  </TooltipTrigger>

                  <TooltipContent>
                    {ecoute
                      ? "En écoute…"
                      : "Dicter"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() =>
                        setScannerOpen(
                          true,
                        )
                      }
                      aria-label="Scanner un QR"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800 active:scale-90"
                    >
                      <QrCode className="size-5" />
                    </button>
                  </TooltipTrigger>

                  <TooltipContent>
                    Scanner un QR
                  </TooltipContent>
                </Tooltip>
              </div>

              <Button
                type="submit"
                disabled={enCours}
                className="h-14 w-full rounded-2xl bg-gradient-to-r from-accent to-accent-dark px-8 text-base font-semibold text-accent-foreground shadow-lg shadow-accent/25 transition-all hover:shadow-accent/40 active:scale-[0.98] md:w-auto md:min-w-[160px]"
              >
                <Search className="size-5" />

                {enCours
                  ? "Recherche…"
                  : "Localiser"}
              </Button>
            </form>

            {erreur && (
              <p
                role="alert"
                className="mt-3 px-2 text-sm text-destructive"
              >
                {erreur}
              </p>
            )}
          </div>

          <div className="scrollbar-hide mt-5 flex flex-nowrap items-center justify-center gap-1.5 overflow-x-auto px-1 md:mt-6">
            {EXEMPLES.map(
              (exemple) => (
                <Link
                  key={exemple}
                  to="/a/$number"
                  params={{
                    number:
                      exemple,
                  }}
                  className="shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/75 backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/15 hover:text-white active:scale-95 sm:text-xs"
                >
                  {exemple}
                </Link>
              ),
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          COMMENT ÇA MARCHE
          ===================================================== */}

      <section
        id="comment-ca-marche"
        className="relative overflow-hidden bg-white px-5 pb-14 pt-10 sm:px-6 md:px-8 md:pb-16 md:pt-14 lg:pb-16 lg:pt-14"
      >
        {/* Motif discret */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(15 23 42) 1px, transparent 0)",
            backgroundSize:
              "34px 34px",
          }}
        />

        {/* Halos */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-48 top-24 h-[500px] w-[500px] rounded-full bg-cyan-100/30 blur-[130px]"
        />

        <div
          aria-hidden
          className="pointer-events-none absolute -left-48 bottom-20 h-[430px] w-[430px] rounded-full bg-blue-100/25 blur-[130px]"
        />

        <div className="relative mx-auto max-w-6xl">
          {/* =============================
              EN-TÊTE
              ============================= */}

          <Reveal>
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                <Sparkles className="size-3.5 text-accent" />
                Comment ça marche
              </span>
            </div>

            <h2 className="text-display mx-auto mt-5 text-center text-3xl font-bold tracking-tight text-slate-950 md:text-[2.5rem] lg:whitespace-nowrap lg:text-[2.8rem] lg:leading-[1.08]">
              Un numéro. Une destination.{" "}
              <span className="bg-gradient-to-r from-accent via-sky-500 to-blue-600 bg-clip-text text-transparent">
                Aucun détour.
              </span>
            </h2>

            {/* PHRASE SUR UNE LIGNE DESKTOP */}
            <p className="mx-auto mt-4 text-center text-sm leading-6 text-slate-600 md:max-w-none md:whitespace-nowrap md:text-base">
              Adresse GN transforme chaque lieu en une adresse simple à identifier, partager et rejoindre.
            </p>

            {/* Micro bénéfices */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {[
                "Numéro unique",
                "QR Code",
                "Localisation GPS",
                "Google Maps & Waze",
              ].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur"
                >
                  <Check className="size-3 text-accent" />
                  {item}
                </span>
              ))}
            </div>
          </Reveal>

          {/* =================================================
              ÉTAPES + DÉMONSTRATION
              ================================================= */}

          <div className="mt-9 grid gap-9 lg:mt-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-12 xl:gap-16">
            {/* ===========================
                ÉTAPES
                =========================== */}

            <div>
              <ol className="space-y-3">
                {ETAPES.map(
                  (etape, index) => (
                    <Reveal
                      key={etape.numero}
                      delay={
                        index * 80
                      }
                    >
                      <li className="group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.035)] transition-all duration-300 hover:-translate-y-1 hover:border-accent/20 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                        <div
                          aria-hidden
                          className="absolute -right-14 -top-14 size-28 rounded-full bg-accent/0 blur-2xl transition-colors group-hover:bg-accent/[0.08]"
                        />

                        <div className="relative flex gap-4">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-slate-950 text-white shadow-lg shadow-slate-950/10 transition-transform duration-300 group-hover:scale-105">
                            <etape.icone className="size-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-mono text-[9px] font-bold tracking-[0.16em] text-accent">
                                ÉTAPE{" "}
                                {
                                  etape.numero
                                }
                              </span>

                              <span className="h-px flex-1 bg-slate-100" />
                            </div>

                            <h3 className="text-display text-base font-bold tracking-tight text-slate-950 md:text-lg">
                              {
                                etape.titre
                              }
                            </h3>

                            <p className="mt-1.5 text-[13px] leading-[1.6] text-slate-600 md:text-sm">
                              {
                                etape.texte
                              }
                            </p>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {etape.tags.map(
                                (
                                  tag,
                                ) => (
                                  <span
                                    key={
                                      tag
                                    }
                                    className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200/70"
                                  >
                                    <Check className="size-2.5 text-accent" />
                                    {
                                      tag
                                    }
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    </Reveal>
                  ),
                )}
              </ol>

              {/* CTA */}
              <Reveal delay={280}>
                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                  <Button
                    asChild
                    className="group h-11 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-5 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5 hover:shadow-accent/30"
                  >
                    <Link
                      to="/a/$number"
                      params={{
                        number:
                          EXEMPLE_DEMO,
                      }}
                    >
                      Voir un exemple
                      <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    className="h-11 rounded-xl border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  >
                    <Link to="/commander">
                      Créer mon Adresse GN
                    </Link>
                  </Button>
                </div>
              </Reveal>
            </div>

            {/* =================================================
                GOOGLE MAPS — ITINÉRAIRE RÉEL
                ================================================= */}

            <Reveal
              delay={150}
              className="relative"
            >
              <div className="relative mx-auto flex max-w-[470px] flex-col items-center">
                {/* Halo */}
                <div
                  aria-hidden
                  className="absolute left-1/2 top-1/2 h-[470px] w-[470px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-accent/20 via-cyan-100/35 to-blue-100/25 blur-[80px]"
                />

                {/* Label */}
                <div className="relative z-10 mb-3 inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-700 shadow-md">
                  <Navigation2 className="size-3.5 text-accent" />
                  Itinéraire réel
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  Google Maps
                </div>

                {/* =============================
                    TÉLÉPHONE
                    ============================= */}

                <div className="relative z-[2] aspect-[9/19] w-[315px] rotate-[-1deg] overflow-hidden rounded-[2.9rem] border-[9px] border-slate-950 bg-white shadow-[0_45px_95px_-28px_rgba(15,23,42,0.58)] transition-all duration-500 hover:rotate-0 hover:scale-[1.012] md:w-[340px] xl:w-[355px]">
                  {/* Notch */}
                  <div
                    aria-hidden
                    className="absolute left-1/2 top-1 z-30 h-4 w-16 -translate-x-1/2 rounded-full bg-slate-950"
                  />

                  <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="relative z-20 gradient-signature-soft px-4 pb-3 pt-7">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white">
                          ADRESSE GN
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[7px] font-medium text-white backdrop-blur">
                          <Navigation2 className="size-2.5" />
                          Navigation
                        </span>
                      </div>
                    </div>

                    {/* =========================================
                        VRAIE CARTE GOOGLE MAPS
                        ========================================= */}

                    <div className="relative flex-1 overflow-hidden bg-slate-100">
                      {GOOGLE_MAPS_EMBED_URL ? (
                        <iframe
                          title="Itinéraire Google Maps de démonstration"
                          src={
                            GOOGLE_MAPS_EMBED_URL
                          }
                          className="absolute inset-0 h-full w-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          allowFullScreen
                        />
                      ) : (
                        /* =================================================
                           FALLBACK VISUEL SI LA CLÉ GOOGLE N'EST PAS ENCORE
                           CONFIGURÉE. LA PAGE NE CASSE PAS.
                           ================================================= */
                        <div className="absolute inset-0 overflow-hidden bg-[#edf2f4]">
                          {/* fond carte */}
                          <div
                            aria-hidden
                            className="absolute inset-0 opacity-50"
                            style={{
                              backgroundImage:
                                "linear-gradient(rgb(203 213 225 / 0.55) 1px, transparent 1px), linear-gradient(90deg, rgb(203 213 225 / 0.55) 1px, transparent 1px)",
                              backgroundSize:
                                "26px 26px",
                            }}
                          />

                          {/* routes */}
                          <div className="absolute -left-10 right-[-10%] top-[25%] h-3 rotate-[-7deg] rounded-full bg-white shadow-sm" />
                          <div className="absolute -bottom-10 left-[31%] top-[-5%] w-3 rotate-[10deg] rounded-full bg-white shadow-sm" />
                          <div className="absolute -left-8 right-[-10%] top-[68%] h-2 rotate-[11deg] rounded-full bg-white/90" />

                          {/* itinéraire fallback */}
                          <svg
                            viewBox="0 0 300 420"
                            className="absolute inset-0 h-full w-full"
                            aria-hidden
                          >
                            <path
                              d="M74 360 C86 330 110 317 113 284 C117 247 93 221 108 185 C124 147 164 158 181 128 C195 103 198 81 220 61"
                              fill="none"
                              stroke="white"
                              strokeWidth="11"
                              strokeLinecap="round"
                            />

                            <path
                              d="M74 360 C86 330 110 317 113 284 C117 247 93 221 108 185 C124 147 164 158 181 128 C195 103 198 81 220 61"
                              fill="none"
                              stroke="rgb(13 148 136)"
                              strokeWidth="6"
                              strokeLinecap="round"
                            />
                          </svg>

                          {/* départ */}
                          <div className="absolute bottom-[12%] left-[19%]">
                            <span className="flex size-6 items-center justify-center rounded-full border-[3px] border-white bg-blue-600 shadow-xl">
                              <span className="size-2 rounded-full bg-white" />
                            </span>
                          </div>

                          {/* destination */}
                          <div className="absolute right-[19%] top-[10%]">
                            <div className="flex size-11 items-center justify-center rounded-full bg-white shadow-xl">
                              <MapPin className="size-7 fill-accent/15 text-accent" />
                            </div>
                          </div>

                          {/* information */}
                          <div className="absolute left-3 top-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
                            <p className="text-[9px] font-bold text-slate-900">
                              Aperçu de navigation
                            </p>
                            <p className="mt-0.5 text-[7px] text-slate-500">
                              Google Maps
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Badge overlay */}
                      <div className="pointer-events-none absolute left-3 top-3 z-10">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-2.5 py-1 text-[8px] font-semibold text-slate-700 shadow-md backdrop-blur">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Itinéraire
                        </span>
                      </div>
                    </div>

                    {/* =========================================
                        DESTINATION
                        ========================================= */}

                    <div className="relative z-20 border-t border-slate-100 bg-white p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-950">
                            Hôtel Kaloum
                          </p>

                          <p className="mt-0.5 font-mono text-[10px] font-bold tracking-[0.04em] text-accent">
                            GN-CKY-582741
                          </p>

                          <p className="mt-0.5 text-[9px] text-slate-500">
                            Kaloum · Conakry
                          </p>
                        </div>

                        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                          <MapPin className="size-4" />
                        </div>
                      </div>

                      {/* =====================================
                          VRAIS LIENS DE NAVIGATION
                          ===================================== */}

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <a
                          href={
                            GOOGLE_MAPS_ROUTE_URL
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="group flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-2 text-[9px] font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
                        >
                          <Navigation2 className="size-3.5" />
                          Google Maps
                          <ExternalLink className="size-2.5 opacity-70" />
                        </a>

                        <a
                          href={
                            WAZE_ROUTE_URL
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="group flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-[9px] font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:text-accent hover:shadow-md"
                        >
                          <Navigation2 className="size-3.5" />
                          Waze
                          <ExternalLink className="size-2.5 opacity-60" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* =========================================
                    CALLOUTS
                    ========================================= */}

                <div className="pointer-events-none absolute -left-2 top-[27%] z-10 hidden rotate-[-4deg] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl md:block xl:-left-8">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-accent/10">
                      <Share2 className="size-3.5 text-accent" />
                    </div>

                    <div>
                      <p className="text-[9px] font-bold text-slate-900">
                        Adresse partagée
                      </p>

                      <p className="text-[8px] text-slate-500">
                        Numéro ou QR Code
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none absolute -right-2 top-[39%] z-10 hidden rotate-[4deg] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl md:block xl:-right-8">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100">
                      <Check className="size-3.5 text-emerald-600" />
                    </div>

                    <div>
                      <p className="text-[9px] font-bold text-slate-900">
                        Destination trouvée
                      </p>

                      <p className="text-[8px] text-slate-500">
                        Navigation disponible
                      </p>
                    </div>
                  </div>
                </div>

                {/* Légende */}
                <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-medium text-slate-600 shadow-sm">
                    <Check className="size-3 text-emerald-600" />
                    Google Maps
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-medium text-slate-600 shadow-sm">
                    <Check className="size-3 text-emerald-600" />
                    Waze
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-medium text-slate-600 shadow-sm">
                    <Check className="size-3 text-emerald-600" />
                    Navigation en 1 clic
                  </span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* =================================================
              AVANT / APRÈS
              ================================================= */}

          <Reveal delay={100}>
            <div className="mt-12 md:mt-14">
              <div className="mx-auto mb-7 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  LA DIFFÉRENCE ADRESSE GN
                </p>

                <h3 className="text-display mt-2.5 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                  Avant, on expliquait.{" "}
                  <span className="text-accent">
                    Maintenant, on partage.
                  </span>
                </h3>

                {/* PHRASE SUR UNE SEULE LIGNE DESKTOP */}
                <p className="mx-auto mt-2.5 text-sm leading-6 text-slate-600 md:max-w-none md:whitespace-nowrap">
                  Un numéro Adresse GN remplace les longues indications et simplifie l’arrivée à destination.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* ======================
                    SANS ADRESSE GN
                    ====================== */}

                <div className="relative overflow-hidden rounded-[26px] border border-rose-100 bg-gradient-to-br from-rose-50/55 via-white to-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-rose-600 shadow-sm">
                    <X className="size-3.5" />
                    Sans Adresse GN
                  </div>

                  <p className="text-base font-semibold leading-snug text-slate-900 md:text-lg">
                    « Après la station, tournez à droite puis demandez le restaurant… »
                  </p>

                  <div className="mt-5 space-y-2.5">
                    {[
                      "Des indications longues à transmettre",
                      "Des appels répétés pour guider",
                      "Une destination plus difficile à trouver",
                    ].map(
                      (item) => (
                        <div
                          key={
                            item
                          }
                          className="flex items-start gap-2.5"
                        >
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100">
                            <X className="size-3 text-rose-500" />
                          </span>

                          <span className="text-[13px] leading-5 text-slate-600">
                            {
                              item
                            }
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* ======================
                    AVEC ADRESSE GN
                    ====================== */}

                <div className="relative overflow-hidden rounded-[26px] border border-accent/25 bg-gradient-to-br from-accent/[0.11] via-white to-cyan-50 p-6 shadow-[0_20px_55px_-30px_rgba(13,148,136,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_65px_-30px_rgba(13,148,136,0.55)]">
                  <div
                    aria-hidden
                    className="absolute -right-14 -top-14 size-44 rounded-full bg-accent/15 blur-3xl"
                  />

                  <div className="relative mb-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white shadow-sm">
                    <Check className="size-3.5 text-accent" />
                    Avec Adresse GN
                  </div>

                  <div className="relative">
                    <p className="font-mono text-xl font-extrabold tracking-[0.06em] text-slate-950 md:text-2xl">
                      GN-CKY-582741
                    </p>

                    <p className="mt-1.5 text-[13px] text-slate-500">
                      Une référence unique pour identifier et retrouver le lieu.
                    </p>

                    <div className="mt-5 space-y-2.5">
                      {[
                        "Un numéro unique facile à partager",
                        "Un QR Code ou un lien accessible instantanément",
                        "Un itinéraire Google Maps ou Waze prêt à être lancé",
                      ].map(
                        (item) => (
                          <div
                            key={
                              item
                            }
                            className="flex items-start gap-2.5"
                          >
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10">
                              <Check className="size-3 text-accent" />
                            </span>

                            <span className="text-[13px] font-medium leading-5 text-slate-700">
                              {
                                item
                              }
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* =================================================
              BÉNÉFICES
              ================================================= */}

          <Reveal delay={140}>
            <div className="mt-7 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50/60 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
              <div className="grid grid-cols-1 divide-y divide-slate-200/70 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
                {AVANTAGES.map(
                  (
                    avantage,
                  ) => (
                    <div
                      key={
                        avantage.titre
                      }
                      className="group flex min-h-[88px] items-center gap-3 bg-white/55 p-4 transition-all hover:bg-white md:p-5"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-md shadow-accent/15 transition-transform group-hover:scale-105">
                        <avantage.icone className="size-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-950 md:text-sm">
                          {
                            avantage.titre
                          }
                        </p>

                        <p className="mt-0.5 text-[11px] leading-4 text-slate-600">
                          {
                            avantage.texte
                          }
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* =====================================================
          USAGES
          ===================================================== */}

      <section
        id="usages"
        className="bg-slate-50 px-6 py-14 md:px-8 md:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <Eyebrow>
              {t(
                "home.usages.eyebrow",
              )}
            </Eyebrow>

            <h2 className="text-display mt-3 text-center text-2xl font-bold tracking-tight text-slate-900 md:mt-4 md:text-4xl">
              {t(
                "home.usages.title",
              )}
            </h2>
          </Reveal>

          <div className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
            {USAGES.map(
              (
                item,
                index,
              ) => (
                <Reveal
                  key={
                    item.cle
                  }
                  delay={
                    index *
                    80
                  }
                >
                  <div className="group h-full rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-transparent hover:shadow-xl md:p-7">
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md transition-transform group-hover:scale-110",
                        item.grad,
                      )}
                    >
                      <item.icone className="size-5" />
                    </span>

                    <h3 className="text-display mt-4 text-base font-bold text-slate-900 md:text-lg">
                      {t(
                        `home.usages.${item.cle}.title`,
                      )}
                    </h3>

                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                      {t(
                        `home.usages.${item.cle}.text`,
                      )}
                    </p>
                  </div>
                </Reveal>
              ),
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          CTA FINAL
          ===================================================== */}

      <section className="bg-white px-4 py-14 md:px-8 md:py-20">
        <Reveal className="mx-auto max-w-5xl">
          <div className="grid overflow-hidden rounded-3xl border border-slate-200 shadow-xl lg:grid-cols-5">
            <div className="gradient-signature-soft p-8 md:p-14 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                {t(
                  "home.cta.eyebrow",
                )}
              </p>

              <h2 className="text-display mt-3 text-2xl font-bold tracking-tight text-white md:mt-4 md:text-3xl">
                {t(
                  "home.cta.title",
                )}
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-white/85 md:mt-4 md:text-base">
                {t(
                  "home.cta.text",
                )}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
                <Button
                  asChild
                  className="h-12 bg-white px-8 text-base font-medium text-slate-900 hover:bg-white/90"
                >
                  <Link to="/tarifs">
                    {t(
                      "home.cta.pricing",
                    )}
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="h-12 border-white/40 bg-transparent px-8 text-base font-medium text-white hover:bg-white/10 hover:text-white"
                >
                  <Link to="/a-propos">
                    {t(
                      "home.cta.contact",
                    )}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex flex-col justify-center bg-white p-6 md:p-10 lg:col-span-2">
              <div className="flex items-center gap-4 rounded-xl bg-slate-100 p-4 md:p-6">
                <span className="min-w-0 flex-1 font-mono text-sm font-bold tracking-tight text-slate-900 sm:text-lg md:text-base">
                  GN-CKY-582741
                </span>

                <svg
                  viewBox="0 0 21 21"
                  aria-hidden
                  className="size-10 shrink-0 text-slate-900 md:size-12"
                  fill="currentColor"
                >
                  <path d="M0 0h7v7H0V0zm2 2v3h3V2H2zM14 0h7v7h-7V0zm2 2v3h3V2h-3zM0 14h7v7H0v-7zm2 2v3h3v-3H2z" />

                  <path d="M9 0h2v2H9V0zM9 3h2v2H9V3zM12 9h2v2h-2V9zM9 9h2v2H9V9zM9 12h2v2H9v-2zM12 12h2v2h-2v-2zM16 9h2v2h-2V9zM19 9h2v2h-2V9zM16 12h2v2h-2v-2zM19 14h2v2h-2v-2zM16 16h2v2h-2v-2zM12 16h2v2h-2v-2zM9 19h2v2H9v-2zM12 19h2v2h-2v-2zM16 19h2v2h-2v-2zM19 19h2v2h-2v-2zM0 9h2v2H0V9zM3 9h2v2H3V9zM6 9h2v2H6V9zM3 12h2v2H3v-2z" />
                </svg>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                {t(
                  "home.cta.plate",
                )}
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <InstallBanner variant="bottom" />

      <QrScanner
        open={scannerOpen}
        onClose={() =>
          setScannerOpen(
            false,
          )
        }
        onDetected={
          gererScanQr
        }
        title="Scanner un QR d'adresse"
      />
    </div>
  );
}
