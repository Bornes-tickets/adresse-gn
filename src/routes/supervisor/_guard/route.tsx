import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supervisorWhoami } from "@/lib/supervisor.functions";
import { CommandPalette } from "@/components/supervisor/CommandPalette";
import { NotificationsPanel } from "@/components/supervisor/NotificationsPanel";
import { ThemeProvider, useTheme, AccentPicker } from "@/components/supervisor/ThemeProvider";
import {
  LayoutDashboard, CalendarClock, ClipboardCheck, FileBarChart2, AlertTriangle,
  MessageSquareWarning, Database, ShieldCheck, LogOut, ChevronRight, ChevronLeft,
  Moon, Sun, Search, PanelLeftClose, PanelLeft, Home, Palette, Maximize2, Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = { to: string; label: string; icon: any; exact?: boolean; badge?: string };
type MenuGroup = { label: string; items: MenuItem[] };

const GROUPS: MenuGroup[] = [
  { label: "Général", items: [{ to: "/supervisor", label: "Tableau de bord", icon: LayoutDashboard, exact: true }] },
  { label: "Opérations terrain", items: [
    { to: "/supervisor/planning", label: "Planification", icon: CalendarClock },
    { to: "/supervisor/installations", label: "Validations", icon: ClipboardCheck, badge: "QC" },
    { to: "/supervisor/report-installations", label: "Rapport installations", icon: FileBarChart2 },
  ]},
  { label: "Support & qualité", items: [
    { to: "/supervisor/reports", label: "Signalements", icon: AlertTriangle },
    { to: "/supervisor/claims", label: "Réclamations", icon: MessageSquareWarning },
  ]},
  { label: "Référentiels", items: [{ to: "/supervisor/consultations", label: "Consultations", icon: Database }] },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

export const Route = createFileRoute("/supervisor/_guard")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const identite = await supervisorWhoami();
      return { identite };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => (
    <ThemeProvider>
      <SupervisorLayout />
    </ThemeProvider>
  ),
});

function initiales(n: string | null | undefined) { return !n ? "SV" : n.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()).join(""); }
function libelleRole(r: string) { return r === "super_admin" ? "Super admin" : r === "admin" ? "Administrateur" : "Superviseur"; }

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

