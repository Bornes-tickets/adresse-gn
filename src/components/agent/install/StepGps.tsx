import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Signal, Sparkles, Compass, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PRECISION_LIMITE, PRECISION_OK, moyenne, precisionCouleur, type InstallMeasure } from "@/lib/install";
import { cn } from "@/lib/utils";

interface Props {
  mesures: InstallMeasure[];
  onMesures: (mesures: InstallMeasure[]) => void;
}

export function StepGps({ mesures, onMesures }: Props) {
  const [precision, setPrecision] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [prisesEnCours, setPrisesEnCours] = useState(0);
  const position = useRef<GeolocationPosition | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setErreur("Géolocalisation indisponible sur cet appareil.");
      return;
    }
    const veille = navigator.geolocation.watchPosition(
      (pos) => { position.current = pos; setPrecision(pos.coords.accuracy); setErreur(null); },
      (err) => setErreur(`Position indisponible : ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(veille);
  }, []);

  const prendreMesures = async () => {
    setEnCours(true);
    setPrisesEnCours(0);
    const prises: InstallMeasure[] = [];
    try {
      for (let i = 0; i < 3; i += 1) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2000));
        const pos = position.current;
        if (!pos || pos.coords.accuracy > PRECISION_OK) {
          setErreur(`Précision insuffisante : ± ${Math.round(pos?.coords.accuracy ?? 999)} m. Attendez 30 secondes ou déplacez-vous en zone dégagée.`);
          setEnCours(false); setPrisesEnCours(0);
          return;
        }
        prises.push({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy, taken_at: new Date().toISOString(),
        });
        setPrisesEnCours(i + 1);
      }
      onMesures(prises);
      toast.success("3 mesures GPS enregistrées");
    } finally { setEnCours(false); }
  };

  const precisionMoyenne = mesures.length === 3 ? moyenne(mesures.map((m) => m.accuracy_m)) : null;
  const bonne = precision !== null && precision <= PRECISION_OK;
  const qualite = precision === null ? "recherche" : precision <= 5 ? "excellente" : precision <= 10 ? "bonne" : precision <= 30 ? "moyenne" : "faible";
  const qualiteColor = qualite === "excellente" ? "from-emerald-500 to-teal-600"
    : qualite === "bonne" ? "from-sky-500 to-blue-600"
    : qualite === "moyenne" ? "from-amber-500 to-orange-500"
    : "from-rose-500 to-red-600";

  return (
    <div className="space-y-4">
      {/* Hero GPS avec compass animé */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-6 text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur mb-3 shadow-lg relative">
              <Compass className={cn("h-8 w-8", precision === null && "animate-spin")} />
              {bonne && (
                <span className="absolute inset-0 rounded-full ring-4 ring-emerald-300/50 animate-ping" />
              )}
            </div>
            <div className="text-xs uppercase tracking-widest text-white/80 font-semibold mb-1">
              {precision === null ? "Recherche du signal…" : `Précision · ${qualite}`}
            </div>
            <div className="text-3xl font-bold font-mono">
              {precision === null ? "—" : `± ${Math.round(precision)} m`}
            </div>
          </div>
        </div>
      </Card>

      {/* Barre de précision + objectif */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1"><Signal className="h-3 w-3" /> Qualité du signal</span>
            <span className="text-slate-500">Objectif ≤ {PRECISION_OK} m</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r transition-all", qualiteColor)}
              style={{ width: precision === null ? "0%" : `${Math.max(8, Math.min(100, (PRECISION_OK / precision) * 100))}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-1 text-[9px] font-semibold text-slate-500">
            <span className="text-emerald-600">≤ 5m Excellente</span>
            <span className="text-sky-600 text-center">≤ 10m Bonne</span>
            <span className="text-amber-600 text-center">≤ 30m Moyenne</span>
            <span className="text-rose-600 text-right">&gt; 30m Faible</span>
          </div>
        </CardContent>
      </Card>

      {/* Compteur de prises en cours */}
      {enCours && (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <div className="flex-1">
              <div className="font-semibold text-slate-900">Mesure en cours…</div>
              <div className="text-xs text-slate-600 mt-0.5">{prisesEnCours} sur 3 prises effectuées</div>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className={cn("h-2 w-2 rounded-full", i < prisesEnCours ? "bg-emerald-500" : "bg-slate-200")} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bouton principal */}
      <Button
        size="lg"
        className="h-14 w-full text-base font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg disabled:from-slate-300 disabled:to-slate-400"
        disabled={!bonne || enCours}
        onClick={() => void prendreMesures()}
      >
        {enCours ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <MapPin className="h-5 w-5 mr-2" />}
        {enCours ? "Mesure en cours…" : "Prendre les 3 mesures GPS"}
      </Button>

      {/* Erreur */}
      {erreur && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{erreur}</span>
        </div>
      )}

      {/* Succès */}
      {precisionMoyenne !== null && (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-emerald-900">3 mesures capturées</div>
              <div className="text-xs text-emerald-700 mt-0.5">Position moyenne · ± {Math.round(precisionMoyenne)} m</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Astuce */}
      <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
        <span>Placez-vous devant la plaque en extérieur, loin des murs et arbres pour améliorer la précision.</span>
      </div>
    </div>
  );
}
