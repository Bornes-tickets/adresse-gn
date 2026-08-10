import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardCheck,
  AlertTriangle,
  MessageSquareWarning,
  Database,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MENU = [
  { to: "/supervisor", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/supervisor/installations", label: "Validations", icon: ClipboardCheck },
  { to: "/supervisor/reports", label: "Signalements", icon: AlertTriangle },
  { to: "/supervisor/claims", label: "Réclamations", icon: MessageSquareWarning },
  { to: "/supervisor/consultations", label: "Consultations", icon: Database },
];

export const Route = createFileRoute("/supervisor/_guard")({
  component: SupervisorLayout,
});

function SupervisorLayout() {
  const { location } = useRouterState();
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Superviseur</div>
            <div className="text-[11px] text-slate-500">Adresse GN</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {MENU.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-3">
          <Link to="/" className="block text-xs text-slate-500 hover:text-slate-700">
            ← Retour au site
          </Link>
        </div>
      </aside>
      <main className="ml-64 p-6">
        <Outlet />
      </main>
    </div>
  );
}
