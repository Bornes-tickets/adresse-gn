import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle, LogOut, User, BadgeCheck, Phone, MapPin, Database,
  HardDrive, RefreshCw, ChevronRight, Wifi, Award, HardHat, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgent } from "@/hooks/useAgent";
import { agentDb } from "@/lib/agent-db";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agent/_guard/profile")({ component: Profile });

function useEspaceLocal() {
  const [mo, setMo] = useState<number | null>(null);
  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    void navigator.storage.estimate().then((estimation) => {
      setMo((estimation.usage ?? 0) / (1024 * 1024));
    });
  }, []);
  return mo;
}

function initiales(n: string | null | undefined) {
  if (!n) return "AG";
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function Profile() {
  const { agent } = useAgent();
  const espaceMo = useEspaceLocal();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const pending = useLiveQuery(() => agentDb.install_queue.where("status").equals("pending").count(), [], 0);
  const errors = useLiveQuery(() => agentDb.install_queue.where("status").equals("error").count(), [], 0);

  const deconnexion = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/agent/login", replace: true });
  };

  return (
    <div className="space-y-4">
      {/* Carte profil hero */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 p-6 text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative flex items-center gap-4">
            <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold text-white shadow-lg ring-4 ring-white/30">
              {initiales(agent?.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <HardHat className="h-4 w-4 text-white/80" />
                <span className="text-xs uppercase tracking-widest text-white/80 font-semibold">Agent terrain</span>
              </div>
              <h1 className="text-xl font-bold truncate">{agent?.full_name ?? "Agent"}</h1>
              <div className="inline-flex items-center gap-1 mt-1 rounded-full bg-white/20 backdrop-blur px-2.5 py-0.5 text-xs font-mono font-semibold">
                <BadgeCheck className="h-3 w-3" />
                {agent?.badge_number ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Infos profil */}
      <Card>
        <CardContent className="p-0">
          <ProfileRow icon={Phone} label="Téléphone" value={agent?.phone ?? "—"} color="emerald" />
          <ProfileRow icon={MapPin} label="Zone d'affectation" value={agent?.zone_name ?? "Non affectée"} color="sky" />
          {espaceMo !== null && (
            <ProfileRow icon={HardDrive} label="Espace utilisé" value={`${espaceMo.toFixed(1)} Mo`} color="violet" />
          )}
        </CardContent>
      </Card>

      {/* Synchronisation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Synchronisation</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className={cn("rounded-xl p-3", pending > 0 ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-slate-200")}>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">En attente</div>
              <div className={cn("text-2xl font-bold mt-0.5", pending > 0 ? "text-amber-700" : "text-slate-400")}>{pending}</div>
            </div>
            <div className={cn("rounded-xl p-3", errors > 0 ? "bg-rose-50 border border-rose-200" : "bg-slate-50 border border-slate-200")}>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Erreurs</div>
              <div className={cn("text-2xl font-bold mt-0.5", errors > 0 ? "text-rose-700" : "text-slate-400")}>{errors}</div>
            </div>
          </div>
          {errors > 0 && (
            <Link to="/agent/sync-issues" className="mt-3 inline-flex items-center justify-between w-full rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100 transition">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Résoudre les erreurs
              </span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Alerte espace */}
      {espaceMo !== null && espaceMo > 50 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-3">
            <div className="flex items-start gap-2 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Plus de 50 Mo utilisés localement. Synchronisez vos installations pour libérer de l'espace.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badge de récompense */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md">
              <Award className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900">Merci pour votre travail !</div>
              <div className="text-xs text-slate-600 mt-0.5">Chaque balise posée aide la Guinée à s'orienter.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Déconnexion */}
      <Button
        variant="outline"
        size="lg"
        className="w-full h-12 rounded-xl border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition"
        onClick={deconnexion}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Se déconnecter
      </Button>

      <div className="text-center text-[10px] text-slate-400 pt-2">
        Adresse GN · Espace agent
      </div>
    </div>
  );
}

function ProfileRow({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const bg: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-600",
    sky: "bg-sky-100 text-sky-600",
    violet: "bg-violet-100 text-violet-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", bg[color] ?? "bg-slate-100 text-slate-600")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-900 truncate">{value}</div>
      </div>
    </div>
  );
}
