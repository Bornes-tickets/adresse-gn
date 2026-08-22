import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bike,
  Building2,
  Check,
  Home as HomeIcon,
  MapPin,
  Mic,
  MicOff,
  QrCode,
  Search,
  UtensilsCrossed,
  ArrowRight,
  Navigation2,
  Zap,
  Smartphone,
  Sparkles,
  X,
  Share2,
  MapPinned,
  Star,
  ShieldCheck,
  Wallet,
  UserCheck,
  Calendar,
  Truck,
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

/* =========================================================
   USAGES — cartes enrichies avec scénarios concrets
   ========================================================= */
const USAGES = [
  {
    icone: HomeIcon,
    grad: "from-emerald-500 to-teal-600",
    tag: "Particuliers",
    titre: "Recevoir facilement chez soi",
    scenario: "« Envoie-moi juste GN-CKY-582741, ton livreur va trouver. »",
    features: [
      "Partage en 1 SMS ou WhatsApp",
      "Fini les explications au téléphone",
      "Marche pour tout visiteur",
    ],
  },
  {
    icone: UtensilsCrossed,
    grad: "from-orange-500 to-rose-600",
    tag: "Commerces",
    titre: "Se rendre trouvable",
    scenario: "« Notre restaurant est à GN-CKY-152963 » sur toutes vos pubs.",
    features: [
      "Affiche QR à mettre en devanture",
      "Sur Instagram, Facebook, cartes",
      "Réservations sans confusion",
    ],
  },
  {
    icone: Bike,
    grad: "from-violet-500 to-fuchsia-600",
    tag: "Livraisons",
    titre: "Livrer plus vite",
    scenario: "Le livreur clique, Google Maps s'ouvre. Aucun appel.",
    features: [
      "Itinéraire précis à ±3 m",
      "Historique des adresses",
      "Compatible flottes & apps",
    ],
  },
  {
    icone: Building2,
    grad: "from-sky-500 to-blue-600",
    tag: "Entreprises",
    titre: "Intégrer via API",
    scenario: "Ajoutez l'Adresse GN à vos formulaires clients et vos ERP.",
    features: [
      "API REST documentée",
      "Webhooks & SDK",
      "SLA & support dédié",
    ],
  },
];

const ETAPES = [
  {
    numero: "01",
    icone: MapPinned,
    titre: "Obtenez votre Adresse GN",
    texte:
      "Chaque lieu reçoit un numéro Adresse GN unique associé à sa localisation. Il peut être communiqué directement ou affiché avec son QR Code.",
    tags: ["Numéro unique", "QR Code associé"],
  },
  {
    numero: "02",
    icone: Search,
    titre: "Saisissez ou scannez",
    texte:
      "Entrez le numéro Adresse GN dans la barre de recherche ou scannez le QR Code depuis votre téléphone pour retrouver immédiatement le lieu.",
    tags: ["Sans application obligatoire", "Mobile & ordinateur"],
  },
  {
    numero: "03",
    icone: Navigation2,
    titre: "Lancez votre itinéraire",
    texte:
      "Une fois l'adresse retrouvée, ouvrez votre application de navigation préférée et laissez-vous guider jusqu'à la destination.",
    tags: ["Navigation GPS", "Accès en quelques gestes"],
  },
];
const AVANTAGES = [
  { icone: Zap, titre: "Accès rapide", texte: "Du numéro à l'adresse" },
  { icone: QrCode, titre: "QR Code", texte: "Scannez pour localiser" },
  { icone: Share2, titre: "Facile à partager", texte: "Numéro, lien ou QR" },
  { icone: Smartphone, titre: "Web & mobile", texte: "Aucune app obligatoire" },
];

/* =========================================================
   CTA FINAL — mini-parcours & badges de confiance
   ========================================================= */
