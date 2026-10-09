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


type LoginMode =
  | "password"
  | "otp";


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
    return "/mon-compte";
  }

  return value;
}


export function LoginPage({
  returnTo,
}: LoginPageProps) {
  const router =
    useRouter();

  const [
    loginMode,
    setLoginMode,
  ] =
    useState<LoginMode>(
      "password",
    );

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
    otpSent,
    setOtpSent,
  ] =
    useState(false);

  const [
    otpCode,
    setOtpCode,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  function changeMode(
    mode: LoginMode,
  ) {
    if (submitting) {
      return;
    }

    setLoginMode(mode);
    setOtpSent(false);
    setOtpCode("");
  }


  async function completeAuthenticatedSession(
    accessToken: string,
    userId: string,
  ) {
    /*
     * Étape essentielle de la migration :
     * toute session Supabase doit être validée
     * par Django avant d'être considérée comme
     * une connexion Adresse GN complète.
     */
    const djangoSession =
      await verifyDjangoSession(
        accessToken,
      );


    if (
      djangoSession.user.id !==
      userId
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
  }


  async function submitPassword() {
    const normalizedEmail =
      email.trim().toLowerCase();

    const {
      data,
      error,
    } =
      await supabase.auth
        .signInWithPassword({
          email:
            normalizedEmail,
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


    await completeAuthenticatedSession(
      data.session.access_token,
      data.user.id,
    );
  }


  async function requestOtp() {
    const normalizedEmail =
      email.trim().toLowerCase();


    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail,
      )
    ) {
      throw new Error(
        "Renseignez une adresse e-mail valide.",
      );
    }


    const {
      error,
    } =
      await supabase.auth
        .signInWithOtp({
          email:
            normalizedEmail,

          options: {
            /*
             * Contrat propriétaire :
             * /login ne crée jamais silencieusement
             * un nouveau compte.
             *
             * La création initiale reste gérée par
             * le checkout /commander.
             */
            shouldCreateUser:
              false,
          },
        });


    if (error) {
      throw new Error(
        error.message,
      );
    }


    setOtpCode("");
    setOtpSent(true);


    toast.success(
      "Code envoyé",
      {
        description:
          "Consultez votre messagerie pour récupérer votre code de connexion.",
      },
    );
  }


  async function verifyOtpLogin() {
    const normalizedEmail =
      email.trim().toLowerCase();

    const cleanCode =
      otpCode.trim();


    if (
      cleanCode.length < 6
    ) {
      throw new Error(
        "Saisissez le code reçu par e-mail.",
      );
    }


    const {
      data,
      error,
    } =
      await supabase.auth
        .verifyOtp({
          email:
            normalizedEmail,

          token:
            cleanCode,

          type:
            "email",
        });


    if (
      error ||
      !data.session ||
      !data.user
    ) {
      throw new Error(
        error?.message ??
          "Code invalide ou expiré.",
      );
    }


    await completeAuthenticatedSession(
      data.session.access_token,
      data.user.id,
    );
  }


  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();


    if (submitting) {
      return;
    }


    setSubmitting(true);


    try {
      if (
        loginMode ===
        "password"
      ) {
        await submitPassword();
        return;
      }


      if (otpSent) {
        await verifyOtpLogin();
        return;
      }


      await requestOtp();
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
      subtitle="Connectez-vous par mot de passe ou avec un code reçu par e-mail."
      footer={
        <>
          Pas encore d&apos;Adresse GN ?{" "}
          <Link
            href="/commander"
            className="font-medium text-accent hover:underline"
          >
            Créer mon Adresse GN
          </Link>
        </>
      }
    >
      <form
        onSubmit={submit}
        className="space-y-5"
      >
        <div
          className="grid grid-cols-2 gap-2"
        >
          <Button
            type="button"
            variant={
              loginMode ===
              "password"
                ? "default"
                : "outline"
            }
            onClick={() =>
              changeMode(
                "password",
              )
            }
            disabled={
              submitting
            }
            className="h-11"
          >
            Mot de passe
          </Button>

          <Button
            type="button"
            variant={
              loginMode ===
              "otp"
                ? "default"
                : "outline"
            }
            onClick={() =>
              changeMode(
                "otp",
              )
            }
            disabled={
              submitting
            }
            className="h-11"
          >
            Code e-mail
          </Button>
        </div>


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
            disabled={
              loginMode ===
                "otp" &&
              otpSent
            }
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


        {loginMode ===
          "password" && (
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
        )}


        {loginMode ===
          "otp" &&
          otpSent && (
          <div className="space-y-2">
            <Label
              htmlFor="otp-code"
            >
              Code reçu
            </Label>

            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otpCode}
              onChange={(
                event,
              ) =>
                setOtpCode(
                  event.target.value
                    .replace(
                      /\D/g,
                      "",
                    )
                    .slice(
                      0,
                      10,
                    ),
                )
              }
              placeholder="00000000"
              className="h-11 border-slate-300 font-mono tracking-[0.2em] focus-visible:ring-2 focus-visible:ring-accent/30"
            />

            <button
              type="button"
              disabled={
                submitting
              }
              onClick={() => {
                setOtpCode("");
                setOtpSent(false);
              }}
              className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
            >
              Recevoir un nouveau code
            </button>
          </div>
        )}


        <Button
          type="submit"
          className="h-12 w-full text-base font-medium transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          disabled={
            submitting
          }
        >
          {submitting
            ? "Connexion…"
            : loginMode ===
                "password"
              ? "Se connecter"
              : otpSent
                ? "Vérifier le code"
                : "Recevoir le code"}
        </Button>
      </form>
    </AuthLayout>
  );
}
