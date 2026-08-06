import { Check } from "lucide-react";

import { ETAPES } from "@/lib/install";
import { cn } from "@/lib/utils";

/** Progression visuelle : cercles numérotés + connecteurs. */
export function StepIndicator({ etape }: { etape: number }) {
  return (
    <div className="flex items-center gap-1">
      {ETAPES.map((label, index) => {
        const numero = index + 1;
        const faite = numero < etape;
        const active = numero === etape;
        return (
          <div key={label} className="flex flex-1 items-center gap-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                  faite && "border-accent bg-accent text-accent-foreground",
                  active && "border-primary bg-primary text-primary-foreground",
                  !faite && !active && "border-border bg-muted text-muted-foreground",
                )}
              >
                {faite ? <Check className="size-4" /> : numero}
              </span>
              <span
                className={cn(
                  "text-[0.65rem]",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {numero < ETAPES.length && (
              <span
                className={cn(
                  "mb-4 h-0.5 flex-1 rounded",
                  faite ? "bg-accent" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
