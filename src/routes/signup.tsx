import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Créer un compte — Adresse GN" },
      {
        name: "description",
        content:
          "Créez votre compte Adresse GN pour enregistrer et gérer vos adresses numérotées.",
      },
      { property: "og:title", content: "Créer un compte — Adresse GN" },
      {
        property: "og:description",
        content: "Rejoignez Adresse GN : un lieu, un numéro, un itinéraire.",
      },
    ],
  }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [aConfirmer, setAConfirmer] = useState(false);

  const soumettre = async (event: React.FormEvent) => {
    event.preventDefault();
    setEnCours(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: motDePasse,
      options: { emailRedirectTo: window.location.origin },
    });
    setEnCours(false);
    if (error) {
      toast.error("Inscription impossible", { description: error.message });
      return;
    }
    if (data.session) {
      toast.success("Compte créé");
      navigate({ to: "/" });
      return;
    }
    setAConfirmer(true);
  };

  if (aConfirmer) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-2xl font-bold text-foreground">
          Vérifiez votre boîte mail
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nous avons envoyé un lien de confirmation à {email}. Cliquez sur ce
          lien pour activer votre compte.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-foreground">Créer un compte</h1>
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
            autoComplete="new-password"
            required
            minLength={6}
            value={motDePasse}
            onChange={(event) => setMotDePasse(event.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={enCours}>
          {enCours ? "Création…" : "Créer mon compte"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Déjà inscrit ?{" "}
        <Link to="/login" className="text-primary underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
