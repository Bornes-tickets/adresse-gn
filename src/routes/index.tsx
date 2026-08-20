import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bike, Building2, Check, Home as HomeIcon, MapPin, Mic, MicOff,
  QrCode, Search, UtensilsCrossed, Sparkles, ShieldCheck, Zap, ArrowRight,
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
const ATOUTS = ["home.product.perks.qr", "home.product.perks.apps", "home.product.perks.noInstall"];
const USAGES = [
  { icone: HomeIcon, cle: "individuals", grad: "from-emerald-500 to-teal-600" },
  { icone: UtensilsCrossed, cle: "shops", grad: "from-orange-500 to-rose-600" },
  { icone: Bike, cle: "delivery", grad: "from-violet-500 to-fuchsia-600" },
  { icone: Building2, cle: "companies", grad: "from-sky-500 to-blue-600" },
];
const CHIFFRES = [
  { valeur: "100%", label: "Guinée couverte", icone: MapPin },
  { valeur: "0 s", label: "Sans installation", icone: Zap },
  { valeur: "Gratuit", label: "Pour tous", icone: ShieldCheck },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADRESSE GN — Un lieu, un numéro, un itinéraire" },
      { name: "description", content: "Trouvez ou partagez n'importe quelle adresse en Guinée grâce à un simple numéro unique." },
      { property: "og:title", content: "ADRESSE GN — Un lieu, un numéro, un itinéraire" },
      { property: "og:description", content: "Envoyez votre adresse comme un numéro de téléphone." },
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
      } else toast.error(`Non compris : "${brut}". Dites par ex. "GN CKY 582741"`);
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
        {/* Blobs décoratifs */}
        <div aria-hidden className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative mx-auto w-full max-w-5xl px-4 pt-10 pb-16 sm:px-6 md:pt-16 md:pb-24 lg:px-8">
          {/* Badge */}
          <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur-md border border-white/20">
            <Sparkles className="size-3.5 text-white" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white">Système d'adressage QR</span>
          </div>

          {/* Titre */}
          <h1
            className="text-display mt-6 text-center font-extrabold leading-[1.05] text-white whitespace-nowrap"
            style={{ textShadow: "0 1px 12px rgb(15 23 42 / 0.18)", fontSize: "clamp(0.95rem, 4.7vw, 3.75rem)" }}
          >
            {t("home.hero.title")}
          </h1>

          {/* Sous-titre */}
          <p className="mx-auto mt-4 md:mt-5 max-w-xl text-center text-sm md:text-lg leading-relaxed text-white/90 lg:max-w-none line-clamp-2 md:line-clamp-none">
            {t("home.hero.subtitle")}
          </p>

          {/* Barre de recherche */}
          <div className="mt-8 md:mt-10 rounded-3xl bg-white p-2.5 md:p-3 shadow-2xl ring-1 ring-slate-900/5">
            <form className="flex flex-col gap-2 md:flex-row md:gap-3" onSubmit={(e) => { e.preventDefault(); void rechercher(numero); }}>
              <div className="flex min-w-0 flex-1 items-center gap-0.5 rounded-2xl border border-slate-200 pl-4 pr-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
                <input
                  value={numero}
                  onChange={(e) => { setNumero(e.target.value); setErreur(null); }}
                  placeholder="GN-CKY-______"
                  aria-label={t("home.hero.inputLabel")}
                  aria-invalid={!!erreur}
                  className="h-14 w-full min-w-0 bg-transparent font-mono text-lg font-semibold tracking-[0.08em] text-slate-900 outline-hidden placeholder:font-normal placeholder:text-slate-400 sm:text-xl"
                />
                {/* Micro voix */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={ecoute ? arreterVoix : demarrerVoix}
                      aria-label={ecoute ? "Arrêter" : "Dicter"}
                      className={cn(
                        "shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-all active:scale-95",
                        ecoute
                          ? "bg-rose-500 text-white animate-pulse"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {ecoute ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{ecoute ? "En écoute…" : "Dicter"}</TooltipContent>
                </Tooltip>
                {/* Scan QR */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      aria-label="Scanner un QR"
                      className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white flex items-center justify-center transition-all active:scale-95 hover:from-slate-800 hover:to-slate-600 ml-1"
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
                className="h-14 w-full rounded-2xl bg-accent px-8 text-base font-semibold text-accent-foreground shadow-md transition-all hover:bg-accent-dark active:scale-95 md:w-auto"
              >
                <Search className="size-5" />
                {enCours ? t("home.hero.searching") : t("home.hero.search")}
              </Button>
            </form>
            {erreur && <p role="alert" className="mt-3 px-2 text-sm text-destructive">{erreur}</p>}
          </div>

          {/* Exemples */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-white/70 uppercase tracking-wider font-semibold">Essayez :</span>
            {EXEMPLES.map((exemple) => (
              <Link
                key={exemple}
                to="/a/$number"
                params={{ number: exemple }}
                className="rounded-full border border-white/25 bg-white/5 px-3 py-1 font-mono text-xs text-white/90 backdrop-blur-sm transition-all hover:border-white/60 hover:bg-white/10 active:scale-95"
              >
                {exemple}
              </Link>
            ))}
          </div>

          {/* 3 chiffres clés */}
          <div className="mt-10 grid grid-cols-3 gap-2 md:gap-4">
            {CHIFFRES.map(({ valeur, label, icone: Icon }) => (
              <div key={label} className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3 md:p-4 text-center">
                <Icon className="size-4 md:size-5 text-white/80 mx-auto" />
                <div className="mt-1.5 text-lg md:text-2xl font-bold text-white leading-none">{valeur}</div>
                <div className="mt-1 text-[10px] md:text-xs text-white/75 uppercase tracking-wide font-semibold leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== PRODUIT ==================== */}
      <section id="comment-ca-marche" className="bg-white px-6 py-14 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:gap-16 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>{t("home.product.eyebrow")}</Eyebrow>
            <h2 className="text-display mt-3 md:mt-4 text-2xl md:text-4xl font-bold tracking-tight text-slate-900">
              {t("home.product.title")}
            </h2>
            <p className="mt-4 md:mt-5 text-base md:text-lg leading-relaxed text-slate-600">{t("home.product.text")}</p>
            <ul className="mt-6 md:mt-8 space-y-2.5 md:space-y-3">
              {ATOUTS.map((atout) => (
                <li key={atout} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
                    <Check className="size-3 text-accent" />
                  </div>
                  <span className="text-sm text-slate-700">{t(atout)}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-6 md:mt-8 h-12 border-slate-300 bg-transparent px-6 text-base font-medium text-slate-700 hover:bg-slate-50 group">
              <Link to="/a/$number" params={{ number: "GN-CKY-582741" }}>
                {t("home.product.example")}
                <ArrowRight className="size-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
          </Reveal>
          <Reveal delay={120} className="relative">
            <div aria-hidden className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative mx-auto aspect-9/19 max-w-[260px] md:max-w-[280px] rotate-[-3deg] overflow-hidden rounded-[2.5rem] border-8 border-slate-900 bg-white shadow-2xl">
              <div className="flex h-full flex-col">
                <div className="gradient-signature-soft px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                  Adresse GN
                </div>
                <div className="relative flex-1 bg-slate-100">
                  <MapPin className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-accent" />
                </div>
                <div className="space-y-3 bg-white p-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-bold text-slate-900">{t("home.product.mockName")}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">GN-CKY-582741</p>
                    <p className="mt-1 text-xs text-slate-500">{t("home.product.mockZone")}</p>
                  </div>
                  <div className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-foreground">
                    {t("home.product.goThere")}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
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
