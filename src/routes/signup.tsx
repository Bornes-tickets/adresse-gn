import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";


import { AuthLayout } from "@/components/AuthLayout";
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
  const { t } = useTranslation();
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
      toast.error(t("auth.signup.errorTitle"), { description: error.message });
      return;
    }
    if (data.session) {
      toast.success(t("auth.signup.success"));
      navigate({ to: "/" });
      return;
    }
    setAConfirmer(true);
  };

  if (aConfirmer) {
    return (
      <AuthLayout
        title={t("auth.signup.checkMailTitle")}
        subtitle={t("auth.signup.checkMailSubtitle", { email })}
      >
        <Button asChild variant="outline" className="h-12 w-full text-base">
          <Link to="/">{t("auth.signup.backHome")}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      footer={
        <>
          {t("auth.signup.already")}{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            {t("auth.signup.login")}
          </Link>
        </>
      }
    >
      <form onSubmit={soumettre} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.email")}</Label>
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
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={motDePasse}
            onChange={(event) => setMotDePasse(event.target.value)}
            className="h-11 border-slate-300 focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <p className="text-xs text-slate-500">{t("auth.signup.minChars")}</p>
        </div>
        <Button
          type="submit"
          className="h-12 w-full text-base font-medium transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          disabled={enCours}
        >
          {enCours ? t("auth.signup.submitting") : t("auth.signup.submit")}
        </Button>

      </form>
    </AuthLayout>
  );
}
