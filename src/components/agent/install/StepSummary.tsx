import { Pencil, Radio, MapPin, Camera, Info, ShieldCheck, ShieldAlert, Sparkles, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { categoryLabel } from "@/lib/geo";
import { moyenne, type InstallMeasure } from "@/lib/install";
import type { InstallDetails } from "@/components/agent/install/types";
import { cn } from "@/lib/utils";

interface Props {
  numero: string;
  mesures: InstallMeasure[];
  photo: string | null;
  details: InstallDetails;
  onModifier: (etape: number) => void;
}

function Section({ titre, icon: Icon, color, etape, onModifier, children }: {
  titre: string; icon: any; color: string; etape: number; onModifier: (etape: number) => void; children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-600",
    sky: "from-sky-500 to-blue-600",
    violet: "from-violet-500 to-fuchsia-600",
  };
  return (
    <Card className="overflow-hidden border-slate-200">
      <div className={cn("h-1 bg-gradient-to-r", colors[color])} />
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-sm", colors[color])}>
              <Icon className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">{titre}</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onModifier(etape)} className="text-slate-500 hover:text-slate-900 h-8">
            <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
          </Button>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm py-1">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-slate-900">{valeur}</span>
    </div>
  );
}

export function StepSummary({ numero, mesures, photo, details, onModifier }: Props) {
  const lat = moyenne(mesures.map((m) => m.lat));
  const lng = moyenne(mesures.map((m) => m.lng));
  const precision = moyenne(mesures.map((m) => m.accuracy_m));
  const pret = mesures.length === 3 && photo && details.consent;

  return (
    <div className="space-y-4">
      {/* Bandeau "prêt à envoyer" */}
      <Card className={cn(
        "border-0 shadow-lg overflow-hidden",
        pret ? "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600" : "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500",
      )}>
        <div className="p-5 text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-md">
              {pret ? <CheckCircle2 className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/80 font-semibold">Récapitulatif</div>
              <div className="text-lg font-bold">
                {pret ? "Prêt à enregistrer" : "Vérifiez les données"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Balise */}
      <Section titre="Balise" icon={Radio} color="indigo" etape={1} onModifier={onModifier}>
        <div className="text-center py-2">
          <div className="font-mono text-2xl font-bold text-slate-900 tracking-tight">{numero}</div>
        </div>
      </Section>

      {/* Position GPS */}
      <Section titre="Position GPS" icon={MapPin} color="emerald" etape={2} onModifier={onModifier}>
        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Latitude</div>
            <div className="font-mono text-sm font-semibold text-slate-900">{lat.toFixed(6)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Longitude</div>
            <div className="font-mono text-sm font-semibold text-slate-900">{lng.toFixed(6)}</div>
          </div>
          <div className="col-span-2 pt-2 border-t border-emerald-200/60">
            <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Précision moyenne</div>
            <div className="font-mono text-lg font-bold text-emerald-700">± {Math.round(precision)} m</div>
          </div>
        </div>
      </Section>

      {/* Photo */}
      <Section titre="Photo" icon={Camera} color="sky" etape={3} onModifier={onModifier}>
        {photo ? (
          <img src={photo} alt="Entrée de l'adresse" className="w-full h-40 rounded-xl border-2 border-sky-100 object-cover shadow-sm" />
        ) : (
          <div className="rounded-xl border-2 border-dashed border-rose-300 bg-rose-50 py-8 text-center">
            <div className="text-sm font-semibold text-rose-700">Photo manquante</div>
          </div>
        )}
      </Section>

      {/* Détails */}
      <Section titre="Détails de l'adresse" icon={Info} color="violet" etape={4} onModifier={onModifier}>
        <div className="space-y-0.5 divide-y divide-slate-100">
          <Ligne label="Catégorie" valeur={categoryLabel(details.category)} />
          <Ligne label="Nom du lieu" valeur={details.name || "—"} />
          <Ligne label="Visibilité" valeur={details.visibility === "public" ? "Publique" : "Privée"} />
          <Ligne label="Point d'accès" valeur={details.access_point_note || "—"} />
          <Ligne label="Propriétaire" valeur={details.owner_name || "—"} />
          <Ligne label="Téléphone" valeur={details.owner_phone || "—"} />
        </div>
        <div className="pt-3 mt-2 border-t border-slate-100">
          {details.consent ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1.5">
              <ShieldCheck className="h-3 w-3" /> Consentement RGPD obtenu
            </Badge>
          ) : (
            <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1.5">
              <ShieldAlert className="h-3 w-3" /> Consentement manquant
            </Badge>
          )}
        </div>
      </Section>

      {/* Astuce */}
      <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
        <span>Vérifiez chaque section. Un envoi ne peut plus être annulé une fois validé.</span>
      </div>
    </div>
  );
}
