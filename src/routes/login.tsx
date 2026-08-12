import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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

/** Détermine la route de destination après login selon le rôle de l'utilisateur. */
function destinationParRole(role: string | null | undefined): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "/admin";
    case "supervisor":
      return "/supervisor";
    case "sales":
      return "/sales";
    case "ops":
      return "/ops";
    case "support":
      return "/support";
    case "agent":
      return "/agent";
    default:
      return "/";
  }
}

function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (event: React.FormEvent) => {
    event.preventDefault();
    setEnCours(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });

    if (error || !data.user) {
      setEnCours(false);
      toast.error(t("auth.login.errorTitle"), { description: error?.message ?? "Erreur." });
      return;
    }

    // Récupère le rôle métier depuis profiles pour rediriger vers le bon espace
    let destination = "/";
    try {
      const { data: profil } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      destination = destinationParRole(profil?.role);
    } catch {
      // En cas d'erreur silencieuse, on redirige vers l'accueil public
      destination = "/";
    }

    setEnCours(false);
    toast.success(t("auth.login.success"));
    navigate({ to: destination });
  };

  return (
    <AuthLayout
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <>
          {t("auth.login.noAccount")}{" "}
          <Link to="/signup" className="font-medium text-accent hover:underline">
            {t("auth.login.createAccount")}
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
          {enCours ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
