"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Flag,
  Home,
  MapPin,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  toast,
} from "sonner";

import {
  Badge,
} from "@/components/ui/badge";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  listOwnerClaims,
  listOwnerReports,
  OwnerApiError,
  type OwnerClaim,
  type OwnerReport,
} from "../api";


const REPORT_REASON_LABELS:
  Record<string, string> = {
    wrong_location:
      "Localisation incorrecte",
    closed:
      "Lieu fermé ou inexistant",
    damaged_beacon:
      "Balise abîmée",
    moving:
      "Déménagement",
    other:
      "Autre",
  };


const REPORT_STATUS_LABELS:
  Record<string, string> = {
    new:
      "Nouveau",
    open:
      "Ouvert",
    in_review:
      "En cours",
    resolved:
      "Résolu",
    rejected:
      "Rejeté",
  };


const CLAIM_STATUS_LABELS:
  Record<string, string> = {
    pending:
      "En attente",
    approved:
      "Approuvée",
    rejected:
      "Rejetée",
  };


function reportStatusClass(
  status: string,
) {
  switch (status) {
    case "resolved":
      return (
        "border-emerald-200 "
        + "bg-emerald-50 "
        + "text-emerald-700"
      );

    case "rejected":
      return (
        "border-rose-200 "
        + "bg-rose-50 "
        + "text-rose-700"
      );

    case "in_review":
      return (
        "border-blue-200 "
        + "bg-blue-50 "
        + "text-blue-700"
      );

    default:
      return (
        "border-amber-200 "
        + "bg-amber-50 "
        + "text-amber-700"
      );
  }
}


function claimStatusClass(
  status: string,
) {
  switch (status) {
    case "approved":
      return (
        "border-emerald-200 "
        + "bg-emerald-50 "
        + "text-emerald-700"
      );

    case "rejected":
      return (
        "border-rose-200 "
        + "bg-rose-50 "
        + "text-rose-700"
      );

    default:
      return (
        "border-amber-200 "
        + "bg-amber-50 "
        + "text-amber-700"
      );
  }
}


function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Date indisponible";
  }

  return new Date(
    value,
  ).toLocaleString(
    "fr-FR",
  );
}


