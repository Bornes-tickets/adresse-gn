import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supervisorWhoami } from "@/lib/supervisor.functions";
import {
  LayoutDashboard,
  CalendarClock,
  ClipboardCheck,
  FileBarChart2,
  AlertTriangle,
  MessageSquareWarning,
  Database,
  ShieldCheck,
  Bell,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = {
  to: string;
  label: string;
  icon: any;
  exact?: boolean;
  badge?: string;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const GROUPS: MenuGroup[] = [
  {
    label: "Général",
    items: [
      { to: "/supervisor", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Opérations terrain",
    items: [
      { to: "/supervisor/planning", label: "Planification", icon: CalendarClock },
      { to: "/supervisor/installations", label: "Validations", icon: ClipboardCheck, badge: "QC" },
      { to: "/supervisor/report-installations", label: "Rapport installations", icon: FileBarChart2 },
    ],
  },
  {
    label: "Support & qualité",
    items: [
      { to: "/supervisor/reports", label: "Signalements", icon: AlertTriangle },
      { to: "/supervisor/claims", label: "Réclamations", icon: MessageSquareWarning },
    ],
  },
  {
    label: "Référentiels",
    items: [
      { to: "/supervisor/consultations", label: "Consultations", icon: Database },
    ],
  },
];

export const Route = createFileRoute("/supervisor/_guard")({
  component: SupervisorLayout,
});

function initiales(nom: string | null | undefined): string {
  if (!nom) return "SV";
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function libelleRole(role: string): string {
  return role === "super_admin"
    ? "Super admin"
    : role === "admin"
      ? "Administrateur"
      : "Superviseur";
}

function fondRole(role: string): string {
  return role === "super_admin"
    ? "from-rose-500 to-orange-500"
    : role === "admin"
      ? "from-violet-500 to-fuchsia-500"
      : "from-indigo-500 to-sky-500";
}

function SupervisorLayout() {
  const { location } = useRouterState();
  const whoamiFn = useServerFn(supervisorWhoami);
  const { data: me } = useQuery({
    queryKey: ["supervisor-whoami"],
    queryFn: () => whoamiFn(),
    staleTime: 5 * 60 * 1000,
  });

  const currentLabel = GROUPS.flatMap((g) => g.items).find((i) =>
    i.exact ? location.pathname === i.to : location.pathname.startsWith(i.to),
  )?.label ?? "Espace superviseur";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-200/80 bg-white/70 backdrop-blur-xl shadow-sm">
        {/* Brand */}
        <div className="flex h-20 items-center gap-3 border-b border-slate-200/60 px-6">
          <div className="relative">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-slate-900 tracking-tight">Adresse GN</div>
            <div className="text-[11px] font-medium text-indigo-600 uppercase tracking-wider">
              Espace superviseur
            </div>
          </div>
        </div>

        {/* Menu par groupes */}
        <nav className="px-4 py-5 space-y-6 overflow-y-auto h-[calc(100vh-20rem)]">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.exact
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                        active
                          ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 font-semibold shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                      )}
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] transition-transform",
                          active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600",
                          active ? "" : "group-hover:scale-110",
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded",
                            active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                      {active && <ChevronRight className="h-3.5 w-3.5 text-indigo-500" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profil utilisateur bas */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200/60 bg-white/60 backdrop-blur-xl p-4">
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/60 p-3 border border-slate-200/60">
            <div
              className={cn(
                "h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shadow-md",
                fondRole(me?.role ?? "supervisor"),
              )}
            >
              {initiales(me?.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-slate-900 truncate">
                {me?.fullName ?? "Chargement…"}
              </div>
              <div className="text-[11px] text-slate-500">{libelleRole(me?.role ?? "supervisor")}</div>
            </div>
            <Link
              to="/"
              className="text-slate-400 hover:text-slate-700 transition p-1.5 rounded-lg hover:bg-slate-200/60"
              title="Retour au site"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-2 text-center text-[10px] text-slate-400">
            Adresse GN · v1.0
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-72">
        {/* Topbar sticky */}
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-8">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Supervision</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="font-semibold text-slate-900">{currentLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition">
                <Bell className="h-4 w-4" />
                <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
              </button>
              <div
                className={cn(
                  "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r text-white text-xs font-medium shadow-sm",
                  fondRole(me?.role ?? "supervisor"),
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {libelleRole(me?.role ?? "supervisor")}
              </div>
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main className="p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
