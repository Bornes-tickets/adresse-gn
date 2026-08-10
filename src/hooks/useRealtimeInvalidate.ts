import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Options = {
  /** Table Postgres surveillée (public.*). */
  table: string;
  /** Types d'événements à écouter. Défaut : tous. */
  events?: ("INSERT" | "UPDATE" | "DELETE")[];
  /** Filtre Realtime optionnel, ex : "agent_id=eq.uuid-xxx". */
  filter?: string;
  /** Clés de queries React à invalider quand un événement arrive. */
  invalidate: (string | number | null | undefined)[][];
  /** Afficher un toast discret à chaque changement. Défaut : false. */
  toastOnChange?: boolean;
  /** Libellé personnalisé du toast. */
  toastLabel?: string;
};

/**
 * Abonne le composant à une table Supabase Realtime et invalide les queries React
 * lorsqu'un changement survient — les tableaux se rafraîchissent tout seuls.
 */
export function useRealtimeInvalidate(opts: Options) {
  const qc = useQueryClient();
  const events = opts.events ?? ["INSERT", "UPDATE", "DELETE"];
  const invalidateKey = JSON.stringify(opts.invalidate);

  useEffect(() => {
    const channelName = `rt:${opts.table}:${opts.filter ?? "all"}:${Math.random().toString(36).slice(2, 7)}`;
    let channel = supabase.channel(channelName);
    for (const event of events) {
      channel = channel.on(
        "postgres_changes" as any,
        { event, schema: "public", table: opts.table, ...(opts.filter ? { filter: opts.filter } : {}) },
        () => {
          for (const key of opts.invalidate) qc.invalidateQueries({ queryKey: key });
          if (opts.toastOnChange) {
            toast(opts.toastLabel ?? "Mise à jour", {
              description: `La table ${opts.table} a changé.`,
              duration: 2000,
            });
          }
        },
      );
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.table, opts.filter, invalidateKey]);
}
