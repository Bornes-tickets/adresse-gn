import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Bike,
  Building2,
  Check,
  Download,
  ExternalLink,
  Handshake,
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

const EXEMPLES = ["GN-CKY-582741", "GN-CKY-152963", "GN-CKY-759482"];
const EXEMPLE_DEMO = "GN-CKY-582741";
const SITE_CONTAINER =
  "mx-auto w-full max-w-[1760px] px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16";
const SECTION_BADGE_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm";
const SECTION_TITLE_CLASS =
  "text-display text-center font-bold leading-[1.08] tracking-tight text-slate-950 text-[clamp(1.8rem,2.35vw,2.75rem)]";
const SECTION_COPY_CLASS =
  "text-center text-sm leading-6 text-slate-600 md:text-[15px]";

const DEMO_ORIGIN = "Kaloum, Conakry, Guinea";
const DEMO_DESTINATION = "Hôtel Kaloum, Conakry, Guinea";
const GOOGLE_MAPS_EMBED_KEY = (
  import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY as string | undefined
)?.trim();
const GOOGLE_MAPS_EMBED_URL = GOOGLE_MAPS_EMBED_KEY
  ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(GOOGLE_MAPS_EMBED_KEY)}&origin=${encodeURIComponent(DEMO_ORIGIN)}&destination=${encodeURIComponent(DEMO_DESTINATION)}&mode=driving&language=fr&region=GN`
  : null;
const GOOGLE_MAPS_ROUTE_URL = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(DEMO_ORIGIN)}&destination=${encodeURIComponent(DEMO_DESTINATION)}&travelmode=driving`;
const WAZE_ROUTE_URL = `https://www.waze.com/ul?q=${encodeURIComponent(DEMO_DESTINATION)}&navigate=yes`;

const USAGES = [
  { icone: HomeIcon, cle: "individuals", titre: "Particuliers", accroche: "Recevez facilement chez vous.", texte: "Partagez votre Adresse GN avec vos proches, visiteurs et livreurs.", avantages: ["Partage en 1 clic", "Itinéraire direct"], grad: "from-emerald-500 to-teal-600", fond: "from-emerald-50/70 via-white to-white", bordure: "hover:border-emerald-200" },
  { icone: UtensilsCrossed, cle: "shops", titre: "Commerces", accroche: "Soyez trouvé sans explication.", texte: "Aidez vos clients à rejoindre facilement votre boutique, restaurant ou établissement.", avantages: ["Adresse partageable", "Navigation GPS"], grad: "from-orange-500 to-rose-500", fond: "from-orange-50/70 via-white to-white", bordure: "hover:border-orange-200" },
  { icone: Bike, cle: "delivery", titre: "Livraisons", accroche: "Livrez plus vite, au bon endroit.", texte: "Réduisez les appels d'orientation et le temps perdu à rechercher une destination.", avantages: ["Moins d'appels", "Destination précise"], grad: "from-violet-500 to-fuchsia-600", fond: "from-violet-50/70 via-white to-white", bordure: "hover:border-violet-200" },
  { icone: Building2, cle: "companies", titre: "Entreprises", accroche: "Centralisez vos adresses.", texte: "Identifiez vos bureaux, agences et sites dans une même solution.", avantages: ["Multi-sites", "Intégration API"], grad: "from-sky-500 to-blue-600", fond: "from-sky-50/70 via-white to-white", bordure: "hover:border-sky-200" },
];

const ETAPES = [
  { numero: "01", icone: MapPinned, titre: "Obtenez votre Adresse GN", texte: "Votre emplacement reçoit un numéro unique associé à sa localisation et à son QR Code.", tags: ["Numéro unique", "QR Code"], titreCourt: "Obtenez" },
  { numero: "02", icone: Search, titre: "Saisissez ou scannez", texte: "Entrez le numéro ou scannez le QR Code pour retrouver instantanément l'adresse.", tags: ["Sans application", "Web & mobile"], titreCourt: "Scannez" },
  { numero: "03", icone: Navigation2, titre: "Lancez votre itinéraire", texte: "Choisissez votre application de navigation et laissez-vous guider jusqu'à destination.", tags: ["Google Maps", "Waze"], titreCourt: "Naviguez" },
];

const AVANTAGES = [
  { icone: Zap, titre: "Localisation immédiate", texte: "Du numéro à la destination" },
  { icone: QrCode, titre: "QR Code intégré", texte: "Scannez pour ouvrir l'adresse" },
  { icone: Share2, titre: "Partage simplifié", texte: "Numéro, lien ou QR Code" },
  { icone: Smartphone, titre: "Accessible partout", texte: "Téléphone, tablette et ordinateur" },
];

