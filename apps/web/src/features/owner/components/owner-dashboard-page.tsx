"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Activity,
  Clock3,
  MapPin,
  Navigation,
  QrCode,
  Search,
  Sparkles,
} from "lucide-react";

import {
  toast,
} from "sonner";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  cn,
} from "@/lib/utils";

import {
  getOwnerDashboard,
  type OwnerActivity,
  type OwnerDashboard,
  OwnerApiError,
} from "../api";


type KpiTone =
  | "blue"
  | "emerald"
  | "violet";


type Kpi = {
  label: string;
  helper: string;
  value: number;
  icon: typeof QrCode;
  tone: KpiTone;
};


const KPI_STYLES: Record<
  KpiTone,
  {
    card: string;
    icon: string;
    accent: string;
  }
> = {
  blue: {
    card: `
      from-blue-50
      via-white
      to-sky-50
      border-blue-100
    `,
    icon: `
      bg-blue-100
      text-blue-700
    `,
    accent: `
      bg-blue-500
    `,
  },

  emerald: {
    card: `
      from-emerald-50
      via-white
      to-cyan-50
      border-emerald-100
    `,
    icon: `
      bg-emerald-100
      text-emerald-700
    `,
    accent: `
      bg-emerald-500
    `,
  },

  violet: {
    card: `
      from-violet-50
      via-white
      to-purple-50
      border-violet-100
    `,
    icon: `
      bg-violet-100
      text-violet-700
    `,
    accent: `
      bg-violet-500
    `,
  },
};


function LoadingValue() {
  return (
    <div
      className="
        h-9 w-16
        animate-pulse
        rounded-lg
        bg-slate-200
      "
    />
  );
}


function ActivityIcon({
  activity,
}: {
  activity: OwnerActivity;
}) {
  const label =
    activity.label.toLowerCase();

  const isGoogle =
    label.includes(
      "(google)",
    );

  const isWaze =
    label.includes(
      "(waze)",
    );

  const isRoute =
    label.includes(
      "itinéraire",
    );

  return (
    <span
      className={cn(
        `
          flex size-11
          shrink-0
          items-center
          justify-center
          rounded-xl
        `,
        isGoogle
          ? `
              bg-blue-50
              text-blue-600
            `
          : isWaze
            ? `
                bg-cyan-50
                text-cyan-700
              `
            : isRoute
              ? `
                  bg-indigo-50
                  text-indigo-600
                `
              : `
                  bg-violet-50
                  text-violet-600
                `,
      )}
    >
      {isGoogle ? (
        <MapPin
          className="
            size-5
          "
        />
      ) : isRoute ? (
        <Navigation
          className="
            size-5
          "
        />
      ) : (
        <Search
          className="
            size-5
          "
        />
      )}
    </span>
  );
}


