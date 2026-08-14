import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Clock, ListChecks, User as UserIcon, HardHat, Wifi, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { InstallBanner } from "@/components/agent/InstallBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgent } from "@/hooks/useAgent";
import { useOnline } from "@/hooks/useOnline";
import { agentDb } from "@/lib/agent-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agent/_guard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Espace agent — ADRESSE GN" },
      { name: "description", content: "Application terrain des agents installateurs Adresse GN." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AgentShell,
});

const ONGLETS = [
  { to: "/agent/tasks", label: "Tâches", icon: ListChecks, gradient: "from-orange-500 to-rose-600", ring: "ring-orange-500/30" },
  { to: "/agent/history", label: "Historique", icon: Clock, gradient: "from-emerald-500 to-teal-600", ring: "ring-emerald-500/30" },
  { to: "/agent/profile", label: "Profil", icon: UserIcon, gradient: "from-indigo-500 to-violet-600", ring: "ring-indigo-500/30" },
] as const;

function initiales(n: string | null | undefined) {
  if (!n) return "AG";
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function AgentShell() {
  const { user, agent, isAgent, loading } = useAgent();
  const navigate = useNavigate();
  const isOnline = useOnline();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Compteurs live : queue en attente + erreurs de sync
  const pending = useLiveQuery(() => agentDb.install_queue.where("status").equals("pending").count(), [], 0);
  const errors = useLiveQuery(() => agentDb.install_queue.where("status").equals("error").count(), [], 0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/agent/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || (!user && !isAgent)) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isAgent) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
          <AlertTriangle className="h-8 w-8 text-rose-600" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Accès refusé</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Cet espace est réservé aux agents installateurs.
        </p>
        <Link to="/agent/login" className="mt-6 inline-block text-sm text-primary underline">
          Utiliser un autre compte
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
      <InstallBanner />

      {/* HEADER HERO avec gradient et infos agent */}
      <header
        className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 text-white shadow-lg"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
        <div className="relative px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur text-white font-bold shadow-md ring-2 ring-white/30">
                  {initiales(agent?.full_name)}
                </div>
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
                  isOnline ? "bg-emerald-400" : "bg-slate-400",
                )} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-widest text-white/70">
                  Agent · {agent?.badge_number ?? "—"}
                </div>
                <div className="text-base font-bold truncate">
                  {agent?.full_name ?? "Agent"}
                </div>
              </div>
            </div>

            {/* Statut online/offline + badges */}
            <div className="flex items-center gap-2">
              {errors > 0 && (
                <Link to="/agent/sync-issues" className="inline-flex items-center gap-1 rounded-full bg-red-500/80 backdrop-blur px-2.5 py-1 text-xs font-semibold shadow-md animate-pulse">
                  <AlertTriangle className="h-3 w-3" />
                  {errors}
                </Link>
              )}
              {pending > 0 && (
                <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/80 backdrop-blur px-2.5 py-1 text-xs font-semibold shadow-md">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  {pending}
                </div>
              )}
              <div className={cn(
                "inline-flex items-center gap-1.5 rounded-full backdrop-blur px-2.5 py-1 text-xs font-semibold shadow-md",
                isOnline ? "bg-emerald-500/80" : "bg-slate-800/60",
              )}>
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isOnline ? "En ligne" : "Hors ligne"}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      {/* BOTTOM NAV moderne */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-3">
          {ONGLETS.map(({ to, label, icon: Icone, gradient, ring }) => {
            const active = pathname.startsWith(to);
            return (
              <Link key={to} to={to} className="relative flex flex-col items-center gap-1 py-3 group">
                {active && (
                  <span className={cn("absolute top-0 left-1/2 -translate-x-1/2 h-1 w-10 rounded-b-full bg-gradient-to-r", gradient)} />
                )}
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                  active
                    ? cn("bg-gradient-to-br text-white shadow-lg", gradient, "shadow-md")
                    : "text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-100",
                )}>
                  <Icone className="h-5 w-5" />
                </div>
                <span className={cn("text-[10px] font-semibold", active ? "text-slate-900" : "text-slate-500")}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
