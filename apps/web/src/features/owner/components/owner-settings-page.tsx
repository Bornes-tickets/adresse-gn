"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  CircleOff,
  CircleUserRound,
  LockKeyhole,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import {
  toast,
} from "sonner";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  getAccessToken,
  supabase,
} from "@/lib/supabase/browser";

import {
  deactivateOwnerAccount,
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
    role,
    setRole,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    deactivationOpen,
    setDeactivationOpen,
  ] = useState(false);

  const [
    deactivationConfirmation,
    setDeactivationConfirmation,
  ] = useState("");

  const [
    deactivating,
    setDeactivating,
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

            setRole(
              result.role,
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


  async function deactivateAccount() {
    if (
      deactivationConfirmation
      !== "DESACTIVER"
    ) {
      return;
    }

    setDeactivating(true);

    try {
      const token =
        await getAccessToken();

      if (!token) {
        window.location.href =
          "/login?returnTo=%2Fmon-compte%2Fsettings";

        return;
      }

      const result =
        await deactivateOwnerAccount(
          token,
        );

      const {
        error: signOutError,
      } =
        await supabase.auth.signOut({
          scope: "local",
        });

      if (signOutError) {
        console.warn(
          "Nettoyage local Supabase incomplet après désactivation.",
          signOutError,
        );
      }

      const destination =
        result.sessions_revoked
          ? "/?account=deactivated"
          : "/?account=deactivated&sessions=unconfirmed";

      window.location.replace(
        destination,
      );

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de désactiver le compte.",
      );

      setDeactivating(false);
    }
  }


  const canSelfDeactivate =
    role === "user";

  const confirmationValid =
    deactivationConfirmation
    === "DESACTIVER";


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
            className="space-y-2"
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
                    event.target.value,
                  )
              }
              maxLength={120}
              placeholder="Votre nom complet"
            />
          </div>


          <div
            className="space-y-2"
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
                    event.target.value,
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
              d&apos;authentification.
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


      <section
        className="
          overflow-hidden
          rounded-3xl
          border
          border-red-200/80
          bg-gradient-to-br
          from-white
          via-white
          to-red-50/70
          shadow-sm
        "
      >
        <div
          className="
            flex flex-col
            gap-5
            p-5
            sm:flex-row
            sm:items-center
            sm:justify-between
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
                bg-red-100
                text-red-600
              "
            >
              <ShieldAlert
                className="size-5"
              />
            </span>

            <div>
              <div
                className="
                  mb-1.5
                  text-xs
                  font-semibold
                  uppercase
                  tracking-[0.16em]
                  text-red-600
                "
              >
                Zone sensible
              </div>

              <h2
                className="
                  font-semibold
                  text-slate-950
                "
              >
                Désactivation du compte
              </h2>

              <p
                className="
                  mt-1
                  max-w-2xl
                  text-sm
                  leading-6
                  text-slate-600
                "
              >
                La désactivation bloque
                l&apos;accès privé à votre compte.
                Vos adresses, commandes,
                réclamations et historiques
                restent conservés.
              </p>

              {!canSelfDeactivate && (
                <p
                  className="
                    mt-3
                    inline-flex
                    rounded-full
                    bg-amber-100
                    px-3 py-1.5
                    text-xs
                    font-semibold
                    text-amber-800
                  "
                >
                  La désactivation libre-service
                  n&apos;est pas disponible pour ce rôle.
                </p>
              )}
            </div>
          </div>

          {canSelfDeactivate && (
            <Button
              type="button"
              variant="outline"
              className="
                shrink-0
                rounded-xl
                border-red-200
                bg-white
                text-red-700
                shadow-sm
                hover:border-red-300
                hover:bg-red-50
                hover:text-red-800
              "
              onClick={
                () => {
                  setDeactivationConfirmation(
                    "",
                  );

                  setDeactivationOpen(
                    true,
                  );
                }
              }
            >
              <CircleOff
                className="size-4"
              />

              Désactiver mon compte
            </Button>
          )}
        </div>
      </section>


      <Dialog
        open={deactivationOpen}
        onOpenChange={
          (open) => {
            if (deactivating) {
              return;
            }

            setDeactivationOpen(
              open,
            );

            if (!open) {
              setDeactivationConfirmation(
                "",
              );
            }
          }
        }
      >
        <DialogContent
          className="
            overflow-hidden
            rounded-3xl
            border-red-100
            p-0
            sm:max-w-lg
          "
        >
          <div
            className="
              bg-gradient-to-br
              from-red-50
              to-orange-50
              px-6 py-5
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
                  bg-red-100
                  text-red-600
                "
              >
                <ShieldAlert
                  className="size-5"
                />
              </span>

              <DialogHeader
                className="
                  space-y-1
                  text-left
                "
              >
                <DialogTitle
                  className="
                    text-xl
                    text-slate-950
                  "
                >
                  Désactiver votre compte ?
                </DialogTitle>

                <DialogDescription
                  className="
                    leading-6
                    text-slate-600
                  "
                >
                  Vous serez déconnecté et
                  l&apos;accès privé Adresse GN sera
                  bloqué. Vos données métier ne
                  seront pas supprimées.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div
            className="
              space-y-5
              px-6 pb-6
            "
          >
            <div
              className="
                rounded-2xl
                border
                border-slate-200
                bg-slate-50
                p-4
                text-sm
                leading-6
                text-slate-600
              "
            >
              Pour confirmer, saisissez
              exactement{" "}
              <strong
                className="
                  font-semibold
                  text-slate-950
                "
              >
                DESACTIVER
              </strong>.
            </div>

            <div
              className="space-y-2"
            >
              <Label
                htmlFor="deactivation-confirmation"
              >
                Confirmation
              </Label>

              <Input
                id="deactivation-confirmation"
                value={
                  deactivationConfirmation
                }
                onChange={
                  (event) => {
                    setDeactivationConfirmation(
                      event.target.value,
                    );
                  }
                }
                disabled={deactivating}
                autoComplete="off"
                placeholder="DESACTIVER"
              />
            </div>

            <DialogFooter
              className="
                gap-2
                sm:space-x-0
              "
            >
              <Button
                type="button"
                variant="outline"
                disabled={deactivating}
                onClick={
                  () => {
                    setDeactivationOpen(
                      false,
                    );
                  }
                }
              >
                Annuler
              </Button>

              <Button
                type="button"
                disabled={
                  !confirmationValid
                  || deactivating
                }
                className="
                  bg-red-600
                  text-white
                  hover:bg-red-700
                "
                onClick={
                  () => {
                    void deactivateAccount();
                  }
                }
              >
                <CircleOff
                  className="size-4"
                />

                {
                  deactivating
                    ? "Désactivation…"
                    : "Confirmer la désactivation"
                }
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
