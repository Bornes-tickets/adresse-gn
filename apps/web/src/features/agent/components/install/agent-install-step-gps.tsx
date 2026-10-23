"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Loader2,
  MapPin,
  Signal,
  Sparkles,
} from "lucide-react";

import type {
  AgentCompleteMeasure,
} from "@/features/agent/api";

import {
  cn,
} from "@/lib/utils";


type Props = {
  currentAccuracy: number | null;
  maxAccuracyM: number;
  measureCount: number;
  measures: AgentCompleteMeasure[];
  watching: boolean;
  capturing: boolean;
  message: string | null;
  captureDisabled: boolean;
  onStartWatch: () => void;
  onStopWatch: () => void;
  onCapture: () => void;
};


function average(
  values: number[],
) {
  if (values.length === 0) {
    return null;
  }

  return (
    values.reduce(
      (
        total,
        value,
      ) =>
        total + value,
      0,
    )
    / values.length
  );
}


export function AgentInstallStepGps({
  currentAccuracy,
  maxAccuracyM,
  measureCount,
  measures,
  watching,
  capturing,
  message,
  captureDisabled,
  onStartWatch,
  onStopWatch,
  onCapture,
}: Props) {

  const accurate =
    currentAccuracy !== null
    && currentAccuracy <= maxAccuracyM;

  const signalPercent =
    currentAccuracy === null
      ? 0
      : Math.max(
          6,
          Math.min(
            100,
            (
              maxAccuracyM
              / currentAccuracy
            )
            * 100,
          ),
        );

  const averageAccuracy =
    measures.length === measureCount
      ? average(
          measures.map(
            (
              measure,
            ) =>
              measure.accuracy_m,
          ),
        )
      : null;

  const status =
    currentAccuracy === null
      ? "Recherche du signal…"
      : accurate
        ? "Précision conforme"
        : "Précision à améliorer";


  return (
    <div className="space-y-4">

      <div
        className="
          relative
          overflow-hidden
          rounded-[28px]
          bg-gradient-to-br
          from-emerald-500
          via-teal-600
          to-cyan-600
          px-5
          py-7
          text-white
          shadow-[0_18px_50px_rgba(5,150,105,0.18)]
          sm:px-7
          sm:py-8
        "
      >
        <div
          className="
            absolute
            -right-16
            -top-20
            h-52
            w-52
            rounded-full
            bg-white/15
            blur-2xl
          "
        />

        <div
          className="
            absolute
            -bottom-24
            -left-12
            h-48
            w-48
            rounded-full
            bg-emerald-950/20
            blur-3xl
          "
        />

        <div
          className="
            relative
            flex
            flex-col
            items-center
            text-center
          "
        >
          <div
            className="
              relative
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-[22px]
              border
              border-white/20
              bg-white/15
              shadow-lg
              backdrop-blur
            "
          >
            <Compass
              className={cn(
                "h-8 w-8",
                watching
                  && currentAccuracy === null
                  && "animate-spin",
              )}
            />

            {accurate ? (
              <span
                className="
                  absolute
                  inset-0
                  rounded-[22px]
                  ring-4
                  ring-emerald-200/30
                "
              />
            ) : null}
          </div>

          <div
            className="
              mt-4
              text-[11px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-white/75
            "
          >
            {status}
          </div>

          <div
            className="
              mt-1
              font-mono
              text-4xl
              font-bold
              tracking-tight
            "
          >
            {currentAccuracy === null
              ? "—"
              : (
                  "±"
                  + currentAccuracy.toFixed(1)
                  + " m"
                )}
          </div>

          <div
            className="
              mt-4
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-white/15
              bg-white/10
              px-3.5
              py-1.5
              text-xs
              font-semibold
              text-white/90
              backdrop-blur
            "
          >
            <Signal className="h-3.5 w-3.5" />

            Objectif ≤ {maxAccuracyM.toFixed(1).replace(".", ",")} m
          </div>
        </div>
      </div>


      <div
        className="
          rounded-[24px]
          border
          border-slate-200/80
          bg-white
          p-4
          shadow-[0_12px_35px_rgba(15,23,42,0.06)]
          sm:p-5
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            gap-3
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              text-sm
              font-bold
              text-slate-800
            "
          >
            <div
              className="
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-xl
                bg-emerald-50
                text-emerald-600
              "
            >
              <Signal className="h-4 w-4" />
            </div>

            Qualité du signal
          </div>

          <div
            className={cn(
              `
                rounded-full
                px-2.5
                py-1
                text-[11px]
                font-bold
              `,
              accurate
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700",
            )}
          >
            {accurate
              ? "Prêt"
              : (
                  "≤ "
                  + maxAccuracyM.toFixed(1).replace(".", ",")
                  + " m requis"
                )}
          </div>
        </div>


        <div
          className="
            mt-4
            h-2.5
            overflow-hidden
            rounded-full
            bg-slate-100
          "
        >
          <div
            className={cn(
              `
                h-full
                rounded-full
                bg-gradient-to-r
                transition-all
                duration-500
              `,
              accurate
                ? "from-emerald-500 to-teal-500"
                : "from-amber-400 to-orange-500",
            )}
            style={{
              width:
                signalPercent
                + "%",
            }}
          />
        </div>


        <div
          className="
            mt-2
            flex
            items-center
            justify-between
            gap-2
            text-[10px]
            font-medium
            text-slate-400
          "
        >
          <span>
            Signal à stabiliser
          </span>

          <span>
            Objectif terrain ≤ {maxAccuracyM.toFixed(1).replace(".", ",")} m
          </span>
        </div>


        <div
          className="
            mt-5
            border-t
            border-slate-100
            pt-4
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-3
            "
          >
            <div>
              <div
                className="
                  text-sm
                  font-bold
                  text-slate-900
                "
              >
                Mesures GPS
              </div>

              <div
                className="
                  mt-0.5
                  text-xs
                  text-slate-500
                "
              >
                Trois acquisitions distinctes sont obligatoires.
              </div>
            </div>

            <div
              className="
                rounded-full
                bg-slate-100
                px-3
                py-1
                text-xs
                font-bold
                text-slate-700
              "
            >
              {measures.length}/{measureCount}
            </div>
          </div>


          <div
            className="
              mt-4
              grid
              grid-cols-3
              gap-2
            "
          >
            {Array.from(
              {
                length:
                  measureCount,
              },
            ).map(
              (
                _unused,
                index,
              ) => {
                const measure =
                  measures[index];

                const captured =
                  Boolean(
                    measure,
                  );

                return (
                  <div
                    key={
                      index
                    }
                    className={cn(
                      `
                        rounded-2xl
                        border
                        px-2
                        py-3
                        text-center
                      `,
                      captured
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50/70",
                    )}
                  >
                    <div
                      className={cn(
                        `
                          mx-auto
                          flex
                          h-8
                          w-8
                          items-center
                          justify-center
                          rounded-xl
                          text-xs
                          font-bold
                        `,
                        captured
                          ? "bg-emerald-500 text-white"
                          : "bg-white text-slate-500 shadow-sm",
                      )}
                    >
                      {captured ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </div>

                    <div
                      className={cn(
                        `
                          mt-2
                          text-[10px]
                          font-bold
                          uppercase
                          tracking-[0.08em]
                        `,
                        captured
                          ? "text-emerald-700"
                          : "text-slate-400",
                      )}
                    >
                      Mesure {index + 1}
                    </div>

                    <div
                      className={cn(
                        `
                          mt-0.5
                          font-mono
                          text-[11px]
                          font-semibold
                        `,
                        captured
                          ? "text-emerald-800"
                          : "text-slate-400",
                      )}
                    >
                      {measure
                        ? (
                            "±"
                            + measure.accuracy_m.toFixed(1)
                            + " m"
                          )
                        : "À capturer"}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </div>


      {message ? (
        <div
          className="
            flex
            items-start
            gap-2.5
            rounded-[18px]
            border
            border-amber-200
            bg-amber-50
            px-4
            py-3.5
            text-sm
            text-amber-900
          "
        >
          <AlertTriangle
            className="
              mt-0.5
              h-4
              w-4
              shrink-0
              text-amber-600
            "
          />

          <span>
            {message}
          </span>
        </div>
      ) : null}


      {!watching ? (
        <button
          type="button"
          onClick={
            onStartWatch
          }
          className="
            flex
            h-14
            w-full
            items-center
            justify-center
            rounded-2xl
            bg-gradient-to-r
            from-emerald-600
            to-teal-600
            px-4
            text-sm
            font-bold
            text-white
            shadow-lg
            shadow-emerald-500/15
            transition
            hover:-translate-y-0.5
            hover:from-emerald-700
            hover:to-teal-700
          "
        >
          <Signal className="mr-2 h-4 w-4" />

          Activer le GPS haute précision
        </button>
      ) : (
        <button
          type="button"
          onClick={
            onStopWatch
          }
          className="
            flex
            h-12
            w-full
            items-center
            justify-center
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-4
            text-sm
            font-bold
            text-slate-700
            shadow-sm
            transition
            hover:bg-slate-50
          "
        >
          <Signal className="mr-2 h-4 w-4 text-emerald-600" />

          Arrêter la surveillance GPS
        </button>
      )}


      <button
        type="button"
        disabled={
          captureDisabled
        }
        onClick={
          onCapture
        }
        className="
          flex
          h-14
          w-full
          items-center
          justify-center
          rounded-2xl
          bg-gradient-to-r
          from-emerald-600
          to-teal-600
          px-4
          text-sm
          font-bold
          text-white
          shadow-lg
          shadow-emerald-500/15
          transition
          enabled:hover:-translate-y-0.5
          enabled:hover:from-emerald-700
          enabled:hover:to-teal-700
          disabled:cursor-not-allowed
          disabled:from-slate-300
          disabled:to-slate-400
          disabled:shadow-none
        "
      >
        {capturing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />

            Acquisition en cours…{" "}
            {Math.min(
              measures.length + 1,
              measureCount,
            )}
            /
            {measureCount}
          </>
        ) : (
          <>
            <MapPin className="mr-2 h-5 w-5" />

            Enregistrer les {measureCount} mesures
          </>
        )}
      </button>


      {averageAccuracy !== null ? (
        <div
          className="
            flex
            items-center
            gap-3
            rounded-[20px]
            border
            border-emerald-200
            bg-gradient-to-r
            from-emerald-50
            to-teal-50
            p-4
          "
        >
          <div
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-gradient-to-br
              from-emerald-500
              to-teal-600
              text-white
              shadow-md
            "
          >
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">

            <div
              className="
                font-bold
                text-emerald-950
              "
            >
              {measureCount} mesures GPS validées
            </div>

            <div
              className="
                mt-0.5
                text-xs
                text-emerald-700
              "
            >
              Précision moyenne observée : ±
              {averageAccuracy.toFixed(1)} m
            </div>
          </div>
        </div>
      ) : null}


      <div
        className="
          flex
          items-start
          gap-3
          rounded-[20px]
          border
          border-emerald-100
          bg-gradient-to-r
          from-emerald-50/90
          via-teal-50/70
          to-cyan-50/60
          px-4
          py-3.5
          text-xs
          leading-5
          text-slate-600
        "
      >
        <div
          className="
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-white
            text-emerald-600
            shadow-sm
          "
        >
          <Sparkles className="h-4 w-4" />
        </div>

        <span>
          Placez-vous devant la plaque, à l’extérieur,
          restez immobile et privilégiez une zone dégagée
          pendant l’acquisition.
          Les {measureCount} mesures doivent chacune respecter{" "}
          <strong className="font-bold text-slate-900">
            ≤ {maxAccuracyM.toFixed(1).replace(".", ",")} m
          </strong>.
        </span>
      </div>

    </div>
  );
}
