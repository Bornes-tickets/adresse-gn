"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  ExternalLink,
  Heart,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  toast,
} from "sonner";

import {
  Badge,
} from "@/components/ui/badge";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  createOwnerFavorite,
  deleteOwnerFavorite,
  listOwnerFavorites,
  type OwnerFavorite,
  OwnerApiError,
  updateOwnerFavorite,
} from "../api";


const CATEGORY_LABELS:
  Record<string, string> = {
    habitation:
      "Habitation",
    restaurant:
      "Restaurant",
    hotel:
      "Hôtel",
    bar:
      "Bar",
    commerce:
      "Commerce",
    entreprise:
      "Entreprise",
    administration:
      "Administration",
    ecole:
      "École",
    sante:
      "Santé",
    pharmacie:
      "Pharmacie",
    banque:
      "Banque",
    tourisme:
      "Tourisme",
    other:
      "Autre",
  };


function categoryLabel(
  category: string | null,
) {
  if (!category) {
    return null;
  }

  return (
    CATEGORY_LABELS[category]
    ?? category
  );
}


function normalizeNumber(
  input: string,
) {
  const raw =
    input
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

  let zone = "CKY";

  if (
    typeof window !==
    "undefined"
  ) {
    const stored =
      window.localStorage
        .getItem(
          "adresse_gn_zone",
        );

    if (
      stored &&
      /^[A-Z]{3}$/.test(
        stored
      )
    ) {
      zone = stored;
    }
  }

  if (/^\d{6}$/.test(raw)) {
    return (
      `GN-${zone}-${raw}`
    );
  }

  const compact =
    raw.replace(
      /[^A-Z0-9]/g,
      "",
    );

  const match =
    compact.match(
      /^GN([A-Z]{3})(\d{6})$/,
    );

  if (match) {
    return (
      `GN-${match[1]}-${match[2]}`
    );
  }

  return raw;
}


