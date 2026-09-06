"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  CircleUserRound,
  LockKeyhole,
  Save,
  Sparkles,
} from "lucide-react";

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
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  getOwnerProfile,
  OwnerApiError,
  updateOwnerProfile,
} from "../api";


export function OwnerSettingsPage() {
  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);


  const load =
    useCallback(
      async (
        signal?: AbortSignal,
      ) => {
        setLoading(true);

        try {
          const token =
            await getAccessToken();

          if (!token) {
            window.location.href =
              "/login?returnTo=%2Fmon-compte%2Fsettings";

            return;
          }

          const result =
            await getOwnerProfile(
              token,
              signal,
            );

          if (!signal?.aborted) {
            setFullName(
              result.full_name ?? "",
            );
            setPhone(
              result.phone ?? "",
            );
          }

        } catch (error) {
          if (signal?.aborted) {
            return;
          }

          if (
            error instanceof OwnerApiError
            && error.statusCode === 401
          ) {
            window.location.href =
              "/login?returnTo=%2Fmon-compte%2Fsettings";

            return;
          }

          toast.error(
            error instanceof Error
              ? error.message
              : "Impossible de charger le profil.",
          );

        } finally {
          if (!signal?.aborted) {
            setLoading(false);
          }
        }
      },
      [],
    );


  useEffect(() => {
    const controller =
      new AbortController();

    void load(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, [load]);


  async function saveProfile() {
    setSaving(true);

    try {
      const token =
        await getAccessToken();

      if (!token) {
        window.location.href =
          "/login?returnTo=%2Fmon-compte%2Fsettings";

        return;
      }

      const result =
        await updateOwnerProfile(
          token,
          {
            full_name:
              fullName.trim() || null,

            phone:
              phone.trim() || null,
          },
        );

      setFullName(
        result.profile.full_name
        ?? "",
      );

      setPhone(
        result.profile.phone
        ?? "",
      );

      toast.success(
        result.message,
      );

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer le profil.",
      );

    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <div
        className="
          h-80
          animate-pulse
          rounded-3xl
          bg-slate-100
        "
      />
    );
  }


  return (
    <div
      className="
        space-y-6
      "
    >
      <section
        className="
          relative
          overflow-hidden
          rounded-3xl
          bg-gradient-to-r
          from-slate-800
          via-slate-700
          to-blue-700
          px-6 py-8
          text-white
          shadow-xl
          shadow-slate-900/10
          sm:px-8
        "
      >
        <div
          className="
            pointer-events-none
            absolute
            -right-20 -top-24
            size-72
            rounded-full
            bg-white/10
            blur-2xl
          "
        />

        <div className="relative">
          <div
            className="
              mb-3
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-white/20
              bg-white/10
              px-3 py-1.5
              text-xs
              font-medium
              backdrop-blur
            "
          >
            <Sparkles
              className="size-3.5"
            />

            Espace propriétaire
          </div>

          <h1
            className="
              text-3xl
              font-bold
              tracking-tight
              sm:text-4xl
            "
          >
            Paramètres
          </h1>

          <p
            className="
              mt-2
              max-w-2xl
              text-sm
              leading-6
              text-slate-200
              sm:text-base
            "
          >
            Gérez les informations
            associées à votre profil
            Adresse GN.
          </p>
        </div>
      </section>


      <section
        className="
          rounded-3xl
          border
          border-slate-200/80
          bg-white
          p-5
          shadow-sm
          sm:p-6
        "
      >
        <div
          className="
            flex
            items-start
            gap-3
          "
        >
          <span
            className="
              flex size-11
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-blue-50
              text-blue-600
            "
          >
            <CircleUserRound
              className="size-5"
            />
          </span>

          <div>
            <h2
              className="
                font-semibold
                text-slate-950
              "
            >
              Profil
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-slate-500
              "
            >
              Ces informations sont
              utilisées dans votre espace
              Adresse GN.
            </p>
          </div>
        </div>


        <div
          className="
            mt-6
            grid
            gap-5
            sm:grid-cols-2
          "
        >
          <div
            className="
              space-y-2
            "
          >
            <Label
              htmlFor="owner-full-name"
            >
              Nom complet
            </Label>

            <Input
              id="owner-full-name"
              value={fullName}
              onChange={
                (event) =>
                  setFullName(
                    event.target.value
                  )
              }
              maxLength={120}
              placeholder="Votre nom complet"
            />
          </div>


          <div
            className="
              space-y-2
            "
          >
            <Label
              htmlFor="owner-phone"
            >
              Téléphone
            </Label>

            <Input
              id="owner-phone"
              value={phone}
              onChange={
                (event) =>
                  setPhone(
                    event.target.value
                  )
              }
              maxLength={30}
              placeholder="+224 ..."
              inputMode="tel"
            />

            <p
              className="
                text-xs
                leading-5
                text-slate-500
              "
            >
              Téléphone de contact du profil.
              Il ne modifie pas votre méthode
              d'authentification.
            </p>
          </div>
        </div>


        <div
          className="
            mt-6
            flex
            flex-wrap
            items-center
            gap-3
          "
        >
          <Button
            type="button"
            onClick={
              () => {
                void saveProfile();
              }
            }
            disabled={saving}
          >
            <Save
              className="size-4"
            />

            {
              saving
                ? "Enregistrement…"
                : "Enregistrer"
            }
          </Button>

        </div>
      </section>


      <section
        className="
          rounded-3xl
          border
          border-slate-200/80
          bg-white
          p-5
          shadow-sm
          sm:p-6
        "
      >
        <div
          className="
            flex
            items-start
            gap-3
          "
        >
          <span
            className="
              flex size-11
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-emerald-50
              text-emerald-600
            "
          >
            <LockKeyhole
              className="size-5"
            />
          </span>

          <div>
            <h2
              className="
                font-semibold
                text-slate-950
              "
            >
              Connexion et sécurité
            </h2>

            <p
              className="
                mt-1
                max-w-2xl
                text-sm
                leading-6
                text-slate-500
              "
            >
              Votre adresse e-mail et votre
              méthode de connexion sont gérées
              séparément de ces informations
              de profil. Modifier votre nom ou
              votre téléphone de contact ne
              change pas vos identifiants.
            </p>
          </div>
        </div>
      </section>
</div>
  );
}
