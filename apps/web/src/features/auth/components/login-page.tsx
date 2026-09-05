"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useState,
} from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  verifyDjangoSession,
} from "@/features/auth/api";

import {
  supabase,
} from "@/lib/supabase/browser";


type LoginPageProps = {
  returnTo?: string;
};


function safeReturnPath(
  value: string | null | undefined,
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  return value;
}


export function LoginPage({
  returnTo,
}: LoginPageProps) {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);


    try {
      const {
        data,
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              email.trim(),
            password,
          });


      if (
        error ||
        !data.session ||
        !data.user
      ) {
        throw new Error(
          error?.message ??
            "Identifiants incorrects.",
        );
      }


      /*
       * Étape essentielle de la migration :
       * on ne considère pas la connexion comme
       * terminée tant que Django n'a pas validé
       * le JWT Supabase.
       */
      const djangoSession =
        await verifyDjangoSession(
          data.session.access_token,
        );


      if (
        djangoSession.user.id !==
        data.user.id
      ) {
        await supabase.auth
          .signOut();

        throw new Error(
          "L'identité retournée par Django ne correspond pas à la session Supabase.",
        );
      }


      toast.success(
        "Connexion réussie",
      );


      const destination =
        safeReturnPath(
          returnTo,
        );


      router.replace(
        destination,
      );

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Une erreur est survenue.";

      toast.error(
        "Connexion impossible",
        {
          description:
            message,
        },
      );
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <AuthLayout
      title="Bon retour"
      subtitle="Connectez-vous pour gérer vos adresses, vos balises et vos favoris."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link
            href="/signup"
            className="font-medium text-accent hover:underline"
          >
            Créer un compte
          </Link>
        </>
      }
    >
      <form
        onSubmit={submit}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label
            htmlFor="email"
          >
            Email
          </Label>

          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(
              event,
            ) =>
              setEmail(
                event.target.value,
              )
            }
            className="h-11 border-slate-300 focus-visible:ring-2 focus-visible:ring-accent/30"
          />
        </div>


        <div className="space-y-2">
          <Label
            htmlFor="password"
          >
            Mot de passe
          </Label>

          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(
              event,
            ) =>
              setPassword(
                event.target.value,
              )
            }
            className="h-11 border-slate-300 focus-visible:ring-2 focus-visible:ring-accent/30"
          />
        </div>


        <Button
          type="submit"
          className="h-12 w-full text-base font-medium transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          disabled={
            submitting
          }
        >
          {submitting
            ? "Connexion…"
            : "Se connecter"}
        </Button>
      </form>
    </AuthLayout>
  );
}