export function OwnerFavoritesPage() {
  const [
    items,
    setItems,
  ] = useState<
    OwnerFavorite[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    number,
    setNumber,
  ] = useState("");

  const [
    alias,
    setAlias,
  ] = useState("");

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<
    string | null
  >(null);

  const [
    editAlias,
    setEditAlias,
  ] = useState("");

  const [
    busyId,
    setBusyId,
  ] = useState<
    string | null
  >(null);


  const load =
    useCallback(
      async (
        signal?: AbortSignal,
      ) => {
        try {
          const token =
            await getAccessToken();

          if (!token) {
            window.location.href =
              "/login?returnTo=%2Fmon-compte%2Ffavorites";

            return;
          }

          const favorites =
            await listOwnerFavorites(
              token,
              signal,
            );

          if (!signal?.aborted) {
            setItems(
              favorites,
            );
          }

        } catch (error) {
          if (signal?.aborted) {
            return;
          }

          if (
            error instanceof
              OwnerApiError &&
            error.statusCode === 401
          ) {
            window.location.href =
              "/login?returnTo=%2Fmon-compte%2Ffavorites";

            return;
          }

          toast.error(
            error instanceof Error
              ? error.message
              : "Impossible de charger vos favoris.",
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


  async function addFavorite(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!number.trim()) {
      return;
    }

    setAdding(true);

    try {
      const token =
        await getAccessToken();

      if (!token) {
        window.location.href =
          "/login?returnTo=%2Fmon-compte%2Ffavorites";

        return;
      }

      await createOwnerFavorite(
        token,
        {
          number:
            normalizeNumber(
              number
            ),
          alias:
            alias.trim()
            || null,
        },
      );

      toast.success(
        "Favori enregistré."
      );

      setNumber("");
      setAlias("");

      const favorites =
        await listOwnerFavorites(
          token,
        );

      setItems(
        favorites,
      );

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d'ajouter ce favori.",
      );

    } finally {
      setAdding(false);
    }
  }


  async function saveAlias(
    favoriteId: string,
  ) {
    setBusyId(
      favoriteId
    );

    try {
      const token =
        await getAccessToken();

      if (!token) {
        return;
      }

      await updateOwnerFavorite(
        token,
        favoriteId,
        editAlias.trim()
        || null,
      );

      toast.success(
        "Alias mis à jour."
      );

      setEditingId(null);

      const favorites =
        await listOwnerFavorites(
          token,
        );

      setItems(
        favorites,
      );

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de modifier cet alias.",
      );

    } finally {
      setBusyId(null);
    }
  }


  async function removeFavorite(
    favoriteId: string,
  ) {
    setBusyId(
      favoriteId
    );

    try {
      const token =
        await getAccessToken();

      if (!token) {
        return;
      }

      await deleteOwnerFavorite(
        token,
        favoriteId,
      );

      toast.success(
        "Favori retiré."
      );

      setItems(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              favoriteId,
          ),
      );

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de retirer ce favori.",
      );

    } finally {
      setBusyId(null);
    }
  }


  return (
    <div
      className="
        space-y-6
      "
    >
      <section
        className="
          relative overflow-hidden
          rounded-3xl
          bg-gradient-to-r
          from-rose-500
          via-fuchsia-600
          to-violet-600
          px-6 py-7
          text-white
          shadow-xl
          shadow-violet-900/10
          sm:px-8
        "
      >
        <div
          className="
            absolute
            -right-16 -top-20
            size-64
            rounded-full
            bg-white/10
            blur-2xl
          "
        />

        <div
          className="
            relative
          "
        >
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
              className="
                size-3.5
              "
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
            Mes favoris
          </h1>

          <p
            className="
              mt-2 max-w-2xl
              text-sm
              leading-6
              text-fuchsia-100
              sm:text-base
            "
          >
            Enregistrez les adresses que vous utilisez souvent
            et donnez-leur un nom facile à retenir.
          </p>
        </div>
      </section>


      <form
        onSubmit={addFavorite}
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
            mb-4
            flex items-center
            gap-3
          "
        >
          <span
            className="
              flex size-10
              items-center
              justify-center
              rounded-xl
              bg-rose-50
              text-rose-600
            "
          >
            <Heart
              className="
                size-5
              "
            />
          </span>

          <div>
            <h2
              className="
                font-semibold
                text-slate-950
              "
            >
              Ajouter une adresse
            </h2>

            <p
              className="
                text-xs
                text-slate-500
              "
            >
              Saisissez son numéro Adresse GN.
            </p>
          </div>
        </div>

        <div
          className="
            flex flex-col
            gap-3
            sm:flex-row
          "
        >
          <Input
            value={number}
            onChange={(event) =>
              setNumber(
                event.target.value
                  .toUpperCase()
              )
            }
            placeholder="GN-CKY-123456"
            className="
              font-mono
              sm:max-w-[14rem]
            "
            maxLength={32}
          />

          <Input
            value={alias}
            onChange={(event) =>
              setAlias(
                event.target.value
              )
            }
            placeholder="Alias (Maison, Bureau…)"
            maxLength={60}
          />

          <Button
            type="submit"
            disabled={
              !number.trim()
              || adding
            }
            className="
              w-full
              rounded-xl
              bg-gradient-to-r
              from-rose-500
              to-violet-600
              text-white
              shadow-sm
              hover:opacity-90
              sm:w-auto
            "
          >
            <Plus
              className="
                size-4
              "
            />

            {adding
              ? "Ajout…"
              : "Ajouter"}
          </Button>
        </div>
      </form>


      {loading ? (
        <div
          className="
            h-36
            animate-pulse
            rounded-3xl
            bg-slate-100
          "
        />

      ) : items.length === 0 ? (
        <section
          className="
            flex
            flex-col
            items-center
            justify-center
            rounded-3xl
            border
            border-dashed
            border-slate-300
            bg-white/70
            px-6 py-14
            text-center
          "
        >
          <span
            className="
              flex size-14
              items-center
              justify-center
              rounded-2xl
              bg-rose-50
              text-rose-500
            "
          >
            <Heart
              className="
                size-6
              "
            />
          </span>

          <h2
            className="
              mt-4
              font-semibold
              text-slate-800
            "
          >
            Aucun favori pour le moment
          </h2>

          <p
            className="
              mt-1 max-w-md
              text-sm
              text-slate-500
            "
          >
            Ajoutez une Adresse GN ci-dessus pour la retrouver
            rapidement depuis votre espace propriétaire.
          </p>
        </section>

      ) : (
        <div
          className="
            space-y-3
          "
        >
          {items.map(
            (favorite) => {
              const category =
                categoryLabel(
                  favorite.category
                );

              return (
                <article
                  key={favorite.id}
                  className="
                    flex flex-col
                    gap-4
                    rounded-2xl
                    border
                    border-slate-200/80
                    bg-white
                    p-5
                    shadow-sm
                    transition
                    hover:shadow-md
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
                  <div
                    className="
                      flex
                      min-w-0
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
                        rounded-xl
                        bg-rose-50
                        text-rose-600
                      "
                    >
                      <MapPin
                        className="
                          size-5
                        "
                      />
                    </span>

                    <div
                      className="
                        min-w-0
                        space-y-2
                      "
                    >
                      {editingId ===
                      favorite.id ? (
                        <div
                          className="
                            flex
                            flex-wrap
                            gap-2
                          "
                        >
                          <Input
                            value={
                              editAlias
                            }
                            onChange={(
                              event,
                            ) =>
                              setEditAlias(
                                event.target
                                  .value
                              )
                            }
                            maxLength={60}
                            className="
                              h-9 w-52
                            "
                            autoFocus
                          />

                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              busyId ===
                              favorite.id
                            }
                            onClick={() =>
                              void saveAlias(
                                favorite.id
                              )
                            }
                          >
                            OK
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditingId(
                                null
                              )
                            }
                          >
                            Annuler
                          </Button>
                        </div>
                      ) : (
                        <p
                          className="
                            truncate
                            font-semibold
                            text-slate-900
                          "
                        >
                          {favorite.alias
                            ?? favorite.name
                            ?? "Adresse enregistrée"}
                        </p>
                      )}

                      <div
                        className="
                          flex
                          flex-wrap
                          items-center
                          gap-2
                        "
                      >
                        <Link
                          href={
                            `/a/${favorite.public_number}`
                          }
                          className="
                            inline-flex
                            items-center
                            gap-1
                            font-mono
                            text-sm
                            font-medium
                            text-blue-600
                            hover:underline
                          "
                        >
                          {
                            favorite.public_number
                          }

                          <ExternalLink
                            className="
                              size-3.5
                            "
                          />
                        </Link>

                        {category ? (
                          <Badge
                            variant="secondary"
                          >
                            {category}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div
                    className="
                      flex
                      shrink-0
                      gap-2
                      pl-14
                      sm:pl-0
                    "
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="
                        rounded-xl
                      "
                      onClick={() => {
                        setEditingId(
                          favorite.id
                        );

                        setEditAlias(
                          favorite.alias
                          ?? ""
                        );
                      }}
                    >
                      <Pencil
                        className="
                          size-4
                        "
                      />

                      <span
                        className="
                          hidden
                          lg:inline
                        "
                      >
                        Renommer
                      </span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={
                        busyId ===
                        favorite.id
                      }
                      className="
                        rounded-xl
                        text-red-600
                        hover:bg-red-50
                        hover:text-red-700
                      "
                      onClick={() =>
                        void removeFavorite(
                          favorite.id
                        )
                      }
                    >
                      <Trash2
                        className="
                          size-4
                        "
                      />
                    </Button>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}