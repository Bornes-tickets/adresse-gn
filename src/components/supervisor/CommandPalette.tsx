import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, CalendarClock, ClipboardCheck, FileBarChart2, AlertTriangle,
  MessageSquareWarning, Database, Search, Radio, MapPin, ArrowRight, Zap,
  CheckCircle2, Plus, Palette,
} from "lucide-react";
import {
  supervisorBeacons, supervisorAddresses, supervisorInstallations,
  supervisorReviewInstallation,
} from "@/lib/supervisor.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTheme, ACCENTS } from "./ThemeProvider";

const NAV = [
  { path: "/supervisor", label: "Tableau de bord", icon: LayoutDashboard },
  { path: "/supervisor/planning", label: "Planification", icon: CalendarClock },
  { path: "/supervisor/installations", label: "Validations installations", icon: ClipboardCheck },
  { path: "/supervisor/report-installations", label: "Rapport installations", icon: FileBarChart2 },
  { path: "/supervisor/reports", label: "Signalements", icon: AlertTriangle },
  { path: "/supervisor/claims", label: "Réclamations", icon: MessageSquareWarning },
  { path: "/supervisor/consultations", label: "Consultations", icon: Database },
];

export function CommandPalette({ open, onOpenChange, dark }: { open: boolean; onOpenChange: (v: boolean) => void; dark: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setAccent } = useTheme();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"main" | "validate" | "accent">("main");

  const beaconsFn = useServerFn(supervisorBeacons);
  const addressesFn = useServerFn(supervisorAddresses);
  const installsFn = useServerFn(supervisorInstallations);
  const reviewFn = useServerFn(supervisorReviewInstallation);

  const q = query.trim();
  const hasSearch = q.length >= 2;

  const { data: beacons } = useQuery({
    queryKey: ["cmdk-beacons", q],
    queryFn: () => beaconsFn({ data: { page: 1, pageSize: 5, q } }),
    enabled: hasSearch && mode === "main",
  });

  const { data: addresses } = useQuery({
    queryKey: ["cmdk-addresses", q],
    queryFn: () => addressesFn({ data: { page: 1, pageSize: 5, q } }),
    enabled: hasSearch && mode === "main",
  });

  const { data: pendingInstalls } = useQuery({
    queryKey: ["cmdk-pending-installs"],
    queryFn: () => installsFn({ data: { page: 1, pageSize: 10, validation: "pending" } }),
    enabled: mode === "validate",
  });

  const review = useMutation({
    mutationFn: (id: string) => reviewFn({ data: { installationId: id, reportId: null, decision: "valider" } }),
    onSuccess: () => {
      toast.success("Installation validée.");
      qc.invalidateQueries({ queryKey: ["cmdk-pending-installs"] });
      qc.invalidateQueries({ queryKey: ["sup-installations"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
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

  useEffect(() => {
    if (!open) { setQuery(""); setMode("main"); }
  }, [open]);

  const close = () => onOpenChange(false);
  const go = (path: string) => { close(); navigate({ to: path }); };

  if (!open) return null;

  const wrapperCls = cn(
    "w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200",
    dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
  );

  const itemCls = cn(
    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition",
    dark ? "text-slate-300 aria-selected:bg-slate-800 aria-selected:text-white" : "text-slate-700 aria-selected:bg-indigo-50 aria-selected:text-indigo-700",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className={wrapperCls}>
        <Command shouldFilter={mode !== "main" || !hasSearch}>
          <div className={cn("flex items-center gap-2 px-4 py-3 border-b", dark ? "border-slate-800" : "border-slate-100")}>
            {mode !== "main" && (
              <button
                onClick={() => { setMode("main"); setQuery(""); }}
                className={cn("text-xs px-2 py-1 rounded", dark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
              >
                ← Retour
              </button>
            )}
            <Search className={cn("h-4 w-4", dark ? "text-slate-500" : "text-slate-400")} />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={
                mode === "validate" ? "Filtrer les installations en attente…" :
                mode === "accent" ? "Choisir une couleur d'accent…" :
                "Actions, navigation, balises, adresses…"
              }
              className={cn("flex-1 bg-transparent border-0 outline-none text-sm", dark ? "text-slate-100 placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400")}
              autoFocus
            />
            <kbd className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono", dark ? "border-slate-700 text-slate-500" : "border-slate-200 text-slate-400")}>ESC</kbd>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className={cn("py-8 text-center text-sm", dark ? "text-slate-500" : "text-slate-400")}>
              Aucun résultat.
            </Command.Empty>

            {/* --------------------- MODE MAIN --------------------- */}
            {mode === "main" && (
              <>
                <Command.Group heading="Actions rapides">
                  <Command.Item value="créer planification nouvelle" onSelect={() => go("/supervisor/planning")} className={itemCls}>
                    <div className="h-6 w-6 rounded flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1">Nouvelle planification d'installation</span>
                    <ArrowRight className="h-3 w-3 opacity-0 aria-selected:opacity-100" />
                  </Command.Item>
                  <Command.Item value="valider installation qc" onSelect={() => { setMode("validate"); setQuery(""); }} className={itemCls}>
                    <div className="h-6 w-6 rounded flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1">Valider une installation…</span>
                    <ArrowRight className="h-3 w-3 opacity-0 aria-selected:opacity-100" />
                  </Command.Item>
                  <Command.Item value="couleur accent thème" onSelect={() => { setMode("accent"); setQuery(""); }} className={itemCls}>
                    <div className="h-6 w-6 rounded flex items-center justify-center bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white">
                      <Palette className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1">Changer la couleur d'accent…</span>
                    <ArrowRight className="h-3 w-3 opacity-0 aria-selected:opacity-100" />
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Navigation" className="mt-2">
                  {NAV.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Command.Item key={a.path} value={a.label} onSelect={() => go(a.path)} className={itemCls}>
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{a.label}</span>
                        <ArrowRight className="h-3 w-3 opacity-0 aria-selected:opacity-100" />
                      </Command.Item>
                    );
                  })}
                </Command.Group>

                {hasSearch && beacons && beacons.rows.length > 0 && (
                  <Command.Group heading="Balises" className="mt-2">
                    {beacons.rows.map((b: any) => (
                      <Command.Item key={b.id} value={`balise ${b.public_number}`} onSelect={() => go(`/supervisor/consultations`)} className={itemCls}>
                        <Radio className="h-4 w-4 text-indigo-500" />
                        <span className="font-mono flex-1">{b.public_number}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", dark ? "bg-slate-800" : "bg-slate-100")}>{b.status}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {hasSearch && addresses && addresses.rows.length > 0 && (
                  <Command.Group heading="Adresses" className="mt-2">
                    {addresses.rows.map((a: any) => (
                      <Command.Item key={a.id} value={`adresse ${a.name}`} onSelect={() => go(`/supervisor/consultations`)} className={itemCls}>
                        <MapPin className="h-4 w-4 text-emerald-500" />
                        <span className="flex-1">{a.name ?? a.beacon_number}</span>
                        <span className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>{a.commune_name}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            )}

            {/* --------------------- MODE VALIDATE --------------------- */}
            {mode === "validate" && (
              <Command.Group heading="Installations en attente">
                {pendingInstalls?.rows.length === 0 ? (
                  <div className={cn("py-6 text-center text-sm", dark ? "text-slate-500" : "text-slate-400")}>
                    Aucune installation en attente.
                  </div>
                ) : (
                  pendingInstalls?.rows.map((i: any) => (
                    <Command.Item
                      key={i.id}
                      value={`${i.beacon_number} ${i.agent_badge}`}
                      onSelect={() => {
                        review.mutate(i.id);
                        close();
                      }}
                      className={itemCls}
                    >
                      <Zap className="h-4 w-4 text-emerald-500" />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs">{i.beacon_number ?? "—"}</div>
                        <div className={cn("text-[11px]", dark ? "text-slate-500" : "text-slate-400")}>
                          Agent {i.agent_badge ?? "—"} · ±{Math.round(i.accuracy_m ?? 0)}m
                        </div>
                      </div>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700")}>Valider</span>
                    </Command.Item>
                  ))
                )}
              </Command.Group>
            )}

            {/* --------------------- MODE ACCENT --------------------- */}
            {mode === "accent" && (
              <Command.Group heading="Couleur d'accent">
                {ACCENTS.map((a) => (
                  <Command.Item
                    key={a.key}
                    value={a.label}
                    onSelect={() => { setAccent(a.key); toast.success(`Accent ${a.label} appliqué.`); close(); }}
                    className={itemCls}
                  >
                    <div className="h-5 w-5 rounded-full shadow-inner" style={{ backgroundColor: a.hex }} />
                    <span className="flex-1">{a.label}</span>
                    <span className="text-[10px] font-mono opacity-60">{a.hex}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className={cn("border-t px-3 py-2 flex items-center justify-between text-[10px]", dark ? "border-slate-800 text-slate-500" : "border-slate-100 text-slate-400")}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><kbd className={cn("px-1 rounded border font-mono", dark ? "border-slate-700" : "border-slate-200")}>↑↓</kbd> naviguer</span>
              <span className="flex items-center gap-1"><kbd className={cn("px-1 rounded border font-mono", dark ? "border-slate-700" : "border-slate-200")}>↵</kbd> exécuter</span>
            </div>
            <span>Adresse GN</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