const PARCOURS = [
  { num: "1", icone: Calendar, titre: "Réservez", texte: "En ligne, en 2 min" },
  { num: "2", icone: Truck, titre: "Un agent vient", texte: "Sous 24-48h" },
  { num: "3", icone: Check, titre: "C'est actif", texte: "Numéro utilisable" },
];
const CONFIANCE = [
  { icone: UserCheck, texte: "Agents agréés" },
  { icone: ShieldCheck, texte: "Garantie 30 jours" },
  { icone: Wallet, texte: "Paiement mobile local" },
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
    if (match) { const v = match[0].toUpperCase(); setNumero(v); void rechercher(v); }
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
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden gradient-signature-soft">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-5xl px-5 pb-8 pt-6 sm:px-6 md:pb-16 md:pt-12 lg:px-8">
          <h1
            className="text-display whitespace-nowrap text-center font-extrabold leading-[1.05] text-white"
            style={{ textShadow: "0 2px 20px rgb(15 23 42 / 0.25)", fontSize: "clamp(0.95rem, 4.7vw, 3.75rem)" }}
          >
            Votre adresse, enfin facile à trouver.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-center text-base leading-relaxed text-white/90 md:mt-6 md:max-w-none md:whitespace-nowrap md:text-xl">
            Un numéro unique par lieu. Fini les explications, les repères et les appels perdus.
          </p>
          <div className="mt-8 rounded-3xl bg-white/95 p-2.5 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] ring-1 ring-white/50 backdrop-blur-xl md:mt-12">
            <form className="flex flex-col gap-2 md:flex-row" onSubmit={(e) => { e.preventDefault(); void rechercher(numero); }}>
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl border border-transparent bg-slate-50/80 pl-4 pr-1.5 transition-all focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/20">
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
                className="h-14 w-full rounded-2xl bg-gradient-to-r from-accent to-accent-dark px-8 text-base font-semibold text-accent-foreground shadow-lg shadow-accent/25 transition-all hover:shadow-accent/40 active:scale-[0.98] md:w-auto md:min-w-[160px]">
                <Search className="size-5" />
                {enCours ? "Recherche…" : "Localiser"}
              </Button>
            </form>
            {erreur && <p role="alert" className="mt-3 px-2 text-sm text-destructive">{erreur}</p>}
          </div>
          <div className="scrollbar-hide mt-5 flex flex-nowrap items-center justify-center gap-1.5 overflow-x-auto px-1 md:mt-6">
            {EXEMPLES.map((exemple) => (
              <Link key={exemple} to="/a/$number" params={{ number: exemple }}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/75 backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/15 hover:text-white active:scale-95 sm:text-xs">
                {exemple}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMMENT ÇA MARCHE ===== */}
      <section id="comment-ca-marche" className="relative overflow-hidden bg-white px-5 py-20 sm:px-6 md:px-8 md:py-32">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgb(15 23 42) 1px, transparent 0)", backgroundSize: "34px 34px" }} />
        <div aria-hidden className="pointer-events-none absolute -right-48 top-40 h-[500px] w-[500px] rounded-full bg-cyan-100/40 blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute -left-48 bottom-20 h-[420px] w-[420px] rounded-full bg-blue-100/40 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl">
          <Reveal>
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                <Sparkles className="size-3.5 text-accent" />
                Comment ça marche
              </span>
            </div>
            <h2 className="text-display mx-auto mt-6 max-w-4xl text-center text-3xl font-bold tracking-tight text-slate-950 md:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
              Un numéro. Une destination.{" "}
              <span className="bg-gradient-to-r from-accent via-sky-500 to-blue-600 bg-clip-text text-transparent">
                Aucun détour.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-7 text-slate-600 md:text-lg">
              Adresse GN transforme un emplacement en un identifiant simple à saisir, scanner ou partager.
              En quelques gestes, passez du numéro à l&apos;itinéraire.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <div className="inline-flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-emerald-400 to-teal-500 text-[10px] font-bold text-white shadow-sm">MK</span>
                  <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-orange-400 to-rose-500 text-[10px] font-bold text-white shadow-sm">FD</span>
                  <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-violet-400 to-fuchsia-500 text-[10px] font-bold text-white shadow-sm">AB</span>
                  <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-sky-400 to-blue-500 text-[10px] font-bold text-white shadow-sm">+</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">100+ utilisateurs à Conakry</span>
              </div>
              <div className="hidden h-4 w-px bg-slate-200 sm:block" />
              <div className="inline-flex items-center gap-1.5">
                <div className="flex text-amber-400">{[0,1,2,3,4].map((i) => <Star key={i} className="size-3.5 fill-current" />)}</div>
                <span className="text-xs font-semibold text-slate-700">Testé par livreurs & commerces</span>
              </div>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-14 lg:mt-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-20">
            <div>
              <ol className="space-y-4">
                {ETAPES.map((etape, index) => (
                  <Reveal key={etape.numero} delay={index * 90}>
                    <li className="group relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.09)] md:p-6">
                      <div aria-hidden className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-accent/0 blur-2xl transition-colors duration-300 group-hover:bg-accent/10" />
                      <div className="relative flex gap-4 md:gap-5">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10 transition-transform duration-300 group-hover:scale-105 md:size-14">
                          <etape.icone className="size-5 md:size-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold tracking-[0.15em] text-accent">ÉTAPE {etape.numero}</span>
                            <span className="h-px flex-1 bg-slate-100" />
                          </div>
                          <h3 className="text-display text-lg font-bold tracking-tight text-slate-950 md:text-xl">{etape.titre}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600 md:text-[15px]">{etape.texte}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {etape.tags.map((tag) => (
                              <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200/70">
                                <Check className="size-3 text-accent" />
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
              <Reveal delay={320}>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="group h-12 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-6 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:shadow-accent/30">
                    <Link to="/a/$number" params={{ number: "GN-CKY-582741" }}>
                      Voir un exemple réel
                      <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 rounded-xl border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Link to="/commander">Créer mon Adresse GN</Link>
                  </Button>
                </div>
              </Reveal>
            </div>

            <Reveal delay={180} className="relative">
              <div className="relative mx-auto flex max-w-[340px] flex-col items-center">
                <div aria-hidden className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-accent/20 via-sky-100/40 to-blue-100/20 blur-[70px]" />
                <div className="relative z-10 mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-md">
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100">
                    <Check className="size-3 text-emerald-600" />
                  </span>
                  Adresse retrouvée
                </div>
                <div className="relative z-[2] aspect-9/19 w-[285px] rotate-[-2deg] overflow-hidden rounded-[2.85rem] border-[9px] border-slate-950 bg-white shadow-[0_40px_90px_-25px_rgba(15,23,42,0.55)] transition-transform duration-500 hover:rotate-0 md:w-[305px]">
                  <div aria-hidden className="absolute left-1/2 top-1 z-20 h-4 w-16 -translate-x-1/2 rounded-full bg-slate-950" />
                  <div className="flex h-full flex-col">
                    <div className="gradient-signature-soft px-4 pb-3 pt-7 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white">ADRESSE GN</span>
                    </div>
                    <div className="relative flex-1 overflow-hidden bg-slate-100"
                      style={{ backgroundImage: "linear-gradient(rgb(203 213 225 / 0.55) 1px, transparent 1px), linear-gradient(90deg, rgb(203 213 225 / 0.55) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
                      <div aria-hidden className="absolute left-[-10%] right-[-10%] top-[35%] h-2 rotate-[-7deg] rounded-full bg-white/90 shadow-sm" />
                      <div aria-hidden className="absolute bottom-[-10%] left-[33%] top-[-10%] w-2 rotate-[8deg] rounded-full bg-white/90 shadow-sm" />
                      <div aria-hidden className="absolute bottom-[20%] left-[-10%] right-[-10%] h-1.5 rotate-[13deg] rounded-full bg-white/80" />
                      <div aria-hidden className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10" />
                      <div aria-hidden className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15" />
                      <div className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-slate-200">
                        <MapPin className="size-6 fill-accent/15 text-accent" />
                      </div>
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-[9px] font-semibold text-slate-700 shadow-md backdrop-blur">
                        Kaloum · Conakry
                      </div>
                    </div>
                    <div className="space-y-3 bg-white p-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950">Restaurant Le Damier</p>
                          <p className="mt-1 font-mono text-[11px] font-semibold tracking-wide text-accent">GN-CKY-582741</p>
                          <p className="mt-1 text-[11px] text-slate-500">Kaloum · Conakry</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-3 py-3 text-xs font-semibold text-accent-foreground shadow-md">
                          <Navigation2 className="size-4" />
                          S&apos;y rendre
                        </div>
                        <div className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600">
                          <Share2 className="size-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute -left-12 top-28 z-10 hidden rotate-[-6deg] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl md:block">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100"><Check className="size-3.5 text-emerald-600" /></div>
                    <div>
                      <p className="text-[9px] font-semibold text-slate-900">Adresse trouvée</p>
                      <p className="text-[8px] text-slate-500">Prête à partager</p>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute -right-14 bottom-36 z-10 hidden rotate-[5deg] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl md:block">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-accent/10"><Navigation2 className="size-3.5 text-accent" /></div>
                    <div>
                      <p className="text-[9px] font-semibold text-slate-900">Itinéraire</p>
                      <p className="text-[8px] text-slate-500">Prêt à démarrer</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={100}>
            <div className="mt-24 md:mt-32">
              <div className="mx-auto mb-9 max-w-2xl text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">LA DIFFÉRENCE ADRESSE GN</p>
                <h3 className="text-display mt-3 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                  Avant, on expliquait. <span className="text-accent">Maintenant, on partage.</span>
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 md:text-base">
                  Remplacez les longues indications par une référence simple, identifiable et directement exploitable.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 md:p-8">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 shadow-sm">
                    <X className="size-3.5" /> Sans identifiant clair
                  </div>
                  <p className="text-lg font-semibold leading-snug text-slate-900 md:text-xl">
                    « Après la station, tournez à droite puis demandez le restaurant… »
                  </p>
                  <div className="mt-6 space-y-3">
                    {["Des repères parfois difficiles à transmettre","Des appels supplémentaires pour guider","Des arrivées plus longues et moins prévisibles"].map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200"><X className="size-3 text-slate-500" /></span>
                        <span className="text-sm leading-5 text-slate-600">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-[28px] border border-accent/20 bg-gradient-to-br from-accent/[0.07] via-white to-sky-50 p-6 shadow-[0_20px_60px_-30px_rgba(13,148,136,0.35)] md:p-8">
                  <div aria-hidden className="absolute -right-14 -top-14 size-40 rounded-full bg-accent/10 blur-3xl" />
                  <div className="relative mb-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-sm">
                    <Check className="size-3.5 text-accent" /> Avec Adresse GN
                  </div>
                  <div className="relative">
                    <p className="font-mono text-xl font-bold tracking-[0.06em] text-slate-950 md:text-2xl">GN-CKY-582741</p>
                    <p className="mt-2 text-sm text-slate-500">Une référence unique pour retrouver le lieu.</p>
                    <div className="mt-6 space-y-3">
                      {["Un numéro simple à communiquer","Un QR Code ou un lien facile à partager","Un accès direct à la navigation"].map((item) => (
                        <div key={item} className="flex items-start gap-3">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10"><Check className="size-3 text-accent" /></span>
                          <span className="text-sm font-medium leading-5 text-slate-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="mt-10 overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50/60 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:mt-12">
              <div className="grid grid-cols-1 divide-y divide-slate-200/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                {AVANTAGES.map((avantage) => (
                  <div key={avantage.titre} className="group flex items-center gap-3.5 bg-white/50 p-5 transition-colors hover:bg-white md:p-6">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-md shadow-accent/20 transition-transform group-hover:scale-105 md:size-12">
                      <avantage.icone className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-950 md:text-[15px]">{avantage.titre}</p>
                      <p className="mt-0.5 text-xs text-slate-600 md:text-[13px]">{avantage.texte}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== USAGES — enrichis avec scénarios ===== */}
      <section id="usages" className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 px-5 py-20 sm:px-6 md:px-8 md:py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgb(15 23 42) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div className="relative mx-auto max-w-6xl">
          <Reveal>
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                <Sparkles className="size-3.5 text-accent" />
                Usages
              </span>
            </div>
            <h2 className="text-display mx-auto mt-6 max-w-3xl text-center text-3xl font-bold tracking-tight text-slate-950 md:text-5xl md:leading-[1.1]">
              Pensé pour{" "}
              <span className="bg-gradient-to-r from-accent via-sky-500 to-blue-600 bg-clip-text text-transparent">
                tous les usages du quotidien.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-7 text-slate-600 md:text-lg">
              Que vous receviez, livriez, vendiez ou opériez — Adresse GN s&apos;adapte à votre besoin.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 md:mt-16 md:grid-cols-2 lg:grid-cols-4">
            {USAGES.map((item, index) => (
              <Reveal key={item.tag} delay={index * 80}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-2 hover:border-transparent hover:shadow-[0_25px_60px_-15px_rgba(15,23,42,0.15)] md:p-7">
                  {/* Fond gradient qui apparaît au hover */}
                  <div aria-hidden className={cn(
                    "absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-[0.04] bg-gradient-to-br",
                    item.grad,
                  )} />

                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <span className={cn(
                      "flex size-12 items-center justify-center rounded-2xl text-white shadow-lg bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 md:size-14",
                      item.grad,
                    )}>
                      <item.icone className="size-5 md:size-6" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {item.tag}
                    </span>
                  </div>

                  {/* Titre + scénario */}
                  <h3 className="text-display mt-5 text-lg font-bold leading-snug text-slate-950 md:text-xl">
                    {item.titre}
                  </h3>
                  <p className="mt-3 rounded-xl border-l-2 border-accent/30 bg-slate-50/70 px-3 py-2 text-[13px] italic leading-5 text-slate-600">
                    {item.scenario}
                  </p>

                  {/* Features */}
                  <ul className="mt-4 flex-1 space-y-2">
                    {item.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Lien discret */}
                  <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors group-hover:text-accent">
                    <span>En savoir plus</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL — premium avec parcours + confiance ===== */}
      <section className="bg-white px-4 py-16 md:px-8 md:py-28">
        <Reveal className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[32px] border border-slate-200 shadow-2xl">
            <div className="grid lg:grid-cols-5">
              {/* Colonne gauche — pitch + parcours */}
              <div className="relative overflow-hidden gradient-signature-soft p-8 md:p-14 lg:col-span-3">
                {/* Décors */}
                <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />

                <div className="relative">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
                    <Sparkles className="size-3 text-accent" /> Commencer
                  </span>
                  <h2 className="text-display mt-4 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                    Obtenez votre adresse{" "}
                    <span className="whitespace-nowrap">en 15 minutes.</span>
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85 md:text-base">
                    Un agent Adresse GN vient chez vous, pose la plaque numérique et active votre numéro. Simple, rapide, définitif.
                  </p>

                  {/* Mini-parcours 3 étapes */}
                  <ol className="mt-7 grid grid-cols-3 gap-2">
                    {PARCOURS.map((p, i) => (
                      <li key={p.num} className="relative">
                        <div className="flex flex-col items-start gap-2 rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                          <div className="flex items-center gap-2">
                            <span className="flex size-6 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-900">
                              {p.num}
                            </span>
                            <p.icone className="size-3.5 text-white/80" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{p.titre}</p>
                            <p className="mt-0.5 text-[10px] text-white/70">{p.texte}</p>
                          </div>
                        </div>
                        {i < PARCOURS.length - 1 && (
                          <div aria-hidden className="pointer-events-none absolute right-[-8px] top-1/2 hidden -translate-y-1/2 text-white/40 sm:block">
                            <ArrowRight className="size-3.5" />
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>

                  {/* Prix indicatif */}
                  <div className="mt-6 flex items-baseline gap-2 text-white">
                    <span className="text-[11px] uppercase tracking-wider text-white/70">À partir de</span>
                    <span className="text-2xl font-extrabold">150 000 GNF</span>
                    <span className="text-[11px] text-white/70">/ adresse · pose incluse</span>
                  </div>

                  {/* CTAs */}
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button asChild className="h-12 bg-white px-8 text-base font-semibold text-slate-900 shadow-lg hover:bg-white/95 hover:scale-[1.02] transition-transform">
                      <Link to="/commander">
                        Créer mon Adresse GN
                        <ArrowRight className="ml-1 size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-12 border-white/40 bg-transparent px-8 text-base font-medium text-white hover:bg-white/10 hover:text-white">
                      <Link to="/tarifs">Voir les tarifs</Link>
                    </Button>
                  </div>

                  {/* Badges de confiance */}
                  <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                    {CONFIANCE.map((c) => (
                      <span key={c.texte} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/85">
                        <c.icone className="size-3.5 text-accent" />
                        {c.texte}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Colonne droite — preview plaque physique */}
              <div className="relative flex flex-col justify-center bg-slate-50 p-6 md:p-10 lg:col-span-2">
                <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 shadow-sm">
                  <MapPinned className="size-3.5 text-accent" />
                  Votre plaque
                </div>

                {/* Plaque simulée */}
                <div className="relative rounded-2xl border-2 border-slate-800 bg-white p-5 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">ADRESSE GN</span>
                    <span className="flex size-2 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50" />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="min-w-0 flex-1 font-mono text-lg font-extrabold tracking-tight text-slate-900 md:text-xl">
                      GN-CKY-582741
                    </span>
                    <svg viewBox="0 0 21 21" aria-hidden className="size-14 shrink-0 text-slate-900" fill="currentColor">
                      <path d="M0 0h7v7H0V0zm2 2v3h3V2H2zM14 0h7v7h-7V0zm2 2v3h3V2h-3zM0 14h7v7H0v-7zm2 2v3h3v-3H2z" />
                      <path d="M9 0h2v2H9V0zM9 3h2v2H9V3zM12 9h2v2h-2V9zM9 9h2v2H9V9zM9 12h2v2H9v-2zM12 12h2v2h-2v-2zM16 9h2v2h-2V9zM19 9h2v2h-2V9zM16 12h2v2h-2v-2zM19 14h2v2h-2v-2zM16 16h2v2h-2v-2zM12 16h2v2h-2v-2zM9 19h2v2H9v-2zM12 19h2v2h-2v-2zM16 19h2v2h-2v-2zM19 19h2v2h-2v-2zM0 9h2v2H0V9zM3 9h2v2H3V9zM6 9h2v2H6V9zM3 12h2v2H3v-2z" />
                    </svg>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-600">
                  Plaque physique en aluminium anodisé, posée par un agent agréé. Résistante aux intempéries et lisible à distance.
                </p>

                {/* Mini-stats */}
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <p className="text-lg font-extrabold text-slate-900">15<span className="text-sm text-slate-500">min</span></p>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-500">Pose sur place</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <p className="text-lg font-extrabold text-slate-900">±3<span className="text-sm text-slate-500">m</span></p>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-500">Précision GPS</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <p className="text-lg font-extrabold text-slate-900">24/7</p>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-500">Accessible</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <InstallBanner variant="bottom" />
      <QrScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={gererScanQr} title="Scanner un QR d'adresse" />
    </div>
  );
}
