import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PRECISION_LIMITE,
  PRECISION_OK,
  moyenne,
  precisionCouleur,
  type InstallMeasure,
} from "@/lib/install";
import { cn } from "@/lib/utils";

interface Props {
  mesures: InstallMeasure[];
  onMesures: (mesures: InstallMeasure[]) => void;
}

/** Étape 2 — capture de 3 mesures GPS espacées de 2 secondes. */
export function StepGps({ mesures, onMesures }: Props) {
  const [precision, setPrecision] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const position = useRef<GeolocationPosition | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setErreur("Géolocalisation indisponible sur cet appareil.");
      return;
    }
    const veille = navigator.geolocation.watchPosition(
      (pos) => {
        position.current = pos;
        setPrecision(pos.coords.accuracy);
        setErreur(null);
      },
      (err) => setErreur(`Position indisponible : ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(veille);
  }, []);

  const prendreMesures = async () => {
    setEnCours(true);
    const prises: InstallMeasure[] = [];
    try {
      for (let i = 0; i < 3; i += 1) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2000));
        const pos = position.current;
        if (!pos || pos.coords.accuracy > PRECISION_OK) {
          setErreur(
            `Précision insuffisante : ± ${Math.round(pos?.coords.accuracy ?? 999)} m. ` +
              "Attendez 30 secondes ou déplacez-vous en zone dégagée.",
          );
          setEnCours(false);
          return;
        }
        prises.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          taken_at: new Date().toISOString(),
        });
      }
      onMesures(prises);
      toast.success("3 mesures GPS enregistrées");
    } finally {
      setEnCours(false);
    }
  };

  const precisionMoyenne = mesures.length === 3 ? moyenne(mesures.map((m) => m.accuracy_m)) : null;
  const bonne = precision !== null && precision <= PRECISION_OK;
  const largeur =
    precision === null ? 0 : Math.max(8, Math.min(100, (PRECISION_OK / precision) * 100));

  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-muted-foreground" />
          <span
            className={cn(
              "text-lg font-semibold",
              precision === null ? "text-muted-foreground" : precisionCouleur(precision),
            )}
          >
            {precision === null
              ? "Recherche du signal…"
              : `Précision : ± ${Math.round(precision)} m`}
          </span>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              bonne ? "bg-accent" : "bg-destructive",
            )}
            style={{ width: `${largeur}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Objectif : ± {PRECISION_OK} m ou mieux (au-delà de ± {PRECISION_LIMITE} m la mesure est
          refusée).
        </p>

        <Button
          size="lg"
          className="h-12 w-full"
          disabled={!bonne || enCours}
          onClick={() => void prendreMesures()}
        >
          {enCours && <Loader2 className="size-5 animate-spin" />}
          {enCours ? "Mesure en cours…" : "Prendre les 3 mesures"}
        </Button>

        {erreur && <p className="text-sm font-medium text-destructive">{erreur}</p>}

        {precisionMoyenne !== null && (
          <p className="rounded-md bg-accent/10 px-3 py-2 text-sm font-medium text-accent">
            3 mesures prises, position moyenne calculée à ± {Math.round(precisionMoyenne)} m.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
