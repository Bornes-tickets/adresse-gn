import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Adresse GN" },
      {
        name: "description",
        content:
          "Connectez-vous à votre compte Adresse GN avec votre email et votre mot de passe.",
      },
      { property: "og:title", content: "Connexion — Adresse GN" },
      {
        property: "og:description",
        content: "Accédez à votre espace Adresse GN.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (event: React.FormEvent) => {
    event.preventDefault();
    setEnCours(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });
    setEnCours(false);
    if (error) {
      toast.error("Connexion impossible", { description: error.message });
      return;
    }
    toast.success("Connexion réussie");
    navigate({ to: "/" });
  };

  return (
    <AuthLayout
      title="Bon retour"
      subtitle="Connectez-vous pour gérer vos adresses, vos balises et vos favoris."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link to="/signup" className="font-medium text-accent hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={soumettre} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 border-slate-300 focus-visible:ring-2 focus-visible:ring-accent/30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={motDePasse}
            onChange={(event) => setMotDePasse(event.target.value)}
            className="h-11 border-slate-300 focus-visible:ring-2 focus-visible:ring-accent/30"
          />
        </div>
        <Button
          type="submit"
          className="h-12 w-full text-base font-medium transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          disabled={enCours}
        >
          {enCours ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </AuthLayout>
  );
}
