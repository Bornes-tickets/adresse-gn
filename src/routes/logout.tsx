import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/logout")({
  head: () => ({
    meta: [
      { title: "Déconnexion — Adresse GN" },
      {
        name: "description",
        content: "Fermeture de votre session Adresse GN en cours.",
      },
      { property: "og:title", content: "Déconnexion — Adresse GN" },
      {
        property: "og:description",
        content: "Vous êtes en train de quitter votre espace Adresse GN.",
      },
    ],
  }),
  component: Logout,
});

function Logout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let annule = false;
    (async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      if (!annule) navigate({ to: "/", replace: true });
    })();
    return () => {
      annule = true;
    };
  }, [navigate, queryClient]);

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold text-foreground">
        {t("checkout.logout.inProgress")}
      </h1>
    </div>
  );
}
