import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bike, Building2, Check, Home as HomeIcon, MapPin, Mic, MicOff,
  QrCode, Search, UtensilsCrossed, ArrowRight, Navigation2,
} from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDefaultZone, isValidBeaconNumber, normalizeBeaconNumber } from "@/lib/geo";
import { searchBeacon } from "@/lib/search.functions";
import { InstallBanner } from "@/components/InstallBanner";
import { QrScanner } from "@/components/QrScanner";
import { cn } from "@/lib/utils";

const EXEMPLES = ["GN-CKY-582741", "GN-CKY-152963", "GN-CKY-759482"];
const USAGES = [
  { icone: HomeIcon, cle: "individuals", grad: "from-emerald-500 to-teal-600" },
  { icone: UtensilsCrossed, cle: "shops", grad: "from-orange-500 to-rose-600" },
  { icone: Bike, cle: "delivery", grad: "from-violet-500 to-fuchsia-600" },
  { icone: Building2, cle: "companies", grad: "from-sky-500 to-blue-600" },
];

// 3 étapes du "comment ça marche"
const ETAPES = [
  {
    numero: "01",
    icone: QrCode,
    grad: "from-emerald-500 to-teal-600",
    titre: "Obtenez votre numéro",
    texte:
      "Une adresse déjà créée ? Notez son numéro (ex. GN-CKY-582741) ou son QR code. Sinon, un agent Adresse GN vient la créer sur place.",
  },
  {
    numero: "02",
    icone: Search,
    grad: "from-sky-500 to-blue-600",
    titre: "Saisissez ou scannez",
    texte:
      "Tapez le numéro sur adresse.gn ou pointez votre caméra sur le QR code. Fonctionne sur téléphone, tablette et ordinateur.",
  },
  {
    numero: "03",
    icone: Navigation2,
    grad: "from-violet-500 to-fuchsia-600",
    titre: "L'itinéraire s'ouvre",
    texte:
      "Un clic et Google Maps, Waze ou Apple Plans lance la navigation vers le point exact. Aucune installation supplémentaire.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADRESSE GN — Votre adresse, enfin facile à trouver" },
      { name: "description", content: "Un numéro unique par lieu. Fini les explications, les repères et les appels perdus. Trouvez ou partagez n'importe quelle adresse en Guinée en un numéro." },
      { property: "og:title", content: "ADRESSE GN — Votre adresse, enfin facile à trouver" },
      { property: "og:description", content: "Un numéro unique par lieu. Fini les explications, les repères et les appels perdus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://place-id-finder.lovable.app/" },
      { property: "og:image", content: "https://place-id-finder.lovable.app/og-cover.jpg" },
      { name: "twitter:image", content: "https://place-id-finder.lovable.app/og-cover.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://place-id-finder.lovable.app/" }],
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
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
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
    const propre = normalizeBeaconNumber(valeur, getDefaultZone());
    if (!propre) return;
    if (!isValidBeaconNumber(propre)) { setErreur(t("home.errors.incomplete")); return; }
    setErreur(null); setEnCours(true);
    const reponse = await searchBeacon({ data: { number: propre } }).catch(() => null);
    setEnCours(false);
    if (reponse?.status === "rate_limited") { setErreur(reponse.message ?? t("home.errors.rateLimited")); return; }
    if (reponse?.status === "not_found") { setErreur(t("home.errors.notFound")); return; }
    navigate({ to: "/a/$number", params: { number: propre } });
  };

  const gererScanQr = (contenu: string) => {
    setScannerOpen(false);
    const match = contenu.match(/GN-[A-Z]{3}-\d{6}/i);
    if (match) { setNumero(match[0].toUpperCase()); void rechercher(match[0].toUpperCase()); }
    else toast.error("QR non reconnu — format attendu : GN-CKY-XXXXXX");
  };

  const demarrerVoix = () => {
    if (!hasSpeechRecognition()) { toast.error("Reconnaissance vocale non supportée"); return; }
    const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const reco = new SR();
    reco.lang = "fr-FR"; reco.interimResults = false; reco.maxAlternatives = 1; reco.continuous = false;
    reco.onstart = () => { setEcoute(true); try { navigator.vibrate?.(30); } catch {} };
    reco.onresult = (e: any) => {
      const brut = String(e.results[0][0].transcript || "").toUpperCase();
      const nettoye = brut.replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
      const match = nettoye.match(/GN[A-Z]{3}\d{6}/) || nettoye.match(/\d{6}/);
      if (match) {
        const raw = match[0];
        const nombre = raw.length === 6 ? `GN-CKY-${raw}` : `${raw.slice(0, 2)}-${raw.slice(2, 5)}-${raw.slice(5)}`;
        setNumero(nombre); void rechercher(nombre);
      } else toast.error(`Non compris : "${brut}"`);
    };
    reco.onerror = (e: any) => {
      setEcoute(false);
      if (e.error === "not-allowed") toast.error("Autorisation micro refusée");
      else if (e.error !== "aborted") toast.error(`Erreur voix : ${e.error}`);
    };
    reco.onend = () => setEcoute(false);
    recognitionRef.current = reco; reco.start();
  };

  const arreterVoix = () => { try { recognitionRef.current?.stop(); } catch {} setEcoute(false); };

  useEffect(() => () => { try { recognitionRef.current?.abort(); } catch {} }, []);

  return (
    <div className="bg-white">
      {/* ==================== HÉROS ==================== */}
      <section className="relative overflow-hidden gradient-signature-soft">
        <div aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative mx-auto w-full max-w-5xl px-5 pt-6 pb-8 sm:px-6 md:pt-12 md:pb-16 lg:px-8">
          <h1
            className="text-display text-center font-extrabold leading-[1.05] text-white whitespace-nowrap"
            style={{ textShadow: "0 2px 20px rgb(15 23 42 / 0.25)", fontSize: "clamp(0.95rem, 4.7vw, 3.75rem)" }}
          >
            Votre adresse, enfin facile à trouver.
          </h1>
          <p className="mx-auto mt-4 md:mt-6 max-w-md md:max-w-none text-center text-base md:text-xl leading-relaxed text-white/90 md:whitespace-nowrap">
            Un numéro unique par lieu. Fini les explications, les repères et les appels perdus.
          </p>
          <div className="mt-8 md:mt-12 rounded-3xl bg-white/95 backdrop-blur-xl p-2.5 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] ring-1 ring-white/50">
            <form className="flex flex-col gap-2 md:flex-row md:gap-2" onSubmit={(e) => { e.preventDefault(); void rechercher(numero); }}>
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl bg-slate-50/80 pl-4 pr-1.5 border border-transparent focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/20 transition-all">
                <input
                  value={numero}
                  onChange={(e) => { setNumero(e.target.value); setErreur(null); }}
                  placeholder="GN-CKY-______"
                  aria-label={t("home.hero.inputLabel")}
                  aria-invalid={!!erreur}
                  className="h-14 w-full min-w-0 bg-transparent font-mono text-lg font-semibold tracking-[0.08em] text-slate-900 outline-hidden placeholder:font-normal placeholder:text-slate-400 sm:text-xl"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={ecoute ? arreterVoix : demarrerVoix}
                      aria-label={ecoute ? "Arrêter" : "Dicter"}
                      className={cn(
                        "shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-all active:scale-90",
                        ecoute
                          ? "bg-rose-500 text-white shadow-md shadow-rose-500/40 animate-pulse"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      )}
                    >
                      {ecoute ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{ecoute ? "En écoute…" : "Dicter"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      aria-label="Scanner un QR"
                      className="shrink-0 h-11 w-11 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center transition-all active:scale-90"
                    >
                      <QrCode className="size-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Scanner un QR</TooltipContent>
                </Tooltip>
              </div>
              <Button
                type="submit"
                disabled={enCours}
                className="h-14 w-full rounded-2xl bg-gradient-to-r from-accent to-accent-dark px-8 text-base font-semibold text-accent-foreground shadow-lg shadow-accent/25 transition-all hover:shadow-accent/40 active:scale-[0.98] md:w-auto md:min-w-[160px]"
              >
                <Search className="size-5" />
                {enCours ? "Recherche…" : "Localiser"}
              </Button>
            </form>
            {erreur && <p role="alert" className="mt-3 px-2 text-sm text-destructive">{erreur}</p>}
          </div>
          <div className="mt-5 md:mt-6 flex flex-nowrap items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide px-1">
            {EXEMPLES.map((exemple) => (
              <Link
                key={exemple}
                to="/a/$number"
                params={{ number: exemple }}
                className="shrink-0 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 font-mono text-[10px] sm:text-xs text-white/75 backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/15 hover:text-white active:scale-95 whitespace-nowrap"
              >
                {exemple}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== COMMENT ÇA MARCHE ==================== */}
      <section id="comment-ca-marche" className="bg-white px-6 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <Eyebrow>Comment ça marche</Eyebrow>
            <h2 className="text-display mt-3 md:mt-4 text-center text-2xl md:text-4xl font-bold tracking-tight text-slate-900">
              En 3 étapes, du numéro à l'itinéraire.
            </h2>
            <p className="mx-auto mt-3 md:mt-4 max-w-2xl text-center text-base md:text-lg leading-relaxed text-slate-600">
              Pas d'installation, pas de compte obligatoire. Un numéro suffit pour lancer la navigation.
            </p>
          </Reveal>

          <div className="mt-10 md:mt-14 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            {/* ÉTAPES */}
            <ol className="relative space-y-5 md:space-y-6">
              {/* Ligne verticale de connexion (desktop) */}
              <div aria-hidden className="absolute left-[27px] top-8 bottom-8 w-px bg-gradient-to-b from-emerald-300 via-sky-300 to-fuchsia-300 hidden md:block" />
              {ETAPES.map((etape, index) => (
                <Reveal key={etape.numero} delay={index * 100}>
                  <li className="group relative flex gap-4 md:gap-6 rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-transparent">
                    {/* Badge numéroté + icône */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={cn(
                          "flex size-14 items-center justify-center rounded-2xl text-white shadow-lg bg-gradient-to-br transition-transform group-hover:scale-110",
                          etape.grad,
                        )}
                      >
                        <etape.icone className="size-6" />
                      </div>
                      <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white shadow-md ring-2 ring-white">
                        {etape.numero}
                      </span>
                    </div>
                    {/* Contenu */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-display text-lg md:text-xl font-bold text-slate-900">
                        {etape.titre}
                      </h3>
                      <p className="mt-1.5 text-sm md:text-base leading-relaxed text-slate-600">
                        {etape.texte}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}

              {/* CTA sous les étapes */}
              <Reveal delay={350}>
                <div className="mt-2 flex flex-wrap gap-3 pl-0 md:pl-[86px]">
                  <Button asChild className="h-12 bg-gradient-to-r from-accent to-accent-dark px-6 text-base font-semibold text-accent-foreground shadow-lg shadow-accent/25 hover:shadow-accent/40 group">
                    <Link to="/a/$number" params={{ number: "GN-CKY-582741" }}>
                      Voir un exemple réel
                      <ArrowRight className="size-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 border-slate-300 bg-white px-6 text-base font-medium text-slate-700 hover:bg-slate-50">
                    <Link to="/commander">Créer mon Adresse GN</Link>
                  </Button>
                </div>
              </Reveal>
            </ol>

            {/* MOCKUP RÉSULTAT */}
            <Reveal delay={200} className="relative order-first lg:order-last">
              <div aria-hidden className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25 blur-3xl" />
              {/* Étiquette "Résultat" au-dessus du mockup */}
              <div className="relative mx-auto flex max-w-[280px] flex-col items-center">
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-md">
                  <Check className="size-3 text-accent" />
                  Résultat sur mobile
                </span>
                <div className="aspect-9/19 w-full rotate-[-3deg] overflow-hidden rounded-[2.5rem] border-8 border-slate-900 bg-white shadow-2xl">
                  <div className="flex h-full flex-col">
                    <div className="gradient-signature-soft px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                      Adresse GN
                    </div>
                    <div className="relative flex-1 bg-slate-100">
                      {/* Pin animé */}
                      <span aria-hidden className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/30 animate-ping" />
                      <MapPin className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 text-accent drop-shadow-lg" />
                    </div>
                    <div className="space-y-3 bg-white p-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-sm font-bold text-slate-900">Restaurant Le Damier</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">GN-CKY-582741</p>
                        <p className="mt-1 text-xs text-slate-500">Kaloum · Conakry</p>
                      </div>
                      <div className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-foreground flex items-center justify-center gap-1.5">
                        <Navigation2 className="size-4" />
                        S'y rendre
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ==================== USAGES ==================== */}
      <section id="usages" className="bg-slate-50 px-6 py-14 md:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <Eyebrow>{t("home.usages.eyebrow")}</Eyebrow>
            <h2 className="text-display mt-3 md:mt-4 text-center text-2xl md:text-4xl font-bold tracking-tight text-slate-900">
              {t("home.usages.title")}
            </h2>
          </Reveal>
          <div className="mt-8 md:mt-12 grid grid-cols-1 gap-3 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
            {USAGES.map((item, index) => (
              <Reveal key={item.cle} delay={index * 80}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-white p-5 md:p-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-transparent">
                  <span className={cn("flex size-11 md:size-14 items-center justify-center rounded-2xl text-white shadow-md bg-gradient-to-br group-hover:scale-110 transition-transform", item.grad)}>
                    <item.icone className="size-5 md:size-6" />
                  </span>
                  <h3 className="text-display mt-4 md:mt-5 text-base md:text-lg font-bold text-slate-900">
                    {t(`home.usages.${item.cle}.title`)}
                  </h3>
                  <p className="mt-1.5 md:mt-2 text-sm leading-relaxed text-slate-600">
                    {t(`home.usages.${item.cle}.text`)}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== CTA FINAL ==================== */}
      <section className="bg-white px-4 py-14 md:px-8 md:py-24">
        <Reveal className="mx-auto max-w-5xl">
          <div className="grid overflow-hidden rounded-3xl border border-slate-200 shadow-xl lg:grid-cols-5">
            <div className="gradient-signature-soft p-8 md:p-14 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{t("home.cta.eyebrow")}</p>
              <h2 className="text-display mt-3 md:mt-4 text-2xl md:text-3xl font-bold tracking-tight text-white">{t("home.cta.title")}</h2>
              <p className="mt-3 md:mt-4 text-sm md:text-base leading-relaxed text-white/85">{t("home.cta.text")}</p>
              <div className="mt-6 md:mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 bg-white px-8 text-base font-medium text-slate-900 hover:bg-white/90">
                  <Link to="/tarifs">{t("home.cta.pricing")}</Link>
                </Button>
                <Button asChild variant="outline" className="h-12 border-white/40 bg-transparent px-8 text-base font-medium text-white hover:bg-white/10 hover:text-white">
                  <Link to="/a-propos">{t("home.cta.contact")}</Link>
                </Button>
              </div>
            </div>
            <div className="flex flex-col justify-center bg-white p-6 md:p-10 lg:col-span-2">
              <div className="flex items-center gap-4 rounded-lg bg-slate-100 p-4 md:p-6">
                <span className="min-w-0 flex-1 font-mono text-sm md:text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                  GN-CKY-582741
                </span>
                <svg viewBox="0 0 21 21" aria-hidden className="size-10 md:size-12 shrink-0 text-slate-900" fill="currentColor">
                  <path d="M0 0h7v7H0V0zm2 2v3h3V2H2zM14 0h7v7h-7V0zm2 2v3h3V2h-3zM0 14h7v7H0v-7zm2 2v3h3v-3H2z" />
                  <path d="M9 0h2v2H9V0zM9 3h2v2H9V3zM12 9h2v2h-2V9zM9 9h2v2H9V9zM9 12h2v2H9v-2zM12 12h2v2h-2v-2zM16 9h2v2h-2V9zM19 9h2v2h-2V9zM16 12h2v2h-2v-2zM19 14h2v2h-2v-2zM16 16h2v2h-2v-2zM12 16h2v2h-2v-2zM9 19h2v2H9v-2zM12 19h2v2h-2v-2zM16 19h2v2h-2v-2zM19 19h2v2h-2v-2zM0 9h2v2H0V9zM3 9h2v2H3V9zM6 9h2v2H6V9zM3 12h2v2H3v-2z" />
                </svg>
              </div>
              <p className="mt-3 md:mt-4 text-xs text-slate-500">{t("home.cta.plate")}</p>
            </div>
          </div>
        </Reveal>
      </section>

      <InstallBanner variant="bottom" />
      <QrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={gererScanQr}
        title="Scanner un QR d'adresse"
      />
    </div>
  );
}
