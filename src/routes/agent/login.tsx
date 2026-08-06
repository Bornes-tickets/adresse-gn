import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgent } from "@/hooks/useAgent";
import { lookupAgentEmail } from "@/lib/agent.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/agent/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion agent — Adresse GN" },
      {
        name: "description",
        content:
          "Espace agents installateurs Adresse GN : connectez-vous avec votre numéro de badge.",
      },
      { property: "og:title", content: "Connexion agent — Adresse GN" },
      {
        property: "og:description",
        content: "Application terrain des agents installateurs Adresse GN.",
      },
    ],
  }),
  component: AgentLogin,
});

function AgentLogin() {
  const navigate = useNavigate();
  const { isAgent, loading } = useAgent();
  const [badge, setBadge] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!loading && isAgent) navigate({ to: "/agent/tasks", replace: true });
  }, [loading, isAgent, navigate]);

  const soumettre = async (event: React.FormEvent) => {
    event.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const { email } = await lookupAgentEmail({ data: { badgeNumber: badge } });
      if (!email) {
        setErreur("Numéro de badge ou mot de passe invalide.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: motDePasse,
      });
      if (error) {
        setErreur("Numéro de badge ou mot de passe invalide.");
        return;
      }
      navigate({ to: "/agent/tasks", replace: true });
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[80dvh] w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <span className="inline-block rounded-lg bg-primary px-3 py-2 text-lg font-bold text-primary-foreground">
          AGN
        </span>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Espace agent</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connectez-vous avec votre numéro de badge.
        </p>
      </div>

      <form onSubmit={soumettre} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="badge">Numéro de badge</Label>
          <Input
            id="badge"
            required
            autoCapitalize="characters"
            className="h-14 font-mono text-lg"
            value={badge}
            onChange={(event) => setBadge(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-14 text-lg"
            value={motDePasse}
            onChange={(event) => setMotDePasse(event.target.value)}
          />
        </div>

        {erreur && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {erreur}
          </p>
        )}

        <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={enCours}>
          {enCours ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </div>
  );
}
