import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  supervisorNotifications, supervisorMarkNotificationRead, supervisorMarkAllNotificationsRead, supervisorWhoami,
} from "@/lib/supervisor.functions";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LIBELLES: Record<string, { titre: string; couleur: string }> = {
  qc_reject: { titre: "Contrôle qualité rejeté", couleur: "text-rose-500" },
  report_status: { titre: "Signalement mis à jour", couleur: "text-amber-500" },
  installation_validated: { titre: "Installation validée", couleur: "text-emerald-500" },
};

export function NotificationsPanel({ dark }: { dark: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const listFn = useServerFn(supervisorNotifications);
  const markFn = useServerFn(supervisorMarkNotificationRead);
  const markAllFn = useServerFn(supervisorMarkAllNotificationsRead);
  const whoamiFn = useServerFn(supervisorWhoami);

  const { data: me } = useQuery({
    queryKey: ["supervisor-whoami"],
    queryFn: () => whoamiFn(),
    staleTime: 5 * 60 * 1000,
  });

  const { data } = useQuery({
    queryKey: ["supervisor-notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });

  const mark = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supervisor-notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supervisor-notifications"] }),
  });

  // Realtime : écoute les INSERT sur notifications pour cet utilisateur
  useEffect(() => {
    if (!me?.userId) return;
    const channel = supabase
      .channel(`notifications:${me.userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.userId}` },
        (payload) => {
          const meta = LIBELLES[(payload.new as any).type] ?? { titre: "Nouvelle notification", couleur: "text-slate-500" };
          toast(meta.titre, {
            description: (payload.new as any).payload?.motif ?? "Vous avez une nouvelle notification.",
            icon: "🔔",
          });
          setPulse(true);
          setTimeout(() => setPulse(false), 2000);
          qc.invalidateQueries({ queryKey: ["supervisor-notifications"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me?.userId, qc]);

  const nonLues = data?.nonLues ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative h-9 w-9 rounded-lg flex items-center justify-center transition",
          dark ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
          pulse && "animate-bounce",
        )}
      >
        <Bell className="h-4 w-4" />
        {nonLues > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-in zoom-in duration-200">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
        {pulse && (
          <span className="absolute inset-0 rounded-lg animate-ping bg-rose-500/30" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute right-0 top-11 z-50 w-96 rounded-2xl shadow-2xl border overflow-hidden",
                dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
              )}
            >
              <div className={cn("flex items-center justify-between px-4 py-3 border-b", dark ? "border-slate-800" : "border-slate-100")}>
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm">Notifications</div>
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Temps réel
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {nonLues > 0 && (
                    <button
                      onClick={() => markAll.mutate()}
                      className={cn("text-[11px] px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1", dark ? "text-indigo-400" : "text-indigo-600")}
                    >
                      <CheckCheck className="h-3 w-3" /> Tout marquer lu
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className={cn("p-1 rounded", dark ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-100 text-slate-400")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {!data?.rows.length ? (
                  <div className={cn("py-12 text-center text-sm", dark ? "text-slate-500" : "text-slate-400")}>
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Aucune notification.
                  </div>
                ) : (
                  data.rows.map((n: any, i: number) => {
                    const meta = LIBELLES[n.type] ?? { titre: n.type, couleur: "text-slate-500" };
                    const isRead = !!n.read_at;
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={cn(
                          "px-4 py-3 border-b flex items-start gap-3 transition group",
                          dark ? "border-slate-800/60 hover:bg-slate-800/40" : "border-slate-50 hover:bg-slate-50",
                          !isRead && (dark ? "bg-indigo-500/5" : "bg-indigo-50/40"),
                        )}
                      >
                        <div className={cn("mt-0.5 h-2 w-2 rounded-full shrink-0", !isRead ? "bg-indigo-500 animate-pulse" : "bg-transparent")} />
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-sm font-medium", meta.couleur)}>{meta.titre}</div>
                          {n.payload && (
                            <div className={cn("text-xs mt-0.5 line-clamp-2", dark ? "text-slate-400" : "text-slate-600")}>
                              {typeof n.payload === "string" ? n.payload : n.payload.motif ?? JSON.stringify(n.payload).slice(0, 120)}
                            </div>
                          )}
                          <div className={cn("text-[10px] mt-1", dark ? "text-slate-500" : "text-slate-400")}>
                            {new Date(n.created_at).toLocaleString("fr-FR")}
                          </div>
                        </div>
                        {!isRead && (
                          <button
                            onClick={() => mark.mutate(n.id)}
                            className={cn("opacity-0 group-hover:opacity-100 p-1 rounded transition", dark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-200 text-slate-500")}
                            title="Marquer comme lu"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
