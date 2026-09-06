"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  CalendarDays,
  CreditCard,
  Download,
  MapPin,
  Package,
  Receipt,
  Sparkles,
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
  listOwnerOrders,
  type OwnerOrder,
  OwnerApiError,
} from "../api";


const ORDER_LABELS:
  Record<string, string> = {
    pending:
      "En attente de paiement",
    paid:
      "Payée",
    cancelled:
      "Annulée",
    refunded:
      "Remboursée",

    // Défensif uniquement pour les anciennes interfaces.
    failed:
      "Échouée",
  };


const PAYMENT_LABELS:
  Record<string, string> = {
    pending:
      "En attente",
    success:
      "Confirmé",
    failed:
      "Échoué",
    refunded:
      "Remboursé",
  };


const PROVIDER_LABELS:
  Record<string, string> = {
    orange:
      "Orange Money",
    mtn:
      "MTN Mobile Money",
    card:
      "Carte bancaire",
    cash:
      "Espèces",
    transfer:
      "Virement",
  };


const SITE_STATUS_LABELS:
  Record<string, string> = {
    pending:
      "En attente",
    assigned:
      "Affecté",
    planned:
      "Planifié",
    in_progress:
      "En cours",
    installed:
      "Installé",
    completed:
      "Terminé",
    cancelled:
      "Annulé",
  };


function formatGnf(
  value: number,
) {
  return (
    `${value.toLocaleString(
      "fr-FR"
    )} GNF`
  );
}


function orderStatusClass(
  status: string,
) {
  switch (status) {
    case "paid":
      return (
        "border-emerald-200 "
        + "bg-emerald-50 "
        + "text-emerald-700"
      );

    case "cancelled":
      return (
        "border-slate-200 "
        + "bg-slate-100 "
        + "text-slate-600"
      );

    case "refunded":
      return (
        "border-violet-200 "
        + "bg-violet-50 "
        + "text-violet-700"
      );

    default:
      return (
        "border-amber-200 "
        + "bg-amber-50 "
        + "text-amber-700"
      );
  }
}


function planLabel(
  order: OwnerOrder,
) {
  return (
    order.plan?.label
    || order.offer_code
  );
}


