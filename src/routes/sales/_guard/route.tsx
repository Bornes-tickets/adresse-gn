import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { salesWhoami } from "@/lib/sales.functions";
import {
  LayoutDashboard, ShoppingCart, CreditCard, CalendarClock, Repeat, Tag,
  Users, TrendingUp, LogOut, ChevronRight, Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = { to: string; label: string; icon: any; exact?: boolean; badge?: string };
type MenuGroup = { label: string; items: MenuItem[] };

const GROUPS: MenuGroup[] = [
  { label: "Pilotage", items: [
    { to: "/sales", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  ]},
  { label: "Ventes", items: [
    { to: "/sales/commandes", label: "Commandes", icon: ShoppingCart },
    { to: "/sales/paiements", label: "Paiements", icon: CreditCard },
    { to: "/sales/installations", label: "Installations à planifier", icon: CalendarClock, badge: "Ops" },
  ]},
  { label: "Récurrent", items: [
    { to: "/sales/abonnements", label: "Abonnements", icon: Repeat },
    { to: "/sales/offres", label: "Offres & tarifs", icon: Tag },
  ]},
  { label: "Clients", items: [
    { to: "/sales/clients", label: "Clients", icon: Users },
  ]},
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

export const Route = createFileRoute("/sales/_guard")({
  beforeLoad: async () => {
    try {
      const identite = await salesWhoami();
      return { identite };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: SalesLayout,
});

function initiales(n: string | null | undefined) {
  return !n ? "SL" : n.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function construireBreadcrumb(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const items: { label: string; path: string }[] = [];
  let cur = "";
  for (const seg of segments) {
    cur += "/" + seg;
    const match = ALL_ITEMS.find((i) => i.to === cur);
    items.push({ label: match?.label ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "), path: cur });
  }
  return items;
}

function SalesLayout() {
  const { location } = useRouterState();
  const whoamiFn = useServerFn(salesWhoami);
  const { data: me } = useQuery({
    queryKey: ["sales-whoami"],
    queryFn: () => whoamiFn(),
    staleTime: 5 * 60 * 1000,
  });

  const breadcrumb = construireBreadcrumb(location.pathname);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-200/80 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="flex h-20 items-center gap-3 border-b border-slate-200/60 px-6">
          <div className="relative shrink-0">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform hover:scale-110 hover:rotate-3">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight">Adresse GN</div>
            <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">Espace commercial</div>
          </div>
        </div>

        <nav className="px-3 py-5 space-y-5 overflow-y-auto h-[calc(100vh-20rem)]">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg text-sm transition-all px-3 py-2.5",
                        active
                          ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 font-semibold shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-600" />}
                      <Icon className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-all",
                        active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600 group-hover:scale-110",
                      )} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded",
                          active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
                        )}>
                          {item.badge}
                        </span>
                      )}
                      {active && <ChevronRight className="h-3.5 w-3.5 text-emerald-500" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200/60 bg-white/60 backdrop-blur-xl p-3">
          <div className="flex items-center gap-3 rounded-xl p-3 border bg-gradient-to-r from-slate-50 to-slate-100/60 border-slate-200/60">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
              {initiales(me?.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">{me?.fullName ?? "Chargement…"}</div>
              <div className="text-[11px] text-slate-500">Commercial</div>
            </div>
            <Link to="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition" title="Retour au site">
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-2 text-center text-[10px] text-slate-400">Adresse GN · Sales</div>
        </div>
      </aside>

      <div className="ml-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-8 gap-4">
            <nav className="flex items-center gap-1.5 text-sm min-w-0">
              <Link to="/sales" className="p-1 rounded hover:bg-slate-100 text-slate-400 transition">
                <Home className="h-3.5 w-3.5" />
              </Link>
              {breadcrumb.slice(1).map((b, i, arr) => (
                <div key={b.path} className="flex items-center gap-1.5">
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                  {i === arr.length - 1
                    ? <span className="font-semibold truncate">{b.label}</span>
                    : <Link to={b.path} className="hover:underline truncate text-slate-500">{b.label}</Link>}
                </div>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-medium shadow-sm">
                <TrendingUp className="h-3.5 w-3.5" />
                Espace commercial
              </div>
            </div>
          </div>
        </header>

        <main className="p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
