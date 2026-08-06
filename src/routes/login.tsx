import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

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
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-foreground">Se connecter</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Email et mot de passe.
      </p>

      <form onSubmit={soumettre} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          />
        </div>
        <Button type="submit" className="w-full" disabled={enCours}>
          {enCours ? "Connexion…" : "Se connecter"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Pas de compte ?{" "}
        <Link to="/signup" className="text-primary underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