function SupervisorLayout() {
  const { location } = useRouterState();
  const { dark, setDark, accentInfo } = useTheme();
  const [collapsed, setCollapsed] = useState<boolean>(() => typeof window !== "undefined" && localStorage.getItem("sv-collapsed") === "1");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);

  /* FOCUS 1/4 : état du mode focus */
  const [focus, setFocus] = useState<boolean>(false);

  const whoamiFn = useServerFn(supervisorWhoami);
  const { data: me } = useQuery({ queryKey: ["supervisor-whoami"], queryFn: () => whoamiFn(), staleTime: 5 * 60 * 1000 });

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sv-collapsed", next ? "1" : "0");
  };

  /* FOCUS 2/4 : raccourci clavier Shift+F pour basculer le mode focus */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "F" || e.key === "f") && !cmdOpen) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        setFocus((f) => !f);
      }
      if (e.key === "Escape" && focus) setFocus(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focus, cmdOpen]);

  const breadcrumb = construireBreadcrumb(location.pathname);
  const accentGradient = `${accentInfo.from} ${accentInfo.to}`;
  const roleBg = accentGradient;

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      dark ? "bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 text-slate-100"
           : "bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 text-slate-900",
    )}>
      {/* FOCUS 3/4 : sidebar et topbar cachés en mode focus */}
      <AnimatePresence>
        {!focus && (
          <motion.aside
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "fixed inset-y-0 left-0 z-30 border-r backdrop-blur-xl shadow-sm transition-all duration-300",
              collapsed ? "w-20" : "w-72",
              dark ? "bg-slate-900/70 border-slate-800/80" : "bg-white/70 border-slate-200/80",
            )}
          >
            <div className={cn("flex h-20 items-center gap-3 border-b px-6", dark ? "border-slate-800/60" : "border-slate-200/60")}>
              <div className="relative shrink-0">
                <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg transition-transform hover:scale-110 hover:rotate-3", accentGradient)}
                     style={{ boxShadow: `0 10px 30px -10px ${accentInfo.hex}80` }}>
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse" />
              </div>
              {!collapsed && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="text-[15px] font-bold tracking-tight">Adresse GN</div>
                  <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: accentInfo.hex }}>Espace superviseur</div>
                </div>
              )}
            </div>

            <button onClick={toggleCollapsed}
              className={cn("absolute -right-3 top-24 z-40 h-6 w-6 rounded-full border shadow-md flex items-center justify-center transition-all hover:scale-110",
                dark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-500 hover:text-slate-900")}
              title={collapsed ? "Déployer" : "Réduire"}>
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>

            <nav className="px-3 py-5 space-y-5 overflow-y-auto h-[calc(100vh-20rem)]">
              {GROUPS.map((group) => (
                <div key={group.label}>
                  {!collapsed && (
                    <div className={cn("px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest", dark ? "text-slate-500" : "text-slate-400")}>{group.label}</div>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
                      const Icon = item.icon;
                      return (
                        <Link key={item.to} to={item.to} title={collapsed ? item.label : undefined}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-lg text-sm transition-all",
                            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                            active
                              ? dark ? "text-white font-semibold shadow-inner" : "font-semibold shadow-sm"
                              : dark ? "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          )}
                          style={active ? { backgroundColor: `${accentInfo.hex}22`, color: accentInfo.hex } : undefined}
                        >
                          {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full" style={{ backgroundColor: accentInfo.hex }} />}
                          <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-all group-hover:scale-110")} style={active ? { color: accentInfo.hex } : undefined} />
                          {!collapsed && (
                            <>
                              <span className="flex-1">{item.label}</span>
                              {item.badge && (
                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", active ? "" : dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")}
                                      style={active ? { backgroundColor: `${accentInfo.hex}33`, color: accentInfo.hex } : undefined}>
                                  {item.badge}
                                </span>
                              )}
                              {active && <ChevronRight className="h-3.5 w-3.5" style={{ color: accentInfo.hex }} />}
                            </>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className={cn("absolute bottom-0 left-0 right-0 border-t backdrop-blur-xl p-3", dark ? "border-slate-800/60 bg-slate-900/60" : "border-slate-200/60 bg-white/60")}>
              <div className={cn("flex items-center gap-3 rounded-xl p-3 border transition-all hover:shadow-md", collapsed && "justify-center p-2",
                dark ? "bg-gradient-to-r from-slate-800/60 to-slate-800/40 border-slate-700/60" : "bg-gradient-to-r from-slate-50 to-slate-100/60 border-slate-200/60")}>
                <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0", roleBg)}>
                  {initiales(me?.fullName)}
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">{me?.fullName ?? "Chargement…"}</div>
                      <div className={cn("text-[11px]", dark ? "text-slate-400" : "text-slate-500")}>{libelleRole(me?.role ?? "supervisor")}</div>
                    </div>
                    <Link to="/" className={cn("p-1.5 rounded-lg transition", dark ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/60")} title="Retour au site">
                      <LogOut className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </div>
              {!collapsed && <div className={cn("mt-2 text-center text-[10px]", dark ? "text-slate-600" : "text-slate-400")}>Adresse GN · v1.0</div>}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className={cn("transition-all duration-300", focus ? "ml-0" : collapsed ? "ml-20" : "ml-72")}>
        {/* FOCUS 4/4 : topbar cachée sauf bouton flottant pour sortir du focus */}
        <AnimatePresence>
          {!focus && (
            <motion.header
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={cn("sticky top-0 z-20 border-b backdrop-blur-xl", dark ? "border-slate-800/60 bg-slate-900/70" : "border-slate-200/60 bg-white/70")}
            >
              <div className="flex h-16 items-center justify-between px-6 md:px-8 gap-4">
                <nav className="flex items-center gap-1.5 text-sm min-w-0">
                  <button onClick={toggleCollapsed} className={cn("md:hidden p-1.5 rounded-lg transition", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
                    {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </button>
                  <Link to="/supervisor" className={cn("p-1 rounded transition", dark ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-100 text-slate-400")}>
                    <Home className="h-3.5 w-3.5" />
                  </Link>
                  {breadcrumb.slice(1).map((b, i, arr) => (
                    <div key={b.path} className="flex items-center gap-1.5">
                      <ChevronRight className={cn("h-3.5 w-3.5", dark ? "text-slate-700" : "text-slate-300")} />
                      {i === arr.length - 1
                        ? <span className="font-semibold truncate">{b.label}</span>
                        : <Link to={b.path} className={cn("hover:underline truncate", dark ? "text-slate-400" : "text-slate-500")}>{b.label}</Link>}
                    </div>
                  ))}
                </nav>

                <div className="flex items-center gap-2">
                  <button onClick={() => setCmdOpen(true)}
                    className={cn("hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition w-64",
                      dark ? "bg-slate-800/50 border-slate-700 hover:border-slate-600 text-slate-400" : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-500")}>
                    <Search className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left text-sm">Rechercher…</span>
                    <kbd className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono", dark ? "border-slate-700" : "border-slate-200")}>⌘K</kbd>
                  </button>

                  <div className="relative">
                    <button onClick={() => setAccentPickerOpen(!accentPickerOpen)}
                      className={cn("h-9 w-9 rounded-lg flex items-center justify-center transition hover:scale-110",
                        dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100")} title="Couleur d'accent">
                      <Palette className="h-4 w-4" />
                    </button>
                    <AnimatePresence>
                      {accentPickerOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setAccentPickerOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            className={cn("absolute right-0 top-11 z-50 rounded-xl shadow-2xl border p-3", dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}
                          >
                            <div className={cn("text-[10px] font-semibold uppercase tracking-widest mb-2", dark ? "text-slate-500" : "text-slate-400")}>Couleur d'accent</div>
                            <AccentPicker dark={dark} />
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  <button onClick={() => setDark(!dark)}
                    className={cn("h-9 w-9 rounded-lg flex items-center justify-center transition-all hover:scale-110",
                      dark ? "text-amber-300 hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100")}
                    title={dark ? "Mode clair" : "Mode sombre"}>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={dark ? "sun" : "moon"} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      </motion.div>
                    </AnimatePresence>
                  </button>

                  {/* Bouton mode focus */}
                  <button onClick={() => setFocus(true)}
                    className={cn("h-9 w-9 rounded-lg flex items-center justify-center transition hover:scale-110",
                      dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100")}
                    title="Mode focus (Shift+F)">
                    <Maximize2 className="h-4 w-4" />
                  </button>

                  <NotificationsPanel dark={dark} />

                  <div className={cn("hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r text-white text-xs font-medium shadow-sm", roleBg)}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {libelleRole(me?.role ?? "supervisor")}
                  </div>
                </div>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Bouton flottant pour sortir du mode focus */}
        <AnimatePresence>
          {focus && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setFocus(false)}
              className={cn(
                "fixed top-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full shadow-2xl border text-xs font-medium transition hover:scale-105",
                dark ? "bg-slate-800 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-700",
              )}
              title="Quitter le mode focus (Esc)"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Quitter focus
              <kbd className={cn("text-[10px] px-1 py-0.5 rounded border font-mono", dark ? "border-slate-700 text-slate-500" : "border-slate-200 text-slate-400")}>Esc</kbd>
            </motion.button>
          )}
        </AnimatePresence>

        <main className={cn("mx-auto transition-all duration-300", focus ? "p-4 max-w-none" : "p-6 md:p-8 max-w-[1600px]")}>
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} dark={dark} />
    </div>
  );
}
