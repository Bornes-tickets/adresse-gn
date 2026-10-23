"use client";

import {
  Camera,
  Check,
  ListChecks,
  MapPin,
  Radio,
  Sparkles,
} from "lucide-react";

import {
  cn,
} from "@/lib/utils";


const ETAPES = [
  "Balise",
  "Position",
  "Photo",
  "Détails",
  "Récapitulatif",
] as const;


const ICONS = [
  Radio,
  MapPin,
  Camera,
  ListChecks,
  Sparkles,
];


const COLORS = [
  {
    active: "from-indigo-500 to-blue-600",
    done: "from-indigo-500 to-blue-600",
  },
  {
    active: "from-emerald-500 to-teal-600",
    done: "from-emerald-500 to-teal-600",
  },
  {
    active: "from-sky-500 to-cyan-600",
    done: "from-sky-500 to-cyan-600",
  },
  {
    active: "from-violet-500 to-fuchsia-600",
    done: "from-violet-500 to-fuchsia-600",
  },
  {
    active: "from-amber-500 to-orange-600",
    done: "from-amber-500 to-orange-600",
  },
] as const;


export function AgentInstallStepIndicator({
  step,
}: {
  step: number;
}) {
  const etape =
    Math.min(
      5,
      Math.max(
        1,
        step,
      ),
    );

  const Icone =
    ICONS[
      etape - 1
    ] ?? Radio;

  const couleur =
    COLORS[
      etape - 1
    ] ?? COLORS[0]!;

  return (
    <div
      className="
        rounded-[22px]
        border
        border-slate-200/70
        bg-white/90
        p-4
        shadow-[0_8px_30px_rgba(15,23,42,0.05)]
        backdrop-blur
      "
    >

      <div className="sm:hidden">
        <div className="mb-3 flex items-center gap-3">

          <div
            className={cn(
              `
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                bg-gradient-to-br
                text-white
                shadow-lg
              `,
              couleur.active,
            )}
          >
            <Icone className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="
                text-[10px]
                font-semibold
                uppercase
                tracking-widest
                text-slate-500
              "
            >
              Étape {etape} sur {ETAPES.length}
            </div>

            <div
              className="
                text-lg
                font-bold
                text-slate-900
              "
            >
              {ETAPES[etape - 1]}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {ETAPES.map(
            (
              _label,
              index,
            ) => {
              const numero =
                index + 1;

              const color =
                COLORS[index]
                ?? COLORS[0]!;

              const atteint =
                numero <= etape;

              return (
                <div
                  key={numero}
                  className={cn(
                    `
                      h-1.5
                      flex-1
                      rounded-full
                    `,
                    atteint
                      ? cn(
                          "bg-gradient-to-r",
                          color.done,
                        )
                      : "bg-slate-200",
                  )}
                />
              );
            },
          )}
        </div>
      </div>


      <div
        className="
          hidden
          items-center
          sm:flex
        "
      >
        {ETAPES.map(
          (
            label,
            index,
          ) => {
            const numero =
              index + 1;

            const terminee =
              numero < etape;

            const active =
              numero === etape;

            const Icon =
              ICONS[index]
              ?? Radio;

            const color =
              COLORS[index]
              ?? COLORS[0]!;

            return (
              <div
                key={label}
                className="
                  flex
                  flex-1
                  items-center
                "
              >
                <div
                  className="
                    flex
                    flex-col
                    items-center
                    gap-2
                  "
                >
                  <div
                    className={cn(
                      `
                        flex
                        h-11
                        w-11
                        items-center
                        justify-center
                        rounded-xl
                        transition-all
                      `,
                      terminee
                        ? cn(
                            `
                              bg-gradient-to-br
                              text-white
                              shadow-md
                            `,
                            color.done,
                          )
                        : active
                          ? cn(
                              `
                                scale-110
                                bg-gradient-to-br
                                text-white
                                shadow-lg
                                ring-4
                                ring-slate-100
                              `,
                              color.active,
                            )
                          : `
                              bg-slate-100
                              text-slate-400
                            `,
                    )}
                  >
                    {terminee ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>

                  <span
                    className={cn(
                      `
                        whitespace-nowrap
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-wider
                      `,
                      active
                        ? "text-slate-900"
                        : terminee
                          ? "text-slate-600"
                          : "text-slate-400",
                    )}
                  >
                    {label}
                  </span>
                </div>

                {numero < ETAPES.length ? (
                  <div
                    className={cn(
                      `
                        mx-2
                        mb-6
                        h-0.5
                        flex-1
                        rounded
                      `,
                      terminee
                        ? cn(
                            "bg-gradient-to-r",
                            color.done,
                          )
                        : "bg-slate-200",
                    )}
                  />
                ) : null}
              </div>
            );
          },
        )}
      </div>

    </div>
  );
}