export function OwnerReportsPage() {
  const [
    reports,
    setReports,
  ] = useState<
    OwnerReport[]
  >([]);

  const [
    claims,
    setClaims,
  ] = useState<
    OwnerClaim[]
  >([]);

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
              "/login?returnTo=%2Fmon-compte%2Fsignalements";

            return;
          }

          const [
            reportItems,
            claimItems,
          ] = await Promise.all([
            listOwnerReports(
              token,
              signal,
            ),
            listOwnerClaims(
              token,
              signal,
            ),
          ]);

          if (!signal?.aborted) {
            setReports(
              reportItems,
            );

            setClaims(
              claimItems,
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
              "/login?returnTo=%2Fmon-compte%2Fsignalements";

            return;
          }

          toast.error(
            error instanceof Error
              ? error.message
              : (
                  "Impossible de charger "
                  + "vos signalements."
                ),
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
          from-cyan-600
          via-blue-600
          to-indigo-600
          px-6 py-8
          text-white
          shadow-xl
          shadow-blue-900/10
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
            Mes signalements
          </h1>

          <p
            className="
              mt-2
              max-w-2xl
              text-sm
              leading-6
              text-blue-50
              sm:text-base
            "
          >
            Suivez les problèmes signalés,
            vos déménagements et vos
            réclamations d'adresse.
          </p>
        </div>
      </section>


      {loading ? (
        <div
          className="
            space-y-5
          "
        >
          {[0, 1, 2].map(
            (item) => (
              <div
                key={item}
                className="
                  h-36
                  animate-pulse
                  rounded-3xl
                  bg-slate-100
                "
              />
            ),
          )}
        </div>

      ) : (
        <>
          <section
            className="
              space-y-4
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
                  flex size-10
                  items-center
                  justify-center
                  rounded-2xl
                  bg-blue-50
                  text-blue-600
                "
              >
                <Flag
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
                  Signalements
                </h2>

                <p
                  className="
                    text-sm
                    text-slate-500
                  "
                >
                  Problèmes et changements
                  transmis à Adresse GN.
                </p>
              </div>
            </div>


            {reports.length === 0 ? (
              <div
                className="
                  rounded-3xl
                  border
                  border-dashed
                  border-slate-300
                  bg-white/70
                  px-6 py-10
                  text-center
                "
              >
                <span
                  className="
                    mx-auto
                    flex size-12
                    items-center
                    justify-center
                    rounded-2xl
                    bg-blue-50
                    text-blue-600
                  "
                >
                  <ShieldCheck
                    className="
                      size-5
                    "
                  />
                </span>

                <p
                  className="
                    mt-3
                    font-semibold
                    text-slate-800
                  "
                >
                  Aucun signalement envoyé
                </p>

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-500
                  "
                >
                  Vos futurs signalements
                  apparaîtront ici avec
                  leur état de traitement.
                </p>
              </div>

            ) : (
              <div
                className="
                  space-y-3
                "
              >
                {reports.map(
                  (report) => (
                    <article
                      key={report.id}
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
                          flex-col
                          justify-between
                          gap-3
                          sm:flex-row
                          sm:items-start
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
                            className={`
                              flex size-10
                              shrink-0
                              items-center
                              justify-center
                              rounded-2xl
                              ${
                                report.type
                                === "moving"
                                  ? (
                                      "bg-violet-50 "
                                      + "text-violet-600"
                                    )
                                  : (
                                      "bg-blue-50 "
                                      + "text-blue-600"
                                    )
                              }
                            `}
                          >
                            {report.type ===
                            "moving" ? (
                              <Home
                                className="
                                  size-5
                                "
                              />
                            ) : (
                              <AlertTriangle
                                className="
                                  size-5
                                "
                              />
                            )}
                          </span>

                          <div>
                            <p
                              className="
                                font-semibold
                                text-slate-900
                              "
                            >
                              {
                                REPORT_REASON_LABELS[
                                  report.reason
                                ]
                                ?? report.reason
                              }
                            </p>

                            {report.public_number ? (
                              <div
                                className="
                                  mt-1
                                  flex
                                  items-center
                                  gap-1.5
                                  font-mono
                                  text-xs
                                  text-slate-500
                                "
                              >
                                <MapPin
                                  className="
                                    size-3.5
                                  "
                                />

                                {
                                  report.public_number
                                }
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={
                            reportStatusClass(
                              report.status,
                            )
                          }
                        >
                          {
                            REPORT_STATUS_LABELS[
                              report.status
                            ]
                            ?? report.status
                          }
                        </Badge>
                      </div>


                      {report.description ? (
                        <p
                          className="
                            mt-4
                            text-sm
                            leading-6
                            text-slate-600
                          "
                        >
                          {
                            report.description
                          }
                        </p>
                      ) : null}


                      {report.admin_response ? (
                        <div
                          className="
                            mt-4
                            flex
                            gap-3
                            rounded-2xl
                            bg-slate-50
                            p-4
                          "
                        >
                          <MessageSquareText
                            className="
                              mt-0.5
                              size-4
                              shrink-0
                              text-blue-600
                            "
                          />

                          <div>
                            <p
                              className="
                                text-xs
                                font-semibold
                                text-slate-700
                              "
                            >
                              Réponse Adresse GN
                            </p>

                            <p
                              className="
                                mt-1
                                text-sm
                                text-slate-600
                              "
                            >
                              {
                                report.admin_response
                              }
                            </p>
                          </div>
                        </div>
                      ) : null}


                      <div
                        className="
                          mt-4
                          flex
                          items-center
                          gap-1.5
                          text-xs
                          text-slate-400
                        "
                      >
                        <Clock3
                          className="
                            size-3.5
                          "
                        />

                        {
                          formatDate(
                            report.created_at
                          )
                        }
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>


          <section
            className="
              space-y-4
              pt-2
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
                  flex size-10
                  items-center
                  justify-center
                  rounded-2xl
                  bg-violet-50
                  text-violet-600
                "
              >
                <ShieldCheck
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
                  Mes réclamations d'adresse
                </h2>

                <p
                  className="
                    text-sm
                    text-slate-500
                  "
                >
                  Demandes de reconnaissance
                  de propriété d'une Adresse GN.
                </p>
              </div>
            </div>


            {claims.length === 0 ? (
              <div
                className="
                  rounded-3xl
                  border
                  border-dashed
                  border-slate-300
                  bg-white/70
                  px-6 py-9
                  text-center
                  text-sm
                  text-slate-500
                "
              >
                Aucune réclamation d'adresse.
              </div>

            ) : (
              <div
                className="
                  space-y-3
                "
              >
                {claims.map(
                  (claim) => (
                    <article
                      key={claim.id}
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
                          flex-col
                          justify-between
                          gap-3
                          sm:flex-row
                          sm:items-start
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
                              flex size-10
                              shrink-0
                              items-center
                              justify-center
                              rounded-2xl
                              bg-violet-50
                              text-violet-600
                            "
                          >
                            {claim.status ===
                            "approved" ? (
                              <CheckCircle2
                                className="
                                  size-5
                                "
                              />

                            ) : claim.status ===
                            "rejected" ? (
                              <XCircle
                                className="
                                  size-5
                                "
                              />

                            ) : (
                              <Clock3
                                className="
                                  size-5
                                "
                              />
                            )}
                          </span>

                          <div>
                            <p
                              className="
                                font-mono
                                font-semibold
                                text-blue-700
                              "
                            >
                              {
                                claim.public_number
                                ?? "Adresse GN"
                              }
                            </p>

                            <p
                              className="
                                mt-1
                                text-xs
                                text-slate-500
                              "
                            >
                              Demande du {
                                new Date(
                                  claim.created_at,
                                ).toLocaleDateString(
                                  "fr-FR",
                                )
                              }
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={
                            claimStatusClass(
                              claim.status,
                            )
                          }
                        >
                          {
                            CLAIM_STATUS_LABELS[
                              claim.status
                            ]
                            ?? claim.status
                          }
                        </Badge>
                      </div>


                      {claim.decision_note ? (
                        <div
                          className="
                            mt-4
                            rounded-2xl
                            bg-slate-50
                            px-4 py-3
                          "
                        >
                          <p
                            className="
                              text-xs
                              font-semibold
                              text-slate-500
                            "
                          >
                            Note de décision
                          </p>

                          <p
                            className="
                              mt-1
                              text-sm
                              leading-6
                              text-slate-700
                            "
                          >
                            {
                              claim.decision_note
                            }
                          </p>
                        </div>
                      ) : null}
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}