"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabase/browser";


export default function ResetPasswordPage() {
  const router =
    useRouter();

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmation,
    setConfirmation,
  ] = useState("");

  const [
    ready,
    setReady,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState(
    "Vérification du lien de récupération…",
  );


  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession()
      .then(
        ({
          data,
        }) => {
          if(!mounted){
            return;
          }

          if(data.session){
            setReady(true);
            setMessage("");
          }
          else{
            setMessage(
              "Lien de récupération invalide ou expiré.",
            );
          }
        },
      );

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        (
          event,
          session,
        ) => {
          if(!mounted){
            return;
          }

          if(
            event === "PASSWORD_RECOVERY"
            || session
          ){
            setReady(true);
            setMessage("");
          }
        },
      );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  },[]);


  async function submit(){
    if(password.length < 8){
      setMessage(
        "Le mot de passe doit contenir au moins 8 caractères.",
      );
      return;
    }

    if(password !== confirmation){
      setMessage(
        "Les deux mots de passe ne correspondent pas.",
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      error,
    } =
      await supabase.auth.updateUser({
        password,
      });

    if(error){
      setSaving(false);
      setMessage(
        error.message,
      );
      return;
    }

    await supabase.auth.signOut();

    router.replace(
      "/login",
    );
  }


  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl border bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Adresse GN
        </p>

        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Nouveau mot de passe
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Définissez un nouveau mot de passe pour votre compte.
        </p>

        {message && (
          <div className="mt-5 rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
            {message}
          </div>
        )}

        {ready && (
          <div className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Nouveau mot de passe
              </span>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border px-3"
                autoComplete="new-password"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Confirmation
              </span>

              <input
                type="password"
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border px-3"
                autoComplete="new-password"
              />
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void submit()
              }
              className="h-11 w-full rounded-xl bg-slate-950 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving
                ? "Enregistrement…"
                : "Enregistrer le mot de passe"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