export function OwnerDashboardPage() {
  const [
    data,
    setData,
  ] = useState<
    OwnerDashboard | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);


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
              "/login?returnTo=%2Fmon-compte";

            return;
          }

          const dashboard =
            await getOwnerDashboard(
              token,
              signal,
            );

          if (
            !signal?.aborted
          ) {
            setData(
              dashboard,
            );
          }

        } catch (error) {
          if (
            signal?.aborted
          ) {
            return;
          }

          if (
            error instanceof
              OwnerApiError &&
            error.statusCode ===
              401
          ) {
            window.location.href =
              "/login?returnTo=%2Fmon-compte";

            return;
          }

          toast.error(
            error instanceof Error
              ? error.message
              : (
                  "Impossible de charger "
                  + "le tableau de bord."
                ),
          );

        } finally {
          if (
            !signal?.aborted
          ) {
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


  const kpis: Kpi[] = [
    {
      label:
        "Balises possédées",
      helper:
        "Adresses associées à votre compte",
      value:
        data?.beaconCount ?? 0,
      icon:
        QrCode,
      tone:
        "blue",
    },
    {
      label:
        "Recherches (30 j)",
      helper:
        "Consultations sur vos adresses",
      value:
        data?.searches30d ?? 0,
      icon:
        Search,
      tone:
        "emerald",
    },
    {
      label:
        "Itinéraires (30 j)",
      helper:
        "Lancements vers vos adresses",
      value:
        data?.routes30d ?? 0,
      icon:
        Navigation,
      tone:
        "violet",
    },
  ];


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
          from-blue-600
          via-indigo-600
          to-violet-600
          px-6 pb-7 pt-10
          text-white
          shadow-xl
          shadow-indigo-900/10
          sm:px-8
        "
      >
        <div
          className="
            pointer-events-none
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
            pointer-events-none
            absolute
            bottom-[-90px]
            right-[18%]
            size-56
            rounded-full
            bg-cyan-300/15
            blur-3xl
          "
        />

        <div
          className="
            relative
            flex flex-col
            justify-between
            gap-6
            lg:flex-row
            lg:items-end
          "
        >
          <div>
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
                text-blue-50
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
              Tableau de bord
            </h1>

            <p
              className="
                mt-2
                max-w-2xl
                text-sm
                leading-6
                text-blue-100
                sm:text-base
              "
            >
              Suivez l’activité des 30 derniers jours
              sur vos adresses Adresse GN.
            </p>
          </div>

          <div
            className="
              flex
              items-center
              gap-3
              rounded-2xl
              border
              border-white/15
              bg-white/10
              px-4 py-3
              backdrop-blur
            "
          >
            <MapPin
              className="
                size-5
                text-cyan-200
              "
            />

            <div>
              <p
                className="
                  text-[11px]
                  font-semibold
                  uppercase
                  tracking-[0.16em]
                  text-blue-200
                "
              >
                Adresse GN
              </p>

              <p
                className="
                  mt-0.5
                  text-sm
                  font-medium
                  text-white
                "
              >
                Vos adresses en un coup d’œil
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="
          grid
          grid-cols-1
          gap-4
          lg:grid-cols-3
        "
      >
        {kpis.map(
          ({
            label,
            helper,
            value,
            icon: Icon,
            tone,
          }) => {
            const style =
              KPI_STYLES[tone];

            return (
              <article
                key={label}
                className={cn(
                  `
                    group
                    relative
                    overflow-hidden
                    rounded-2xl
                    border
                    bg-gradient-to-br
                    p-5
                    shadow-sm
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    hover:shadow-lg
                  `,
                  style.card,
                )}
              >
                <div
                  className={cn(
                    `
                      absolute
                      inset-x-0
                      top-0
                      h-1
                    `,
                    style.accent,
                  )}
                />

                <div
                  className="
                    flex
                    items-start
                    justify-between
                    gap-4
                  "
                >
                  <div>
                    {loading ? (
                      <LoadingValue />
                    ) : (
                      <p
                        className="
                          text-4xl
                          font-bold
                          tracking-tight
                          text-slate-950
                        "
                      >
                        {value}
                      </p>
                    )}

                    <p
                      className="
                        mt-1
                        text-sm
                        font-semibold
                        text-slate-800
                      "
                    >
                      {label}
                    </p>
                  </div>

                  <span
                    className={cn(
                      `
                        flex size-12
                        shrink-0
                        items-center
                        justify-center
                        rounded-2xl
                        transition-transform
                        duration-200
                        group-hover:scale-105
                      `,
                      style.icon,
                    )}
                  >
                    <Icon
                      className="
                        size-6
                      "
                    />
                  </span>
                </div>

                <div
                  className="
                    mt-5
                    flex
                    items-center
                    gap-2
                    border-t
                    border-slate-200/70
                    pt-4
                  "
                >
                  <Activity
                    className="
                      size-4
                      text-slate-400
                    "
                  />

                  <span
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    {helper}
                  </span>
                </div>
              </article>
            );
          },
        )}
      </section>

      <section
        className="
          overflow-hidden
          rounded-3xl
          border
          border-slate-200/80
          bg-white
          shadow-sm
        "
      >
        <header
          className="
            flex
            items-center
            justify-between
            gap-4
            border-b
            border-slate-100
            px-5 py-5
            sm:px-6
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <span
              className="
                flex size-11
                items-center
                justify-center
                rounded-2xl
                bg-gradient-to-br
                from-blue-50
                to-indigo-100
                text-indigo-600
              "
            >
              <Clock3
                className="
                  size-5
                "
              />
            </span>

            <div>
              <h2
                className="
                  text-base
                  font-bold
                  text-slate-950
                  sm:text-lg
                "
              >
                Dernières activités
              </h2>

              <p
                className="
                  mt-0.5
                  text-xs
                  text-slate-500
                  sm:text-sm
                "
              >
                Les dernières interactions sur vos adresses.
              </p>
            </div>
          </div>

          {!loading &&
            data?.activities.length ? (
              <span
                className="
                  hidden
                  rounded-full
                  bg-slate-100
                  px-3 py-1.5
                  text-xs
                  font-medium
                  text-slate-500
                  sm:inline-flex
                "
              >
                {data.activities.length} dernières
              </span>
            ) : null}
        </header>

        <div
          className="
            px-3 py-2
            sm:px-4
          "
        >
          {loading && (
            <div
              className="
                space-y-2
                py-2
              "
            >
              {[0, 1, 2].map(
                (item) => (
                  <div
                    key={item}
                    className="
                      h-[72px]
                      animate-pulse
                      rounded-2xl
                      bg-slate-100
                    "
                  />
                ),
              )}
            </div>
          )}

          {!loading &&
            !data?.activities.length && (
              <div
                className="
                  flex
                  flex-col
                  items-center
                  justify-center
                  px-4 py-14
                  text-center
                "
              >
                <span
                  className="
                    flex size-14
                    items-center
                    justify-center
                    rounded-2xl
                    bg-slate-100
                    text-slate-400
                  "
                >
                  <Clock3
                    className="
                      size-6
                    "
                  />
                </span>

                <p
                  className="
                    mt-4
                    text-sm
                    font-semibold
                    text-slate-700
                  "
                >
                  Aucune activité récente
                </p>

                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >
                  Les recherches et itinéraires apparaîtront ici.
                </p>
              </div>
            )}

          {data?.activities.map(
            (
              activity,
              index,
            ) => (
              <div
                key={
                  `${activity.at}-${index}`
                }
                className="
                  group flex
                  flex-col
                  gap-3
                  rounded-2xl
                  border-b
                  border-slate-100
                  px-3 py-3.5
                  transition-colors
                  last:border-b-0
                  hover:bg-slate-50
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                  sm:px-4
                "
              >
                <div
                  className="
                    flex
                    min-w-0
                    items-center
                    gap-3
                  "
                >
                  <ActivityIcon
                    activity={activity}
                  />

                  <div
                    className="
                      min-w-0
                    "
                  >
                    <p
                      className="
                        truncate
                        text-sm
                        font-semibold
                        text-slate-900
                      "
                    >
                      {activity.label}
                    </p>

                    <p
                      className="
                        mt-1
                        truncate
                        font-mono
                        text-xs
                        font-medium
                        tracking-wide
                        text-slate-500
                      "
                    >
                      {activity.detail}
                    </p>
                  </div>
                </div>

                <div
                  className="
                    flex
                    shrink-0
                    items-center
                    gap-2
                    pl-14
                    text-xs
                    font-medium
                    text-slate-500
                    sm:pl-0
                  "
                >
                  <Clock3
                    className="
                      size-3.5
                      text-slate-400
                    "
                  />

                  {new Date(
                    activity.at,
                  ).toLocaleString(
                    "fr-FR",
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
