import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  CalendarClock,
  ClipboardCheck,
  FileBarChart2,
  AlertTriangle,
  MessageSquareWarning,
  Database,
  Search,
  Radio,
  MapPin,
  User,
  ArrowRight,
} from "lucide-react";
import { supervisorBeacons, supervisorAddresses } from "@/lib/supervisor.functions";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { path: "/supervisor", label: "Tableau de bord", icon: LayoutDashboard, group: "Navigation" },
  { path: "/supervisor/planning", label: "Planification", icon: CalendarClock, group: "Navigation" },
  { path: "/supervisor/installations", label: "Validations installations", icon: ClipboardCheck, group: "Navigation" },
  { path: "/supervisor/report-installations", label: "Rapport installations", icon: FileBarChart2, group: "Navigation" },
  { path: "/supervisor/reports", label: "Signalements", icon: AlertTriangle, group: "Navigation" },
  { path: "/supervisor/claims", label: "Réclamations", icon: MessageSquareWarning, group: "Navigation" },
  { path: "/supervisor/consultations", label: "Consultations", icon: Database, group: "Navigation" },
];

export function CommandPalette({ open, onOpenChange, dark }: { open: boolean; onOpenChange: (v: boolean) => void; dark: boolean }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const beaconsFn = useServerFn(supervisorBeacons);
  const addressesFn = useServerFn(supervisorAddresses);

  const q = query.trim();
  const hasSearch = q.length >= 2;

  const { data: beacons } = useQuery({
    queryKey: ["cmdk-beacons", q],
    queryFn: () => beaconsFn({ data: { page: 1, pageSize: 5, q } }),
    enabled: hasSearch,
  });

  const { data: addresses } = useQuery({
    queryKey: ["cmdk-addresses", q],
    queryFn: () => addressesFn({ data: { page: 1, pageSize: 5, q } }),
    enabled: hasSearch,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const go = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate({ to: path });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => onOpenChange(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200",
          dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
        )}
      >
        <Command shouldFilter={!hasSearch}>
          <div className={cn("flex items-center gap-2 px-4 py-3 border-b", dark ? "border-slate-800" : "border-slate-100")}>
            <Search className={cn("h-4 w-4", dark ? "text-slate-500" : "text-slate-400")} />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Rechercher une action, balise, adresse…"
              className={cn(
                "flex-1 bg-transparent border-0 outline-none text-sm",
                dark ? "text-slate-100 placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400",
              )}
              autoFocus
            />
            <kbd className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono", dark ? "border-slate-700 text-slate-500" : "border-slate-200 text-slate-400")}>ESC</kbd>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className={cn("py-8 text-center text-sm", dark ? "text-slate-500" : "text-slate-400")}>
              Aucun résultat.
            </Command.Empty>

            <Command.Group heading="Navigation" className={cn("text-[10px] font-semibold uppercase tracking-widest px-2 py-1.5", dark ? "text-slate-500" : "text-slate-400")}>
              {ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Command.Item
                    key={a.path}
                    value={`${a.label} ${a.path}`}
                    onSelect={() => go(a.path)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition",
                      dark
                        ? "text-slate-300 aria-selected:bg-slate-800 aria-selected:text-white"
                        : "text-slate-700 aria-selected:bg-indigo-50 aria-selected:text-indigo-700",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{a.label}</span>
                    <ArrowRight className="h-3 w-3 opacity-0 aria-selected:opacity-100" />
                  </Command.Item>
                );
              })}
            </Command.Group>

            {hasSearch && beacons && beacons.rows.length > 0 && (
              <Command.Group heading="Balises" className={cn("text-[10px] font-semibold uppercase tracking-widest px-2 py-1.5 mt-2", dark ? "text-slate-500" : "text-slate-400")}>
                {beacons.rows.map((b: any) => (
                  <Command.Item
                    key={b.id}
                    value={`balise ${b.public_number}`}
                    onSelect={() => go(`/supervisor/consultations?tab=beacons&q=${b.public_number}`)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition",
                      dark ? "text-slate-300 aria-selected:bg-slate-800" : "text-slate-700 aria-selected:bg-indigo-50 aria-selected:text-indigo-700",
                    )}
                  >
                    <Radio className="h-4 w-4 text-indigo-500" />
                    <span className="font-mono flex-1">{b.public_number}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded", dark ? "bg-slate-800" : "bg-slate-100")}>{b.status}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {hasSearch && addresses && addresses.rows.length > 0 && (
              <Command.Group heading="Adresses" className={cn("text-[10px] font-semibold uppercase tracking-widest px-2 py-1.5 mt-2", dark ? "text-slate-500" : "text-slate-400")}>
                {addresses.rows.map((a: any) => (
                  <Command.Item
                    key={a.id}
                    value={`adresse ${a.name}`}
                    onSelect={() => go(`/supervisor/consultations?tab=addresses&id=${a.id}`)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition",
                      dark ? "text-slate-300 aria-selected:bg-slate-800" : "text-slate-700 aria-selected:bg-indigo-50 aria-selected:text-indigo-700",
                    )}
                  >
                    <MapPin className="h-4 w-4 text-emerald-500" />
                    <span className="flex-1">{a.name ?? a.beacon_number}</span>
                    <span className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>{a.commune_name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className={cn("border-t px-3 py-2 flex items-center justify-between text-[10px]", dark ? "border-slate-800 text-slate-500" : "border-slate-100 text-slate-400")}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><kbd className={cn("px-1 rounded border font-mono", dark ? "border-slate-700" : "border-slate-200")}>↑↓</kbd> naviguer</span>
              <span className="flex items-center gap-1"><kbd className={cn("px-1 rounded border font-mono", dark ? "border-slate-700" : "border-slate-200")}>↵</kbd> ouvrir</span>
            </div>
            <span>Adresse GN</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
