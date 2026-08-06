import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export interface AdminRecord {
  id: string;
  role: "admin" | "super_admin";
  full_name: string | null;
  phone: string | null;
}

/** Session administrateur : profiles.role ∈ ('admin','super_admin'). */
export function useAdmin() {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annule = false;

    const charger = async (nextUser: User | null) => {
      if (!nextUser) {
        if (!annule) {
          setUser(null);
          setAdmin(null);
          setLoading(false);
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, full_name, phone")
        .eq("id", nextUser.id)
        .maybeSingle();

      if (annule) return;
      setUser(nextUser);
      setAdmin(
        profile && (profile.role === "admin" || profile.role === "super_admin")
          ? {
              id: profile.id,
              role: profile.role,
              full_name: profile.full_name ?? null,
              phone: profile.phone ?? null,
            }
          : null,
      );
      setLoading(false);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      void charger(session?.user ?? null);
    });

    void supabase.auth.getUser().then(({ data }) => charger(data.user ?? null));

    return () => {
      annule = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { user, admin, isAdmin: !!admin, isSuperAdmin: admin?.role === "super_admin", loading };
}
