import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supportWhoami } from "@/lib/support.functions";
import {
  LayoutDashboard, Headphones, AlertTriangle, MessageSquareWarning, MessageCircle,
  LogOut, ChevronRight, Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = { to: string; label: string; icon: any; exact?: boolean };
type MenuGroup = { label: string; items: MenuItem[] };

const GROUPS: MenuGroup[] = [
  { label: "Pilotage", items: [{ to: "/support", label: "Tableau de bord", icon: LayoutDashboard, exact: true }]},
  { label: "Tickets", items: [
    { to: "/support/signalements", label: "Signalements citoyens", icon: AlertTriangle },
    { to: "/support/reclamations", label: "Réclamations", icon: MessageSquareWarning },
    { to: "/support/messages", label: "Messages entrants", icon: MessageCircle },
  ]},
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

export const Route = createFileRoute("/support/_guard")({
  ssr: false,
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
    try {
      return { identite: await supportWhoami() };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: SupportLayout,
});

function initiales(n: string | null | undefined) {
  return !n ? "SP" : n.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function construireBreadcrumb(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const items: { label: string; path: string }[] = [];
  let cur = "";
  for (const seg of segments) {
    cur += "/" + seg;
    const match = ALL_ITEMS.find((i) => i.to === cur);
    items.push({ label: match?.label ?? seg.charAt(0).toUpperCase() + seg.slice(1), path: cur });
  }
  return items;
}

function SupportLayout() {
  const { location } = useRouterState();
  const whoamiFn = useServerFn(supportWhoami);
  const { data: me } = useQuery({ queryKey: ["support-whoami"], queryFn: () => whoamiFn(), staleTime: 5 * 60 * 1000 });
  const breadcrumb = construireBreadcrumb(location.pathname);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/40">
      <aside className="fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-200/80 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="flex h-20 items-center gap-3 border-b border-slate-200/60 px-6">
          <div className="relative shrink-0">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30 transition-transform hover:scale-110 hover:rotate-3">
              <Headphones className="h-6 w-6 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight">Adresse GN</div>
            <div className="text-[11px] font-medium text-sky-600 uppercase tracking-wider">Espace support</div>
          </div>
        </div>

        <nav className="px-3 py-5 space-y-5 overflow-y-auto h-[calc(100vh-20rem)]">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to}
                      className={cn("group relative flex items-center gap-3 rounded-lg text-sm transition-all px-3 py-2.5",
                        active ? "bg-gradient-to-r from-sky-50 to-blue-50 text-sky-700 font-semibold shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-sky-500 to-blue-600" />}
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-sky-600" : "text-slate-400 group-hover:text-slate-600 group-hover:scale-110")} />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 text-sky-500" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200/60 bg-white/60 backdrop-blur-xl p-3">
          <div className="flex items-center gap-3 rounded-xl p-3 border bg-gradient-to-r from-slate-50 to-slate-100/60 border-slate-200/60">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">{initiales(me?.fullName)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">{me?.fullName ?? "Chargement…"}</div>
              <div className="text-[11px] text-slate-500">Support</div>
            </div>
            <Link to="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"><LogOut className="h-4 w-4" /></Link>
          </div>
          <div className="mt-2 text-center text-[10px] text-slate-400">Adresse GN · Support</div>
        </div>
      </aside>

      <div className="ml-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-8 gap-4">
            <nav className="flex items-center gap-1.5 text-sm min-w-0">
              <Link to="/support" className="p-1 rounded hover:bg-slate-100 text-slate-400"><Home className="h-3.5 w-3.5" /></Link>
              {breadcrumb.slice(1).map((b, i, arr) => (
                <div key={b.path} className="flex items-center gap-1.5">
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                  {i === arr.length - 1 ? <span className="font-semibold truncate">{b.label}</span> : <Link to={b.path} className="hover:underline truncate text-slate-500">{b.label}</Link>}
                </div>
              ))}
            </nav>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-medium shadow-sm">
              <Headphones className="h-3.5 w-3.5" /> Espace support
            </div>
          </div>
        </header>
        <main className="p-8 max-w-[1600px] mx-auto"><Outlet /></main>
      </div>
    </div>
  );
}
