import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export interface AgentRecord {
  id: string;
  badge_number: string;
  zone_id: string | null;
  active: boolean | null;
  hired_at: string | null;
  full_name: string | null;
  phone: string | null;
  zone_name: string | null;
}

/**
 * Session agent : vérifie profiles.role = 'agent' ET la présence d'une ligne agents.
 */
export function useAgent() {
  const [user, setUser] = useState<User | null>(null);
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annule = false;

    const charger = async (nextUser: User | null) => {
      if (!nextUser) {
        if (!annule) {
          setUser(null);
          setAgent(null);
          setLoading(false);
        }
        return;
      }

      const [{ data: profile }, { data: agentRow }] = await Promise.all([
        supabase
          .from("profiles")
          .select("role, full_name, phone")
          .eq("id", nextUser.id)
          .maybeSingle(),
        supabase
          .from("agents")
          .select("id, badge_number, zone_id, active, hired_at")
          .eq("id", nextUser.id)
          .maybeSingle(),
      ]);

      let zoneName: string | null = null;
      if (agentRow?.zone_id) {
        const { data: commune } = await supabase
          .from("communes")
          .select("name")
          .eq("id", agentRow.zone_id)
          .maybeSingle();
        zoneName = commune?.name ?? null;
      }

      if (annule) return;
      setUser(nextUser);
      setAgent(
        profile?.role === "agent" && agentRow
          ? {
              ...agentRow,
              full_name: profile.full_name ?? null,
              phone: profile.phone ?? null,
              zone_name: zoneName,
            }
          : null,
      );
      setLoading(false);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Ne JAMAIS repasser en chargement sur un simple rafraîchissement de jeton :
      // cela démonterait l'écran d'installation en cours (retour de l'appareil photo).
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void charger(session?.user ?? null);
    });

    void supabase.auth.getUser().then(({ data }) => charger(data.user ?? null));


    return () => {
      annule = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { user, agent, isAgent: !!agent, loading };
}
