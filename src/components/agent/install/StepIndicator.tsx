import { Check, Radio, MapPin, Camera, ListChecks, Sparkles } from "lucide-react";
import { ETAPES } from "@/lib/install";
import { cn } from "@/lib/utils";

const ICONS = [Radio, MapPin, Camera, ListChecks, Sparkles];
const COLORS = [
  { active: "from-indigo-500 to-blue-600", done: "from-indigo-500 to-blue-600" },
  { active: "from-emerald-500 to-teal-600", done: "from-emerald-500 to-teal-600" },
  { active: "from-sky-500 to-cyan-600", done: "from-sky-500 to-cyan-600" },
  { active: "from-violet-500 to-fuchsia-600", done: "from-violet-500 to-fuchsia-600" },
  { active: "from-amber-500 to-orange-600", done: "from-amber-500 to-orange-600" },
];

export function StepIndicator({ etape }: { etape: number }) {
  const Icone = ICONS[etape - 1] ?? Radio;
  const couleur = COLORS[etape - 1] ?? COLORS[0];

  return (
    <div className="space-y-3">
      {/* Version mobile compacte */}
      <div className="sm:hidden">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("h-12 w-12 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg", couleur.active)}>
            <Icone className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Étape {etape} sur {ETAPES.length}
            </div>
            <div className="text-lg font-bold text-slate-900">{ETAPES[etape - 1]}</div>
          </div>
        </div>
        {/* Points de progression */}
        <div className="flex items-center gap-1.5">
          {ETAPES.map((_, i) => {
            const num = i + 1;
            const done = num < etape;
            const active = num === etape;
            const c = COLORS[i];
            return (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all",
                  done || active ? cn("bg-gradient-to-r", c.done) : "bg-slate-200",
                )}
              />
            );
          })}
        </div>
      </div>

      {/* Version desktop enrichie */}
      <div className="hidden sm:flex items-center gap-2">
        {ETAPES.map((label, index) => {
          const numero = index + 1;
          const faite = numero < etape;
          const active = numero === etape;
          const Ic = ICONS[index] ?? Radio;
          const c = COLORS[index];
          return (
            <div key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all shadow-sm",
                  faite && cn("bg-gradient-to-br text-white shadow-md", c.done),
                  active && cn("bg-gradient-to-br text-white shadow-lg scale-110 ring-4 ring-offset-2", c.active,
                    index === 0 ? "ring-indigo-200" : index === 1 ? "ring-emerald-200" : index === 2 ? "ring-sky-200" : index === 3 ? "ring-violet-200" : "ring-amber-200"),
                  !faite && !active && "bg-slate-100 text-slate-400",
                )}>
                  {faite ? <Check className="h-5 w-5" /> : <Ic className="h-5 w-5" />}
                </div>
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  active ? "text-slate-900" : faite ? "text-slate-600" : "text-slate-400",
                )}>
                  {label}
                </span>
              </div>
              {numero < ETAPES.length && (
                <div className={cn("mb-6 h-0.5 flex-1 rounded", faite ? cn("bg-gradient-to-r", c.done) : "bg-slate-200")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
