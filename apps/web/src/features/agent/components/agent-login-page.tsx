"use client";

import {
  HardHat,
  LoaderCircle,
  LockKeyhole,
  Radio,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

import {
  toast,
} from "sonner";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  AgentApiError,
  getAgentMe,
  loginAgentBadge,
} from "@/features/agent/api";

import {
  getAccessToken,
  supabase,
} from "@/lib/supabase/browser";


export function AgentLoginPage() {
  const router =
    useRouter();

  const [
    badge,
    setBadge,
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

  const [
    checkingSession,
    setCheckingSession,
  ] =
    useState(true);


  useEffect(() => {
    let cancelled =
      false;

    const controller =
      new AbortController();

    async function checkExistingSession() {
      try {
        const token =
          await getAccessToken();

        if (!token) {
          return;
        }

        await getAgentMe(
          token,
          controller.signal,
        );

        if (!cancelled) {
          router.replace(
            "/agent/tasks",
          );
        }
      } catch {
        /*
         * Une session utilisateur non-Agent ne doit pas
         * empêcher l'affichage du formulaire Agent.
         */
      } finally {
        if (!cancelled) {
          setCheckingSession(
            false,
          );
        }
      }
    }

    void checkExistingSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    router,
  ]);


  async function submit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const cleanBadge =
      badge.trim();

    if (
      !cleanBadge ||
      !password
    ) {
      toast.error(
        "Connexion impossible",
        {
          description:
            "Renseignez votre numéro de badge et votre mot de passe.",
        },
      );

      return;
    }

    setSubmitting(true);

    let sessionInstalled =
      false;

    try {
      const result =
        await loginAgentBadge(
          cleanBadge,
          password,
        );

      const {
        data,
        error,
      } =
        await supabase.auth
          .setSession({
            access_token:
              result.session
                .access_token,
            refresh_token:
              result.session
                .refresh_token,
          });

      if (
        error ||
        !data.session ||
        !data.user
      ) {
        throw new Error(
          "La session Agent n'a pas pu être enregistrée.",
        );
      }

      sessionInstalled =
        true;

      const agentSession =
        await getAgentMe(
          data.session
            .access_token,
        );

      if (
        agentSession.agent
          .user_id !==
        data.user.id
      ) {
        throw new Error(
          "La session Agent retournée est incohérente.",
        );
      }

      toast.success(
        "Connexion réussie",
        {
          description:
            `Bienvenue ${
              agentSession.agent
                .full_name ??
              "Agent"
            }.`,
        },
      );

      router.replace(
        "/agent/tasks",
      );

      router.refresh();
    } catch (error) {
      if (sessionInstalled) {
        await supabase.auth
          .signOut();
      }

      const message =
        error instanceof
          AgentApiError ||
        error instanceof Error
          ? error.message
          : (
            "Connexion impossible."
          );

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


  if (checkingSession) {
    return (
      <div
        className="
          flex min-h-[100dvh]
          items-center justify-center
          bg-gradient-to-br
          from-slate-50 via-white
          to-orange-50/40
          px-5
        "
      >
        <div
          className="
            flex items-center gap-2
            text-sm font-medium
            text-slate-500
          "
        >
          <LoaderCircle
            className="
              h-5 w-5
              animate-spin
              text-orange-500
            "
          />

          Vérification de la session…
        </div>
      </div>
    );
  }


  return (
    <div
      className="
        relative flex
        min-h-[100dvh]
        items-center justify-center
        overflow-hidden
        bg-gradient-to-br
        from-slate-50 via-white
        to-orange-50/50
        px-5 py-10
      "
    >
      <div
        className="
          absolute -right-20 -top-20
          h-64 w-64 rounded-full
          bg-orange-200/30 blur-3xl
        "
      />

      <div
        className="
          absolute -bottom-24 -left-20
          h-72 w-72 rounded-full
          bg-rose-200/30 blur-3xl
        "
      />

      <div
        className="
          relative w-full max-w-sm
        "
      >
        <div
          className="
            mb-8 text-center
          "
        >
          <div
            className="
              mx-auto flex h-16 w-16
              items-center justify-center
              rounded-2xl
              bg-gradient-to-br
              from-orange-500
              via-rose-500
              to-pink-600
              text-white shadow-lg
              shadow-orange-500/20
            "
          >
            <HardHat
              className="h-8 w-8"
            />
          </div>

          <div
            className="
              mt-4 inline-flex
              items-center gap-1.5
              rounded-full
              bg-orange-100
              px-3 py-1
              text-[11px]
              font-semibold
              uppercase
              tracking-widest
              text-orange-700
            "
          >
            <Radio
              className="h-3 w-3"
            />

            Adresse GN
          </div>

          <h1
            className="
              mt-3 text-2xl
              font-bold
              text-slate-900
            "
          >
            Espace agent
          </h1>

          <p
            className="
              mt-2 text-sm
              leading-6
              text-slate-500
            "
          >
            Connectez-vous avec
            votre numéro de badge.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="
            space-y-5
            rounded-2xl
            border border-slate-200
            bg-white/90
            p-5 shadow-xl
            shadow-slate-900/5
            backdrop-blur
          "
        >
          <div
            className="space-y-2"
          >
            <Label
              htmlFor="agent-badge"
            >
              Numéro de badge
            </Label>

            <Input
              id="agent-badge"
              required
              autoCapitalize="characters"
              autoComplete="username"
              disabled={
                submitting
              }
              value={badge}
              onChange={(
                event,
              ) =>
                setBadge(
                  event.target.value,
                )
              }
              placeholder="AG-001"
              className="
                h-14 rounded-xl
                border-slate-200
                bg-white
                font-mono
                text-base
                uppercase
              "
            />
          </div>

          <div
            className="space-y-2"
          >
            <Label
              htmlFor="agent-password"
            >
              Mot de passe
            </Label>

            <div
              className="relative"
            >
              <LockKeyhole
                className="
                  pointer-events-none
                  absolute left-3
                  top-1/2 h-4 w-4
                  -translate-y-1/2
                  text-slate-400
                "
              />

              <Input
                id="agent-password"
                type="password"
                required
                autoComplete={
                  "current-password"
                }
                disabled={
                  submitting
                }
                value={password}
                onChange={(
                  event,
                ) =>
                  setPassword(
                    event.target.value,
                  )
                }
                className="
                  h-14 rounded-xl
                  border-slate-200
                  bg-white
                  pl-10 text-base
                "
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={
              submitting
            }
            className="
              h-14 w-full
              rounded-xl
              bg-gradient-to-r
              from-orange-500
              to-rose-600
              text-base
              font-semibold
              text-white
              shadow-lg
              shadow-orange-500/20
              hover:from-orange-600
              hover:to-rose-700
            "
          >
            {submitting ? (
              <>
                <LoaderCircle
                  className="
                    h-4 w-4
                    animate-spin
                  "
                />

                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </Button>
        </form>

        <p
          className="
            mt-5 text-center
            text-[11px]
            text-slate-400
          "
        >
          Adresse GN ·
          Application terrain
        </p>
      </div>
    </div>
  );
}
