// src/components/agent/AgentBottomNav.tsx
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ScanLine, MapPin, History, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/agent", label: "Accueil", icon: Home, exact: true },
  { to: "/agent/scanner", label: "Scanner", icon: ScanLine },
  { to: "/agent/poser", label: "Poser", icon: MapPin, primary: true },
  { to: "/agent/historique", label: "Historique", icon: History },
  { to: "/agent/compte", label: "Compte", icon: User },
];

function vibrate() { try { navigator.vibrate?.(15); } catch {} }

export function AgentBottomNav({ counts }: { counts?: Partial<Record<string, number>> }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* Espaceur pour le contenu (hauteur de la nav + safe-area) */}
      <div style={{ height: "calc(72px + env(safe-area-inset-bottom, 0px))" }} aria-hidden />

      <nav
        className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Navigation principale"
      >
        <div className="grid grid-cols-5 h-[72px]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            const count = counts?.[tab.to];
            return (
              <Link
                key={tab.to}
                to={tab.to}
                onClick={vibrate}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 relative transition-colors",
                  active ? "text-orange-600" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {tab.primary ? (
                  <div className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center shadow-lg -mt-4 transition-all",
                    active
                      ? "bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 text-white scale-110"
                      : "bg-gradient-to-br from-slate-800 to-slate-900 text-white",
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                ) : (
                  <div className="relative">
                    <Icon className={cn("h-6 w-6 transition-transform", active && "scale-110")} />
                    {count != null && count > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </div>
                )}
                <span className={cn("text-[10px] font-semibold uppercase tracking-wide", active && "text-orange-600")}>
                  {tab.label}
                </span>
                {active && !tab.primary && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-8 rounded-b-full bg-orange-500" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

