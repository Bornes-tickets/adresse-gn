// src/components/agent/GpsAcquisition.tsx
import { useEffect } from "react";
import { MapPin, Loader2, Target, AlertTriangle, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHighAccuracyGps, type GpsPoint, type GpsQuality } from "@/hooks/useHighAccuracyGps";
import { cn } from "@/lib/utils";

interface Props {
  /** Se déclenche automatiquement au montage. Défaut : true. */
  autoStart?: boolean;
  /** Précision cible en mètres avant d'être "prêt". Défaut : 5. */
  targetAccuracy?: number;
  /** Callback quand la meilleure position est prête. */
  onReady?: (point: GpsPoint) => void;
}

const QUALITY_STYLES: Record<GpsQuality, { cls: string; label: string; icon: any }> = {
  excellent: { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Excellent", icon: Target },
  bon: { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Bon", icon: Target },
  moyen: { cls: "bg-amber-100 text-amber-700 border-amber-200", label: "Moyen", icon: MapPin },
  faible: { cls: "bg-rose-100 text-rose-700 border-rose-200", label: "Faible", icon: AlertTriangle },
  aucun: { cls: "bg-slate-100 text-slate-500 border-slate-200", label: "Aucun signal", icon: AlertTriangle },
};

export function GpsAcquisition({ autoStart = true, targetAccuracy = 5, onReady }: Props) {
  const gps = useHighAccuracyGps({ targetAccuracy });

  useEffect(() => { if (autoStart) gps.acquire(); /* eslint-disable-next-line */ }, [autoStart]);
  useEffect(() => { if (gps.status === "done" && gps.best) onReady?.(gps.best); }, [gps.status, gps.best, onReady]);

  const q = QUALITY_STYLES[gps.quality];
  const QIcon = q.icon;
  const acquiring = gps.status === "acquiring";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between",
        gps.status === "done" ? "bg-emerald-50" : gps.status === "error" || gps.status === "denied" ? "bg-rose-50" : "bg-slate-50",
      )}>
        <div className="flex items-center gap-2">
          {gps.status === "done" ? <Check className="h-5 w-5 text-emerald-600" />
            : acquiring ? <Loader2 className="h-5 w-5 text-orange-600 animate-spin" />
            : <MapPin className="h-5 w-5 text-slate-500" />}
          <span className="font-semibold text-sm">
            {gps.status === "done" ? "Position acquise"
              : acquiring ? "Acquisition GPS…"
              : gps.status === "denied" ? "Autorisation refusée"
              : gps.status === "error" ? "Erreur GPS"
              : "En attente"}
          </span>
        </div>
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide", q.cls)}>
          <QIcon className="h-3 w-3" />{q.label}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Progression */}
        {acquiring && (
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Mesures : {gps.count} / 5</span>
              <span>{gps.progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full transition-all" style={{ width: `${gps.progress}%` }} />
            </div>
          </div>
        )}

        {/* Précision */}
        {gps.best && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-2">
              <div className="text-[9px] uppercase text-slate-500 font-semibold">Latitude</div>
              <div className="font-mono text-xs font-bold mt-0.5">{gps.best.lat.toFixed(6)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <div className="text-[9px] uppercase text-slate-500 font-semibold">Longitude</div>
              <div className="font-mono text-xs font-bold mt-0.5">{gps.best.lng.toFixed(6)}</div>
            </div>
            <div className={cn("rounded-lg p-2", gps.best.accuracy <= targetAccuracy ? "bg-emerald-50" : "bg-amber-50")}>
              <div className="text-[9px] uppercase font-semibold">Précision</div>
              <div className="font-mono text-xs font-bold mt-0.5">± {gps.best.accuracy.toFixed(1)} m</div>
            </div>
          </div>
        )}

        {gps.error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{gps.error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {(gps.status === "idle" || gps.status === "error" || gps.status === "denied") && (
            <Button size="lg" className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white h-12" onClick={gps.acquire}>
              <Target className="h-4 w-4 mr-2" />Démarrer GPS
            </Button>
          )}
          {gps.status === "done" && (
            <Button size="lg" variant="outline" className="flex-1 h-12" onClick={gps.acquire}>
              <RotateCcw className="h-4 w-4 mr-2" />Réacquérir
            </Button>
          )}
          {acquiring && (
            <Button size="lg" variant="outline" className="flex-1 h-12" onClick={gps.stop}>Arrêter</Button>
          )}
        </div>
      </div>
    </div>
  );
}