const POINTS_CONFIANCE = [
  { icone: MapPinned, titre: "Précision GPS", texte: "Chaque Adresse GN est associée à une position géographique exploitable pour retrouver le lieu sans approximation.", badge: "Repère fiable" },
  { icone: Handshake, titre: "Accompagnement local", texte: "Des agents peuvent accompagner la création et l'installation de votre Adresse GN selon l'offre choisie.", badge: "Support terrain" },
  { icone: Smartphone, titre: "Compatible avec vos outils", texte: "Google Maps, Waze, QR Code, web et mobile : votre adresse reste simple à partager et facile à utiliser.", badge: "Utilisation immédiate" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADRESSE GN — Votre adresse, enfin facile à trouver" },
      { name: "description", content: "Un numéro unique par lieu. Fini les explications, les repères et les appels perdus. Trouvez ou partagez n'importe quelle adresse en Guinée avec Adresse GN." },
      { property: "og:title", content: "ADRESSE GN — Votre adresse, enfin facile à trouver" },
      { property: "og:description", content: "Un numéro unique par lieu. Localisez, partagez et rejoignez facilement chaque adresse." },
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
  return <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{children}</p>;
}
type DesktopInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }> };
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
  const [desktopInstallPrompt, setDesktopInstallPrompt] = useState<DesktopInstallPromptEvent | null>(null);
  const [desktopInstallVisible, setDesktopInstallVisible] = useState(false);
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
    if (match) { const valeur = match[0].toUpperCase(); setNumero(valeur); void rechercher(valeur); }
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const dismissedForSession = window.sessionStorage.getItem("adresse-gn-desktop-install-dismissed") === "1";
    if (!isDesktop || isStandalone || dismissedForSession) return;
    const showTimer = window.setTimeout(() => { setDesktopInstallVisible(true); }, 900);
    const handleBeforeInstallPrompt = (event: Event) => { event.preventDefault(); setDesktopInstallPrompt(event as DesktopInstallPromptEvent); setDesktopInstallVisible(true); };
    const handleInstalled = () => { setDesktopInstallPrompt(null); setDesktopInstallVisible(false); };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);
  const fermerInstallationDesktop = () => {
    if (typeof window !== "undefined") window.sessionStorage.setItem("adresse-gn-desktop-install-dismissed", "1");
    setDesktopInstallVisible(false);
  };
  const installerSurDesktop = async () => {
    if (!desktopInstallPrompt) { toast.info("Dans Chrome ou Edge, utilisez l'icône Installer dans la barre d'adresse, ou le menu du navigateur > Installer Adresse GN."); return; }
    await desktopInstallPrompt.prompt();
    const choix = await desktopInstallPrompt.userChoice;
    if (choix.outcome === "accepted") setDesktopInstallVisible(false);
    setDesktopInstallPrompt(null);
  };

  return (
    <div className="w-full overflow-x-hidden bg-white">
      {/* ===================================================================
          MOBILE ONLY — HERO ULTRA SIMPLE & PREMIUM
          Le desktop reste totalement inchangé à partir de md.
          =================================================================== */}
      <section className="relative overflow-hidden gradient-signature-soft md:hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-cyan-300/15 blur-[70px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 size-64 rounded-full bg-blue-950/15 blur-[70px]"
        />

        <div className="relative px-4 pb-4 pt-5">
          <div className="mx-auto max-w-[430px]">
            <h1
              className="text-display text-balance text-center text-[clamp(1.85rem,8.2vw,2.25rem)] font-extrabold leading-[1.04] tracking-[-0.035em] text-white"
              style={{
                textShadow: "0 2px 18px rgb(15 23 42 / 0.22)",
              }}
            >
              Votre adresse, enfin
              <span className="block text-cyan-100">facile à trouver.</span>
            </h1>

            <p className="mx-auto mt-3 max-w-[330px] text-center text-[13px] leading-5 text-white/85">
              Un numéro suffit pour trouver ou partager un lieu.
            </p>

            <div className="mt-4 rounded-[24px] border border-white/50 bg-white/95 p-2 shadow-[0_18px_45px_-18px_rgba(15,23,42,0.42)] backdrop-blur-xl">
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void rechercher(numero);
                }}
              >
                <div className="flex min-w-0 items-center rounded-[18px] bg-slate-50 px-3 ring-1 ring-slate-200/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/25">
                  <input
                    value={numero}
                    onChange={(e) => {
                      setNumero(e.target.value);
                      setErreur(null);
                    }}
                    placeholder="GN-CKY-______"
                    aria-label={t("home.hero.inputLabel")}
                    aria-invalid={!!erreur}
                    className="h-12 min-w-0 flex-1 bg-transparent font-mono text-[16px] font-bold tracking-[0.09em] text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
                  />

                  <button
                    type="button"
                    onClick={ecoute ? arreterVoix : demarrerVoix}
                    aria-label={ecoute ? "Arrêter" : "Dicter"}
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all active:scale-90",
                      ecoute
                        ? "animate-pulse bg-rose-500 text-white"
                        : "text-slate-500 active:bg-slate-100",
                    )}
                  >
                    {ecoute ? (
                      <MicOff className="size-[18px]" />
                    ) : (
                      <Mic className="size-[18px]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    aria-label="Scanner un QR"
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all active:scale-90 active:bg-slate-100"
                  >
                    <QrCode className="size-[18px]" />
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={enCours}
                  className="h-12 w-full rounded-[17px] bg-gradient-to-r from-accent to-accent-dark text-[14px] font-bold text-white shadow-lg shadow-accent/20 active:scale-[0.99]"
                >
                  <Search className="size-[17px]" />
                  {enCours ? "Recherche…" : "Localiser"}
                </Button>
              </form>

              {erreur && (
                <p
                  role="alert"
                  className="px-2 pb-1 pt-2 text-[11px] text-destructive"
                >
                  {erreur}
                </p>
              )}
            </div>

            <div className="mt-3 flex justify-center">
              <Link
                to="/a/$number"
                params={{ number: EXEMPLE_DEMO }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/85 backdrop-blur-sm active:scale-95"
              >
                Essayer
                <span className="font-mono font-bold">GN-CKY-582741</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          HERO — commun mobile / desktop (INCHANGÉ)
          =================================================================== */}
      <section className="relative hidden overflow-hidden gradient-signature-soft md:block">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className={cn(SITE_CONTAINER, "relative pb-7 pt-5 md:pb-11 md:pt-8 xl:pb-12 xl:pt-9")}>
          <h1
            className="text-display whitespace-nowrap text-center font-extrabold leading-[1.05] text-white"
            style={{ textShadow: "0 2px 20px rgb(15 23 42 / 0.25)", fontSize: "clamp(1.9rem, 3.15vw, 3.35rem)" }}
          >
            Votre adresse, enfin facile à trouver.
          </h1>
          <p className="mx-auto mt-3 max-w-4xl text-center text-sm leading-relaxed text-white/90 sm:text-base md:mt-4 md:max-w-none md:whitespace-nowrap lg:text-lg xl:text-xl">
            Un numéro unique par lieu. Fini les explications, les repères et les appels perdus.
          </p>
          <div className="mx-auto mt-6 max-w-[1280px] rounded-[22px] bg-white/95 p-2 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] ring-1 ring-white/50 backdrop-blur-xl md:mt-8 xl:mt-9">
            <form className="flex flex-col gap-2 md:flex-row" onSubmit={(e) => { e.preventDefault(); void rechercher(numero); }}>
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl border border-transparent bg-slate-50/80 pl-4 pr-1.5 transition-all focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/20">
                <input value={numero} onChange={(e) => { setNumero(e.target.value); setErreur(null); }} placeholder="GN-CKY-______" aria-label={t("home.hero.inputLabel")} aria-invalid={!!erreur}
                  className="h-12 w-full min-w-0 bg-transparent font-mono text-lg font-semibold tracking-[0.08em] text-slate-900 outline-hidden placeholder:font-normal placeholder:text-slate-400 sm:text-xl" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={ecoute ? arreterVoix : demarrerVoix} aria-label={ecoute ? "Arrêter" : "Dicter"}
                      className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all active:scale-90",
                        ecoute ? "animate-pulse bg-rose-500 text-white shadow-md shadow-rose-500/40" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")}>
                      {ecoute ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{ecoute ? "En écoute…" : "Dicter"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => setScannerOpen(true)} aria-label="Scanner un QR"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800 active:scale-90">
                      <QrCode className="size-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Scanner un QR</TooltipContent>
                </Tooltip>
              </div>
              <Button type="submit" disabled={enCours}
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-accent to-accent-dark px-8 text-base font-semibold text-accent-foreground shadow-lg shadow-accent/25 transition-all hover:shadow-accent/40 active:scale-[0.98] md:w-auto md:min-w-[160px]">
                <Search className="size-5" />
                {enCours ? "Recherche…" : "Localiser"}
              </Button>
            </form>
            {erreur && <p role="alert" className="mt-3 px-2 text-sm text-destructive">{erreur}</p>}
          </div>
          <div className="scrollbar-hide mx-auto mt-4 flex max-w-[1280px] flex-nowrap items-center justify-center gap-1.5 overflow-x-auto px-1 md:mt-5">
            {EXEMPLES.map((exemple) => (
              <Link key={exemple} to="/a/$number" params={{ number: exemple }}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/75 backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/15 hover:text-white active:scale-95 sm:text-xs">
                {exemple}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          MOBILE ONLY — PARCOURS SIMPLE, FLUIDE & ULTRA MODERNE
          =================================================================== */}

      <div className="md:hidden">
        {/* ---------------------------------------------------------------
            1. ACTIONS RAPIDES
            --------------------------------------------------------------- */}
        <section className="bg-white px-4 py-4">
          <div className="mx-auto max-w-[430px]">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="group relative overflow-hidden rounded-[22px] border border-slate-200/90 bg-white p-3.5 text-left shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] transition-all active:scale-[0.98]"
              >
                <div
                  aria-hidden
                  className="absolute -right-8 -top-8 size-24 rounded-full bg-accent/10 blur-2xl"
                />

                <span className="relative flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-lg shadow-accent/20">
                  <QrCode className="size-5" />
                </span>

                <p className="relative mt-4 text-[14px] font-bold leading-5 text-slate-950">
                  Scanner un QR
                </p>

                <p className="relative mt-1 text-[11px] leading-4 text-slate-500">
                  Trouver une adresse
                </p>
              </button>

              <Link
                to="/commander"
                className="group relative overflow-hidden rounded-[22px] border border-slate-900 bg-gradient-to-br from-slate-950 via-[#11284a] to-accent-dark p-3.5 text-left shadow-[0_14px_34px_-16px_rgba(15,23,42,0.38)] transition-all active:scale-[0.98]"
              >
                <div
                  aria-hidden
                  className="absolute -right-8 -top-8 size-28 rounded-full bg-cyan-300/15 blur-2xl"
                />

                <span className="relative flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10 backdrop-blur">
                  <Sparkles className="size-5" />
                </span>

                <p className="relative mt-4 text-[14px] font-bold leading-5 text-white">
                  Créer mon adresse
                </p>

                <p className="relative mt-1 text-[11px] leading-4 text-white/78">
                  Obtenir mon numéro GN
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            2. COMMENT ÇA MARCHE — 3 ÉTAPES SEULEMENT
            --------------------------------------------------------------- */}
        <section
          id="comment-ca-marche-mobile"
          className="border-y border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-4 py-5"
        >
          <div className="mx-auto max-w-[430px]">
            <div className="text-center">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent">
                Comment ça marche
              </span>

              <h2 className="text-display mt-1.5 text-[22px] font-bold tracking-tight text-slate-950">
                Un numéro. Une destination.
              </h2>

              <p className="mt-1.5 text-[12px] text-slate-500">
                Saisissez, scannez, naviguez.
              </p>
            </div>

            <div className="relative mt-5 grid grid-cols-3 gap-2">
              <div
                aria-hidden
                className="absolute left-[17%] right-[17%] top-[21px] h-[2px] rounded-full bg-gradient-to-r from-accent/20 via-accent/70 to-accent/20"
              />

              {ETAPES.map((etape, index) => (
                <div
                  key={etape.numero}
                  className="relative z-10 flex flex-col items-center text-center"
                >
                  <span className="flex size-11 items-center justify-center rounded-[15px] border border-slate-800 bg-slate-950 text-white shadow-md">
                    <etape.icone className="size-[18px]" />
                  </span>

                  <span className="absolute right-[calc(50%-27px)] top-[-5px] flex size-[19px] items-center justify-center rounded-full bg-accent text-[9px] font-extrabold text-white ring-[3px] ring-slate-50">
                    {index + 1}
                  </span>

                  <p className="mt-2.5 text-[11px] font-bold text-slate-800">
                    {etape.titreCourt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            3. DÉMONSTRATION ITINÉRAIRE — VERSION MOBILE COMPACTE
            --------------------------------------------------------------- */}
        <section className="bg-white px-4 py-4">
          <div className="mx-auto max-w-[430px]">
            <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_16px_38px_-24px_rgba(15,23,42,0.28)]">
              {/* En-tête compact */}
              <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/8 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-accent ring-1 ring-accent/10">
                      <Navigation2 className="size-3" />
                      Itinéraire réel
                    </span>
                  </div>

                  <p className="mt-2 font-mono text-[15px] font-extrabold tracking-[0.09em] text-slate-950">
                    GN-CKY-582741
                  </p>

                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                    → Hôtel Kaloum · Kaloum
                  </p>
                </div>

                <span className="flex size-9 shrink-0 items-center justify-center rounded-[13px] bg-accent/10 text-accent">
                  <MapPin className="size-[18px]" />
                </span>
              </div>

              {/* Carte compacte */}
              <div className="relative h-[178px] overflow-hidden border-y border-slate-100 bg-slate-100">
                {GOOGLE_MAPS_EMBED_URL ? (
                  <iframe
                    title="Itinéraire Google Maps Adresse GN sur mobile"
                    src={GOOGLE_MAPS_EMBED_URL}
                    className="absolute inset-0 h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <div className="absolute inset-0 overflow-hidden bg-[#edf2f4]">
                    <div
                      aria-hidden
                      className="absolute inset-0 opacity-45"
                      style={{
                        backgroundImage:
                          "linear-gradient(rgb(203 213 225 / 0.55) 1px, transparent 1px), linear-gradient(90deg, rgb(203 213 225 / 0.55) 1px, transparent 1px)",
                        backgroundSize: "22px 22px",
                      }}
                    />

                    <div className="absolute -left-[10%] right-[23%] top-[15%] h-2.5 rotate-[103deg] rounded-full bg-white shadow-sm" />
                    <div className="absolute left-[1%] right-[-10%] top-[47%] h-2.5 rotate-[8deg] rounded-full bg-white shadow-sm" />
                    <div className="absolute left-[7%] right-[-8%] top-[76%] h-2 rotate-[14deg] rounded-full bg-white/95 shadow-sm" />

                    <svg
                      viewBox="0 0 360 178"
                      className="absolute inset-0 h-full w-full"
                      aria-hidden
                    >
                      <path
                        d="M64 156 C86 133 104 125 106 103 C109 81 91 67 102 49 C119 23 153 39 178 24 C193 15 207 10 226 8"
                        fill="none"
                        stroke="white"
                        strokeWidth="11"
                        strokeLinecap="round"
                      />

                      <path
                        d="M64 156 C86 133 104 125 106 103 C109 81 91 67 102 49 C119 23 153 39 178 24 C193 15 207 10 226 8"
                        fill="none"
                        stroke="rgb(13 148 136)"
                        strokeWidth="5.5"
                        strokeLinecap="round"
                      />
                    </svg>

                    <span className="absolute bottom-[8%] left-[16%] flex size-5.5 items-center justify-center rounded-full border-[3px] border-white bg-blue-600 shadow-lg">
                      <span className="size-1.5 rounded-full bg-white" />
                    </span>

                    <span className="absolute right-[24%] top-[7%] flex size-9 items-center justify-center rounded-full bg-white text-accent shadow-lg">
                      <MapPin className="size-5 fill-accent/10" />
                    </span>
                  </div>
                )}

                {/* Numéro visible sur la carte */}
                <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-[13px] border border-white/80 bg-white/94 px-2.5 py-1.5 shadow-md backdrop-blur">
                  <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Adresse GN
                  </p>

                  <p className="mt-0.5 font-mono text-[11px] font-extrabold tracking-[0.09em] text-slate-950">
                    GN-CKY-582741
                  </p>
                </div>
              </div>

              {/* Action principale */}
              <div className="p-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <a
                    href={GOOGLE_MAPS_ROUTE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-accent to-accent-dark px-4 text-[11px] font-bold text-white shadow-md shadow-accent/15 transition-all active:scale-[0.99]"
                  >
                    <Navigation2 className="size-4" />
                    Ouvrir dans Google Maps
                  </a>

                  <a
                    href={WAZE_ROUTE_URL}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Ouvrir dans Waze"
                    className="flex h-11 min-w-11 items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 text-slate-700 transition-all active:scale-[0.98] active:bg-slate-50"
                  >
                    <Navigation2 className="size-4" />
                  </a>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 px-0.5">
                  <span className="text-[9px] font-medium text-slate-400">
                    Navigation directe vers la destination
                  </span>

                  <a
                    href={WAZE_ROUTE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500"
                  >
                    Waze
                    <ArrowRight className="size-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            4. AVANT / APRÈS — VERSION MOBILE COURTE
            --------------------------------------------------------------- */}
        <section className="border-y border-slate-100 bg-slate-50/65 px-4 py-6">
          <div className="mx-auto max-w-[430px]">
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                La différence Adresse GN
              </p>

              <h2 className="text-display mt-1.5 text-[21px] font-bold tracking-tight text-slate-950">
                Avant, on expliquait.
                <span className="block text-accent">Maintenant, on partage.</span>
              </h2>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="rounded-[20px] border border-rose-100 bg-rose-50/65 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-500">
                    <X className="size-4" />
                  </span>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-500">
                      Sans Adresse GN
                    </p>

                    <p className="mt-1.5 text-[13px] font-semibold leading-5 text-slate-800">
                      « Après la station, tournez à droite… »
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-accent/40 bg-gradient-to-br from-emerald-50 via-white to-cyan-100/60 p-4 ring-1 ring-accent/10 shadow-[0_16px_36px_-20px_rgba(13,148,136,0.55)]">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
                    <Check className="size-4" />
                  </span>

                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-accent">
                      Avec Adresse GN
                    </p>

                    <p className="mt-1 font-mono text-[15px] font-extrabold tracking-[0.08em] text-slate-950">
                      GN-CKY-582741
                    </p>

                    <p className="mt-1 text-[11px] font-semibold text-slate-600">
                      Partagez. Localisez. Naviguez.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            5. USAGES — GRILLE 2 × 2
            --------------------------------------------------------------- */}
        <section
          id="usages-mobile"
          className="bg-white px-4 py-5"
        >
          <div className="mx-auto max-w-[430px]">
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
                Usages
              </p>

              <h2 className="text-display mt-1.5 text-[22px] font-bold tracking-tight text-slate-950">
                Pour tous les usages.
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {USAGES.map((item) => {
                const mobileLabel =
                  item.cle === "individuals"
                    ? "Recevez facilement."
                    : item.cle === "shops"
                      ? "Soyez trouvé."
                      : item.cle === "delivery"
                        ? "Livrez au bon endroit."
                        : "Centralisez vos adresses.";

                return (
                  <article
                    key={item.cle}
                    className={cn(
                      "relative min-h-[122px] overflow-hidden rounded-[20px] border border-slate-200/90 bg-gradient-to-br p-3 shadow-[0_8px_22px_-18px_rgba(15,23,42,0.18)]",
                      item.fond,
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-[13px] bg-gradient-to-br text-white shadow-md",
                        item.grad,
                      )}
                    >
                      <item.icone className="size-4" />
                    </span>

                    <p className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {item.titre}
                    </p>

                    <h3 className="mt-1 text-[13px] font-bold leading-[1.3] text-slate-950">
                      {mobileLabel}
                    </h3>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            6. CONFIANCE — 3 GARANTIES SANS PARAGRAPHES
            --------------------------------------------------------------- */}
        <section className="border-y border-slate-100 bg-slate-50/70 px-4 py-5">
          <div className="mx-auto max-w-[430px]">
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
                Confiance
              </p>

              <h2 className="text-display mt-1.5 text-[21px] font-bold tracking-tight text-slate-950">
                Conçu pour le terrain.
              </h2>
            </div>

            <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
              {[
                {
                  icon: MapPinned,
                  label: "Localisation GPS précise",
                },
                {
                  icon: Handshake,
                  label: "Accompagnement local",
                },
                {
                  icon: Smartphone,
                  label: "Google Maps, Waze & QR Code",
                },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5",
                    index !== 2 && "border-b border-slate-100",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[13px] bg-accent/10 text-accent">
                    <item.icon className="size-[17px]" />
                  </span>

                  <p className="text-[13px] font-semibold text-slate-800">
                    {item.label}
                  </p>

                  <Check className="ml-auto size-4 shrink-0 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            7. CTA FINAL — MOBILE SIGNATURE / ULTRA PREMIUM COMPACT
            --------------------------------------------------------------- */}
        <section className="bg-white px-4 py-3.5">
          <div className="mx-auto max-w-[430px]">
            <div className="relative isolate overflow-hidden rounded-[26px] border border-slate-800/70 bg-[#071426] px-4.5 pb-4 pt-3.5 text-white shadow-[0_24px_55px_-28px_rgba(2,8,23,0.68)]">
              {/* Fond signature */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_88%_10%,rgba(34,211,238,0.23),transparent_31%),radial-gradient(circle_at_6%_100%,rgba(59,130,246,0.16),transparent_34%),linear-gradient(135deg,#071426_0%,#102f58_52%,#078b8d_100%)]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute -right-14 top-7 -z-10 size-32 rounded-full border border-white/[0.05]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute -right-5 top-14 -z-10 size-16 rounded-full border border-white/[0.04]"
              />

              <div className="relative">
                {/* Sur-ligne */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 text-[7.5px] font-bold uppercase tracking-[0.14em] text-cyan-100 backdrop-blur-md">
                    <Sparkles className="size-2.5 shrink-0" />
                    <span className="truncate">Votre adresse commence ici</span>
                  </span>

                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-2 py-1 text-[7.5px] font-semibold text-emerald-100">
                    <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_7px_rgba(110,231,183,0.9)]" />
                    Simple
                  </span>
                </div>

                {/* Titre — UNE SEULE LIGNE SUR MOBILE */}
                <h2 className="text-display mt-3 whitespace-nowrap text-[clamp(15px,4.8vw,19px)] font-extrabold leading-none tracking-[-0.025em] text-white">
                  Une adresse claire.{" "}
                  <span className="bg-gradient-to-r from-cyan-200 via-sky-200 to-emerald-200 bg-clip-text text-transparent">
                    Un accès immédiat.
                  </span>
                </h2>

                <p className="mt-2 text-[10.5px] leading-4 text-white/70">
                  Créez votre numéro Adresse GN et partagez votre localisation en quelques secondes.
                </p>

                {/* Aperçu produit — version ultra compacte */}
                <div className="mt-3 flex items-center justify-between gap-3 rounded-[15px] border border-white/10 bg-white/[0.065] px-3 py-2.5 backdrop-blur-md">
                  <div className="min-w-0">
                    <p className="text-[6.5px] font-semibold uppercase tracking-[0.15em] text-white/38">
                      Exemple d’adresse
                    </p>

                    <p className="mt-0.5 truncate font-mono text-[13px] font-extrabold tracking-[0.09em] text-white">
                      GN-CKY-582741
                    </p>

                    <div className="mt-1 flex items-center gap-1 text-[8px] font-medium text-white/50">
                      <MapPin className="size-2.5 shrink-0 text-cyan-200" />
                      Kaloum · Conakry
                    </div>
                  </div>

                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] border border-white/10 bg-white/[0.07] text-cyan-100">
                    <QrCode className="size-[18px]" />
                  </div>
                </div>

                {/* Valeur clé */}
                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Numéro", icon: MapPinned },
                    { label: "QR Code", icon: QrCode },
                    { label: "GPS", icon: Navigation2 },
                  ].map(({ label, icon: Icon }) => (
                    <div
                      key={label}
                      className="flex min-h-9 items-center justify-center gap-1.5 rounded-[11px] border border-white/[0.08] bg-white/[0.04] px-1.5 text-[8px] font-semibold text-white/80"
                    >
                      <Icon className="size-3 shrink-0 text-cyan-200" />
                      <span className="truncate">{label}</span>
                    </div>
                  ))}
                </div>

                {/* CTA principal */}
                <Button
                  asChild
                  className="group mt-3.5 h-11 w-full rounded-[14px] bg-white px-3.5 text-[13px] font-extrabold text-slate-950 shadow-[0_12px_26px_-12px_rgba(255,255,255,0.24)] transition-all active:scale-[0.99] hover:bg-white"
                >
                  <Link to="/commander">
                    Créer mon Adresse GN
                    <span className="ml-auto flex size-6.5 items-center justify-center rounded-full bg-slate-950 text-white transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="size-3" />
                    </span>
                  </Link>
                </Button>

                {/* CTA secondaire + réassurance sur une seule zone compacte */}
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <Link
                    to="/tarifs"
                    className="inline-flex items-center gap-1 text-[9px] font-semibold text-white/66 transition-colors active:text-white"
                  >
                    Découvrir les offres
                    <ArrowRight className="size-3" />
                  </Link>

                  <div className="flex items-center gap-1.5 text-[7.5px] font-medium text-white/40">
                    <span className="inline-flex items-center gap-1">
                      <Check className="size-2.5 text-cyan-200" />
                      Sans app
                    </span>

                    <span className="size-0.5 rounded-full bg-white/25" />

                    <span className="inline-flex items-center gap-1">
                      <Check className="size-2.5 text-cyan-200" />
                      Plaque en option
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ===================================================================
          DESKTOP ONLY (≥ md)
          Version desktop finale : contenu visuel inchangé.
          =================================================================== */}
      <div className="hidden md:block">
        {/* =====================================================
            COMMENT ÇA MARCHE
            ===================================================== */}
        <section id="comment-ca-marche" className="relative w-full overflow-hidden bg-white pb-10 pt-8 sm:pb-11 sm:pt-9 md:pb-12 md:pt-10 lg:pb-12 lg:pt-10 xl:pb-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.022]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgb(15 23 42) 1px, transparent 0)", backgroundSize: "34px 34px" }} />
          <div aria-hidden className="pointer-events-none absolute -right-48 top-24 h-[500px] w-[500px] rounded-full bg-cyan-100/30 blur-[130px]" />
          <div aria-hidden className="pointer-events-none absolute -left-48 bottom-20 h-[430px] w-[430px] rounded-full bg-blue-100/25 blur-[130px]" />
          <div className={cn(SITE_CONTAINER, "relative")}>
            <Reveal>
              <div className="flex justify-center">
                <span className={SECTION_BADGE_CLASS}>
                  <Sparkles className="size-3 text-accent" />
                  Comment ça marche
                </span>
              </div>
              <h2 className={cn(SECTION_TITLE_CLASS, "mx-auto mt-4 max-w-[1500px] xl:whitespace-nowrap")}>
                Un numéro. Une destination.{" "}
                <span className="bg-gradient-to-r from-accent via-sky-500 to-blue-600 bg-clip-text text-transparent">Aucun détour.</span>
              </h2>
              <p className={cn(SECTION_COPY_CLASS, "mx-auto mt-3 max-w-4xl xl:max-w-none xl:whitespace-nowrap")}>
                Adresse GN transforme chaque lieu en une adresse simple à identifier, partager et rejoindre.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {["Numéro unique", "QR Code", "Localisation GPS", "Google Maps & Waze"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur">
                    <Check className="size-3 text-accent" />
                    {item}
                  </span>
                ))}
              </div>
            </Reveal>
            <div className="mx-auto mt-7 grid w-full max-w-[1540px] gap-8 md:mt-8 lg:mt-9 lg:grid-cols-[minmax(0,0.96fr)_minmax(420px,1.04fr)] lg:items-center lg:gap-8 xl:gap-10 2xl:max-w-[1640px] 2xl:gap-14">
              <div>
                <ol className="space-y-3">
                  {ETAPES.map((etape, index) => (
                    <Reveal key={etape.numero} delay={index * 80}>
                      <li className="group relative w-full overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.035)] transition-all duration-300 hover:-translate-y-1 hover:border-accent/20 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-5 xl:rounded-[22px] xl:p-5">
                        <div aria-hidden className="absolute -right-14 -top-14 size-28 rounded-full bg-accent/0 blur-2xl transition-colors group-hover:bg-accent/[0.08]" />
                        <div className="relative flex gap-4">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-slate-950 text-white shadow-lg shadow-slate-950/10 transition-transform duration-300 group-hover:scale-105">
                            <etape.icone className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-mono text-[9px] font-bold tracking-[0.16em] text-accent">ÉTAPE {etape.numero}</span>
                              <span className="h-px flex-1 bg-slate-100" />
                            </div>
                            <h3 className="text-display text-[15px] font-bold tracking-tight text-slate-950 sm:text-base xl:text-[17px]">{etape.titre}</h3>
                            <p className="mt-1.5 text-[13px] leading-6 text-slate-600 xl:text-sm">{etape.texte}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {etape.tags.map((tag) => (
                                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200/70">
                                  <Check className="size-2.5 text-accent" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </li>
                    </Reveal>
                  ))}
                </ol>
                <Reveal delay={280}>
                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                    <Button asChild className="group h-11 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-5 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5 hover:shadow-accent/30">
                      <Link to="/a/$number" params={{ number: EXEMPLE_DEMO }}>
                        Voir un exemple
                        <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-xl border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50">
                      <Link to="/commander">Créer mon Adresse GN</Link>
                    </Button>
                  </div>
                </Reveal>
              </div>
              {/* GOOGLE MAPS MOCKUP */}
              <Reveal delay={150} className="relative">
                <div className="relative mx-auto flex w-full max-w-[620px] flex-col items-center">
                  <div aria-hidden className="absolute left-1/2 top-1/2 h-[470px] w-[470px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-accent/20 via-cyan-100/35 to-blue-100/25 blur-[80px]" />
                  <div className="relative z-10 mb-3 inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-700 shadow-md">
                    <Navigation2 className="size-3.5 text-accent" />
                    Itinéraire réel
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    Google Maps
                  </div>
                  <div className="relative z-[2] aspect-[9/19] w-[min(78vw,272px)] rotate-[-1deg] overflow-hidden rounded-[2.45rem] border-[8px] border-slate-950 bg-white shadow-[0_42px_90px_-30px_rgba(15,23,42,0.55)] transition-all duration-500 hover:rotate-0 hover:scale-[1.01] sm:w-[286px] sm:rounded-[2.6rem] md:w-[298px] lg:w-[312px] xl:w-[330px] 2xl:w-[350px] 2xl:rounded-[2.9rem] 2xl:border-[9px]">
                    <div aria-hidden className="absolute left-1/2 top-1 z-30 h-4 w-16 -translate-x-1/2 rounded-full bg-slate-950" />
                    <div className="flex h-full flex-col">
                      <div className="relative z-20 gradient-signature-soft px-4 pb-3 pt-7">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white">ADRESSE GN</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[7px] font-medium text-white backdrop-blur">
                            <Navigation2 className="size-2.5" />
                            Navigation
                          </span>
                        </div>
                      </div>
                      <div className="relative flex-1 overflow-hidden bg-slate-100">
                        {GOOGLE_MAPS_EMBED_URL ? (
                          <iframe title="Itinéraire Google Maps de démonstration" src={GOOGLE_MAPS_EMBED_URL} className="absolute inset-0 h-full w-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                        ) : (
                          <div className="absolute inset-0 overflow-hidden bg-[#edf2f4]">
                            <div aria-hidden className="absolute inset-0 opacity-45" style={{ backgroundImage: "linear-gradient(rgb(203 213 225 / 0.55) 1px, transparent 1px), linear-gradient(90deg, rgb(203 213 225 / 0.55) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
                            <div className="absolute -left-[8%] right-[22%] top-[16%] h-3 rotate-[102deg] rounded-full bg-white/95 shadow-sm" />
                            <div className="absolute left-[3%] right-[-10%] top-[40%] h-3 rotate-[8deg] rounded-full bg-white/95 shadow-sm" />
                            <div className="absolute left-[8%] right-[-8%] top-[70%] h-2.5 rotate-[14deg] rounded-full bg-white/90 shadow-sm" />
                            <svg viewBox="0 0 300 420" className="absolute inset-0 h-full w-full" aria-hidden>
                              <path d="M78 356 C103 330 112 305 112 272 C112 230 88 207 98 171 C111 124 157 134 178 106 C196 82 202 66 226 48" fill="none" stroke="rgba(59,130,246,0.85)" strokeWidth="4" strokeLinecap="round" />
                              <path d="M72 362 C92 333 98 317 98 282 C98 247 70 217 81 181 C94 138 136 130 158 109 C180 88 187 69 212 58" fill="none" stroke="rgba(59,130,246,0.6)" strokeWidth="3" strokeLinecap="round" />
                              <path d="M76 360 C94 334 103 316 102 286 C101 247 79 221 91 183 C105 140 154 151 177 122 C196 98 200 80 222 60" fill="none" stroke="white" strokeWidth="12" strokeLinecap="round" />
                              <path d="M76 360 C94 334 103 316 102 286 C101 247 79 221 91 183 C105 140 154 151 177 122 C196 98 200 80 222 60" fill="none" stroke="rgb(13 148 136)" strokeWidth="6" strokeLinecap="round" />
                            </svg>
                            <div className="absolute bottom-[10%] left-[21%] z-20">
                              <span className="flex size-6 items-center justify-center rounded-full border-[3px] border-white bg-blue-600 shadow-xl">
                                <span className="size-2 rounded-full bg-white" />
                              </span>
                            </div>
                            <div className="absolute right-[17%] top-[9%] z-20">
                              <div className="flex size-11 items-center justify-center rounded-full bg-white shadow-xl">
                                <MapPin className="size-7 fill-accent/15 text-accent" />
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-2xl border border-white/70 bg-white/92 px-3 py-2 shadow-lg backdrop-blur">
                          <p className="text-[7px] font-semibold uppercase tracking-[0.16em] text-slate-400">Numéro recherché</p>
                          <p className="mt-0.5 font-mono text-[11px] font-extrabold tracking-[0.12em] text-slate-950">GN-CKY-582741</p>
                        </div>
                        <div className="pointer-events-none absolute left-[6%] top-[17%] z-20 rounded-xl border border-slate-200 bg-white/96 px-2.5 py-1.5 shadow-lg backdrop-blur">
                          <p className="text-[10px] font-bold leading-none text-amber-600">24 min</p>
                          <p className="mt-0.5 text-[8px] text-slate-500">10 km</p>
                        </div>
                        <div className="pointer-events-none absolute right-[10%] top-[34%] z-20 rounded-xl border border-slate-200 bg-white/96 px-2.5 py-1.5 shadow-lg backdrop-blur">
                          <p className="text-[10px] font-bold leading-none text-slate-700">25 min</p>
                          <p className="mt-0.5 text-[8px] text-slate-500">9,9 km</p>
                        </div>
                        <div className="pointer-events-none absolute bottom-[13%] left-[37%] z-20 rounded-xl border border-slate-200 bg-white/96 px-2.5 py-1.5 shadow-lg backdrop-blur">
                          <p className="text-[10px] font-bold leading-none text-slate-700">28 min</p>
                          <p className="mt-0.5 text-[8px] text-slate-500">10,3 km</p>
                        </div>
                      </div>
                      <div className="relative z-20 border-t border-slate-100 bg-white p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-accent">Numéro central</div>
                            <p className="mt-2 font-mono text-[12px] font-extrabold tracking-[0.1em] text-slate-950 sm:text-[13px]">GN-CKY-582741</p>
                            <p className="mt-1 text-xs font-bold text-slate-950">Hôtel Kaloum</p>
                            <p className="mt-0.5 text-[9px] text-slate-500">Kaloum · Conakry</p>
                          </div>
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <MapPin className="size-4" />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <a href={GOOGLE_MAPS_ROUTE_URL} target="_blank" rel="noreferrer" className="group flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-2 text-[9px] font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg">
                            <Navigation2 className="size-3.5" />
                            Google Maps
                            <ExternalLink className="size-2.5 opacity-70" />
                          </a>
                          <a href={WAZE_ROUTE_URL} target="_blank" rel="noreferrer" className="group flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-[9px] font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:text-accent hover:shadow-md">
                            <Navigation2 className="size-3.5" />
                            Waze
                            <ExternalLink className="size-2.5 opacity-60" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute -left-2 top-[27%] z-10 hidden rotate-[-4deg] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl md:block xl:-left-8">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-full bg-accent/10"><Share2 className="size-3.5 text-accent" /></div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-900">Adresse partagée</p>
                        <p className="text-[8px] text-slate-500">Numéro ou QR Code</p>
                      </div>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute -right-2 top-[39%] z-10 hidden rotate-[4deg] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl md:block xl:-right-8">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100"><Check className="size-3.5 text-emerald-600" /></div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-900">Destination trouvée</p>
                        <p className="text-[8px] text-slate-500">Navigation disponible</p>
                      </div>
                    </div>
                  </div>
                  <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-medium text-slate-600 shadow-sm">
                      <Check className="size-3 text-emerald-600" /> Google Maps
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-medium text-slate-600 shadow-sm">
                      <Check className="size-3 text-emerald-600" /> Waze
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-medium text-slate-600 shadow-sm">
                      <Check className="size-3 text-emerald-600" /> Navigation en 1 clic
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>
            {/* AVANT / APRÈS */}
            <Reveal delay={100}>
              <div className="mt-9 md:mt-10 xl:mt-11">
                <div className="mx-auto mb-6 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">LA DIFFÉRENCE ADRESSE GN</p>
                  <h3 className="text-display mt-2 text-[clamp(1.5rem,1.85vw,2rem)] font-bold leading-tight tracking-tight text-slate-950">
                    Avant, on expliquait. <span className="text-accent">Maintenant, on partage.</span>
                  </h3>
                  <p className="mx-auto mt-2 max-w-4xl text-sm leading-6 text-slate-600 xl:max-w-none xl:whitespace-nowrap">
                    Un numéro Adresse GN remplace les longues indications et simplifie l'arrivée à destination.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:gap-5">
                  <div className="relative overflow-hidden rounded-[26px] border border-rose-100 bg-gradient-to-br from-rose-50/55 via-white to-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-rose-600 shadow-sm">
                      <X className="size-3.5" /> Sans Adresse GN
                    </div>
                    <p className="text-base font-semibold leading-snug text-slate-900 md:text-lg">
                      « Après la station, tournez à droite puis demandez le restaurant… »
                    </p>
                    <div className="mt-4 space-y-2.5">
                      {["Des indications longues à transmettre", "Des appels répétés pour guider", "Une destination plus difficile à trouver"].map((item) => (
                        <div key={item} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100"><X className="size-3 text-rose-500" /></span>
                          <span className="text-[13px] leading-5 text-slate-600">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-[26px] border border-accent/35 bg-gradient-to-br from-white via-emerald-50/70 to-cyan-50 p-6 ring-1 ring-accent/10 shadow-[0_24px_65px_-30px_rgba(13,148,136,0.55)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_75px_-28px_rgba(13,148,136,0.62)]">
                    <div aria-hidden className="absolute -right-14 -top-14 size-44 rounded-full bg-accent/20 blur-3xl" />
                    <div className="relative flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white shadow-sm">
                        <Check className="size-3.5 text-accent" /> Avec Adresse GN
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Situation idéale</div>
                    </div>
                    <div className="relative mt-4">
                      <div className="inline-flex rounded-2xl bg-slate-950 px-4 py-2 shadow-md shadow-slate-950/10">
                        <p className="font-mono text-xl font-extrabold tracking-[0.08em] text-white md:text-2xl">GN-CKY-582741</p>
                      </div>
                      <p className="mt-2 text-[13px] font-medium text-slate-600">Une référence claire, partageable et immédiatement exploitable pour retrouver le lieu.</p>
                      <div className="mt-4 space-y-2">
                        {["Un numéro unique facile à partager", "Un QR Code ou un lien accessible instantanément", "Un itinéraire Google Maps ou Waze prêt à être lancé"].map((item) => (
                          <div key={item} className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/12 ring-1 ring-accent/10"><Check className="size-3 text-accent" /></span>
                            <span className="text-[13px] font-semibold leading-5 text-slate-800">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
            {/* BÉNÉFICES */}
            <Reveal delay={140}>
              <div className="mt-6 overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50/60 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                <div className="grid grid-cols-1 divide-y divide-slate-200/70 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0 2xl:grid-cols-4">
                  {AVANTAGES.map((avantage) => (
                    <div key={avantage.titre} className="group flex min-h-[80px] items-center gap-3 bg-white/55 p-4 transition-all hover:bg-white md:px-5 md:py-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-md shadow-accent/15 transition-transform group-hover:scale-105">
                        <avantage.icone className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-950 md:text-sm">{avantage.titre}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{avantage.texte}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ===== USAGES ===== */}
        <section id="usages" className="relative w-full overflow-hidden border-t border-slate-100 bg-slate-50 py-10 sm:py-11 md:py-12 xl:py-14">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[700px] -translate-x-1/2 rounded-full bg-white/90 blur-[100px]" />
          <div className={cn(SITE_CONTAINER, "relative")}>
            <Reveal>
              <div className="flex justify-center">
                <span className={SECTION_BADGE_CLASS}>
                  <Sparkles className="size-3 text-accent" /> Usages
                </span>
              </div>
              <h2 className={cn(SECTION_TITLE_CLASS, "mx-auto mt-4 max-w-5xl")}>
                Pensé pour{" "}
                <span className="bg-gradient-to-r from-accent via-sky-500 to-blue-600 bg-clip-text text-transparent">tous les usages du quotidien.</span>
              </h2>
              <p className={cn(SECTION_COPY_CLASS, "mx-auto mt-3 max-w-3xl lg:max-w-none xl:whitespace-nowrap")}>
                Que vous receviez, livriez, vendiez ou gériez plusieurs sites, Adresse GN simplifie la façon de vous trouver.
              </p>
            </Reveal>
            <div className="mx-auto mt-7 grid w-full max-w-[1660px] grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-8 lg:grid-cols-4 lg:gap-4 xl:gap-5 2xl:gap-6">
              {USAGES.map((item, index) => (
                <Reveal key={item.cle} delay={index * 70}>
                  <article className={cn("group relative flex h-full min-h-[230px] flex-col overflow-hidden rounded-[22px] border border-slate-200/90 bg-gradient-to-br p-5 shadow-[0_8px_28px_rgba(15,23,42,0.035)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_55px_rgba(15,23,42,0.10)] lg:min-h-[238px] xl:min-h-[245px] xl:rounded-[24px] xl:p-5", item.fond, item.bordure)}>
                    <div aria-hidden className={cn("absolute -right-16 -top-16 size-40 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-20", item.grad)} />
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-center justify-between gap-3">
                        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-all duration-300 group-hover:scale-105", item.grad)}>
                          <item.icone className="size-5" />
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white/85 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400 shadow-sm">{item.titre}</span>
                      </div>
                      <h3 className="text-display mt-4 text-[17px] font-bold leading-snug tracking-tight text-slate-950 xl:text-lg">{item.accroche}</h3>
                      <p className="mt-2.5 text-[13px] leading-5 text-slate-600">{item.texte}</p>
                      <div className="mt-5 space-y-2.5">
                        {item.avantages.map((avantage) => (
                          <div key={avantage} className="flex items-center gap-2">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/80"><Check className="size-3 text-accent" /></span>
                            <span className="text-xs font-medium text-slate-700">{avantage}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-auto pt-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors group-hover:text-accent">
                          Une adresse adaptée à votre besoin
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CONFIANCE ===== */}
        <section className="relative w-full overflow-hidden bg-white py-4 sm:py-5 md:py-6 xl:py-7">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[240px] w-[680px] -translate-x-1/2 rounded-full bg-cyan-50 blur-[90px]" />
          <div className={cn(SITE_CONTAINER, "relative")}>
            <Reveal>
              <div className="mx-auto w-full max-w-[1320px] rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/70 p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.18)] sm:p-5 xl:p-5">
                <div className="mx-auto w-full text-center">
                  <span className={SECTION_BADGE_CLASS}>
                    <Sparkles className="size-3 text-accent" /> Pourquoi nous faire confiance
                  </span>
                  <h2 className={cn(SECTION_TITLE_CLASS, "mx-auto mt-3 max-w-3xl")}>Conçu pour les réalités du terrain.</h2>
                  <p className={cn(SECTION_COPY_CLASS, "mx-auto mt-2 w-full max-w-[1180px] xl:whitespace-nowrap")}>
                    Adresse GN relie un numéro unique, une position GPS et des outils que les utilisateurs connaissent déjà pour rendre l'adresse simple à créer, à partager et à rejoindre.
                  </p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3 xl:gap-4">
                  {POINTS_CONFIANCE.map((point, index) => (
                    <Reveal key={point.titre} delay={index * 60}>
                      <article className="group h-full rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] xl:p-[18px]">
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-md shadow-accent/20">
                            <point.icone className="size-5" />
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">{point.badge}</span>
                        </div>
                        <h3 className="mt-3 text-[15px] font-bold text-slate-950 sm:text-base xl:text-[17px]">{point.titre}</h3>
                        <p className="mt-1.5 text-[12px] leading-5 text-slate-600 xl:text-[13px]">{point.texte}</p>
                      </article>
                    </Reveal>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ===== CTA FINAL ===== */}
        <section className="relative w-full overflow-hidden bg-white pb-7 pt-1 sm:pb-8 sm:pt-2 md:pb-8 md:pt-2 xl:pb-9 xl:pt-2">
          <div aria-hidden className="pointer-events-none absolute -left-52 top-1/2 size-[420px] -translate-y-1/2 rounded-full bg-blue-100/45 blur-[120px]" />
          <div aria-hidden className="pointer-events-none absolute -right-52 top-1/2 size-[420px] -translate-y-1/2 rounded-full bg-cyan-100/45 blur-[120px]" />
          <Reveal className={cn(SITE_CONTAINER, "relative")}>
            <div className="mx-auto grid w-full max-w-[1660px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_22px_62px_-34px_rgba(15,23,42,0.28)] sm:rounded-[26px] lg:grid-cols-[1.12fr_0.88fr] xl:rounded-[28px]">
              <div className="relative overflow-hidden gradient-signature-soft px-6 py-6 sm:px-8 md:px-9 lg:px-10 lg:py-6 xl:px-11">
                <div aria-hidden className="absolute -left-20 -top-20 size-56 rounded-full bg-white/10 blur-[65px]" />
                <div aria-hidden className="absolute -bottom-24 right-[-30px] size-64 rounded-full bg-cyan-300/10 blur-[70px]" />
                <div className="relative flex h-full flex-col justify-center">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
                    <Zap className="size-3.5" /> Passez à l'action
                  </span>
                  <h2 className="text-display mt-3 max-w-xl text-[1.75rem] font-bold leading-[1.08] tracking-tight text-white sm:text-3xl md:text-[2.05rem] lg:max-w-none lg:text-[clamp(1.55rem,1.72vw,2.05rem)] xl:whitespace-nowrap">
                    Créez votre Adresse GN.{" "}
                    <span className="block text-cyan-200 sm:mt-1 lg:mt-0 lg:inline">Soyez facile à trouver.</span>
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-5 text-white/85 md:text-[14px] lg:max-w-none lg:text-[11px] xl:whitespace-nowrap xl:text-xs 2xl:text-[13px]">
                    Obtenez un numéro unique associé à votre localisation, partagez-le instantanément et choisissez la formule adaptée à votre besoin.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-cyan-100">
                    <Sparkles className="size-3.5 shrink-0" /> Votre adresse numérique est prête à être partagée dès son activation.
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {["Numéro unique prêt à partager", "QR Code intégré", "Localisation GPS", "Plaque physique en option"].map((item) => (
                      <div key={item} className="flex min-h-10 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.08] px-2.5 py-2 backdrop-blur-sm sm:px-3">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/16"><Check className="size-3 text-white" /></span>
                        <span className="text-[10px] font-medium leading-4 text-white/95 sm:text-xs">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <Button asChild className="group h-12 w-full rounded-xl bg-white px-7 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_36px_rgba(15,23,42,0.24)] sm:w-auto sm:min-w-[220px]">
                      <Link to="/commander">
                        Créer mon Adresse GN
                        <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-12 w-full rounded-xl border-white/35 bg-white/[0.04] px-6 text-sm font-semibold text-white backdrop-blur-sm hover:border-white/60 hover:bg-white/10 hover:text-white sm:w-auto">
                      <Link to="/tarifs">Voir les offres</Link>
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-medium text-white/65 sm:text-[10px]">
                    <span className="inline-flex items-center gap-1.5"><Check className="size-3 shrink-0" /> Sans application obligatoire</span>
                    <span className="inline-flex items-center gap-1.5"><Check className="size-3 shrink-0" /> Plaque physique selon l'offre</span>
                  </div>
                </div>
              </div>
              <div className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 px-5 py-5 sm:px-7 md:px-8 lg:px-7 lg:py-5">
                <div aria-hidden className="absolute -right-20 -top-20 size-60 rounded-full bg-accent/10 blur-[80px]" />
                <div aria-hidden className="absolute -bottom-28 -left-20 size-64 rounded-full bg-blue-100/70 blur-[80px]" />
                <div aria-hidden className="absolute inset-x-16 bottom-10 h-8 rounded-full bg-slate-950/10 blur-2xl" />
                <div className="relative w-full max-w-[420px]">
                  <div className="mb-2 flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.16em] text-slate-600 shadow-sm sm:text-[9px]">
                      <QrCode className="size-3.5 text-accent" /> Aperçu de votre Adresse GN
                    </span>
                  </div>
                  <div className="relative mx-auto w-full max-w-[395px] rotate-[0.5deg] overflow-hidden rounded-[22px] border border-slate-300/80 bg-white shadow-[0_26px_60px_-24px_rgba(15,23,42,0.36)] transition-all duration-500 hover:rotate-0 hover:scale-[1.005]">
                    <div className="gradient-signature-soft px-5 py-3 sm:px-6 sm:py-3.5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur"><MapPin className="size-4 text-white" /></span>
                          <div>
                            <p className="text-[7px] font-medium uppercase tracking-[0.18em] text-white/60">Votre adresse</p>
                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white">ADRESSE GN</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-white/85">Guinée</span>
                      </div>
                    </div>
                    <div className="relative p-4 sm:p-5">
                      <span aria-hidden className="absolute left-3 top-3 size-1.5 rounded-full border border-slate-300 bg-slate-100 shadow-inner" />
                      <span aria-hidden className="absolute right-3 top-3 size-1.5 rounded-full border border-slate-300 bg-slate-100 shadow-inner" />
                      <span aria-hidden className="absolute bottom-3 left-3 size-1.5 rounded-full border border-slate-300 bg-slate-100 shadow-inner" />
                      <span aria-hidden className="absolute bottom-3 right-3 size-1.5 rounded-full border border-slate-300 bg-slate-100 shadow-inner" />
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:gap-5">
                        <div className="min-w-0">
                          <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-slate-400">Numéro unique</p>
                          <p className="mt-1.5 whitespace-nowrap font-mono text-[clamp(0.78rem,4vw,1.45rem)] font-extrabold tracking-[0.025em] text-slate-950 sm:tracking-[0.035em]">GN-CKY-582741</p>
                          <div className="mt-3.5 flex items-center gap-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><MapPin className="size-3.5" /></span>
                            <div>
                              <p className="text-[11px] font-bold text-slate-900">Kaloum</p>
                              <p className="mt-0.5 text-[9px] text-slate-500">Conakry · Guinée</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-2 shadow-inner sm:rounded-[18px] sm:p-2.5">
                          <svg viewBox="0 0 21 21" aria-label="QR Code Adresse GN" className="size-14 text-slate-950 min-[390px]:size-16 sm:size-[72px] md:size-20" fill="currentColor">
                            <path d="M0 0h7v7H0V0zm2 2v3h3V2H2zM14 0h7v7h-7V0zm2 2v3h3V2h-3zM0 14h7v7H0v-7zm2 2v3h3v-3H2z" />
                            <path d="M9 0h2v2H9V0zM9 3h2v2H9V3zM12 9h2v2h-2V9zM9 9h2v2H9V9zM9 12h2v2H9v-2zM12 12h2v2h-2v-2zM16 9h2v2h-2V9zM19 9h2v2h-2V9zM16 12h2v2h-2v-2zM19 14h2v2h-2v-2zM16 16h2v2h-2v-2zM12 16h2v2h-2v-2zM9 19h2v2H9v-2zM12 19h2v2h-2v-2zM16 19h2v2h-2v-2zM19 19h2v2h-2v-2zM0 9h2v2H0V9zM3 9h2v2H3V9zM6 9h2v2H6V9zM3 12h2v2H3v-2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <QrCode className="size-3.5 shrink-0 text-accent" />
                          <p className="text-[9px] font-medium text-slate-500">Scannez pour localiser cette adresse</p>
                        </div>
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-semibold text-emerald-700">
                          <span className="size-1.5 rounded-full bg-emerald-500" /> Adresse active
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)] backdrop-blur">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><Smartphone className="size-4" /></span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold leading-4 text-slate-950 sm:text-[11px]">Adresse numérique</p>
                          <p className="mt-0.5 hidden text-[9px] leading-4 text-slate-500 min-[390px]:block">Disponible dès l'activation.</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)] backdrop-blur">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><QrCode className="size-4" /></span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold leading-4 text-slate-950 sm:text-[11px]">Plaque physique</p>
                          <p className="mt-0.5 hidden text-[9px] leading-4 text-slate-500 min-[390px]:block">Disponible selon votre offre.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

      </div>

      {desktopInstallVisible && (
        <aside role="dialog" aria-label="Installer Adresse GN"
          className="fixed bottom-5 left-5 z-[1200] hidden w-[min(420px,calc(100vw-40px))] overflow-hidden rounded-[22px] bg-gradient-to-r from-orange-500 via-orange-500 to-rose-600 p-[1px] shadow-[0_24px_70px_-18px_rgba(244,63,94,0.45)] lg:block">
          <div className="relative rounded-[21px] bg-gradient-to-r from-orange-500 via-orange-500 to-rose-600 px-5 py-4 text-white">
            <button type="button" onClick={fermerInstallationDesktop} aria-label="Fermer la proposition d'installation"
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white">
              <X className="size-4" />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/18 shadow-inner backdrop-blur-sm">
                <Smartphone className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-5">Installer Adresse GN</h3>
                <p className="mt-1 text-[12px] leading-4 text-white/90">Accès rapide depuis votre bureau, mode hors-ligne et expérience proche d'une application.</p>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={() => void installerSurDesktop()}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-orange-600 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg">
                    <Download className="size-4" /> Installer
                  </button>
                  <button type="button" onClick={fermerInstallationDesktop}
                    className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold text-white transition-colors hover:bg-white/10">
                    Plus tard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
      <InstallBanner variant="bottom" />
      <QrScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={gererScanQr} title="Scanner un QR d'adresse" />
    </div>
  );
}