export function OwnerOrdersPage() {
  const [
    orders,
    setOrders,
  ] = useState<
    OwnerOrder[]
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
              "/login?returnTo=%2Fmon-compte%2Fcommandes";

            return;
          }

          const result =
            await listOwnerOrders(
              token,
              signal,
            );

          if (!signal?.aborted) {
            setOrders(
              result,
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
              "/login?returnTo=%2Fmon-compte%2Fcommandes";

            return;
          }

          toast.error(
            error instanceof Error
              ? error.message
              : (
                  "Impossible de charger "
                  + "vos commandes."
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
          from-amber-500
          via-orange-500
          to-rose-500
          px-6 py-8
          text-white
          shadow-xl
          shadow-orange-900/10
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
            Mes commandes
          </h1>

          <p
            className="
              mt-2
              max-w-2xl
              text-sm
              leading-6
              text-orange-50
              sm:text-base
            "
          >
            Suivez vos offres Adresse GN,
            leurs adresses concernées,
            leur paiement et vos factures.
          </p>
        </div>
      </section>


      {loading ? (
        <div
          className="
            space-y-4
          "
        >
          {[0, 1].map(
            (item) => (
              <div
                key={item}
                className="
                  h-64
                  animate-pulse
                  rounded-3xl
                  bg-slate-100
                "
              />
            ),
          )}
        </div>

      ) : orders.length === 0 ? (
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
              bg-orange-50
              text-orange-600
            "
          >
            <Package
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
            Aucune commande
          </h2>

          <p
            className="
              mt-1
              max-w-md
              text-sm
              text-slate-500
            "
          >
            Vous n'avez encore passé
            aucune commande Adresse GN.
          </p>
        </section>

      ) : (
        <div
          className="
            space-y-5
          "
        >
          {orders.map(
            (order) => (
              <article
                key={order.id}
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
                    flex-col
                    justify-between
                    gap-4
                    border-b
                    border-slate-100
                    bg-gradient-to-r
                    from-slate-50
                    to-orange-50/40
                    px-5 py-5
                    sm:flex-row
                    sm:items-center
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
                        shrink-0
                        items-center
                        justify-center
                        rounded-2xl
                        bg-orange-100
                        text-orange-700
                      "
                    >
                      <Receipt
                        className="
                          size-5
                        "
                      />
                    </span>

                    <div>
                      <p
                        className="
                          font-mono
                          text-base
                          font-bold
                          text-slate-950
                        "
                      >
                        {order.order_ref}
                      </p>

                      <div
                        className="
                          mt-1
                          flex
                          items-center
                          gap-1.5
                          text-xs
                          text-slate-500
                        "
                      >
                        <CalendarDays
                          className="
                            size-3.5
                          "
                        />

                        {order.created_at
                          ? new Date(
                              order.created_at,
                            ).toLocaleString(
                              "fr-FR",
                            )
                          : "Date indisponible"}
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={
                      orderStatusClass(
                        order.status,
                      )
                    }
                  >
                    {
                      ORDER_LABELS[
                        order.status
                      ]
                      ?? order.status
                    }
                  </Badge>
                </header>


                <div
                  className="
                    space-y-5
                    px-5 py-5
                    sm:px-6
                  "
                >
                  <section>
                    <p
                      className="
                        text-[11px]
                        font-semibold
                        uppercase
                        tracking-[0.14em]
                        text-slate-400
                      "
                    >
                      Offre
                    </p>

                    <div
                      className="
                        mt-2
                        flex
                        flex-wrap
                        items-center
                        gap-2
                      "
                    >
                      <p
                        className="
                          font-semibold
                          text-slate-900
                        "
                      >
                        {planLabel(
                          order
                        )}
                      </p>

                      {order.plan?.active ===
                      false ? (
                        <Badge
                          variant="secondary"
                        >
                          Offre historique
                        </Badge>
                      ) : null}
                    </div>
                  </section>


                  {order.items.length > 0 ? (
                    <section
                      className="
                        rounded-2xl
                        bg-slate-50
                        p-4
                      "
                    >
                      <p
                        className="
                          mb-3
                          text-xs
                          font-semibold
                          text-slate-500
                        "
                      >
                        Détail
                      </p>

                      <div
                        className="
                          space-y-2
                        "
                      >
                        {order.items.map(
                          (
                            item,
                            index,
                          ) => (
                            <div
                              key={
                                `${item.ref}-${index}`
                              }
                              className="
                                flex
                                justify-between
                                gap-4
                                text-sm
                              "
                            >
                              <span
                                className="
                                  text-slate-700
                                "
                              >
                                {
                                  item.label
                                  || item.ref
                                  || "Ligne"
                                }

                                {item.qty > 1
                                  ? ` × ${item.qty}`
                                  : ""}
                              </span>

                              <span
                                className="
                                  shrink-0
                                  font-mono
                                  font-medium
                                  text-slate-900
                                "
                              >
                                {formatGnf(
                                  item.unit_price_gnf
                                  * item.qty,
                                )}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </section>

                  ) : (
                    <section
                      className="
                        rounded-2xl
                        border
                        border-amber-100
                        bg-amber-50/50
                        px-4 py-3
                      "
                    >
                      <p
                        className="
                          text-sm
                          font-medium
                          text-amber-900
                        "
                      >
                        Commande historique
                      </p>

                      <p
                        className="
                          mt-1
                          text-xs
                          leading-5
                          text-amber-700
                        "
                      >
                        Le détail des lignes
                        n'était pas enregistré
                        pour cette ancienne commande.
                        Le montant total d'origine
                        est conservé ci-dessous.
                      </p>
                    </section>
                  )}


                  {order.sites.length > 0 ? (
                    <section
                      className="
                        space-y-2
                      "
                    >
                      <p
                        className="
                          text-xs
                          font-semibold
                          text-slate-500
                        "
                      >
                        {
                          order.sites.length === 1
                            ? "Adresse concernée"
                            : "Adresses concernées"
                        }
                      </p>

                      {order.sites.map(
                        (site) => (
                          <div
                            key={site.id}
                            className="
                              flex
                              flex-col
                              gap-2
                              rounded-2xl
                              border
                              border-slate-100
                              bg-white
                              px-4 py-3
                              sm:flex-row
                              sm:items-center
                              sm:justify-between
                            "
                          >
                            <div
                              className="
                                flex
                                items-start
                                gap-3
                              "
                            >
                              <MapPin
                                className="
                                  mt-0.5
                                  size-4
                                  shrink-0
                                  text-orange-500
                                "
                              />

                              <div>
                                <p
                                  className="
                                    text-sm
                                    font-medium
                                    text-slate-800
                                  "
                                >
                                  {
                                    site.place_name
                                    || site.address_line
                                    || `Adresse ${site.sequence_no}`
                                  }
                                </p>

                                {site.place_name &&
                                site.address_line ? (
                                  <p
                                    className="
                                      mt-0.5
                                      text-xs
                                      text-slate-500
                                    "
                                  >
                                    {
                                      site.address_line
                                    }
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <span
                              className="
                                text-xs
                                font-medium
                                text-slate-500
                              "
                            >
                              {
                                SITE_STATUS_LABELS[
                                  site.status
                                ]
                                ?? site.status
                              }
                            </span>
                          </div>
                        ),
                      )}
                    </section>
                  ) : null}


                  {order.payment ? (
                    <section
                      className="
                        flex
                        flex-wrap
                        items-center
                        gap-2
                        rounded-2xl
                        bg-blue-50/60
                        px-4 py-3
                      "
                    >
                      <CreditCard
                        className="
                          size-4
                          text-blue-600
                        "
                      />

                      <span
                        className="
                          text-sm
                          font-medium
                          text-blue-900
                        "
                      >
                        {
                          order.payment.provider
                            ? (
                                PROVIDER_LABELS[
                                  order.payment.provider
                                ]
                                ?? order.payment.provider
                              )
                            : "Paiement"
                        }
                      </span>

                      <span
                        className="
                          text-xs
                          text-blue-700
                        "
                      >
                        ·
                        {" "}
                        {
                          PAYMENT_LABELS[
                            order.payment.status
                          ]
                          ?? order.payment.status
                        }
                      </span>
                    </section>
                  ) : null}


                  <footer
                    className="
                      flex
                      flex-col
                      justify-between
                      gap-4
                      border-t
                      border-slate-100
                      pt-5
                      sm:flex-row
                      sm:items-center
                    "
                  >
                    <div>
                      <p
                        className="
                          text-xs
                          text-slate-500
                        "
                      >
                        Montant total
                      </p>

                      <p
                        className="
                          mt-1
                          font-mono
                          text-xl
                          font-bold
                          text-orange-600
                        "
                      >
                        {formatGnf(
                          order.amount_gnf
                        )}
                      </p>
                    </div>


                    {order.invoice?.pdf_url ? (
                      <a
                        href={
                          order.invoice.pdf_url
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="
                          inline-flex
                          h-10
                          items-center
                          justify-center
                          gap-2
                          rounded-xl
                          border
                          border-slate-200
                          bg-white
                          px-4
                          text-sm
                          font-medium
                          text-slate-700
                          shadow-sm
                          transition
                          hover:border-orange-200
                          hover:bg-orange-50
                          hover:text-orange-700
                        "
                      >
                        <Download
                          className="
                            size-4
                          "
                        />

                        Facture {
                          order.invoice.number
                        }
                      </a>

                    ) : (
                      <p
                        className="
                          max-w-sm
                          text-xs
                          leading-5
                          text-slate-500
                          sm:text-right
                        "
                      >
                        Facture disponible
                        après confirmation
                        du paiement.
                      </p>
                    )}
                  </footer>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}